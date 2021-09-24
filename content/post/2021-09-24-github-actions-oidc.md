---
layout: post
title: "GitHub Actions + OIDC Token の情報をAWSのセッションタグに設定してみた"
slug: github-actions-oidc
date: 2021-09-24 13:58:00 +0900
comments: true
categories: [aws, github]
---

GitHub Actions で ID Token が使えるようになったと話題ですね。

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">うおー！サイコー！！！！！ <a href="https://t.co/2stS4miUOD">https://t.co/2stS4miUOD</a></p>&mdash; Tori Hara (@toricls) <a href="https://twitter.com/toricls/status/1438111074138480645?ref_src=twsrc%5Etfw">September 15, 2021</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Ok I blogged about it. That&#39;s how excited I am. <br><br>1. Deploy this CFN template<br>2. Write this GHA workflow<br>3. Never worry about IAM users again<br> <a href="https://t.co/KJrr2Jw4bE">https://t.co/KJrr2Jw4bE</a> <a href="https://t.co/9IcocgurxP">pic.twitter.com/9IcocgurxP</a></p>&mdash; Aidan W Steele (@__steele) <a href="https://twitter.com/__steele/status/1437984026145427461?ref_src=twsrc%5Etfw">September 15, 2021</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

AWS IAM が OpenID Connect (OIDC) を使った認証 (`sts:AssumeRoleWithWebIdentity`) に対応しているので、認証プロバイダ(IdP)を用意してあげればシークレットの登録が不要になるということらしいです。
これは便利！

## セッションタグを渡したい

