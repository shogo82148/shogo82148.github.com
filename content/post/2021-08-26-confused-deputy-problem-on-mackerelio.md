---
layout: post
title: "Mackerelにおける「混乱した代理」問題に対応しよう"
slug: confused-deputy-problem-on-mackerelio
date: 2021-08-26 21:12:00 +0900
comments: true
categories: [mackerel, aws]
---

最近 [Mackerel](https://ja.mackerel.io/) の AWS インテグレーション機能にいくつかセキュリティ強化のアップデートが入りました。
(「最近」と言っても最も古いアップデートは 2 年前ですが・・・)

- [AWS インテグレーションで IAM ロールによる認証利用時の権限チェック頻度を変更しました ほか](https://mackerel.io/ja/blog/entry/weekly/20210806)
- [AWS インテグレーション CloudFront 連携で取得できるメトリックを追加しました ほか](https://mackerel.io/ja/blog/entry/weekly/20210727)
- [【リリース予告】AWS インテグレーションの権限チェックを強化していきます](https://mackerel.io/ja/blog/entry/announcement/20210705)
- [AWS Step Functions インテグレーションをリリースしました　ほか](https://mackerel.io/ja/blog/entry/weekly/20190529)

これらのアップデートは「[混乱した代理問題(Confused deputy problem)](https://ja.wikipedia.org/wiki/Confused_deputy_problem))」に対応するものです。
僕が AWS インテグレーションの設定をしている際にふと **「この機能、攻撃に利用できるのでは？」** と思いついてしまったので、
Mackerel サポートに問題点を伝えて修正していただきました。

リリース記事に関連する AWS のドキュメントが貼ってありますが、正直 AWS のドキュメントは難しい・・・。
そういうわけで、Mackerel の AWS インテグレーションを例に「混乱した代理問題」を噛み砕いて解説しよう、というのが本記事の趣旨です。
(いちおう Mackerel のサポートから許可は頂いています。)

## TL;DR

「詳しい解説とかいらない！」という方も、最低限これだけはやっておきましょう。

Mackerel の [AWS インテグレーション](https://mackerel.io/ja/docs/entry/integrations/aws) を利用している場合、以下の項目を確認すること。

- [Mackerel の AWS インテグレーション設定のページ](https://mackerel.io/my?tab=awsIntegration) で各設定の「編集」をクリックし、ロール ARN に緑のチェックマークが入っていること
- 連携用の AWS IAM Role に External ID (外部 ID)が設定されていること
  - 設定されていても `Mackerel-AWS-Integration` になっている場合、それは古い設定です。今すぐ更新してください！

AWS インテグレーションのような「アクセス権の委任」を使った機能を提供する場合は以下の点に注意すること。

- `AssumeRole` API を呼び出す際は外部 ID(`sts:ExternalId`) にユーザー毎に異なる値を設定すること
- 不正な外部 ID を `sts:ExternalId` に設定し `AssumeRole` API を呼び出した場合に失敗することを確認すること

## 前提

さて、本題に入る前に、「シークレット」と「シークレットではないもの」の区別をしっかりしておきましょう。
AWS アカウントに関する情報はすべてが秘密なわけではなく、どうしても第三者に漏れてしまうのもあります。
不正アクセスをする人間はこれらの情報を知っていると考えるべきです。

### AWS のアカウント番号はシークレット **ではない**

**AWS のアカウント番号はシークレットではありません**。
今更隠してもしょうがないので、例えば僕の AWS アカウント番号(のひとつ)を書いておくと `445285296882` です。

この番号は色んな所で見つけられます。
例えば僕は AWS Lambda の [Perl Custom Runtime](https://metacpan.org/pod/AWS::Lambda) を公開しているのですが、
このときに利用する Layer の ARN にはバッチリアカウント番号が入っています。

> - `arn:aws:lambda:ap-northeast-1:445285296882:layer:perl-5-34-runtime-al2:2`

また、[AWS Serverless Application Repository](https://aws.amazon.com/jp/serverless/serverlessrepo/)にもいくつかアプリケーションを公開しています。
その中から適当にひとつ[acme-cert-updater](https://serverlessrepo.aws.amazon.com/applications/us-east-1/445285296882/acme-cert-updater)というアプリケーションの詳細を開くと、URL や アプリケーションの ARN にアカウント番号が載っています。

> - `https://serverlessrepo.aws.amazon.com/applications/us-east-1/445285296882/acme-cert-updater`
> - `arn:aws:serverlessrepo:us-east-1:445285296882:applications/acme-cert-updater`

僕の個人アカウント以外にも AWS アカウント番号が公開されている例はあります。
例えば Mackerel の (AWS インテグレーション専用？)AWS アカウント `217452466226` は、
[AWS インテグレーション](https://mackerel.io/ja/docs/entry/integrations/aws) のページで公開されています。

> Mackerel の AWS インテグレーション設定のページから作成ボタンを押して、External ID を取得してください。許可する Account ID には `217452466226` を入力してください。

このように AWS はアカウント番号をシークレットとして扱っておらず、外部に公開する場合があります。
「アカウント番号は世界中に知れ渡っているもの」という前提でセキュリティ対策を行う必要があります。

### IAM ロール名はシークレット **ではない**

**IAM ロール名はシークレットではありません**。
ロール名はユーザーが自由に名前をつけられます。名前はわかりやすさが優先で、わざわざパスワードのような複雑な文字列を設定することはないでしょう。
そのため用途から簡単に名前を推測できてしまいます。

例えば、[AWS インテグレーション](https://mackerel.io/ja/docs/entry/integrations/aws) のページでは例として `MackerelAWSIntegrationRole` を挙げていますね。

> ロール名を指定してロールを作成します。 `MackerelAWSIntegrationRole` のように Mackerel の AWS インテグレーションで使用していることが分かりやすい名前を付けることを推奨します。

統計を取ったわけではありませんが、ドキュメント通り `MackerelAWSIntegrationRole` という名前で作成したという方は多いのではないでしょうか？

### IAM ロール ARN はシークレット **ではない**

「AWS のアカウント番号」と「ロール名」がわかってしまえば、それから ARN (Amazon Resource Name) は自動的にわかります。

- `arn:aws:iam::${AccountNumber}:role/${RoleName}`

ARN の命名規則にしたがって、アカウント番号とロール名を埋めるだけです。
例えば僕が AWS インテグレーションに使っている IAM Role ARN は以下のように簡単にわかってしまいます。

- `arn:aws:iam::445285296882:role/MackerelAWSIntegrationRole`

「AWS のアカウント番号」と「ロール名」はシークレットではないので、もちろん ARN もシークレットではありません。

## Mackerel における「混乱した代理」問題

前置きが長くなりましたが、ここからが本題です。
IAM Role を用いた AWS インテグレーションが Mackerel に導入された当初、 **すべてのユーザーが外部 ID に `Mackerel-AWS-Integration` を指定する** という仕様でした。

正規のユーザー @shogo82148 が AWS インテグレーションを使うぶんには問題ありません。
IAM Role の信頼ポリシーに「Mackerel からの要求のみ許可する」という条件が設定されているため、
Mackerel はメトリックスの収集を行うことができます。

![Mackerelで発生していた混乱した代理問題](/images/2021-08-26-confused-deputy-problem-on-mackerelio1.svg)

しかし Mackerel のユーザーの中に不正を行うユーザー @chooblarin がいた場合はどうでしょう？
前節に書いたように Role ARN はシークレットではありません。
公開されている情報から AWS アカウント番号を取得したり、ロール名を推測したりなどすれば、Role ARN を割り出すことが可能です。
不正を行うユーザーは、この Role ARN を使って Mackerel の AWS インテグレーションを設定します。
すると AWS アカウントからは **Mackerel から要求が来ているようにしか見えません**。
そのため、AWS はメトリックスの収集を許可してしまい、 **第三者が Mackerel を介してメトリックスを収集できしてしまいます**。

不正を行うユーザーは Mackerel を踏み台にして、本来は見ることのできないメトリックスにアクセスできてしまいました。
これが「混乱した代理問題(Confused Deputy Problem)」です。

## 外部 ID を用いた解決

「混乱した代理問題」に対して、AWS は「外部 ID(External ID)」を用いた防御策を提供しています。

### 外部 ID

Mackerel は外部 ID としてランダムな(？)文字列を利用していますが、ここではわかりやすいようユーザー名を使って説明します。

正規のユーザーである @shogo82148 は、 IAM Role の信頼ポリシーに「外部 ID が `shogo82148` である」という条件を追加します。
Mackerel はメトリックスの収集時、外部 ID にユーザー名 `shogo82148` を設定してリクエストしてきます。
これは正規のリクエストなので、もちろん要求は通ります。

![外部IDを用いた混乱した代理問題の解決](/images/2021-08-26-confused-deputy-problem-on-mackerelio2.svg)

では先程と同じように、不正を行うユーザー @chooblarin が現れた場合はどうでしょう。
Mackerel に正しい IAM Role ARN を渡したとしても、
Mackerel はメトリックスの収集時、外部 ID に `chooblarin` を設定します。
IAM Role の信頼ポリシーの「外部 ID が `shogo82148` である」という条件を満たさないので、このリクエストは拒否されます。

@chooblarin が IAM Role ARN を Mackerel に入力する際、外部 ID に `shogo82148` を指定した場合はどうでしょう。
このケースでは、Mackerel が入力された外部 ID はすでに使用されていることを検知して、この設定を拒否します。

こうして外部 ID を用いることで不正なアクセスを防ぐことができ、「混乱した代理問題」を解消することができます。

### 信頼ポリシーの検証

さて、外部 ID を使用することで「混乱した代理問題」は完全に解決したように見えます。
しかし、この仕組がうまく不正リクエストを弾くのは **ユーザーが IAM Role の信頼ポリシーを正しく設定した場合に限ります**。
例えば僕が信頼ポリシーに「外部 ID が `shogo82148` である」という条件を入れるのをうっかり忘れてしまったら、
第三者のアクセスを許可してしまい、外部 ID を導入した意味がありません。
僕の AWS アカウントは当然ながら僕の管理下にあるので、Mackerel は信頼ポリシーを直接確認してこのような設定を拒否することはできません。

そこで AWS のドキュメントでは、あえて「正しくない外部 ID」を使用して `AssumeRole` API を呼び出すことを推奨しています。

> https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/id_roles_create_for-user_externalid.html#external-id-use
> 外部 ID は常に AssumeRole API 呼び出しで指定する必要があります。さらに、顧客からロールの ARN を受け取ったら、正しい外部 ID と正しくない外部 ID の両方を使用して、そのロールを引き受けることができるかどうかをテストします。正しい外部 ID がなくてもロールを引き受けることのできる場合は、システムに顧客のロール ARN を保存しないでください。顧客がロール信頼ポリシーを更新し、正しい外部 ID を要求するまで待ちます。こうすることにより、顧客による不正を防止し、"混乱した代理" 問題からお客様と顧客の両方を守ることができます。

ちなみに「お客様」と「顧客」という似た単語が使われていて混乱したんですが、両者は全くの別物です。英語の原文では「お客様」= "You", 「顧客」= "Your customers" となっています。

> You should always specify the external ID in your AssumeRole API calls. In addition when a customer gives you a role ARN, test whether you can assume the role both with and without the correct external ID. If you can assume the role without the correct external ID, don't store the customer's role ARN in your system. Wait until your customer has updated the role trust policy to require the correct external ID. In this way you help your customers to do the right thing, which helps to keep both of you protected against the confused deputy problem.

Mackerel ではこのチェックが行われていないようだったので、報告して修正してもらったのが [【リリース予告】AWS インテグレーションの権限チェックを強化していきます](https://mackerel.io/ja/blog/entry/announcement/20210705) で入った権限チェックの強化です。
`sts:ExternalId` の設定をうっかり忘れてしまっても、AWS インテグレーションの設定に失敗するようになりました。

## まとめ

Mackerel の [AWS インテグレーション](https://mackerel.io/ja/docs/entry/integrations/aws) を利用している場合、以下の項目を確認すること。

- [Mackerel の AWS インテグレーション設定のページ](https://mackerel.io/my?tab=awsIntegration) で各設定の「編集」をクリックし、ロール ARN に緑のチェックマークが入っていること
- 連携用の AWS IAM Role に External ID (外部 ID)が設定されていること
  - 設定されていても `Mackerel-AWS-Integration` になっている場合、それは古い設定です。今すぐ更新してください！

AWS インテグレーションのような「アクセス権の委任」を使った機能を提供する場合は以下の点に注意すること。

- `AssumeRole` API を呼び出す際は外部 ID(`sts:ExternalId`) にユーザー毎に異なる値を設定すること
- 不正な外部 ID を `sts:ExternalId` に設定し `AssumeRole` API を呼び出した場合に失敗することを確認すること

大事なことなので二回書きました。

権限の委任は難しいですね。僕は外部 ID の意義を理解するまで 3 年くらいかかりました。
(Mackerel の AWS インテグレーションが IAM Role を使ってできることを知ってから、今回の修正依頼を出すまでがたぶんそれくらい・・・)

難しいんですが、効果的に利用すればシークレットを扱う機会を減らすことができ、セキュリティの向上が見込めます。
権限の委任を使って連携を行うサービスが増えてくれるといいなと思っています。

## 参考

- [AWS インテグレーションで IAM ロールによる認証利用時の権限チェック頻度を変更しました ほか](https://mackerel.io/ja/blog/entry/weekly/20210806)
- [AWS インテグレーション CloudFront 連携で取得できるメトリックを追加しました ほか](https://mackerel.io/ja/blog/entry/weekly/20210727)
- [【リリース予告】AWS インテグレーションの権限チェックを強化していきます](https://mackerel.io/ja/blog/entry/announcement/20210705)
- [AWS Step Functions インテグレーションをリリースしました　ほか](https://mackerel.io/ja/blog/entry/weekly/20190529)
- [How to use an external ID when granting access to your AWS resources to a third party - AWS Identity and Access Management](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-user_externalid.html)
- [The confused deputy problem - AWS Identity and Access Management](https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html)
- [Additional authenticated data - Cloud Key Management Service](https://cloud.google.com/kms/docs/additional-authenticated-data)
- [Confused deputy problem - Wikipedia](https://ja.wikipedia.org/wiki/Confused_deputy_problem)

---

@chooblarin ごめんね・・・

あと `arn:aws:iam::445285296882:role/MackerelAWSIntegrationRole` を使っていると言ったな。
あれは嘘だ。
