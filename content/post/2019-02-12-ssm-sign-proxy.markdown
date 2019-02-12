---
layout: post
title: "外部サービスでもIAM Roleで認証がしたい！"
slug: ssm-sign-proxy
date: 2019-02-12 12:46:00 +0900
comments: true
categories: [go, golang, aws, lambda]
---

## 背景

外部サービスのAPIやWebHookを叩くときには、多くの場合 API トークンが必要になります。
もちろん API トークン無しでも叩けるサービスはありますが、[GitHub APIのようにトークン無しではリクエスト数が大きく制限](https://developer.github.com/v3/#rate-limiting)されたり、
一部機能が制限されてしまう場合があります。

外部連携サービスが増えてくると、このAPIトークンをどうやって管理するかが問題になってきます。
プロダクションに投入されているサービスは普通複数のサーバーから構成されており、各サーバーにAPIトークンを配布するのはちょっと面倒です。
この問題に対して、以下のようなことが行われて来ました。

- プライベートネットワークからのアクセスに限定した Proxy を立てる
- APIトークンの管理は Proxy に任せる

DevOpsが注目され、Slackの利用が広まったころに、このような目的で書かれたProxyサーバーがよく登場しました。

- [社内IRCをSlackに移行した時にやったこと](https://techblog.kayac.com/ircslack.html)
  - この記事で紹介されている [kayac/nopaste](https://github.com/kayac/nopaste)
- [Slackboard〜Slackプロキシサーバ in Go〜](https://qiita.com/cubicdaiya/items/1f9a8846f55b9d0bcb48)
- [Slackプロキシサーバ〜slackboard〜を利用したメルカリのSlack活用法](https://tech.mercari.com/entry/2015/07/06/141056)
- [App::Ikachan - 様々なサーバのバッチ処理の結果等を IRC のチャンネルに通知するサーバ](http://blog.yappo.jp/yappo/archives/000760.html)
  - (IRCはHTTPで動いているわけではないし、大本の目的もコネクション維持だけど、認証も代理でやってくれる)

しかし、これらのサーバーはSlack専用だったりIRC専用だったりします。
Slackだけじゃなくって、GitHubにコメント登録したり、[Mackerelのグラフアノテーション](https://mackerel.io/ja/blog/entry/weekly/20170127)を投稿したり、
他のサービスとも連携したい！

最近はどんなAPIもHTTPで提供されるようになったので(IRCは・・・ウッ・・・そんなのなかった)、もっと汎用的に書けるのではとやってみました。


## 実装

APIトークンの保管場所として [AWS Systems Manager Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-paramstore.html) を採用しました。
Parameter Store からAPIトークンを取り出す部分と、実際にAPIを叩く部分は AWS Lambda を使用します。
各サーバーに Forward Proxy デーモンを立てておき、APIを使いたいアプリケーションはこのProxyを経由するようにします。

![概略図](/images/2019-02-12-ssm-sign-proxy.png)

この図ではEC2インスタンスを例にしていますが、IAM Roleを付与できるAWSのサービスであれば何でも
([ECS](https://aws.amazon.com/jp/ecs/), [Lambda](https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/welcome.html), [CodeBuild](https://docs.aws.amazon.com/ja_jp/codebuild/latest/userguide/welcome.html), etc.)
APIにアクセスすることができます。

外部サービスのAPIを叩くのが Lambda 関数というのもポイントです。
APIトークンをヘッダーに設定するのか、URLの一部に含めるのか、クエリストリングに含めるのか・・・といった設定方法はサービスによってまちまちです。
Lambda 関数がこの辺の設定を肩代わりしてくれるので、APIトークンの扱いを気にする必要はありません。
また、API利用時にうっかりAPIトークンを漏らしてしまう心配もなくなります。

**APIトークンの管理をしたいんじゃない！！ただ、APIを叩きたいだけなんだ！！！！** という思いから、Proxy デーモンはシークレットに関しては何も関与しません。

-----

ソースコードはこちら。Lambdaの部分は最近お気に入りの AWS Serverless Application Repository に公開してあります。

- GitHub: [shogo82148/ssm-sign-proxy](https://github.com/shogo82148/ssm-sign-proxy)
- [AWS Serverless Application Repository](https://serverlessrepo.aws.amazon.com/applications/arn:aws:serverlessrepo:us-east-1:445285296882:applications~ssm-sign-proxy)


## 使い方

### AWS Serverless Application をデプロイする

[AWS Serverless Application Repository](https://serverlessrepo.aws.amazon.com/applications/arn:aws:serverlessrepo:us-east-1:445285296882:applications~ssm-sign-proxy) からLambda関数をデプロイします。

### AWS System Manager Parameter Store にAPIトークンを登録する

Parameter Store にAPIトークンを登録します。
URLから使用する使用するパラメーターを指定できるように、
パラメーター名を `/{hostname}/headers/{header-name}` のような特殊な形式にする必要があります。
例えば[GitHub REST API v3](https://developer.github.com/v3/)の場合、
ホスト名は `api.github.com` で `Authorization` ヘッダーを設定する必要があるので、
以下のような設定になります。

```
aws ssm put-parameter \
    --name "/api.github.com/headers/Authorization" \
    --value "token $YOUR_OAUTH_TOKEN_HERE" \
    --type SecureString
```

これで `api.github.com` へのアクセス時、自動的にヘッダーが設定されます。
ヘッダー追加以外のリクエスト書き換えにも対応しているので、READMEを参照。

### Proxy サーバーを実行する

[Releases](https://github.com/shogo82148/ssm-sign-proxy/releases)から実行バイナリをダウンロードするか、
`go get` で取得します。

```
$ go get github.com/shogo82148/ssm-sign-proxy/cmd/ssm-sign-proxy
```

`ssm-sign-proxy` コマンドに Lambda 関数の名前と待受ポートを指定して起動します。

```
$ ssm-sign-proxy -function-name=ssm-sign-proxy-Proxy-XXXXXXXXXXXXX -addr=localhost:8000
```

以下のようにHTTP Proxyを経由でAPIを叩けるようになります。

```
$ http_proxy=localhost:8000 curl api.github.com/user/repos
```

MITM(Man In The Middle) みたいな邪悪な機能は実装していないので、ProxyとはPlainなHTTPで通信する必要があります。
「今どきAPIトークンが必須今どきTLS非対応のAPIなんて無いだろ」という考えで、Lambda側で勝手に https に書き換えます。

Parameter Store からAPIトークンが見つからなかった場合は 407 Proxy Authentication Required を返します。


## 応用

ここから先は他にもこんな使い方ができるはずという単なるアイディア。
検証はしてない。

### Proxy を Go のアプリケーションに組み込む

[proxy.Proxy](https://godoc.org/github.com/shogo82148/ssm-sign-proxy#Proxy.RoundTrip)は
[http.RoundTripper](https://golang.org/pkg/net/http/#RoundTripper)インターフェースを実装しているので、
必ずLambdaを経由するHTTPクライアントを実装できます。

例えば [mackerel-client-go](https://github.com/mackerelio/mackerel-client-go) に渡すHTTPクライアントをカスタマイズすれば、
APIトークンを Parameter Store で一元管理できるはず(まだやってない、これから試す)。

```go
import (
  "net/http"

  "github.com/aws/aws-sdk-go-v2/aws/external"
  mackerel "github.com/mackerelio/mackerel-client-go"
  proxy    "github.com/shogo82148/ssm-sign-proxy"
)

func main() {
  cfg, _ := external.LoadDefaultAWSConfig()
  p := &proxy.Proxy{
    Config: cfg,
    FunctionName: "ssm-sign-proxy-XXXXXXXX",
  }

  // DUMMY-API-KEY は Lambda関数が適切に置き換えてくれる
  client := mackerel.NewClientWithOptions("DUMMY-API-KEY", "http://api.mackerelio.com/", false)
  client.HTTPClient = &http.Client{
    Transport: p,
    Timeout:   30 * time.Second,
  }

  // use client
}
```


### ALB を使う

ssm-sign-proxyとLambda関数のやり取りは、ALB や Lambda Proxy Integrations と互換性がある形式にしているので、
ssm-sign-proxy をそのまま ALB で置き換えることができるはず。

```
curl -H 'Host: api.github.com' internal-310-elb-xxxxxxx.ap-northeast-1.elb.amazonaws.com/user/repos
```

ALBってForward Proxyとして動作するのかな？(未確認)


### Lambda Proxy Integrations in Local として使う

逆にLambda関数のほうをオリジナルのアプリケーションと置き換えれば、
ssm-sign-proxyが簡易 Lambda Proxy Integrations として動作するはず。
[突然CGIを動かしたくなったとき](https://shogo82148.github.io/blog/2018/12/16/run-cgi-in-aws-lambda/)に活躍する・・・かも？


## まとめ

- 外部サービスの認証を肩代わりしてくれる AWS Lambda 関数を作った
  - 認証情報は Parameter Store へ
  - APIの実行権限をLambda関数の実行権限として表現できるので、権限管理を IAM Role に集中できて楽(きっと)

- GitHub: [shogo82148/ssm-sign-proxy](https://github.com/shogo82148/ssm-sign-proxy)
- [AWS Serverless Application Repository](https://serverlessrepo.aws.amazon.com/applications/arn:aws:serverlessrepo:us-east-1:445285296882:applications~ssm-sign-proxy)

実は[サーバーレスでCloudWatchメトリクスをMackerelに転送する](https://shogo82148.github.io/blog/2019/01/31/mackerel-cloudwatch-transfer/) で、
Mackerel API Key のパラメーター名を `/development/api.mackerelio.com/headers/X-Api-Key` にしたのは ssm-sign-proxy を使うためだったりします。
キーの管理を一元化できて便利！

## 参考

- [社内IRCをSlackに移行した時にやったこと](https://techblog.kayac.com/ircslack.html)
- [Slackboard〜Slackプロキシサーバ in Go〜](https://qiita.com/cubicdaiya/items/1f9a8846f55b9d0bcb48)
- [Slackプロキシサーバ〜slackboard〜を利用したメルカリのSlack活用法](https://tech.mercari.com/entry/2015/07/06/141056)
- [App::Ikachan - 様々なサーバのバッチ処理の結果等を IRC のチャンネルに通知するサーバ](http://blog.yappo.jp/yappo/archives/000760.html)
- [Using AWS Lambda with an Application Load Balancer](https://docs.aws.amazon.com/lambda/latest/dg/services-alb.html)
- [Set up Lambda Proxy Integrations in API Gateway](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html)
