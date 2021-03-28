---
layout: post
title: "AWS_SECRET_ACCESS_KEY を GitHub Actions secrets へ突っ込むのに疲れた俺達は"
slug: actions-check-permissions
date: 2021-03-24 21:57:00 +0900
comments: true
categories: [github]
---

「GitHub Actions から継続的デプロイをしたい！」と思ったときに、
僕の扱うデプロイ先は AWS なことが多いので AWS のキー (`AWS_ACCESS_KEY`, `AWS_SECRET_ACCESS_KEY` ) を
GitHub Actions secrets へ突っ込む必要があります。
まあ一回や二回ならやるんですが、デベロップメント、ステージング、プロダクション、と複数環境あったり、
プロジェクトも複数あったりして、中々の回数設定を行わなければなりません。
設定するだけでつらいのに、AWS はキーのローテーションを勧めてきます。つらい。

と言うわけで、シークレットの管理を極力しなくて済む方法を考えて、設定用の Action を作成しました。

- [shogo82148/actions-aws-assume-role](https://github.com/shogo82148/actions-aws-assume-role)
- [Configure AWS Credentials by Assuming Roles](https://github.com/marketplace/actions/configure-aws-credentials-by-assuming-roles)

## 使い方

まずは AWS 側に IAM Role を作成します。
IAM Role の信頼関係(trust policy) には以下の内容を記載します。
信頼する AWS アカウントには `053160724612` を指定してください。
これは僕の管理している AWS アカウントなので、**僕を信頼できる方だけこの先に進んでください**。
外部 ID(`ExternalId`) にはこのロールを使用する予定のレポジトリ名を入れます。

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
          "sts:ExternalId": "your-name/your-repo"
        }
      }
    }
  ]
}
```

IAM Role に付与するパーミッションは、用途に合わせてご自由に設定してください。

次に GitHub Actions のワークフローに以下のステップを追加します。
`aws-region` には接続先のリージョンを、 `role-to-assume` には先程設定した Role の Arn を入力してください。

```yaml
- name: Configure AWS Credentials
  uses: shogo82148/actions-aws-assume-role@v1
  with:
    aws-region: ap-northeast-1
    role-to-assume: arn:aws:iam::123456789012:role/GitHubRepoRole
```

これで完了です！
このアクションが `AWS_ACCESS_KEY`, `AWS_SECRET_ACCESS_KEY` 環境変数を設定してくれます。
Actions secrets の設定画面を開くことなく設定が終わりました！

## セッションタギング

`role-session-tagging: true` を追加するとセッションタギングが有効化されます。

```yaml
- uses: shogo82148/actions-aws-assume-role@v1
  with:
    aws-region: ap-northeast-1
    role-to-assume: arn:aws:iam::123456789012:role/GitHubRepoRole
    role-session-tagging: true
