---
layout: post
title: "Go言語でGraceful Restartをする"
date: 2015-05-03 12:10
comments: true
categories: [golang]
---

とあるHTTPサーバをGolangで立てようって話になったんだけど、
止まると困るので無停止でサーバ再起動をしたい。
Perlには[Server::Starter](https://metacpan.org/pod/Server::Starter)という有名モジュールがあるんだけど、
Golangはどうなってるの？ってことで調べてみました。

<!-- More -->

## gracefulじゃないバージョン

Golangの標準ライブラリを使ってHTTPサーバを立ててみる例。
レスポンスが一瞬で終わってしまうとよくわからないので、sleepするhandlerを追加しておきます。

``` go
package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

var now = time.Now()

func main() {
	log.Printf("start pid %d\n", os.Getpid())
	s := &http.Server{Addr: ":8080", Handler: newHandler()}
	s.ListenAndServe()
}

// https://github.com/facebookgo/grace/blob/master/gracedemo/demo.go から一部拝借
func newHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/sleep/", func(w http.ResponseWriter, r *http.Request) {
		duration, err := time.ParseDuration(r.FormValue("duration"))
		if err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		time.Sleep(duration)
		fmt.Fprintf(
			w,
			"started at %s slept for %d nanoseconds from pid %d.\n",
			now,
			duration.Nanoseconds(),
			os.Getpid(),
		)
	})
	return mux
}
```

以下のような感じで実行してみる。
(それぞれのコマンドは処理が終わるまでブロックするので、コンソールを3つ程開いて実行してね！)

``` plain
$ go run main.go
2015/05/03 12:04:08 start pid 69046
$ curl 'http://localhost:8080/sleep/?duration=20s'
$ kill -TERM 69046
```

curlからのリクエストをさばく前に終了してしまい
`curl: (52) Empty reply from server` といわれてしまいます。


## facebookgo/grace

facebook製の[grace](https://github.com/facebookgo/grace/gracehttp)は
gracefulな終了と再起動をしてくれるライブラリ。

``` go
package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/facebookgo/grace/gracehttp"
)

var now = time.Now()

func main() {
	log.Printf("start pid %d\n", os.Getpid())
	s := &http.Server{Addr: ":8080", Handler: newHandler()}
	// s.ListenAndServe()
	gracehttp.Serve(s)
}

// newHanderは一緒なので、以下省略。適当に補完して実行して
```

さっきと同じように実行してみるとリクエストを捌き切るまで終了しなくなります。

``` plain
$ go run main.go
2015/05/03 12:04:08 start pid 69046
2015/05/03 12:04:08 Serving [::]:8080 with pid 69046
$ curl 'http://localhost:8080/sleep/?duration=20s'
started at 2015-05-04 12:04:08.562569712 +0900 JST slept for 20000000000 nanoseconds from pid
$ kill -TERM 69046
```

TERMの代わりにUSR2シグナルを送るとgracefulに再起動できる。
ただ、再起動すると最初のプロセスは死んでしまうので、daemontoolsみたいなデーモン管理ツールと一緒には使えない。
そのためデーモン化に必要なもろもろ(PID・標準出力・標準エラー等をファイルに書き出す等)は全部自前でやる必要があります。
[cmdctrl](https://github.com/facebookgo/cmdctrl)を使うとそこら辺の処理をやってくれる。

``` go
package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/facebookgo/cmdctrl"
	"github.com/facebookgo/grace/gracehttp"
)

var now = time.Now()

func main() {
	cmdctrl.SimpleStart()

	log.Printf("start pid %d\n", os.Getpid())
	s := &http.Server{Addr: ":8080", Handler: newHandler()}
	gracehttp.Serve(s)
}

// newHanderは一緒なので、以下省略。適当に補完して実行して
```

``` plain
$ go run main.go -c hoge.conf -pidfile hoge.pid start
2015/05/03 12:04:08 start pid 69046
2015/05/03 12:04:08 Serving [::]:8080 with pid 69046
$ curl 'http://localhost:8080/sleep/?duration=20s'
started at 2015-05-04 12:04:08.562569712 +0900 JST slept for 20000000000 nanoseconds from pid
$ go run main.go stop
```

ただ、デーモン化はされないみたいなので、実際に使うには他にもいろいろ工夫しないといけないっぽい。


## go-server-starter-listener

牧さん作の[go-server-starter-listener](https://github.com/lestrrat/go-server-starter-listener)。
Perlの[Server::Starter](https://metacpan.org/pod/Server::Starter)と一緒に使える。

``` go
package main

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"time"

	"github.com/lestrrat/go-server-starter-listener"
)

var now = time.Now()

func main() {
	log.Printf("start pid %d\n", os.Getpid())

	l, err := ss.NewListener()
	if l == nil || err != nil {
		// Fallback if not running under Server::Starter
		l, err = net.Listen("tcp", ":8080")
		if err != nil {
			panic("Failed to listen to port 8080")
		}
	}

	s := &http.Server{Handler: newHandler()}
	s.Serve(l)
}

// newHanderは一緒なので、以下省略。適当に補完して実行して
```

以下のようにstart_serverコマンドと組み合わせて起動することで、
Server::Starterの管理下で実行されるようになります。

``` plain
$ start_server --port=8080 ./main
start_server (pid:6941) starting now...
starting new worker 6942
2015/05/03 08:27:54 start pid 6942
$ kill -HUP 6941
```

ただ、[go-server-starter-listener](https://github.com/lestrrat/go-server-starter-listener)自体はgracefulなシャットダウンに対応していないので、
再起動の途中のコネクションは破棄されてしまいます。
これを避けるには[manners](https://github.com/braintree/manners)を使うといいようです。

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
	"time"

	"github.com/braintree/manners"
	"github.com/lestrrat/go-server-starter-listener"
)

var now = time.Now()

func main() {
	log.Printf("start pid %d\n", os.Getpid())

	signal_chan := make(chan os.Signal)
	signal.Notify(signal_chan, syscall.SIGTERM)
	go func() {
		for {
			s := <-signal_chan
			if s == syscall.SIGTERM {
				manners.Close()
			}
		}
	}()

	l, err := ss.NewListener()
	if l == nil || err != nil {
		// Fallback if not running under Server::Starter
		l, err = net.Listen("tcp", ":8080")
		if err != nil {
			panic("Failed to listen to port 8080")
		}
	}

	manners.Serve(l, newHandler())
}

// newHanderは一緒なので、以下省略。適当に補完して実行して
```

manners自体はシグナルの扱いをやってくれないみたいなので、
そこだけ自分で書く必要がありますが、
今回調べた中ではこれがベストっぽい。
自前でデーモン化はできませんが、daemontoolsが使えるのでそれで十分でしょう。

ちなみに、Server::StarterのGo版[go-server-starter](https://github.com/lestrrat/go-server-starter)もあるので、
デーモン化以外はGo化できそう。


## 2015-05-07 追記

{% oembed https://twitter.com/lestrrat/status/596154619740303360 %}

こっち見んな！
作者の方によると、[go-server-starter-listener](https://github.com/lestrrat/go-server-starter-listener)は非推奨らしいです。
[go-server-starter](https://github.com/lestrrat/go-server-starter) にlistenerも一緒に入っているのでこちらを使います。

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
	"time"

	"github.com/braintree/manners"
	"github.com/lestrrat/go-server-starter/listener"
)

var now = time.Now()

func main() {
	log.Printf("start pid %d\n", os.Getpid())

	signal_chan := make(chan os.Signal)
	signal.Notify(signal_chan, syscall.SIGTERM)
	go func() {
		for {
			s := <-signal_chan
			if s == syscall.SIGTERM {
				log.Printf("SIGTERM!!!!\n")
				manners.Close()
			}
		}
	}()

	listeners, err := listener.ListenAll()
	if err != nil {
		panic(err)
	}
	var l net.Listener
	if len(listeners) == 0 {
		// Fallback if not running under Server::Starter
		l, err = net.Listen("tcp", ":8080")
		if err != nil {
			panic("Failed to listen to port 8080")
		}
	} else {
		l = listeners[0]
	}

	manners.Serve(l, newHandler())
}

// newHanderは一緒なので、以下省略。適当に補完して実行して
```

こっちのほうが複数ポートの読み込みにも対応していて高機能みたいなので、
[go-server-starter](https://github.com/lestrrat/go-server-starter) を使いましょう！
