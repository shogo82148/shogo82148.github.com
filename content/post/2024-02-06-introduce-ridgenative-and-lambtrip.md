---
layout: post
title: "AWS Lambda Function URLsのイベントをnet/httpで扱えるridgenativeとlambtripを書いた"
slug: 2024-02-06-introduce-ridgenative-and-lambtrip
date: 2024-02-06 00:14:00 +0900
comments: true
categories: [aws, aws-lambda, go, golang]
---

AWS Lambda関数をGoの標準ライブラリのインターフェイスに変換するライブラリを作りました。

- `http.Handler` 実装: [shogo82148/ridgenative](https://github.com/shogo82148/ridgenative)
- `http.RoundTripper` 実装: [shogo82148/lambtrip](https://github.com/shogo82148/lambtrip)

## ridgenative

Lambda Function URLsではリクエストとレスポンスがJSON形式になって渡ってきます。
これらをGo標準ライブラリの `net/http.Request` と `net/http.ResponseWriter` で扱えるように書いたアダプターが
[shogo82148/ridgenative](https://github.com/shogo82148/ridgenative)です。

### 同じコードをHTTPサーバーやAWS Lambda上で動かす

これのうれしいポイントは `net/http.Handler` の実装をひとつ用意すれば、
普通のHTTPサーバーとしても、AWS Lambda上でも動かすことができるという点です。

たとえば以下のコードは `go run main.go` のように実行すると、
8080ポート上で動く普通のHTTPサーバーになります。

```go
package main

import (
  "fmt"
  "net/http"

  "github.com/shogo82148/ridgenative"
)

func main() {
  http.HandleFunc("/hello", handleRoot)

  // httpの代わりにridgenativeを呼び出す
  ridgenative.ListenAndServe(":8080", nil)
}

func handleRoot(w http.ResponseWriter, r *http.Request) {
  w.Header().Set("Content-Type", "text/plain")
  fmt.Fprintln(w, "Hello World")
}
```

`bootstrap` という名前でコンパイルして、zipで固めてアップロードすれば、
Lambda Function URLsやAPI Gatewayで動くHTTP APIの完成です。

```
GOOS=linux GOARCH=arm64 CGOENABLED=0 go build -o bootstrap main.go
zip archive.zip bootstrap
```

ソースコードには一切手を触れることなく、まったく同じコードが動きます。

祝日APIやURL圧縮サイトの裏側ではridgenativeが動いています。
動作確認はローカルでできるので非常に便利です。

- [祝日APIを公開しました](https://shogo82148.github.io/blog/2021/09/04/holidays-api-is-released/)
- [URL圧縮サイトを作ってみた](https://shogo82148.github.io/blog/2023/11/18/2023-11-18-url-compressor-for-qr-code/)

-----

まあ、アイデア自体は[fujiwara/ridge](https://github.com/fujiwara/ridge)からの借り物なんですが・・・。
ridgeから [Apex](https://github.com/apex/apex) 依存を取り除いたものという意味で、ridgenativeという名称で開発を始めました。
しかし、ridge本家からApex依存が取り除かれてしまったため、この点ではメリットがなくなってしまいました。

### ridgenativeでResponse Streamを扱う

ridgenativeはResponse Streamにも対応しています。
通常のLambda関数は実行が完了するまで結果を受け取ることができません。
Response Streamを有効化すると、Lambda関数の実行中に少しずつ実行結果を返すことができます。

- [AWS Lambda レスポンスストリーミングの紹介](https://aws.amazon.com/jp/blogs/news/introducing-aws-lambda-response-streaming/)

`RIDGENATIVE_INVOKE_MODE` 環境変数を `RESPONSE_STREAM` に設定することで有効化できます。

## lambtrip

ridgenativeはHTTPサーバー側の実装でした。
HTTPクライアント側でも似たようなことができるのでは？と思い作ったのが、[shogo82148/lambtrip](https://github.com/shogo82148/lambtrip)です。
lambtripはLambda関数の呼び出しを `net/http.RoundTripper` に変換します。

### 新しいプロトコルとして登録する

`http.Transport`に新しいプロトコルとして追加すれば、普通のHTTP呼び出しと透過的に扱えます。

```go
// AWS SDKを初期化する
cfg, err := config.LoadDefaultConfig(context.Background())
if err != nil {
  panic(err)
}
svc := lambda.NewFromConfig(cfg)

// lambdaプロトコルを登録する
t := &http.Transport{}
t.RegisterProtocol("lambda", lambtrip.NewBufferedTransport(svc))
c := &http.Client{Transport: t}

// 普通のHTTP呼び出しと同じ感覚で扱える
resp, err := c.Get("lambda://function-name/foo/bar")
if err != nil {
  panic(err)
}
defer resp.Body.Close()
```

### リバースプロキシする

Go標準のインターフェイスに合わせることのメリットは、`http.Client`以外にも組み合わせの幅が広がるという点です。
たとえば`httputil.ReverseProxy`と組み合わせてみましょう。

```go
// AWS SDKを初期化する
cfg, err := config.LoadDefaultConfig(context.Background())
if err != nil {
  panic(err)
}
svc := lambda.NewFromConfig(cfg)

// リバースプロキシ
proxy := &httputil.ReverseProxy{
  Director: func(req *http.Request) {
    req.URL.Host = "function-name"
  },
  Transport: lambtrip.NewBufferedTransport(svc),
}
if err := http.ListenAndServe(":8080", proxy); err != nil {
  panic(err)
}
```

HTTPリクエストを受け取ってAWS Lambdaを起動する、自作のFunction URLsを簡単に作ることができます。

### lambtripでResponse Streamを扱う

lambtripもResponse Streamに対応しています。
Response Streamを有効化するには、[lambtrip.BufferedTransport](https://pkg.go.dev/github.com/shogo82148/lambtrip#BufferedTransport)の代わりに
[lambtrip.ResponseStreamTransport](https://pkg.go.dev/github.com/shogo82148/lambtrip#ResponseStreamTransport)を使用します。

```go
// AWS SDKを初期化する
cfg, err := config.LoadDefaultConfig(context.Background())
if err != nil {
  panic(err)
}
svc := lambda.NewFromConfig(cfg)

// lambtrip.NewResponseStreamTransportを使ってlambdaプロトコルを登録する
t := &http.Transport{}
t.RegisterProtocol("lambda", lambtrip.NewResponseStreamTransport(svc))
c := &http.Client{Transport: t}
```

## まとめ

AWS Lambda関数をGoの標準ライブラリのインターフェイスに変換するライブラリを作りました。

- `http.Handler` 実装: [shogo82148/ridgenative](https://github.com/shogo82148/ridgenative)
- `http.RoundTripper` 実装: [shogo82148/lambtrip](https://github.com/shogo82148/lambtrip)

標準ライブラリのインターフェイスなので、色々な組み合わせで遊べると思います。
ぜひ試してみてください。

## 参考

- [fujiwara/ridge](https://github.com/fujiwara/ridge)
- [API Gateway + Lambdaでcatch allした処理をApex + Goでnet/httpで扱える ridge を書いた](https://sfujiwara.hatenablog.com/entry/2016/10/03/153022)
- [Ridge - GAE/Goみたいなのon AWS](https://speakerdeck.com/fujiwara3/go-mitainafalse-on-aws)
- [shogo82148/ridgenative](https://github.com/shogo82148/ridgenative)
- [shogo82148/lambtrip](https://github.com/shogo82148/lambtrip)
- [AWS Lambda レスポンスストリーミングの紹介](https://aws.amazon.com/jp/blogs/news/introducing-aws-lambda-response-streaming/)
