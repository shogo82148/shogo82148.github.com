---
layout: post
title: "Go1.8のGraceful Shutdownとgo-gracedownの対応"
date: 2017-01-21 12:44:32 +0900
comments: true
categories: [go, golang]
---

Go1.8beta1が出た時に、Go1.8で追加される予定のGraceful Shutdownについて書く！
とTwitterに書き込んで早1ヶ月。
この前の金曜日に[Go1.8rc2がリリースされ](https://twitter.com/golang/status/822201571928731648)、正式リリースも間近になってきて、
さすがに書かねばという気持ちになって来たので、がんばって検証してみます。

<!-- More -->

## 公式サポートで増える予定の機能

以前[Go言語でGraceful Restartをするときに取りこぼしを少なくする](https://shogo82148.github.io/blog/2015/11/23/golang-graceful-restart-2nd/)で
紹介したように[shogo82148/go-gracedown](https://github.com/shogo82148/go-gracedown)というものを書きました。
あれから時は経ち、ついにGo1.8からは[Graceful Shudownがbuild-inの機能として提供](https://github.com/golang/go/issues/4674)される予定です。
公式サポートが入ることによって、以下のような機能を使えるようになります。

### HTTP/2のGraceful Shutdownができる

HTTP/2ではGOAWAYフレームという接続を切ることを通知する機能があります。
Go1.8からはシャットダウン時にこのGOAWAYフレームを送ってくれるようになります。
GOAWAYフレームはサーバ側から任意のタイミングで送ることができ、
どこまで正常に処理できたかをクライアントに伝えられるという利点があります。

余談ですが、この機能は[x/net/http2を利用している場合は動かない](https://github.com/golang/go/issues/18471)らしいです。
[importしたときには動かないけどbundleしたときにだけ動く黒魔術](https://github.com/golang/net/blob/8fd7f25955530b92e73e9e1932a41b522b22ccd9/http2/server.go#L2716-L2736)が使われているためです。
覚えておいても今後絶対使うことはなさそう。というか使いたくない・・・。

### contextが使える

go-gracedownを作った頃は、contextはまだ標準パッケージに取り込まれていなかったので対応していませんでした。
(1.7のリリース時に対応を怠っていただけとも言える)
net/httpのシャットダウンはもちろんcontextに対応しています。
これにより、Graceful Shutdownを中断して強制終了する、
ということが簡単にできるようになります。


## 公式サポートで変更になる予定の挙動

Keep-Aliveでのリクエストの挙動が少し変わります。
1.7以前のgo-gracedownでは、クライアントにKeep-Aliveが無効になったのを伝え、
クライアント側から接続を切るのを待つように実装してしました。
多少接続時間が延びたとしてもクライアント側でよくわからないエラーになるよりはマシだろ、との考えからです。

1.8からはシャットダウン時にIdle状態(TCP接続は有効だけど、リクエストは処理していない状態)な接続は切断されます。
内部で使っている[Server.SetKeepAlivesEnabled](https://golang.org/pkg/net/http/#Server.SetKeepAlivesEnabled)の
挙動が[変更になった](https://github.com/golang/go/issues/9478)ためです。

Goの中の人的には「この挙動が原因で万が一トラブルになっても、クライアントがリトライしてくれるから大丈夫でしょ」とのことのようです。
サーバシャットダウン以外にもネットワークトラブル等でも接続は切れるので、
クライアント側で頑張ってというのは正論ですが、
どの程度エラーが増えるのかは気になるところです。


### go-gracedownの対応

go-gracedownはGo1.8でコンパイルされたときはbuild-inの機能を直接使うようになります。
中身はほとんどがインターフェースの互換性を保つためのコードなので、
機能的なメリットは完全になくなってしまいました・・・。
HTTP/2サポートも問題なく動くはずです。
逆にパッケージの依存が増えること以外はデメリットはないともいえます。

Go1.7以下では今までの方法にフォールバックしてくれます。
というわけで、以下のような人には有用です。

- 深淵な理由でGo1.7以下しか使えない人
- Go1.8とGo1.7以下のサポートがどうしても必要な人
- Go1.8にアップグレードしたけど、graceful shutdownの処理を書き換えるのがめんどくさい人


ところで、環境が悪いときに性能を落としたり機能を制限することをフォールバック(fall back)というわけですが、
逆に環境が良いときに性能を上げたり機能を拡張することはなんていうんですかね？
モデムでは通信環境が良いときに高速な通信方式に切り変えることを「フォールフォワード(fall forward)」というらしいです。
「Go1.8ではbild-inのGraceful Shutdownにフォールフォワードする」で使い方あってます？


## 使い方

### Server.Shutdownを使う

[Go(その3) Advent Calendar](http://qiita.com/advent-calendar/2016/go3)の
[最終日の記事](http://qiita.com/najeira/items/806cacb9bba96ff06ec4)でも扱ってますが改めて。

``` go
package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/lestrrat/go-server-starter/listener"
)

func main() {
	log.Printf("start pid %d\n", os.Getpid())

	listeners, err := listener.ListenAll()
	if err != nil && err != listener.ErrNoListeningTarget {
		panic(err)
	}
	var l net.Listener
	if err == listener.ErrNoListeningTarget {
		// Fallback if not running under Server::Starter
		l, err = net.Listen("tcp", ":8080")
		if err != nil {
			panic("Failed to listen to port 8080")
		}
	} else {
		l = listeners[0]
	}

    // 別goroutineでServeしていることに注意！
	srv := &http.Server{Handler: newHandler()}
	go func() {
		srv.Serve(l)
	}()

    // mainの中でシグナルの待受をしていることに注意！
	signal_chan := make(chan os.Signal)
	signal.Notify(signal_chan, syscall.SIGTERM)
	for {
		s := <-signal_chan
		if s == syscall.SIGTERM {
			log.Printf("SIGTERM!!!!\n")
			srv.Shutdown(context.Background())
			return
		}
	}
}

func newHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "from pid %d.\n", os.Getpid())
	})
	return mux
}
```

go-gracedownからの移行するさいの注意点は以下の通りです。

- `Server.Shutdown`を使う(`Serer.Close`もあるけど、そっちはGracefulではない)
- `Server.Serve`は**シャットダウンが始まる**とすぐに制御を返す(**シャットダウンが終わる**とではない)
- `Server.Shutdown`は**シャットダウンが終わる**と制御を返す(**シャットダウンが始まる**とではない)

### go-gracedownを使う

go-gracedownの使い方も再掲しておきます。
Go1.6から利用方法は一切変更はないですが、
Go1.8でコンパイルすると`Server.Shutdown`を利用してくれます。

``` go
package main

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/lestrrat/go-server-starter/listener"
	"github.com/shogo82148/go-gracedown"
)

func main() {
	log.Printf("start pid %d\n", os.Getpid())

	signal_chan := make(chan os.Signal)
	signal.Notify(signal_chan, syscall.SIGTERM)
	go func() {
		for {
			s := <-signal_chan
			if s == syscall.SIGTERM {
				log.Printf("SIGTERM!!!!\n")
				gracedown.Close()
			}
		}
	}()

	listeners, err := listener.ListenAll()
	if err != nil && err != listener.ErrNoListeningTarget {
		panic(err)
	}
	var l net.Listener
	if err == listener.ErrNoListeningTarget {
		// Fallback if not running under Server::Starter
		l, err = net.Listen("tcp", ":8080")
		if err != nil {
			panic("Failed to listen to port 8080")
		}
	} else {
		l = listeners[0]
	}

	gracedown.Serve(l, newHandler())
}

func newHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "from pid %d.\n", os.Getpid())
	})
	return mux
}
```

### HTTP/2を使う

せっかくHTTP/2にも対応したことなので、
Server::Starterを使ってHTTP/2サーバのGraceful Restartをする例も書いてみました。

``` go
package main

import (
	"context"
	"crypto/tls"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/lestrrat/go-server-starter/listener"
)

// net/http/internal/testcert.go から拝借
var localhostCert = []byte(`-----BEGIN CERTIFICATE-----
MIICEzCCAXygAwIBAgIQMIMChMLGrR+QvmQvpwAU6zANBgkqhkiG9w0BAQsFADAS
MRAwDgYDVQQKEwdBY21lIENvMCAXDTcwMDEwMTAwMDAwMFoYDzIwODQwMTI5MTYw
MDAwWjASMRAwDgYDVQQKEwdBY21lIENvMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCB
iQKBgQDuLnQAI3mDgey3VBzWnB2L39JUU4txjeVE6myuDqkM/uGlfjb9SjY1bIw4
iA5sBBZzHi3z0h1YV8QPuxEbi4nW91IJm2gsvvZhIrCHS3l6afab4pZBl2+XsDul
rKBxKKtD1rGxlG4LjncdabFn9gvLZad2bSysqz/qTAUStTvqJQIDAQABo2gwZjAO
BgNVHQ8BAf8EBAMCAqQwEwYDVR0lBAwwCgYIKwYBBQUHAwEwDwYDVR0TAQH/BAUw
AwEB/zAuBgNVHREEJzAlggtleGFtcGxlLmNvbYcEfwAAAYcQAAAAAAAAAAAAAAAA
AAAAATANBgkqhkiG9w0BAQsFAAOBgQCEcetwO59EWk7WiJsG4x8SY+UIAA+flUI9
tyC4lNhbcF2Idq9greZwbYCqTTTr2XiRNSMLCOjKyI7ukPoPjo16ocHj+P3vZGfs
h1fIw3cSS2OolhloGw/XM6RWPWtPAlGykKLciQrBru5NAPvCMsb/I1DAceTiotQM
fblo6RBxUQ==
-----END CERTIFICATE-----`)

var localhostKey = []byte(`-----BEGIN RSA PRIVATE KEY-----
MIICXgIBAAKBgQDuLnQAI3mDgey3VBzWnB2L39JUU4txjeVE6myuDqkM/uGlfjb9
SjY1bIw4iA5sBBZzHi3z0h1YV8QPuxEbi4nW91IJm2gsvvZhIrCHS3l6afab4pZB
l2+XsDulrKBxKKtD1rGxlG4LjncdabFn9gvLZad2bSysqz/qTAUStTvqJQIDAQAB
AoGAGRzwwir7XvBOAy5tM/uV6e+Zf6anZzus1s1Y1ClbjbE6HXbnWWF/wbZGOpet
3Zm4vD6MXc7jpTLryzTQIvVdfQbRc6+MUVeLKwZatTXtdZrhu+Jk7hx0nTPy8Jcb
uJqFk541aEw+mMogY/xEcfbWd6IOkp+4xqjlFLBEDytgbIECQQDvH/E6nk+hgN4H
qzzVtxxr397vWrjrIgPbJpQvBsafG7b0dA4AFjwVbFLmQcj2PprIMmPcQrooz8vp
jy4SHEg1AkEA/v13/5M47K9vCxmb8QeD/asydfsgS5TeuNi8DoUBEmiSJwma7FXY
fFUtxuvL7XvjwjN5B30pNEbc6Iuyt7y4MQJBAIt21su4b3sjXNueLKH85Q+phy2U
fQtuUE9txblTu14q3N7gHRZB4ZMhFYyDy8CKrN2cPg/Fvyt0Xlp/DoCzjA0CQQDU
y2ptGsuSmgUtWj3NM9xuwYPm+Z/F84K6+ARYiZ6PYj013sovGKUFfYAqVXVlxtIX
qyUBnu3X9ps8ZfjLZO7BAkEAlT4R5Yl6cGhaJQYZHOde3JEMhNRcVFMO8dJDaFeo
f9Oeos0UUothgiDktdQHxdNEwLjQf7lJJBzV+5OtwswCWA==
-----END RSA PRIVATE KEY-----`)

func main() {
	log.Printf("start pid %d\n", os.Getpid())

	listeners, err := listener.ListenAll()
	if err != nil && err != listener.ErrNoListeningTarget {
		panic(err)
	}
	var l net.Listener
	if err == listener.ErrNoListeningTarget {
		// Fallback if not running under Server::Starter
		l, err = net.Listen("tcp", ":8080")
		if err != nil {
			panic("Failed to listen to port 8080")
		}
	} else {
		l = listeners[0]
	}
	cert, err := tls.X509KeyPair(localhostCert, localhostKey)
	if err != nil {
		panic(err)
	}
	tlsConfig := &tls.Config{
		NextProtos:   []string{"h2"},
		Certificates: []tls.Certificate{cert},
	}

	srv := &http.Server{
		Handler:   newHandler(),
		TLSConfig: tlsConfig,
	}
	l = tls.NewListener(l, tlsConfig)
	go func() {
		srv.Serve(l)
	}()

	signal_chan := make(chan os.Signal)
	signal.Notify(signal_chan, syscall.SIGTERM)
	for {
		s := <-signal_chan
		if s == syscall.SIGTERM {
			log.Printf("SIGTERM!!!!\n")
			srv.Shutdown(context.Background())
			return
		}
	}
}

func newHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "from pid %d.\n", os.Getpid())
	})
	return mux
}
```

`NextProtos`へ明示的に`h2`を指定する必要があるのがポイントです。
net/httpはデフォルトでHTTP/2を有効にしてくれますが、
`TLSConfig`が指定されているときは自前でやる必要があります。


## 実験

HTTP/2に対応していて証明書の検証もスキップできて・・・という条件で
ベンチマークソフトを探すのが面倒だったので、Goで自作です。
あまり詳しい統計情報は要らないので、負荷をかけるのにリソースを割きたかったというのもあります。

``` go
package main

import (
	"crypto/tls"
	"flag"
	"io"
	"io/ioutil"
	"log"
	"net"
	"net/http"
	"time"

	"github.com/kayac/parallel-benchmark/benchmark"
	"golang.org/x/net/http2"
)

type myWorker struct {
	URL    string
	client *http.Client
	buf    []byte
}

func (w *myWorker) Setup() {
	tr := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		MaxIdleConns:        1,
		IdleConnTimeout:     90 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
		TLSClientConfig: &tls.Config{
			// テストなので証明書の検証はスキップ
			// プロダクションでは必ず有効にしてください！
			InsecureSkipVerify: true,
		},
		ExpectContinueTimeout: 1 * time.Second,
	}
	if err := http2.ConfigureTransport(tr); err != nil {
		panic(err)
	}
	w.client = &http.Client{
		Transport: tr,
	}
	w.buf = make([]byte, 1024)
}

func (w *myWorker) Teardown() {
}

func (w *myWorker) Process() (subscore int) {
	resp, err := w.client.Get(w.URL)
	if err != nil {
		log.Printf("ERROR: %v", err)
		return 0
	}
	_, err = io.CopyBuffer(ioutil.Discard, resp.Body, w.buf)
	resp.Body.Close()
	if err != nil && err != io.EOF {
		log.Printf("ERROR: %v", err)
		return 0
	}
	if resp.StatusCode != http.StatusOK {
		log.Printf("Invalid Status: %d", resp.StatusCode)
		return 0
	}
	return 1
}

func main() {
	var (
		conn     int
		duration time.Duration
	)
	flag.IntVar(&conn, "c", 1, "connections to keep open")
	flag.DurationVar(&duration, "d", time.Second, "duration of benchmark")
	flag.Parse()
	url := flag.Args()[0]
	workers := make([]benchmark.Worker, conn)
	for i, _ := range workers {
		workers[i] = &myWorker{URL: url}
	}
	benchmark.Run(workers, duration)
}
```

前回記事同様、Server::Starterを使って1秒毎に再起動を繰り返しながらベンチを回します。
AWSのc4.largeインスタンス上で実行しました。

``` bash
$ start_server --port 8080 --pid-file app.pid -- ./main
$ while true; do kill -HUP `cat app.pid`; sleep 1; done
$ ./bin/bench -c 10 -d=1m http://localhost:8080/
```

## 結果

### Server.Shutdownを使った場合

Server.Shutdownを使った場合の結果です。

``` plain
$ ./bin/bench -c 10 -d=1m http://localhost:8080/
2017/01/22 12:20:51 starting benchmark: concurrency: 10, time: 1m0s, GOMAXPROCS: 2
2017/01/22 12:21:51 done benchmark: score 1174412, elapsed 1m0.002557914s = 19572.698912 / sec
```

先程紹介したKeepAliveの挙動変更の影響で多少はエラーがでるのでは？と予想していたものの、
まったく影響はありませんでした。

### go-gracedownを使った場合

go-gracedownを使った場合の結果です。

``` plain
$ ./bin/bench -c 10 -d=1m http://localhost:8080/
2017/01/22 12:22:26 starting benchmark: concurrency: 10, time: 1m0s, GOMAXPROCS: 2
2017/01/22 12:23:26 done benchmark: score 1160878, elapsed 1m0.009764419s = 19344.818485 / sec
```

中身は`Server.Shutdown`なので、当然ながら同じ結果です。

### HTTP/2でアクセスした場合

HTTP/2でアクセスした場合の結果です。
GoのHTTP/2サポートはHTTPSで通信したときにしか有効にならないので、他のベンチとURLが違うことに注意。

``` plain
$ ./bin/bench -c 10 -d=1m https://localhost:8080/
2017/01/22 12:30:04 starting benchmark: concurrency: 10, time: 1m0s, GOMAXPROCS: 2
2017/01/22 12:31:04 done benchmark: score 666801, elapsed 1m0.001842465s = 11113.008745 / sec
```

特にエラーもなく、全く問題ありませんでした。


## まとめ

- Go1.8からサポートされる予定のHTTPサーバのGraceful Shutdownについて検証しました
  - HTTP/1.1とHTTP/2で検証しましたが、特に問題は見つかりませんでした
- go-gracedownはGo1.8でコンパイルされたときはbuild-inの機能を使うようになります
  - 機能的にはbuild-inの機能を直接使う場合とまったく変わりありません

Go1.8の正式リリース楽しみですね！

## 参考

- [Go言語でGraceful Restartをする](https://shogo82148.github.io/blog/2015/05/03/golang-graceful-restart/)
- [Go言語でGraceful Restartをするときに取りこぼしを少なくする](https://shogo82148.github.io/blog/2015/11/23/golang-graceful-restart-2nd/)
- [net/http: add built-in graceful shutdown support to Server #4674](https://github.com/golang/go/issues/4674)
- [net/http: make Server.SetKeepAlivesEnabled(false) drop currently-open connections #9478](https://github.com/golang/go/issues/9478)
- [Go 1.8 の HTTP Server Graceful Shutdown を試す](http://qiita.com/najeira/items/806cacb9bba96ff06ec4)
