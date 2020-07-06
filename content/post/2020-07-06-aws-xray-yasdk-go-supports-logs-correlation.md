---
layout: post
title: "Yet Another AWS X-Ray Go SDK でログの関連付けをサポートした"
slug: aws-xray-yasdk-go-supports-logs-correlation
date: 2020-03-30 06:37:00 +0900
comments: true
categories: [aws, go, golang]
---

僕が管理しているサービスででは、ALB が発行する Trace ID を調査時の手がかりとして使えるようログに出力しています。
これのおかげで、Nginx, アプリケーション, その他AWSのマネージドサービス, etc. といった異なるコンポーネントであっても、関連するログを抽出ができ、
障害発生時の役に立っています。
しかし、肝心の抽出作業がマネージドコンソールぽちぽちなため、完全に職人芸になっているというのが現状でした。

解決のための良いツールがないかな、と目をつけたのが [CloudWatch ServiceLens](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/ServiceLens.html) です。
CloudWatch メトリックとログ、[AWS X-Ray](https://aws.amazon.com/jp/xray/) からのトレースを結び付けて、直感なインターフェースで分析できるというもの。

- [Amazon CloudWatch ServiceLens の発表](https://aws.amazon.com/jp/about-aws/whats-new/2019/11/announcing-amazon-cloudwatch-servicelens/)

AWS X-Ray のトレース結果を送るのは、以前開発した [Yet Another AWS X-Ray SDK for Go](https://shogo82148.github.io/blog/2020/03/30/aws-xray-yasdk-go/) でできます。
CloudWatch Logs への出力方法は色々ありますが、僕は自作の [cloudwatch-logs-agent-lite](https://github.com/shogo82148/cloudwatch-logs-agent-lite) を使っています。

材料はそろった、さあ、ServiceLens で分析だ！と行きたいところですが、
ただ単にこれらの情報を送りつけるだけでは、得られる情報は X-Ray 単体、CloudWatch Logs 単体で使ったときと大差ありません。
X-Ray のトレース結果とログの関連付けが行われていないので、結局 Trace ID を使って CloudWatch Logs を検索する必要が出てきてしまいます。

ドキュメントを見る限り、2020-07-06現在 [AWS X-Ray SDK for Java](https://github.com/aws/aws-xray-sdk-java) だけがログ関連付け機能に対応しているようです。
JavaにできてGoにできないわけがないだろう・・・ということで移植してきました。


## 使い方

[aws-xray-yasdk-go](https://github.com/shogo82148/aws-xray-yasdk-go) の v1.1.1 移行で対応しているので、そのバージョンを落としてきます。

```
go get github.com/shogo82148/aws-xray-yasdk-go@v1.1.1
```

こんな感じで Service Lens の画面からログを確認できるようになります。

![CloudWatch Service Lens](/images/2020-07-06-service-lens.png)

ただし、CloudWatch Logs へのログ転送方法によっては、追加で設定が必要です。

### EC2 + CloudWatch Logs Agent と一緒に使う

EC2 + CloudWatch Logs Agent を使っている場合は、EC2プラグインを有効化にするだけ。

```go
import _ "github.com/shogo82148/aws-xray-yasdk-go/plugins/ec2/init"
```

**追加で必要な作業はありません！**

SDKがアプリケーション起動時に CloudWatch Logs Agent の設定ファイルを探して、勝手に関連付けを行ってくれます。

### EKS と一緒に使う

EKSもプラグインを有効化するだけで、自動的に関連付けを行ってくれます。

```go
import _ "github.com/shogo82148/aws-xray-yasdk-go/plugins/eks/init"
```

・・・ただ、EKS全くわからなくて動作検証できていないので、うまく動くか正直自身がないです。
人柱募集中。

### 明示的にロググループを指定する

前述の通り、僕はログ収集に自作の [cloudwatch-logs-agent-lite](https://github.com/shogo82148/cloudwatch-logs-agent-lite) を使っているので、
ログコレクターに依存しない方法も用意しました。

以下のように CloudWatch Logs のロググループを明示的に指定します。

```go
import (
	"github.com/shogo82148/aws-xray-yasdk-go/plugins/cwlogs"
	"github.com/shogo82148/aws-xray-yasdk-go/xray"
	"github.com/shogo82148/aws-xray-yasdk-go/xray/schema"
)

func main() {
	plugin := cwlogs.New(&cwlogs.Config{
		LogReferences: []*schema.LogReference{
			{LogGroup: "/log-group-name/for/your-application"},
		},
	})
	xray.AddPlugin(plugin)
}
```


## 実装

セグメントにはAWSリソースに関する情報を格納するセクションがあります。
以下にこのセクションの書き方に関するドキュメントがあるのですが、ドキュメントの更新が追いついていないのか、
実装が先行して Undocumented なままになっているフィールドがあるようです。

- [AWS resource data](https://docs.aws.amazon.com/xray/latest/devguide/xray-api-segmentdocuments.html#api-segmentdocuments-aws)

・・・というわけで Java SDK からリバースエンジニアリングしたところ、以下のような設定を書き込めば関連付けができました。

```json
"aws": {
    "cloudwatch_logs": [
        {
            "log_group": "/log-group-name/for/your-application"
        },
    ]
}
```

## まとめ

というわけで、引き続き人柱募集中です！

- [Yet Another AWS X-Ray SDK for Go](https://github.com/shogo82148/aws-xray-yasdk-go)


## 参考

- [AWS X-Ray](https://aws.amazon.com/jp/xray/)
- [Yet Another AWS X-Ray SDK for Go](https://github.com/shogo82148/aws-xray-yasdk-go)
- [Amazon CloudWatch ServiceLens の発表](https://aws.amazon.com/jp/about-aws/whats-new/2019/11/announcing-amazon-cloudwatch-servicelens/)
- [CloudWatch ServiceLens](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/ServiceLens.html)
- [cloudwatch-logs-agent-lite](https://github.com/shogo82148/cloudwatch-logs-agent-lite)
- [AWS X-Ray SDK for Java](https://github.com/aws/aws-xray-sdk-java)
