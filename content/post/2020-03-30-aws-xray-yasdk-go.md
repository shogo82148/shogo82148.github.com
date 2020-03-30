---
layout: post
title: "Yet Another AWS X-Ray Go SDK を作った"
slug: aws-xray-yasdk-go
date: 2020-03-30 06:37:00 +0900
comments: true
categories: [aws, go, golang]
---

[AWS X-Ray Go SDK の地雷処理をしている話](https://shogo82148.github.io/blog/2020/02/11/aws-xray-golang/) で投げた[SQLのプルリクエスト](https://github.com/aws/aws-xray-sdk-go/pull/169) も無事マージしてもらい、
その後もちょくちょくプルリクエストを投げて地雷処理をしていたんですが、我慢できずにやってしまいました・・・。

- [Yet Another AWS X-Ray SDK for Go](https://github.com/shogo82148/aws-xray-yasdk-go)

そもそも [AWS X-Ray](https://aws.amazon.com/jp/xray/) ってなんだ、という方は以下のリンクから [@fujiwara](https://twitter.com/fujiwara) さんの記事へ飛べるのでどうぞ。

- [AWS Lambda Perl Runtime で AWS X-Ray を使えるようになりました](https://shogo82148.github.io/blog/2019/08/21/aws-xray-with-perl-lambda-runtime/)

## 使い方

だいたいオフィシャルSDKと一緒です。
ただし、パッケージ分割をしたので、呼び出す関数名等はちょっと変わってます。
他にも微妙に挙動が違う箇所があります。

### 環境変数の設定

`AWS_XRAY_DAEMON_ADDRESS`, `AWS_XRAY_CONTEXT_MISSING` 等の環境変数の設定項目は本家と合わせました。
ただし、以下の点が本家とは異なります。

- **コード内の設定が優先されます。** 環境変数はコード内で明示的に設定が行われなかった場合のフォールバックです。
- **`AWS_XRAY_CONTEXT_MISSING` のデフォルト値は `LOG_ERROR` です。**

### セグメントの作り方

オフィシャルSDKは `seg.Close(err)` のようにセグメントを閉じるときにエラーを渡します。
Go には `defer` という便利な機能があるので、セグメントを閉じるときもこれを使いたいところです。
だたエラーを正しく受け取るには、以下のように戻り値に名前をつけて、`defer` 部分を無名関数の呼び出しにする必要があります。

```go
// オフィシャルSDKの場合
import "github.com/aws/aws-xray-sdk-go/xray"

func DoSomethingWithSubsegment(ctx context.Context) (err error) {
	ctx, seg := xray.BeginSubsegment(ctx, "service-name")
	defer func() {
		seg.Close(err)
	}()
	err = doSomething(ctx)
	return
}
```

ただこれも万能ではなく、Goのエラーには `io.EOF` のような、このエラーに対して適切に対応できればOK、みたいなやつがあります。
これはエラーと記録してほしくありません。

というわけで、セグメントを閉じる処理とエラーを記録する処理は分割し、明示的にエラーを記録するインターフェースにしました。

```go
// Yet Another SDK の場合
import "github.com/shogo82148/aws-xray-yasdk-go/xray"

func DoSomethingWithSubsegment(ctx context.Context) error {
	ctx, seg := xray.BeginSubsegment(ctx, "service-name")
	defer seg.Close()
	if err := doSomething(ctx); seg.AddError(err) { // 明示的にエラーを記録する
		return err
	}
	return nil
}
```

単純な記述量は増えている気がするけど、こっちのほうが(良くも悪くも) Go っぽいかなと思ってます。

### SQL

SQLの実装は [go-sql-proxy](https://github.com/shogo82148/go-sql-proxy) をベースにしています。
SQLドライバーの一種として実装しているので、(元のコードでちゃんとContext対応できていれば)
X-Ray でトレースしていることを意識せず透過的に扱うことができます。
サードパーティーのORMも使えるはずです。

```go
import "github.com/shogo82148/aws-xray-yasdk-go/xraysql"

func DoSomething(ctx context.Context) error {
	db, err := xraysql.Open("postgres", "postgres://user:password@host:port/db")
	// db は *sql.DB で返ってくる
	row, err := db.QueryRowContext(ctx, "SELECT 1")
	return err
}
```

### AWS SDK

`xrayaws.Client` を呼ぶだけです。
AWS SDKが用意しているフックポイントにいい感じにトレース処理を仕込んでくれるので、他に特別な処理は必要ありません。

```go
import "github.com/shogo82148/aws-xray-yasdk-go/xrayaws"

func DoSomething(ctx context.Context) error {
	sess := session.Must(session.NewSession())
	dynamo := dynamodb.New(sess)
	xrayaws.Client(dynamo.Client) // この行を追加するだけ
	dynamo.ListTablesWithContext(ctx, &dynamodb.ListTablesInput{})
}
```

### HTTP Client

`http.DefaultClient` の代わりに `xrayhttp.Client(nil)` を使うだけです。
`http.RoundTripper` の実装をいい感じに置き換えてくれるので、他に特別な処理は必要ありません。

```go
func getExample(ctx context.Context) ([]byte, error) {
	req, err := http.NewRequest(http.MethodGet, "http://example.com")
	if err != nil {
		return nil, err
	}
	req = req.WithContext(ctx)

	client = xrayhttp.Client(nil) // この行を追加するだけ
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return ioutil.ReadAll(resp.Body)
}
```

### HTTP Server

`xrayhttp.Handler` で囲んであげるだけです。かんたんですね。

```go
func main() {
	namer := xrayhttp.FixedTracingNamer("myApp")
	h := xrayhttp.Handler(namer, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "Hello World!")
	}))
	http.ListenAndServe(":8000", h)
}
```

[AWS X-Ray コンソールでのサンプリングルールの設定](https://docs.aws.amazon.com/ja_jp/xray/latest/devguide/xray-console-sampling.html) にも対応したので、
コードの変更無しにサンプリングルールの変更ができます。

## まとめ

オフィシャルではない Yet Another な実装を書きました。

- [Yet Another AWS X-Ray SDK for Go](https://github.com/shogo82148/aws-xray-yasdk-go)

人柱募集中！
