---
layout: post
title: "GitHub Actions を使って AWS SAM をデプロイしてみる"
slug: deploy-aws-sam-with-github-actions
date: 2022-01-02 17:23:00 +0900
comments: true
categories: [aws]
---

[dependabot](https://docs.github.com/en/code-security/supply-chain-security/keeping-your-dependencies-updated-automatically) を使って
依存ライブラリの更新に追従しているのですが、
API のようなデプロイが必要なものは当然ながらデプロイしないと意味がありません。
今までは手元でデプロイしてきましたが、いい加減面倒になったので GitHub Actions を使った自動化をしてみました。

とりあえずお試しで [shogo82148/holidays-jp](https://github.com/shogo82148/holidays-jp) にワークフローを設定してみました。
[AWS SAM](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html) を使った API で、
データーベースや外部サービスとの連携のないシンプルなものです。
API 自体の使い方はこちらをどうぞ。

- [祝日 API を公開しました](https://shogo82148.github.io/blog/2021/09/04/holidays-api-is-released/)

## 単純にデプロイした場合の問題点

GitHub Actions の環境にはすでに AWS CLI, AWS SAM CLI, Go 等々ビルドに必要なものはすでにインストールされています。
あとは **「適切な権限を設定」** すればデプロイ自体は直ぐにできます。
ただまあ、この「適切な権限を設定」が一番の難所なので今まで二の足を踏んでいたわけです。

AWS SAM で作成した API は [AWS Lambda](https://aws.amazon.com/jp/lambda/) によって実行されるのですが、
Lambda 関数に適切な権限を渡すために [IAM Role](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html) を作成する必要があります。
つまり SAM アプリケーションのデプロイには「IAM を操作する権限」というかなり強力な権限を GitHub Actions に渡さなければなりません。

例えば GitHub Actions からデプロイ用 IAM ユーザーのアクセスキーが漏れたとしましょう。
IAM ユーザー自体の権限を最小限に絞っていたとしても、アクセスキーを入手した人は「IAM を操作する権限」を使って「AWS アカウントのすべての操作が可能な管理者ユーザー」を作ることができてしまいます。
いわゆる **権限昇格の脆弱性** です。
「管理者ユーザー」さえ作ってしまえば、EC2 のインスタンスを大量にたてて仮想通貨のマイニングをしたり、S3 から情報を抜き取ったりと、デプロイとは無関係のことも何でもできてしまいます。

ようするに「IAM を操作する権限」を付与するということは「AWS アカウントの管理者権限」を付与するのとほぼ同義です。
GitHub Actions 自体のセキュリティが万全であったとしても、万が一を考えると気軽に渡せるものではないですよね。

## 対策

「万が一」のことばかり考えて自動化から逃げていると手作業が増えて大変になっていくばかりなので、
許容可能な範囲にリスクを低減することを考えましょう。
以下の 3 つの対策を行いました。

- Permissions boundaries の設定
- AWS CloudFormation service role の利用
- OpenID Connect を用いた一時的なアクセストークン発行

### Permissions boundaries の設定

まずは一番の問題である権限昇格への対応です。
Permissions boundaries (アクセス許可の境界) の設定です。

- [Permissions boundaries for IAM entities](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_boundaries.html)

なんか難しそうですね・・・ええ、実際 **かなり** 難しいです。
アレコレ説明するよりも具体的な設定を見ながらのほうがわかりやすいと思うので、早速設定を見ていきましょう。

Permissions boundaries と難しそうな名前がついていますが、実体はただの IAM ポリシーです。
以下は AWS Lambda の実行ロールに付与した Permissions boundaries の CloudFormation テンプレートです。
API の動作に必要な CloudWatch Logs と System Manager だけを許可して、 `holidays-jp-permission-boundary-ap-northeast-1` という名前をつけました。
通常の IAM ポリシーと何も変わらないですね。

- [cicd.yaml#L6-L20](https://github.com/shogo82148/holidays-jp/blob/b36054872de0ba3a44a78a2e80d5ed21b54fcbca/cicd.yaml#L6-L20)

```yaml
# Permission Boundary for Roles
PermissionsBoundary:
  Type: AWS::IAM::ManagedPolicy
  Properties:
    Description: Permission Boundary for holidays-jp Roles
    ManagedPolicyName: !Sub "holidays-jp-permissions-boundary-${AWS::Region}"
    PolicyDocument:
      Version: "2012-10-17"
      Statement:
        - Sid: ServiceBoundaries
          Effect: Allow
          Action:
            - "logs:*"
            - "ssm:*"
          Resource: "*"
```

実際に利用しているのが SAM テンプレートの以下の部分です。

- [template.yaml#L6-L9](https://github.com/shogo82148/holidays-jp/blob/b36054872de0ba3a44a78a2e80d5ed21b54fcbca/template.yaml#L6-L9)

```yaml
Globals:
  Function:
    Timeout: 5
    PermissionsBoundary: !Sub "arn:aws:iam::${AWS::AccountId}:policy/holidays-jp-permissions-boundary-ap-northeast-1"
```

`Globals` セクションの `Function.PermissionsBoundary` に設定することで、このテンプレート内で管理しているすべての IAM ロールに
`PermissionsBoundary` の設定が適用されます。
これによって AWS Lambda の権限を `holidays-jp-permissions-boundary-ap-northeast-1` に書いた設定で制限することができます。
今回の例では CloudWatch Logs と System Manager へのアクセスだけが許可され、他のサービスへのアクセスは (暗黙的に) 拒否されます。

ここまでなら「普通に IAM ロールのインラインポリシーやマネージドポリシーに設定追加するのと一緒だよね？」という話になりますよね。

そのとおり、Permissions boundaries が設定された IAM ロールをただ利用するだけであればメリットはありません。
Permissions boundaries が活きてくるのは「IAM ロールを作成するとき」です。
AWS Lambda の作成を行う「CloudFormation でデプロイを行うためのロール」を見てみましょう。注目すべきなのはこの部分です。

- [cicd.yaml#L36-L53](https://github.com/shogo82148/holidays-jp/blob/b36054872de0ba3a44a78a2e80d5ed21b54fcbca/cicd.yaml#L36-L53)

```yaml
Policies:
  - PolicyName: deploy-sam-templates
    PolicyDocument:
      Version: "2012-10-17"
      Statement:
        - Sid: CreateOrChangeOnlyWithBoundary
          Effect: Allow
          Action:
            - "iam:CreateRole"
            - "iam:PutRolePolicy"
            - "iam:AttachRolePolicy"
            - "iam:DetachRolePolicy"
            - "iam:DeleteRolePolicy"
            - "iam:PutRolePermissionsBoundary"
          Resource: "*"
          Condition:
            StringEquals:
              "iam:PermissionsBoundary": !Ref PermissionsBoundary
```

IAM ポリシーの `Condition` (条件) 要素に `iam:PermissionsBoundary` を指定しています。
こうすることで IAM ロール作成時(`iam:CreateRole`)に `PermissionsBoundary` の設定を強制することができます。
`PermissionsBoundary` の設定をせずに IAM ロールを作成すると、以下のようにエラーを吐いて失敗します。

> iam:CreateRole User: arn:aws:sts::445285296882:assumed-role/holidays-jp-cfn-service-role-ap-northeast-1/AWSCloudFormation is not authorized to perform: iam:CreateRole on resource: arn:aws:iam::445285296882:role/holidays-jp-AdminRole-LUUBFXRI6WMS

これにより Permissions boundaries より広い範囲の権限を持つ IAM ロールは作成できなくなります。
今回であれば CloudWatch Logs と System Manager 以外のサービスにアクセスする IAM ロールは作成できず、
権限の昇格を防ぐことができます。

・・・と思いたいんですが、実は 「IAM ロール新規作成」だけ塞いだのでは不十分です。
いろんな穴を塞ぎつつ、必要な IAM ロールを作るために最終的には以下のようなルールを書きました。

- IAM ロール新規作成時に `PermissionsBoundary` の設定を強制する
  - `iam:CreateRole` アクションの `Condition` 要素
- 既存の IAM ロール(主に自分自身)の権限を書き換えて昇格するのを防ぐ
  - `iam:PutRolePolicy`, `iam:AttachRolePolicy`, `iam:DetachRolePolicy`, `iam:DeleteRolePolicy` アクションの `Condition` 要素
- 既存の IAM ロールに `PermissionsBoundary` を新たに設定するのは許可する
  - `iam:PutRolePermissionsBoundary` アクションの許可
- Permissions boundaries を更新して昇格するのを防ぐ
- 一回 `PermissionsBoundary` を設定したあとに削除して設定を無効化するのを防ぐ
- その他の IAM ロールに関連する操作は許可
- 一般的な SAM テンプレートの範囲なら IAM ユーザ や IAM グループを利用することはないので、それらの操作は禁止
- 加えて SAM のリソース作成に必要な IAM 以外の権限
  - AWS Lambda, API Gateway など

対応する CloudFormation のテンプレートは以下の部分です。

- [cicd.yaml#L36-L103](https://github.com/shogo82148/holidays-jp/blob/6638af346b1e7c28c1cb92fdedd36f047ddbefb1/cicd.yaml#L36-L103)

```yaml
Policies:
  - PolicyName: deploy-sam-templates
    PolicyDocument:
      Version: "2012-10-17"
      Statement:
        - Sid: CreateOrChangeOnlyWithBoundary
          Effect: Allow
          Action:
            - "iam:CreateRole"
            - "iam:PutRolePolicy"
            - "iam:AttachRolePolicy"
            - "iam:DetachRolePolicy"
            - "iam:DeleteRolePolicy"
            - "iam:PutRolePermissionsBoundary"
          Resource: "*"
          Condition:
            StringEquals:
              "iam:PermissionsBoundary": !Ref DeploymentPolicy
        - Sid: NoBoundaryPolicyEdit
          Effect: Deny
          Action:
            - "iam:CreatePolicyVersion"
            - "iam:DeletePolicy"
            - "iam:DeletePolicyVersion"
            - "iam:SetDefaultPolicyVersion"
          Resource:
            - !Ref DeploymentPolicy
        - Sid: NoBoundaryRoleDelete
          Effect: Deny
          Action:
            - "iam:DeleteRolePermissionsBoundary"
          Resource: "*"
        - Sid: OtherIAMTasks
          Effect: Allow
          Resource: "*"
          Action:
            # handle IAM Roles
            - "iam:ListRolePolicies"
            - "iam:ListRoleTags"
            - "iam:ListRoles"
            - "iam:GetRole"
            - "iam:GetRolePolicy"
            - "iam:ListAttachedRolePolicies"
            - "iam:UpdateRole"
            - "iam:UpdateRoleDescription"
            - "iam:UpdateAssumeRolePolicy"
            - "iam:TagRole"
            - "iam:UntagRole"
            - "iam:DeleteRole"

            # handle Service Linked Roles
            - "iam:ListPoliciesGrantingServiceAccess"
            - "iam:CreateServiceLinkedRole"
            - "iam:DeleteServiceLinkedRole"
            - "iam:GetServiceLinkedRoleDeletionStatus"

        - Sid: CloudFormationStackOperation
          Effect: Allow
          Action:
            - "cloudformation:*"
            - "lambda:*"
            - "route53:*"
            - "acm:*"
            - "apigateway:*"
            - "s3:*"
            - "events:*"
          Resource:
            - "*"
```

・・・これで全部塞いだつもりなんですが自信がないので、間違いに気がついた人はこっそり教えて下さい。

Permissions boundaries やデプロイ用 IAM ロールを GitHub Actions から書き換えできてしまったら自由に権限昇格できてしまって意味がないので、
これらは別スタックで僕自身の権限を使って作成、 GitHub Actions からは変更禁止にします。

これは Permissions boundaries の更新を自動化できなくなると言うことですが、
更新が必要な場合はどうせ手作業で動作確認をするので問題にはならないでしょう。

### AWS CloudFormation service role の利用

CloudFormation が AWS リソースの操作を行う際は、特に何も指定しなければ CloudFormation の操作を行ったユーザの権限が使用されます。
ここで[AWS CloudFormation service role](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-iam-servicerole.html) という機能を使うと、
リソースの操作に指定した IAM ロールの権限を使ってくれます。

SAM CLI では設定ファイル `samconfig.toml` に `role_arn` という項目があるので、ここにリソース操作用のロールを指定します。

- [samconfig.toml#L6](https://github.com/shogo82148/holidays-jp/blob/b36054872de0ba3a44a78a2e80d5ed21b54fcbca/samconfig.toml#L6)

```toml
role_arn = "arn:aws:iam::445285296882:role/holidays-jp-cfn-service-role-ap-northeast-1"
```

これの何が嬉しいかというと、 「GitHub Actions に IAM ロールを直接操作する権限を渡さなくて良い」という点です。
例えば先程の「CloudFormation でデプロイを行うためのロール」のポリシーには、SAM アプリケーションをデプロイするために AWS Lambda や API Gateway へのアクセス許可があります。
しかし 操作の対象となる AWS リソースの Arn は事前に分からないので、 `Resource` 要素を適切に設定することができません。
このままでは既存の Lambda 関数や API を変更・削除することができてしまいます。
それはちょっと怖い。

そこで AWS CloudFormation service role を使って「CloudFormation のスタック操作を行うロール」と「実際に AWS リソースの操作を行うロール」を分けます。
「CloudFormation のスタック操作を行うロール」は IAM ロールへ直接アクセスすることはできず、CloudFormation スタックの操作を介して操作をすることになります。
CloudFormation では基本的にスタックの外にあるリソースは操作できないので、こうすることによって「既存の Lambda 関数を変更する」といった操作はできなくなります。
CloudFormation スタックの操作を介することによって、既存のリソースを保護し、SAM CLI によって作成されたリソースのアクセスのみに限定することができるわけです。

「CloudFormation のスタック操作を行うロール」 には以下の権限が必要です。

- 「実際に AWS リソースの操作を行うロール」 に操作を移譲するための権限
- CloudFormation のスタックを操作する権限
- CloudFormation テンプレートや Lambda 関数のコードを S3 にアップロードするための権限

CloudFormation テンプレートの対応する箇所は以下のとおりです。

- [cicd.yaml#L127-L155](https://github.com/shogo82148/holidays-jp/blob/6638af346b1e7c28c1cb92fdedd36f047ddbefb1/cicd.yaml#L127-L155)

```yaml
Policies:
  - PolicyName: SAMDeployment
    PolicyDocument:
      Version: "2012-10-17"
      Statement:
        - Sid: CloudFormationOperation
          Effect: Allow
          Action:
            - "iam:PassRole"
          Resource: !GetAtt DeploymentRole.Arn
        - Sid: CloudFormationStackOperation
          Effect: Allow
          Action:
            - "cloudformation:*"
          Resource:
            - !Sub "arn:aws:cloudformation:ap-northeast-1:${AWS::AccountId}:stack/holidays-jp/*"
            - !Sub "arn:aws:cloudformation:us-east-1:${AWS::AccountId}:stack/holidays-jp-update-trigger/*"
        - Sid: S3Operation
          Effect: Allow
          Action:
            - "s3:*"
          Resource:
            - "arn:aws:s3:::aws-sam-cli-managed-default-samclisourcebucket-*/*"
        - Sid: S3GetOperation
          Effect: Allow
          Action:
            - "s3:ListBucket"
          Resource:
            - "arn:aws:s3:::aws-sam-cli-managed-default-samclisourcebucket-*"
```

### OpenID Connect を用いた一時的なアクセストークン発行

GitHub Actions の OpenID Connect 対応が GA になったので、これを使っています。

- [About security hardening with OpenID Connect](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)

有効期限の短いトークンが発行されるので、万が一流出したとしても被害を最小限に抑えることができます。

OpenID Connect と AWS の連携部分ですが、公式の Action ではなく自作のものを使っています。
理由は以下の記事にも書いたのですがセッションタグを使いたかったからです。

- [GitHub Actions + OIDC Token の情報を AWS のセッションタグに設定してみた](https://shogo82148.github.io/blog/2021/09/24/github-actions-oidc/)
- [fuller-inc/actions-aws-assume-role](https://github.com/fuller-inc/actions-aws-assume-role)
- [Permissions required to add session tags](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_session-tags.html#id_session-tags_permissions-required)

セッションタグは信頼ポリシーの `Condition` 要素に条件として追加できるので、 「production 環境の場合のみアクセスを許可する」といったことが簡単にできます。
実際の例はこんな感じです。

- [cicd.yaml#L110-L126](https://github.com/shogo82148/holidays-jp/blob/b36054872de0ba3a44a78a2e80d5ed21b54fcbca/cicd.yaml#L110-L126)

```yaml
AssumeRolePolicyDocument:
  Version: "2012-10-17"
  Statement:
    - Effect: Allow
      Principal:
        AWS: arn:aws:iam::053160724612:root
      Action: "sts:AssumeRole"
      Condition:
        StringEquals:
          "sts:ExternalId": "R_kgDOF1U3OQ"
        StringLike:
          "aws:RequestTag/Audience": "*"
          "aws:RequestTag/Environment": "production"
    - Effect: Allow
      Principal:
        AWS: arn:aws:iam::053160724612:root
      Action: "sts:TagSession"
```

GitHub の Environment を見るだけであれば OIDC トークンの `sub` を見ても同じことはできるのですが、
セッションタグを使えば「 @shogo82148 以外のコミットは拒否する」といったより高度な設定も可能です。

これも以前書いたことなんですが、AWS か GitHub 側で正式に対応してくれませんかね。

## まとめ

AWS SAM の自動デプロイを行うさいには **権限昇格の脆弱性**を作り込まないよう注意が必要です。
今回は GitHub Actions からデプロイするために以下の 3 つの対策を行いました。

- Permissions boundaries の設定
- AWS CloudFormation service role の利用
- OpenID Connect を用いた一時的なアクセストークン発行

Permissions boundaries によってこれでも簡単になったほうなんでしょうが、しっかりやると難しい・・・。

## 参考

- [Permissions boundaries for IAM entities](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_boundaries.html)
- [Actions, resources, and condition keys for Identity And Access Management](https://docs.aws.amazon.com/service-authorization/latest/reference/list_identityandaccessmanagement.html)
- [AWS CloudFormation service role](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-iam-servicerole.html)
- [AWS CloudFormation conditions](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-iam-template.html#using-iam-template-conditions)
- [Globals section of the AWS SAM template](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-specification-template-anatomy-globals.html)
- [AWS SAM CLI configuration file](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-config.html)
- [Permissions required to add session tags](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_session-tags.html#id_session-tags_permissions-required)
- [shogo82148/holidays-jp](https://github.com/shogo82148/holidays-jp)
- [fuller-inc/actions-aws-assume-role](https://github.com/fuller-inc/actions-aws-assume-role)
- [About security hardening with OpenID Connect](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [祝日 API を公開しました](https://shogo82148.github.io/blog/2021/09/04/holidays-api-is-released/)
- [GitHub Actions + OIDC Token の情報を AWS のセッションタグに設定してみた](https://shogo82148.github.io/blog/2021/09/24/github-actions-oidc/)
