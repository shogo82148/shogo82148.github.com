---
layout: post
title: "GoでForwarded Headerのパーサーを作った"
slug: 2024-01-09-go-forwarded-header
date: 2024-01-09 22:28:00 +0900
comments: true
categories: [go, golang]
---

ちょっとした用事で Forwarded ヘッダーの解析をしたくなったので、解析ライブラリを書いてみました。

- [shogo82148/forwarded-header](https://github.com/shogo82148/forwarded-header)

## 背景

Amazon API GatewayのHTTP Proxy Integrationを利用しているプロジェクトで、
クライアントのIPアドレスを知りたい用件がありました。

リバースプロキシの運用に慣れている人なら、「クライアントのIPアドレスを取得したい」と聞いて真っ先に思いつくのは [X-Forwarded-For ヘッダー](https://developer.mozilla.org/ja/docs/Web/HTTP/Headers/X-Forwarded-For)でしょう。
しかし、HTTP Proxy Integrationはこのヘッダーを付与しません。

なんとかIPアドレスを取得できないかと調べてみると、HTTP Proxy IntegrationはForwardedヘッダーを付与することがわかりました。

- [Amazon API Gateway: Explaining HTTP Proxy in HTTP API](https://medium.com/@lancers/amazon-api-gateway-explaining-http-proxy-in-http-api-3ea0afe6b03c)

Forwardedヘッダーは [RFC 7239](https://www.rfc-editor.org/info/rfc7239) で標準化されているヘッダーです。
リバースプロキシによって失われてしまう情報を補完するために利用します。

- [RFC 7239: Forwarded HTTP Extension](https://www.rfc-editor.org/info/rfc7239)
- [RFC 7239: Forwarded HTTP拡張](https://shogo82148.github.io/rfc-translated-ja/rfc7239.html)
- [Forwarded - MDN](https://developer.mozilla.org/ja/docs/Web/HTTP/Headers/Forwarded)

Forwardedヘッダーを見ればクライアントのIPアドレスもわかります。
たとえば以下の例では `192.0.2.60` がクライアントのIPアドレスです。

```
Forwarded: for=192.0.2.60; proto=http; by=203.0.113.43
```

X-Forwarded-Forヘッダーは単純なカンマ区切りのテキストだったので、Split関数で十分でした。
一方Forwardedヘッダーは構造化されているため、パーサーが必要です。
そこまで複雑ではないので、実装してみました。

## 使い方

解析は [Parse](https://pkg.go.dev/github.com/shogo82148/fowarded-header#Parse)関数を呼び出すだけです。

```go
package main

import (
	"fmt"
	"net/http"
	"os"

	forwardedheader "github.com/shogo82148/forwarded-header"
)

func main() {
	header := make(http.Header)
	header.Set("Forwarded", "by=203.0.113.43;for=192.0.2.60;proto=http")

	// parse the Forwarded Header
	parsed, err := forwardedheader.Parse(header.Values("Forwarded"))
	if err != nil {
		panic(err)
	}
	for _, f := range parsed {
		fmt.Println(f)
	}
	// Output:
	// by=203.0.113.43;for=192.0.2.60;proto=http
}
```

## 参考

- [HTTP ヘッダーと Application Load Balancer](https://docs.aws.amazon.com/ja_jp/elasticloadbalancing/latest/application/x-forwarded-headers.html)
- [Amazon API Gateway: Explaining HTTP Proxy in HTTP API](https://medium.com/@lancers/amazon-api-gateway-explaining-http-proxy-in-http-api-3ea0afe6b03c)
- [RFC 7239: Forwarded HTTP Extension](https://www.rfc-editor.org/info/rfc7239)
- [RFC 7239: Forwarded HTTP拡張](https://shogo82148.github.io/rfc-translated-ja/rfc7239.html)
- [X-Forwarded-For - MDN](https://developer.mozilla.org/ja/docs/Web/HTTP/Headers/X-Forwarded-For)
- [Forwarded - MDN](https://developer.mozilla.org/ja/docs/Web/HTTP/Headers/Forwarded)