これはまさに「[AWS_SECRET_ACCESS_KEY を GitHub Actions secrets へ突っ込むのに疲れた俺達は](https://shogo82148.github.io/blog/2021/03/24/actions-aws-assume-role/)」で実現したかったことですね。
~~このままだとせっかく作ったアクションが不要になりそうで悔しいので~~ このアクションにずっと追加したかった機能があるのですが、OIDCトークンを使うと簡単に実装できそうだったので、お試しで追加してみました。

`actions-aws-assume-role` アクションは[セッションタギング](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_session-tags.html#id_session-tags_adding-assume-role)に対応しています。
これを利用するとアクションを実行したレポジトリ、ブランチ、実行したユーザー等がわかります。

| Key        | Value               |
| ---------- | ------------------- |
| GitHub     | "Actions"           |
| Repository | `GITHUB_REPOSITORY` |
| Workflow   | `GITHUB_WORKFLOW`   |
| RunId      | `GITHUB_RUN_ID`     |
| Actor      | `GITHUB_ACTOR`      |
| Branch     | `GITHUB_REF`        |
| Commit     | `GITHUB_SHA`        |

しかしこれらの情報は、レポジトリへの書き込み権限を持っているユーザーであれば容易に偽装可能です。
そのため100%正しい情報が入っているとは言えない状態でした。

OIDC が利用可能になるとこれが変わります。
以下はOIDCのIDトークンの Claim 部分をデコードしたものです。
ここにもレポジトリ、ブランチ、実行したユーザー等が入っていますね。

```json
{
  "jti": "73e91482-a3d5-408a-98ea-b91de4733605",
  "sub": "repo:shogo82148/github-action-test:ref:refs/heads/main",
  "aud": "https://github.com/shogo82148/github-action-test",
  "ref": "refs/heads/main",
  "sha": "6dfcf89b39ebf8046a9e72d93eda07c22214dde9",
  "repository": "shogo82148/github-action-test",
  "repository_owner": "shogo82148",
  "run_id": "1250487318",
  "run_number": "32",
  "run_attempt": "1",
  "actor": "shogo82148",
  "workflow": "token permission",
  "head_ref": "",
  "base_ref": "",
  "event_name": "workflow_dispatch",
  "ref_type": "branch",
  "job_workflow_ref": "shogo82148/github-action-test/.github/workflows/workflow_dispatch.yml@refs/heads/main",
  "iss": "https://vstoken.actions.githubusercontent.com",
  "nbf": 1632045829,
  "exp": 1632046729,
  "iat": 1632046429
}
```

GitHub Actions 上の環境変数と違うのは、これらの情報が **電子署名によって保護されているという点** です。
改ざんしても署名でバレてしまうので、信頼できる情報として扱うことができます。

セッションタグは IAM Role の信頼ポリシーの `Condition` に設定する条件として使用可能です。
例えば以下のように `"aws:RequestTag/Branch": "refs/heads/main"` を追加することで、
`actions-aws-assume-role` アクションの使用を main ブランチに制限することができます。

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::053160724612:root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "shogo82148/github-action-test",
          "aws:RequestTag/IdToken": "true",
          "aws:RequestTag/GitHub": "Actions",
          "aws:RequestTag/Branch": "refs/heads/main"
        }
      }
    },
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::053160724612:root"
      },
      "Action": "sts:TagSession"
    }
  ]
}
```

## Environment が取得できる

OIDCの利用にはもうひとつ嬉しい点があって、[Environments](https://docs.github.com/en/actions/deployment/environments) を指定すると、IDトークンに Environment に関する情報が入ります。

```json
{
  "jti": "f409168e-6bec-42bb-9cef-73d86a0a01da",
  "sub": "repo:shogo82148/github-action-test:environment:test",
  "aud": "https://github.com/shogo82148/github-action-test",
  "ref": "refs/heads/main",
  "sha": "edbf00b96304d9ce2434f3daed59dd847ffd449b",
  "repository": "shogo82148/github-action-test",
  "repository_owner": "shogo82148",
  "run_id": "1268676048",
  "run_number": "34",
  "run_attempt": "1",
  "actor": "shogo82148",
  "workflow": "token permission",
  "head_ref": "",
  "base_ref": "",
  "event_name": "workflow_dispatch",
  "ref_type": "branch",
  "environment": "test",
  "job_workflow_ref": "shogo82148/github-action-test/.github/workflows/workflow_dispatch.yml@refs/heads/main",
  "iss": "https://vstoken.actions.githubusercontent.com",
  "nbf": 1632462508,
  "exp": 1632463407,
  "iat": 1632463108
}
```

GitHub Actions のジョブの中からこの情報が取れなくて困ってたんですよね。
これが使えると [デプロイ内容のレビュー](https://docs.github.com/en/actions/managing-workflow-runs/reviewing-deployments) を受けて Approve されたワークフローにのみ権限を付与する、
などといった高度なアクセス制御か可能となります。

## 各社へのお願い

### AWS

実は `sts:AssumeRoleWithWebIdentity` でもIDトークンの情報を信頼ポリシーの条件とすることが可能です。

- [Available keys for AWS web identity federation](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_iam-condition-keys.html#condition-keys-wif)

しかし、簡単に試してみた限り `vstoken.actions.githubusercontent.com:aud` や `vstoken.actions.githubusercontent.com:sub` といった OIDC の一般的なキーしか参照できないようです。

一方、Google や Facebook は設定済みのIdPが用意されており、`graph.facebook.com:app_id`, `accounts.google.com:oaud` といったプロバイダ特有のキーが利用できるようです。

設定済みのIdPに GitHub Actions を追加して、利用可能なキーを追加してもらうことってできないですかね・・・？

### GitHub

`sts:AssumeRoleWithWebIdentity` でも一応セッションタグを利用することはできるのですが、
IDトークンの Claim に `"https://aws.amazon.com/tags"` という特殊なキーを埋め込む必要があります。

```json
{
    "sub": "johndoe",
    "aud": "ac_oic_client",
    "jti": "ZYUCeRMQVtqHypVPWAN3VB",
    "iss": "https://xyz.com",
    "iat": 1566583294,
    "exp": 1566583354,
    "auth_time": 1566583292,
    "https://aws.amazon.com/tags": {
        "principal_tags": {
            "Project": ["Automation"],
            "CostCenter": ["987654"],
            "Department": ["Engineering"]
        },
        "transitive_tag_keys": [
            "Project",
            "CostCenter"
        ]
    }
}
```

これを使えば GitHub 側でも対応可能だと思うので、何卒・・・

## まとめ

GitHub Actions の ID Token の情報を AWSのセッションタグに設定してみました。
`actions-aws-assume-role` アクションにも組み込んでみましたが、 **マーケットへの公開はしていません。**

というのも、2021-09-24時点 **OpenID Connect に関して GitHub の公式ドキュメントには一切記載がなく**、
今後どうなるのか全くわからないからです。
非常に便利そうな機能なので、公開されるのが待ち遠しいですね。

## 参考

- [Actions: Secure cloud deployments with Open ID Connect](https://github.com/github/roadmap/issues/249)
  - GitHub の公開ロードマップ
- [Added OIDC client functionality in core package #887](https://github.com/actions/toolkit/pull/887)
- [AWS federation comes to GitHub Actions - Aidan Steele's blog (usually about AWS)](https://awsteele.com/blog/2021/09/15/aws-federation-comes-to-github-actions.html)
- [glassechidna/ghaoidc](https://github.com/glassechidna/ghaoidc)
- [zarnovican/aws-oidc-login-action](https://github.com/zarnovican/aws-oidc-login-action)
  - 先に紹介したブログ記事では Bash Script だったものを JavaScript Action として書き直したもの
- [GitHub ActionsでAWSの永続的なクレデンシャルを渡すことなくIAM Roleが利用できるようになったようです - DevelopersIO](https://dev.classmethod.jp/articles/github-actions-without-permanent-credential/)
- [GitHub ActionsのOIDC id tokenでGCPにアクセスしてみた - ryotarai's blog](https://ryotarai.hatenablog.com/entry/github-acitons-id-token-gcp)
- [google-github-actions/auth](https://github.com/google-github-actions/auth)
  - GCP でも同じことができるよ！という記事を見かけたなと思ったら、もうGCP公式が Action 作り始めていた...
- [Available keys for AWS web identity federation](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_iam-condition-keys.html#condition-keys-wif)
- [Passing session tags using AssumeRoleWithWebIdentity](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_session-tags.html#id_session-tags_adding-assume-role-idp)
- [GitHub Actionsに「強い」AWSの権限を渡したい / AWS credentials on Actions](https://speakerdeck.com/fujiwara3/aws-credentials-on-actions)
