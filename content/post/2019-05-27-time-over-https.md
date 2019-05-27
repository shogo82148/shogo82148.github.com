---
layout: post
title: "サーバーの時刻を伝える time wellknown uri を実装してみた"
slug: time-over-https
date: 2019-05-27 12:10:00 +0900
comments: true
categories: [go, golang]
---

インターネットをさまよっていたら、 `/.well-known/time` の存在を知ったので、雑に実装してみました。

## 使い方

うまいこと共存できそうだったので、[HTTP/WebSocketで時刻同期するWebNTPを書いた](https://shogo82148.github.io/blog/2017/03/11/go-webntp/) で作成した WebNTP の一部として実装してあります。

- [shogo82148/go-webntp](https://github.com/shogo82148/go-webntp)

```
$ go get github.com/shogo82148/go-webntp/cmd/webntp
$ webntp -serve :8080

$ curl -I localhost:8080/.well-known/time
HTTP/1.1 204 No Content
X-Httpstime: 1558915632.285965
Date: Mon, 27 May 2019 00:07:12 GMT
```

## 仕様

HTTPには「予約済みのURI」というものが定義されています。([RFC5785](https://tools.ietf.org/html/rfc5785))。

- [Well-Known URIs](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml)

[Let's Encrypt](https://letsencrypt.org/) でドメインの所有権確認に使用される [ACMEプロトコル(RFC8555)](https://tools.ietf.org/html/rfc8555) や、
[Mastodon](https://joinmastodon.org/) のユーザーディスカバリーに使用する [WebFinger(RFC7033)](https://tools.ietf.org/html/rfc7033)等々、
近年話題になったサービスの裏方で使われています。

- /.well-known/acme-challenge [ACMEプロトコル(RFC8555)](https://tools.ietf.org/html/rfc8555)
- /.well-known/webfinger [WebFinger(RFC7033)](https://tools.ietf.org/html/rfc7033)

Time over HTTPS も Well-Known URIs を利用するプロトコルのひとつです。

- /.well-known/time [Time over HTTPS specification](http://phk.freebsd.dk/time/20151129/)

仕様としては非常に単純で、サーバー側は HTTP の `HEAD` に対して、 `Date` ヘッダーをつけたリクエストを返すだけ。
より高精度な時刻を得るために `X-HTTPSTIME` ヘッダーに秒未満の情報を入れた Unix タイムスタンプ を返すこともできます。

-----

WebNTP を書いたときから「まあHTTPで時刻同期なんて二番煎じなんだろうなあ」とは思っていたものの、
IANAのような公共レジストリに Well-Known URIs として登録されているのには驚きました。

しかも登録者は [Poul-Henning_Kamp](https://en.wikipedia.org/wiki/Poul-Henning_Kamp)。
FreeBSDのコミッターを務めたり、[Varnish](https://github.com/varnishcache/varnish-cache)の開発をしている凄腕ハッカーですが、
プロジェクト名義ではなく、個人名義で登録されています。

Well-Known URIs への登録って個人でもできるんですね・・・知らなかった。

## 実装

さて、かなり簡単な仕様なので、実装も簡単です。
Goだとサーバーサイドの実装は、最低限以下のコードでOKです。

```go
func serve(rw http.ResponseWriter, req *http.Request) {
  now := time.Now()
  rw.Header().Set("X-HTTPSTIME", fmt.Sprintf("%d.%09d", now.Unix(), now.Nanosecond()))
  rw.WriteHeader(http.StatusNoContent)
}
```

一方クライアントサイドは `X-HTTPSTIME` ヘッダーに未対応のサーバー対応や、TLSハンドシェイク時間の考慮など、精度を高めるためには考慮すべきことがたくさんあり、ちょっと面倒です。
(WebNTPではまだ実装してない)


## まとめ

いろいろ書いたけど、「Well-Known URIs の登録は個人名義でもできる」ということに驚いた、ってことを言いたかった。


## 参考

- [Well-Known URIs](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml)
- [Time over HTTPS specification](http://phk.freebsd.dk/time/20151129/)
- [Poul-Henning_Kamp](https://en.wikipedia.org/wiki/Poul-Henning_Kamp)