```

セッションに以下の内容のタグが付きます。
trust policy の条件に使用できたり、CloudTrail のログからどのような用途に使われたのか調査したり、といった用途使えます。

| Key        | Value               |
| ---------- | ------------------- |
| GitHub     | "Actions"           |
| Repository | `GITHUB_REPOSITORY` |
| Workflow   | `GITHUB_WORKFLOW`   |
| RunId      | `GITHUB_RUN_ID`     |
| Actor      | `GITHUB_ACTOR`      |
| Branch     | `GITHUB_REF`        |
| Commit     | `GITHUB_SHA`        |

セッションタギングを使用するには IAM Role 側の trust policy の変更も必要です。
`sts:TagSession` を許可してください。

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
          "sts:ExternalId": "your-name/your-repo"
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

## 仕組み

バックエンドで API Gateway + AWS Lambda が動いており、それと連携して認証を行います。

![概要図](/images/2021-03-24-how-to-work.svg)

### 1. クレデンシャルのリクエスト

アクションが実行されると API Gateway へ AWS のクレデンシャルのリクエストを投げます。
このとき認証用に GitHub Actions が自動生成してくれた `GITHUB_TOKEN` も一緒に送ります。

### 2. GitHub のパーミッションチェック

アクションから送信された `GITHUB_TOKEN` を使って GitHub API を叩き、正規のリクエストであることを確認します。

- アクションが実行された GitHub レポジトリへの書き込み権限があること
- GitHub Actions GitHub App (ややこしい) が発行したトークンであること

  - 色々遊んでみたところ GitHub Actions 内で使える `GITHUB_TOKEN` は GitHub Apps の仕組みを流用したもののようです
    - `GITHUB_TOKEN` は使用できるレポジトリを絞れるのが特長ですが、 GitHub Apps にはこのトークンを作るための API が存在します
    - [Create an installation access token for an app](https://docs.github.com/en/rest/reference/apps#create-an-installation-access-token-for-an-app)
  - GitHub Apps には ID が振られているので、この ID をもとに GitHub Actions によって発行されたものであることを確認します
  - この条件を満たすトークンは GitHub Actions を実行する以外の発行方法がない (少なくとも僕は知らない) ので確実に判定できます。

ここのパーミッションチェックはこのアクションの肝と言っていい部分です。
万が一判定ロジックが改ざんされると IAM Role 乗っ取り放題になってしまいます。
GitHub Runner 上で実行されるのコードは VM に展開されるためいくらでも改ざん可能なので、これらのパーミッションチェックは改変の心配がない AWS Lambda 上で実行します。

### 3. AssumeRole API を呼び出す

Assume Role は他のプリンシパル(AWS のサービスだったり、IAM User だったり、別の AWS アカウントだったり)に、自分の持っている権限を受け渡す API です。
この API を使って一時的なクレデンシャルの発行を行います。

### 4. 信頼関係(trust policy) のチェック

AWS IAM が trust policy にしたがって、 Assume Role を呼び出す権限があるのかをチェックします。
ここも異なった AWS 間でクレデンシャルのやり取りを行う重要なステップです。

`shogo82148/actions-aws-assume-role` には今の所使用制限はかけていません。誰でも自由に使用できることができます。
そのため AWS アカウント `053160724612` から AssumeRole のリクエストが来たからと言って、一番最初のリクエストが誰から来たものなのかはわかりません。
(そもそもお前のアカウントなんて信頼できないよ！って方もいるかも知れないですが、便宜上信頼してもらったものとして話を進めますね)

ここでキーになってくるのが `ExternalId` です。
AssumeRole の際、`ExternalId` にはクレデンシャルリクエストを出した元のレポジトリの名前を入れます。
このレポジトリ名は Step2 の段階で身元の証明ができているので、このステップでは単に名前を確認すれば OK です。
レポジトリ名を偽装しようとしても Step2 で弾かれてこのステップまで到達することができないので、
意図したレポジトリにだけ権限を払い出すことができます。

### 5, 6 クレデンシャルの払い出し

AssumeRole が成功すると一時的なクレデンシャルが払い出されるので、GitHub Actions Job の環境変数にセットします。
これで AWS のクレデンシャルを使った操作を自由に行うことができます。

## 注意

- クロスアカウントで AssumeRole を実行したログは、自動的に双方の [CloudTrail](https://aws.amazon.com/jp/cloudtrail/) によって記録されます。\
  これはつまり `shogo82148/actions-aws-assume-role` を提供している僕には、アクションを実行したレポジトリの名前、AWS アカウントの名前、実行に使用したロール名等がわかるということです。
- さらに `role-session-tagging: true` を指定した場合、ワークフローの名前、Run ID、実行のトリガーとなったユーザー、ブランチ、コミットハッシュ、もログに残ります。
- もちろんこれらのログは厳重に管理し、セキュリティーチェックのためだけに使用します
- が、しかし、これらの情報がどこの誰だか知らない一個人に渡っているという認識だけはお願いします。特にプライベートレポジトリでの使用はよく考えてから導入しましょう
- `shogo82148/actions-aws-assume-role` のバックエンドのソースコードは公開しています。ログを見られるのが気になる方はご自身でサーバーを立ち上げることをお勧めします

## まとめ

AWS アクセストークンの管理に疲れたので、なるべく管理が楽になるアクションを作りました。

- [shogo82148/actions-aws-assume-role](https://github.com/shogo82148/actions-aws-assume-role)
- [Configure AWS Credentials by Assuming Roles](https://github.com/marketplace/actions/configure-aws-credentials-by-assuming-roles)

やり取りされるトークンはすべて一時的なもので、どんなに頑張って延長しても最長で 12 時間で有効期限が切れます。
シークレットの管理が楽になる上に、セキュリティーの向上も図れていると思うので、ぜひご利用ください。

---

万が一不備を見つけた場合は、内容が内容なので [shogo82148@gmail.com](mailto:shogo82148.com) まで直接連絡をお願いします。

## 参考文献

- [GitHub Rest API - Apps](https://docs.github.com/en/rest/reference/apps)
- [GitHub API を使う Bot たちの GitHub Apps への移行](https://techblog.kayac.com/github-apps-bot)
- [How to use an external ID when granting access to your AWS resources to a third party](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-user_externalid.html)
