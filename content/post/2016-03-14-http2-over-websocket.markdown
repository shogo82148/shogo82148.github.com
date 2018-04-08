---
layout: post
title: "ngrokみたいなHTTPプロキシを書いてみた"
slug: http2-over-websocket
date: 2016-03-14T22:59:00+09:00
comments: true
categories: [go, golang, websocket]
---

開発中のWebアプリをみんなに試してほしいけど、
サーバなんてなくて開発環境がローカルにしか無くて公開できないということは、
開発初期段階だとよくあることだと思います。
もちろん本格的にやるならテスト用にサーバを建てるべきですが、
小さなものなら[ngrok](https://ngrok.com/)を使うと簡単です。
[ngrok](https://ngrok.com/)の公開サーバへのHTTPリクエストをローカルにリレーして、
ローカルのサーバをお手がるに公開できるサービスです。

びっくりするほど簡単に公開できて便利ですが、
一応oAuthで制限とかかけたいなーとかカスタマイズしてみたくなってきたので、
似たようなものを自作できないかといろいろ遊んでみました。

その結果、HTTP2 over Websocketみたいな謎なものが出来上がってしまったというお話です。

<!-- More -->

## HTTP2 over Websocketというアイデア

[ngrok](https://ngrok.com/)っぽいものを実現するためには、
サーバが受け取ったHTTPリクエストをローカルの環境に転送する必要があります。
ご存知のとおり通常のHTTPではサーバ側からのプッシュ配信が難しいので、Websocketを使うのが良さそうです。
しかし、複数のコネクションで並列にやってくるHTTPリクエストを、一本のWebsocketに束ねる必要があり、
上手く制御するのは大変そうです。

さて、HTTP2は一つのTCPコネクションで複数のリクエストを並行処理する仕様があります。
「複数のリクエストを一本に束ねる」という点ではなんか似ているので、なんだか流用できそうな気がしてきました。
Golangならきっと上手いこと`interface`を実装すれば、なんとかできるのではとやってみました。


## 実装

HTTP2は暗号化や複雑なフロー制御を行っていますが、
外から見れば`net.Conn`インターフェースに読み書きしている何かに過ぎません。
そして、`websocket.Conn`も`net.Conn`を実装しているので、そのままHTTP2のライブラリに渡せるはずです。

そうしてできたのが以下のサーバです。

``` go server.go
package main

import (
	"errors"
	"log"
	"net/http"
	"net/http/httputil"
	"sync"

	"golang.org/x/net/http2"
	"golang.org/x/net/websocket"
)

type transport struct {
	m      sync.Mutex
	t      http.RoundTripper
	closed chan struct{}
}

var t *transport

func main() {
	t = &transport{}
	s := websocket.Server{Handler: websocket.Handler(Handler)}
	http.Handle("/", s)
	go http.ListenAndServe(":3000", nil)
	http.ListenAndServe(":3001", &httputil.ReverseProxy{
		Transport: t,
		Director: func(req *http.Request) {
		},
	})
}

func Handler(ws *websocket.Conn) {
	log.Println("start new connection")
	t2 := &http2.Transport{}
	conn, err := t2.NewClientConn(ws)
	if err != nil {
		log.Println(err)
		return
	}

	t.m.Lock()
	if t.t != nil {
		t.m.Unlock()
		log.Println("already connected.")
		return
	}
	t.t = conn
	t.m.Unlock()
	<-t.closed
	log.Println("close connection")
}

func (t *transport) RoundTrip(req *http.Request) (*http.Response, error) {
	t.m.Lock()
	t2 := t.t
	t.m.Unlock()
	if t2 == nil {
		return nil, errors.New("connection not found")
	}
	res, err := t2.RoundTrip(req)
	if err != nil {
		log.Println(err)
		t.m.Lock()
		t.t = nil
		t.m.Unlock()
		t.closed <- struct{}{}
		return nil, err
	}
	return res, nil
}
```

複数Websocketのコネクションが張られた場合の処理が少し煩雑ですが、思いのほか短くかけました。
3001番ポートに来たリクエストをWebsocket経由で転送します。
Websocketは3000番ポートで待ち受けです。

これにアクセスするためのクライアントがこちら。

``` go client.go
package main

import (
	"log"
	"net/http/httputil"
	"net/url"

	"golang.org/x/net/http2"
	"golang.org/x/net/websocket"
)

func main() {
	origin := "http://localhost:3000/"
	u := "ws://localhost:3000/"
	ws, err := websocket.Dial(u, "", origin)
	if err != nil {
		log.Fatal(err)
	}

	target, _ := url.Parse("http://localhost:8000/")

	s := &http2.Server{}
	s.ServeConn(ws, &http2.ServeConnOpts{
		Handler: httputil.NewSingleHostReverseProxy(target),
	})
}
```

Websocket経由でリクエストを受け付け、それを8000番ポートに転送します。
こちらも非常に短くかけました。
サーバーとクライアントを立ち上げて`http://localhost:3001/`にアクセスすると、
`http://localhost:8000/`の内容が見れるはずです。



## ngrok1.xについて

ところでngrokの旧バージョンはソースコードが公開されているから、こっちを使ったほうが早い？
でも、開発中止って書かれてて不安になる。

- [ngrok1.x](https://github.com/inconshreveable/ngrok)


## まとめ

ローカルのサーバをお手軽に公開するためのngrokというサービスを紹介しました。
自作のためのアイデアとして、http2 over websocketを試してみました。

設定の読み込みとかエラー処理とかセキュリティ周りとかいろいろ足りてない部分はありますが、
たったあれだけのコードで、ヘッダの圧縮転送、リクエストの並行処理等のHTTP2の機能が使えるのは面白いですね。

もうちょっと手を加えて多少は使えるものにしてみたいですね。
