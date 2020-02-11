---
layout: post
title: "AWS X-Ray Go SDK の地雷処理をしている話"
slug: aws-xray-golang
date: 2020-02-11 06:37:00 +0900
comments: true
categories: [aws]
---

[AWS Lambda Perl Runtime で AWS X-Ray を使えるようになりました](https://shogo82148.github.io/blog/2019/08/21/aws-xray-with-perl-lambda-runtime/) で紹介した
AWSの分散アプリケーションの分析サービス [AWS X-Ray](https://aws.amazon.com/jp/xray/)。
Perl から使えるようにしたももの、自分自身は最近 Perl をあまり使っていないことに気がついた！！ので、AWSが提供しているGo実装である [aws/aws-xray-sdk-go](https://github.com/aws/aws-xray-sdk-go)に
手を出してみることにしました。

結果、X-Rayのサービスマップやトーレスが見れるようになって便利！・・・にはなったんですが、そこまでの道のりが長かった。
「 [@fujiwara](https://twitter.com/fujiwara) さんの[YAPC::Tokyo 2019での発表](https://speakerdeck.com/fujiwara3/yapc-tokyo-2019) から1年近く経ってるしそろそろ安定してきているでしょ！」と
軽い気持ちで始めたのが良くない。
色々と地雷(？)を踏んだので、記録として残しておきます。


## 依存ライブラリのcontext対応が地味に辛い

X-Ray で実行をトレースするには、「今実行している関数がどこから呼ばれたのか？」という情報をうまいこと伝える必要があります。
[Perlで使われているような黒魔術](https://perldoc.jp/func/local)はGoでは使えないので、
`context.Context` を地道に引数に渡していくことになります。

まあ、こんなこともあろうかと、`context.Context` にはバッチリ対応してあるからサクッと行けるでしょ！

と思ってたんですが、現実はそうは甘くなかった。
X-Rayを入れようとしたプロジェクトではWebフレームワークとして[goadesign/goa](https://github.com/goadesign/goa)を使っています。
GoaのHTTPハンドラーには `context.Context` が渡ってくるので油断していたのですが、
contextの親をたどっていくと行き着く先は `context.Background()` (HTTPハンドラーなので `request.Context()` であってほしい)。
なんとなく `context.Context` 対応詐欺にあった気分です。

Goaは現在 v2, v3 の開発がメインで現在使っているのは v1 です。
v1からv3へのアップグレードには大幅な書き換えが必要なこと、アップグレードしたとしても直っている保証がないこと、
最近 Goa v1 のリリースが滞りがちなこと、などなどの理由から結局フォークしてくることにしました。

- [shogo82148/goa-v1](https://github.com/shogo82148/goa-v1)

AWS X-Ray Go SDK 自体の問題ではないのですが、
Contextってタイムアウトをうまく処理するための仕組みなので、実装漏れがちですよね。
皆さん実装するときやライブラリの選定には気をつけましょう。


## SQLクエリを実行する関数のシグネチャーが微妙に違う

これに関しては [@acidlemon](https://twitter.com/acidlemon) 先生の kamakura.go の資料を見るのが手っ取り早いです。

- [開発期間数年のサービスの完成間際にcontext対応をぶち込む / introduce context.Context into long term project kamakura.go #5 @ 鎌倉](https://speakerdeck.com/acidlemon/introduce-context-dot-context-into-long-term-project)

<script async class="speakerdeck-embed" data-id="f092fbf8da174846979790d8691709ed" data-ratio="1.77777777777778" src="//speakerdeck.com/assets/embed.js"></script>

`*sql.DB` のクエリ実行関数のシグネチャーは `func QueryContext(ctx context.Context, query string, args ...interface{}) (*Rows, error)` なのに対して、
`*xray.DB` のシグネチャーは `func Query(ctx context.Context, query string, args ...interface{}) (*Rows, error)`。
せめてシグネチャーだけ合わせておいてくれればインターフェースで回避できたものの名前が微妙に違う。
最初から X-Ray 前提でコードを書くか、インターフェースを適合させるためのアダプターが必要になります。

これに関しては一旦トレースを諦めて、SDKにプルリクエストを送って対応してもらうのを待つことにしました。

- [proposal: implement custom driver for xray instead of xray.DB #169](https://github.com/aws/aws-xray-sdk-go/pull/169)

[go-sql-proxyがcontextに対応しました](https://shogo82148.github.io/blog/2017/02/16/go-sql-proxy-in-go18/) と同じアプローチでトレースコードを差し込む実装です。
まだマージされていないですが、「方針は良さそう！」みたいなコメントをもらえたので、マージされるといいな。
これが入るとSQLドライバーを変更するだけでOKなので、既存のコードの変更はほとんどなくなります。


## デフォルトで落ちてくるバージョンが古い

ここまでの地雷は目に見えてわかる(ドキュメントに書いてあるし、なにか問題があればコンパイルエラーになる)ので簡単でしたね。
*ここからは目に見えなくて地味につらいやつです。*

READMEに書いてあるとおりに `go get github.com/aws/aws-xray-sdk-go` してくると落ちてくるバージョンは
[v0.9.4](https://github.com/aws/aws-xray-sdk-go/releases/tag/v0.9.4) です。
しかしこのリリースは **2017年9月** のもの。2年も前のバージョンです。

最新リリースは [v1.0.0-rc.14](https://github.com/aws/aws-xray-sdk-go/releases/tag/v1.0.0-rc.14) (2019年9月)です。
しかし、 `go get` はデフォルトではRC版をとってきてくれません。
明示的に `go get github.com/aws/aws-xray-sdk-go@v1.0.0-rc.14` を指定する必要があります。
バグフィックスが多めなのと、カジュアルに新機能とかが入ってくるので、RC版の使用を強く推奨します。


## contextを正しく扱ってないときはデフォルトpanic

X-Ray はアプリケーションの処理の単位をセグメントをいう概念で表します。

- [AWS X-Ray の概念](https://docs.aws.amazon.com/ja_jp/xray/latest/devguide/xray-concepts.html)

処理が複数に分割できる場合、セグメントが複数のサブセグメント含む場合があります。
ここで注意が必要なのは、セグメントの作成とサブセグメントの作成との挙動の違いです。

サブセグメントを作るときは **親になるセグメントが必須** です。

```go
// 親セグメントが見つからないので panic
ctx, seg := xray.BeginSubsegment(context.Background(), "subsegment-name")

// サブセグメントを作るにはセグメントが必要
ctx, seg := xray.BeginSegment(context.Background(), "service-name")
ctx, subseg := xray.BeginSubsegment(ctx, "subsegment-name")
```

セグメント同士には親子関係を設定できません。例えば以下のコードで `seg1` と `seg2` は無関係な別のセグメントです。

```go
// seg1 と seg2 は関連のない別のセグメントとして扱われる
ctx, seg1 := xray.BeginSegment(context.Background(), "service-name")
ctx, seg2 := xray.BeginSegment(ctx, "subsegment-name")
```

SDKにはいくつかユーティリティ関数が用意されていますが、こういった理由から作成するのがセグメントなのかサブセグメントなのかが重要です。
`xray.Handler` はセグメントを、 `xray.Capture`, `xray.AWS`, `xray.Client`, `xray.SQL` はサブセグメントを作成します。
サブセグメントを作るユーティリティ関数を使うときは、必ず親セグメントが存在しなければなりません。

ここで問題になってくるのが **親セグメントが設定されていない場合はデフォルトでpanicする** ということです。
もちろん、この動作は変更可能で、 `AWS_XRAY_CONTEXT_MISSING` 環境変数でログを吐くだけにできます。

```bash
export AWS_XRAY_CONTEXT_MISSING=LOG_ERROR
# default: RUNTIME_ERROR
```

うっかり `context.Background()` なんかを使って AWS API を叩く箇所があると、容赦なく `panic` します。
`panic` するとスタックトレースが表示されるのでデバッグには便利ですが、未設定のまま本番環境にあげないようにしましょう。

うっかりをよくやってしまうのでデフォルト `LOG_ERROR` が良かった・・・。

(ちなみに、この `AWS_XRAY_CONTEXT_MISSING` 環境変数は、2020-02-11現在の[公式ドキュメント](https://docs.aws.amazon.com/xray/latest/devguide/xray-sdk-go-configuration.html#xray-sdk-go-configuration-envvars) には存在しないという地味な落とし穴もあります)


## AWS Lambda では LOG_ERROR がデフォルト

さて、前節で出てきた `AWS_XRAY_CONTEXT_MISSING` ですが、AWS Lambda ではデフォルト値が違います。

> [環境変数を使用した AWS X-Ray との通信](https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/lambda-x-ray.html#lambda-x-ray-env-variables)
>
> `AWS_XRAY_CONTEXT_MISSING`: X-Ray SDK はこの変数を使用して、関数が X-Ray データを記録しようとしたがトレーシングヘッダーを使用できない場合の動作を決定します。Lambda はデフォルトでこの値を `LOG_ERROR` に設定します

親切ですね。

最初から `LOG_ERROR` をデフォルトにしてくれると、とてもありがたい・・・。


## S3 で大きなファイルをあげようとするとpanicする

- [Large files cause panic with S3 #175](https://github.com/aws/aws-xray-sdk-go/issues/175)

`s3manager` を使うと、大きなファイルのアップロード時は自動的に分割してくれます。
しかし、分割時に親セグメントの情報を失ってしまうようです。
結果、親セグメントが見つからず `panic`

今の所 `panic` を避けるには、 `AWS_XRAY_CONTEXT_MISSING` でログに吐くようにするしか無いようです。


## 環境変数の設定が常に最優先

`AWS_XRAY_CONTEXT_MISSING` はアプリケーションからも変更可能です。

```go
xray.Configure(xray.Config{
    ContextMissingStrategy: ctxmissing.LogErrorStrategy,
})
```

しかし、 **環境変数が設定されている場合、この設定は無視されます** 。
有効になるのは `AWS_XRAY_CONTEXT_MISSING` が設定されていない場合のみです。

・・・ AWS SDK と真逆ですね？
(例えば `AWS_REGION` 環境変数よりも、アプリケーション内の `config.Region` が優先される)
なぜ、こんなユーザーを混乱させるような設定になっているんでしょうね？
単なる実装ミスかと思い、他言語の X-Ray SDK (Ruby, Python, C#, Java) も確認してみたのですが、
Goと同様に環境変数が最優先でした。


## 最新リリースだと環境変数からの設定読み込みがバグっている

`AWS_XRAY_CONTEXT_MISSING` ですが、万が一ミスがあると `panic` するので **非常に重要な設定** です。
さっきから何度も出ていることからも分かりますね。

・・・にも関わらず、2020-02-11時点での最新版 v1.0.0-rc14 には、 **ContextMissingStrategyを環境変数から読んでくれない** という致命的なバグがあります。

- [context missing environment varibale fix #161](https://github.com/aws/aws-xray-sdk-go/pull/161)

AWS Lambda では `LOG_ERROR` がデフォルトだと書きました。
しかし、v1.0.0-rc14 以前の X-Ray SDK を使っている場合は忘れてください。
親セグメントが見つからなかった場合、AWS Lambda 上で実行していたとしても `panic` します。

アプリケーション内で明示的に `LOG_ERROR` を指定しましょう。

```go
xray.Configure(xray.Config{
    ContextMissingStrategy: ctxmissing.LogErrorStrategy,
})
```

ややこしいのは `xray.Configure` を呼び出したときは「環境変数の設定が常に最優先」のルールが発動するという点です。
どうしてこうなった。

[#161](https://github.com/aws/aws-xray-sdk-go/pull/161) は master ブランチに取り込まれているので、
次のリリースには取り込まれる、はず。


## まとめ

AWS X-Ray SDK Go のインストールは以下のコマンドで。

```bash
$ go get github.com/aws/aws-xray-sdk-go@v1.0.0-rc.14
$ export AWS_XRAY_CONTEXT_MISSING=LOG_ERROR
```

main関数の最初の方で、以下の設定をいれること。

```go
xray.Configure(xray.Config{
    ContextMissingStrategy: ctxmissing.LogErrorStrategy,
})
```

プルリクエスト送るためにザッとSDK全体をみたのですが、 `gofmt` すらかかっていない状態だったり、グローバル変数を多用していたり、
Goに慣れていない人が別言語の実装を移植した雰囲気があるので、他にも罠がありそうです。

・・・もう書き直して、「俺の考えた最強の AWS X-Ray SDK」を作ったほうが早いんじゃないか？という気もしなくはないですが、これもこみゅにてぃーへの還元・・・もうちょっとだけ頑張って地雷処理してみます・・・。

-----
以下チラシの裏

[この辺](https://github.com/aws/aws-xray-sdk-go/blob/16d917bfd8d13242ae4f03807a10773a5e9cd468/xray/default_streaming_strategy.go#L59-L83) とか意図がわからなくて困ってる。

```go
	for i := 0; i < len(seg.rawSubsegments); i++ {
		child := seg.rawSubsegments[i]
		seg.rawSubsegments[i] = seg.rawSubsegments[len(seg.rawSubsegments)-1]
		seg.rawSubsegments[len(seg.rawSubsegments)-1] = nil
		seg.rawSubsegments = seg.rawSubsegments[:len(seg.rawSubsegments)-1]

		seg.Subsegments[i] = seg.Subsegments[len(seg.Subsegments)-1]
		seg.Subsegments[len(seg.Subsegments)-1] = nil
		seg.Subsegments = seg.Subsegments[:len(seg.Subsegments)-1]

		atomic.AddUint32(&seg.ParentSegment.totalSubSegments, ^uint32(0))

		// Add extra information into child subsegment
		child.Lock()
		child.beforeEmitSubsegment(seg)
		cb, err:= json.Marshal(child)
		if err!= nil{
			logger.Errorf("JSON error while marshalling subsegment: %v",err)
		}
		outSegments = append(outSegments, cb)
		logger.Debugf("Streaming subsegment named '%s' from segment tree.", child.Name)
		child.Unlock()

		break
	}
```

~~Go初心者どころか、プログラミング初心者が書いたんじゃないか・・・？~~
