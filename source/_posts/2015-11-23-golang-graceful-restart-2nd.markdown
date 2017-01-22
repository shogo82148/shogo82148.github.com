---
layout: post
title: "Go言語でGraceful Restartをするときに取りこぼしを少なくする"
date: 2015-11-23 20:51
comments: true
categories: [golang]
---

少し前に[Starlet](https://github.com/kazuho/Starlet)にGraceful Restartが時たま上手く動かない問題を修正する[pullreq](https://github.com/kazuho/Starlet/pull/21)を投げました。
原因は割り込みハンドラ内でexitを呼んでいたからでした。
「割り込みハンドラ内ではフラグを建てるだけ」
「メインのプログラム内でそのフラグを見て分岐する」という原則があるのですが、それを守るのは難しいということですね。
(しかし新たな問題を産んでしまい[revertされてしまいましたが・・・](https://github.com/kazuho/Starlet/pull/23)
まあ修正後のコードも考え方は一緒です。割り込みホント難しい・・・)

このpullreqを取り込んでもらうときに再現実験をやってみたのですが、
Goでもちゃんと動くのかな？と気になったので
[Go言語でGraceful Restartをする](http://shogo82148.github.io/blog/2015/05/03/golang-graceful-restart/)で紹介した
プログラムに同じテストをやってみました。

<!-- More -->

## mannersでテストしてみる

前回の記事では[manners](https://github.com/braintree/manners)と[go-server-starter](https://github.com/lestrrat/go-server-starter)の
組み合わせが良さそうとの結論になったので、この組み合わせでテストしてみます。
以下テストに使用したコードです。
(今回の内容とは直接関係は無いですが、go-server-starterに変更が入ってFallbackのやり方が前回から少し変わってます)

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

        manners.Serve(l, newHandler())
}

func newHandler() http.Handler {
        mux := http.NewServeMux()
        mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
                fmt.Fprintf(
                        w,
                        "from pid %d.\n",
                        os.Getpid(),
                )
        })
        return mux
}
```

1秒毎にgraceful restartを行いながら負荷をかけます。
以下のコマンドを別々のターミナルから実行します。
`go run main.go`だと自分で書いたプログラムがシグナルを受け取れなくなってしまうので、
`go build main.go`とコンパイルしてから実行するところがポイントです。

``` bash
$ start_server --port 8080 --pid-file app.pid -- ./main
$ while true; do kill -HUP `cat app.pid`; sleep 1; done
$ ab -r -n 1000000 -c 10 http://localhost:8080/
```

**2017-01-22追記**: 上記コマンド、`start_server`の引数が`--pid app.pid`となっていましたが、`--pid-file app.pid`でした。
Perl版のServer::Starterは一番名前の近いオプションに勝手に解釈してくれる(ちょっとお節介過ぎると思う)ので、
間違っていても動きますが、Go版では動きません。

[mannersを使った場合の実験結果](https://gist.github.com/shogo82148/a1524f31292202ec34f3#file-manners)へのリンクを貼っておきます。
「Failed requests:        122」となっており、残念ながら取りこぼしが発生してしまいました。
負荷をかけた時間は72.437秒なので、70回ほどリスタートをかけたことになります。
github-flowを採用しているようなところだと毎日数回デプロイをするということも珍しくないので、
1〜2ヶ月も運用していれば一度くらいはこの現象に遭遇することになります(秒間1万リクエストさばく必要のあるようなサービスの場合ですが)。
ちょっと気になりますね。


## 自分で書いてみた

mannersの改造、難しそうだったので、自分で書いてみました。

- https://github.com/shogo82148/go-gracedown

mannersと全く同じインタフェースなので、s/manners/gracedown/するだけです。
これを使って実験してみた結果がこちら https://gist.github.com/shogo82148/a1524f31292202ec34f3#file-gracedown
「Failed requests:        0」やったね！

## その他メモ

これ書くのに色々しらべたのでメモとして残しておきます。

### acceptの直後にcloseされた場合の挙動について

Starletで起こっていた不具合の原因は、
acceptから処理が帰ってきてからcanExitフラグを落とすまでにわずかな期間があるのが問題でした。
この期間にシグナルを受け取ると間違えてサーバを終了させてしまいます。
GoでもacceptしてからステートがStateNewになるまでの間に若干の時間差があるので、
ここが問題にならないか少し気になっていました。

net/httpの処理を追ってみると、acceptとStateNewは`Serve(net.Listener)`を実行したのと同じgoroutineで実行されているようです。
したがって、サーバシャットダウンの判定も`Serve(net.Listener)`と同じgoroutineで行えば、
誤ってacceptしてからステートがStateNewになるまでの間にサーバをシャットダウンしてしまうことは防げるということがわかりました。


### Acceptがブロックしているのを解除する方法について

[UnixListener.Closeでソケットファイルが消えて困っている](http://qiita.com/hiratara/items/0f0b6103a0dc9280cea9) という記事に

> POSIX では Close() を呼んだからといって Accept() が制御を戻してくれる保証はないといことでしょうか。

という一文が書いてありました。

これについて実際はどうなんだろうと調べてみたところ[https://golang.org/pkg/net/#Listener](net.Listener)のコメントに

> Close closes the listener.
> Any blocked Accept operations will be unblocked and return errors.

とありました。
このコメントを読む限りGo言語では「`Close()` を呼んだら`Accept()`が制御を戻す」と考えて良さそうです。
POSIXでどう規定されているかまでは調査しきれていませんが、
たとえどう規定されていようとも互換性を保つために裏で色々やってくれていると信じています。

この記事の主題である「UnixListener.Closeでソケットファイルが消えて困っている」件についても調べてはみたのですが、
結論は出ませんでした・・・。
たしかにソケットファイルは使い終わったらunlinkすることが推奨されているということがわかったくらいです。
nameが「@」で始まっていると「abstract socket address」と見なされて削除されなくなるから、「@」をテキトウにつけるとか・・・？


### keep-aliveの挙動について

mannersはKeep-Aliveなコネクションがあった場合でも、それがIdle状態であればシャットダウンしてしまいます。
それに対してgo-gracedownは全部のコネクションがClosedになるまでまちます。
終了処理に入った段階でKeep-Aliveは無効にしているので、
go-gracedown側で特に操作しなくてもnet/httpがそのうちクローズしてくれるだろうとの考えからです。

Keep-Aliveはクライアントからリクエストがないと切断できない(レスポンスに「Connection: Close」ヘッダを含める必要があるため)ので
リクエストがないと永遠にシャットダウンできません。
それでは困るので一応タイムアウトも入れてあります。

この挙動のおかげで[boom](https://github.com/rakyll/boom)(http benchで検索したら一番上にきた)でのベンチでも
[エラー無しで処理できています](https://gist.github.com/shogo82148/a1524f31292202ec34f3#file-gracedown-boom)。
ちなみにApache Benchでも-kオプションでKeep-Aliveを有効にできるのですが、
HTTP/1.0だと「Connection: Close」を送る方法が使えないので、[残念ながらエラーが出てしまいました](https://gist.github.com/shogo82148/a1524f31292202ec34f3#file-gracedown-keep-alive)。


## まとめ

- 実験の結果[manners](https://github.com/braintree/manners)はときどきGraceful Shutdownに失敗する場合があることがわかった
- [go-gracedown](https://github.com/shogo82148/go-gracedown)というのを書いてみた
  - 今回行った再現実験ではすべてのリクエストを正常に処理できました
- Graceful Restartむずかしい
