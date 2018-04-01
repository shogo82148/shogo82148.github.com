---
layout: post
title: "ぼくのかんがえたさいきょうのcontext対応版go-mysql-driverをマージしてもらった"
date: 2017-06-16 07:11:15 +0900
comments: true
categories: [go, golang, mysql]
---

[go-sql-driver](https://github.com/go-sql-driver/mysql)に`context.Context`対応するプルリクエスト
[go-sql-driver/mysql#608](https://github.com/go-sql-driver/mysql/pull/608)
を送って取り込んでもらいました！！
現時点ではまだ正式リリースされていませんが、次のリリース(version 1.4)から使えるようにはずです。
masterブランチではすでに使えるようになっているので、引き続き人柱募集中です。

コネクションプーリングを実装していて、自分も「`context.Context`サポートしたい！」というかたのために、
実装の概要をメモとして残しておきます。

<!-- More -->

## おおまかな仕組み

- 「**contextの監視のみを行うgoroutine**(以下、watcher goroutine)」をあらかじめ起動しておく
- 「**やりたい処理を実際に実行するgoroutine**(以下、executor goritune)」とchannelを経由して`context.Context`をやり取りする

watcher goroutineがこの実装で一番重要な部分です。


### watcher goroutine の実装

一番重要な watcher goroutine の実装例から見てみましょう
(実際には細かい最適化などが入るため、マージされたコードとは異なります)。

``` go
func (mc *mysqlConn) startWatcher() {
	// executor goritune と `context.Context` のやり取りをするための channel
	watcher := make(chan context.Context, 1)
	mc.watcher = watcher

	// executor goritune で処理が完了したことを知るための channel
	finished := make(chan struct{})
	mc.finished = finished

	// コネクションがCloseされたことを知らせるための channel
	mc.closech = make(chan struct{})

	// ここから watcher goroutine 本体
	go func() {
		for {
			// executor goritune から `context.Context` を待ち受ける
			var ctx context.Context
			select {
			case ctx = <-watcher:
			case <-mc.closech:
				// コネクションが Close されたので watcher gorutine を終了する
				return
			}

			// `context.Context` を監視する
			select {
			case <-ctx.Done():
				// executor goritune を強制終了する
				mc.cancel(ctx.Err())
			case <-finished:
				// 正常に処理が終了したので何もしない
			case <-mc.closech:
				// コネクションが Close されたので watcher gorutine を終了する
				return
			}
		}
	}()
}
```

`watcher`, `finished`, `closech` の3つの channel を経由して
executor goroutine と通信を行います。


### executor goroutine の実装

executor goritune の実装例は以下のようになります。

``` go
// 何かやる
func (mc *mysqlConn) DoSomething(ctx context.Context) error {
	// watcher gorutineにctxを渡して監視してもらう
	if err := mc.watchCancel(ctx); err != nil {
		return err
	}

	// doSomthing()が実際に行いたい処理
	if err := mc.doSomthing(); err != nil {
		// キャンセルされたのか、ネットワークエラーで切断されたのか、を確認する
		if cerr := mc.canceled(); cerr != nil {
			return cerr
		}
		return err
	}

	// watcher gorutineに処理が終了したことを通知する
	mc.finish()

	return nil
}
```

`mc.doSomthing()` が実際に行いたい処理なのですが、これに `ctx` を渡していないのがポイントです。
watcher goroutine に `ctx` の監視を任せているので、executor goroutine 側では監視しなくてもいいのです。


### executor goritune と watcher goroutine 間の通信

executor goritune と watcher goroutine 間の通信は主に
`watcher` channel と `finished` channel が担当します。

``` go
func (mc *mysqlConn) watchCancel(ctx context.Context) error {
	// 実際の処理が始まるまえに、 `ctx` が終了していないか確認
	select {
	default:
	case <-ctx.Done():
		return ctx.Err()
	}

	// watcher goroutineに渡す
	mc.watcher <- ctx

	return nil
}

func (mc *mysqlConn) finish() {
	select {
	case mc.finished <- struct{}{}:
	case <-mc.closech:
	}
}
```


### キャンセルの実装

`context.Context`がキャンセルされたときに、executor goroutineを強制終了する処理は、
コネクションを強制的に `Close` することで行っています。
ちょっと強引な気はしますが、キャンセルされるような状況に陥った時点で正常な通信なんて出来ていないので、
まあいいかと、このような実装になっています。
もっと賢いキャンセルの方法があるかもしれませんが、キャンセルされない場合のほうが圧倒的に多いので、
余計なオーバーヘッドは避けたいというのもあります。

``` go
// キャンセルを実行する
func (mc *mysqlConn) cancel(err error) {
	// **コネクションを実際にCloseする前** にエラー内容を記録する
	mc.mu.Lock()
	mc.canceledErr = err
	mc.mu.Unlock()

	// 強制切断
	mc.cleanup()
}

// キャンセルされたか確認用
func (mc *mysqlConn) canceled() error {
	mc.mu.Lock()
	defer mc.mu.Unlock()
	return mc.canceledErr
}

func (mc *mysqlConn) cleanup() {
	// closeが2回以上実行されないようガード
	if atomic.SwapInt32(&mc.closed, 1) != 0 {
		return
	}

	// (executor|watcher) goroutineに終了を通知
	close(mc.closech)

	// コネクションを切断
	mc.netConn.Close()
}
```

これらの関数は (executor|watcher) 両方の goroutine から呼ばれる可能性があるため、
以下の二点が非常に重要です。

- cancelでは **コネクションを実際にCloseする前** にエラー内容を記録する
  - これが逆だと executor がキャンセルを見逃してしまう場合がある
- sync package や sync/atomic package を使って **goroutine-safe に書く**


## FAQ(よくあるであろう質問)

こっちの実装の方がいいんじゃないの？と実装中に自問自答した内容を
FAQと称して残しておきます。

### close(watcher)していないのはなぜ？

最初は watcher goroutine の実装は以下のようになっていて、
`close(watcher)` で watcher goroutine を終了させようかと考えてました。

``` go
for ctx := range watcher {
	// context.Context監視処理
}
```

しかしこの実装では `mc.watcher <- ctx` のところで `close` されていないかを毎回確認する必要があり、
channelを使うメリットが薄れてしまうので廃案となりました。


### close(finished)していないのはなぜ？

監視の終了に `close(finished)` を使うという案も考えました。
しかしこの実装が廃案になったのには大きく二つの理由があります。

一つ目は「監視の終了は同期していなければならない」からです。
`close(finished)` を使った方法では executor goroutine が監視の終了を通知しても、
watcher goroutine が実際に監視を終了するタイミングは goroutine スケジューラの気分次第で遅れてしまう可能性があります。
すると watcher goroutine がクエリキャンセルしたときには、 executor goroutine では既に次のクエリが実行さており、
間違ったクエリをキャンセルしてしまうという事故が起こりえます。

`finished <- struct{}{}` を使った方法ならこれは起こりません。
executor goroutine が監視の終了を通知するのと、
watcher goroutine が実際に監視を終了するのとが同期しているので、
確実にキャンセルしたいクエリだけをキャンセルできます。

実際、PostgreSQLのGo driver実装は、最初 `close(finished)` で実装されていたものが、
`finished <- struct{}{}` に置き換えられています(実装時には知らなくて、この記事を書いているときに知った)。

- [Add context methods lib/pq#535](https://github.com/lib/pq/pull/535)
- [Fix race condition in query cancellation lib/pq#578](https://github.com/lib/pq/pull/578)

二つ目は「channelの再利用ができない」という理由です。
一度 `close` した channel は `open` することはできないので、新規に channel を作る必要があります。
これにはメモリ確保が必要になるので、パフォーマンス面で不利になります。


### QueryContextの中でfinishを直接呼んでいないのはなぜ？

QueryContext の実装をよく見てみると `rows.finish = mc.finish` しているだけで、
QueryContext の中では `finish` を呼んでいません。

- [QueryContext](https://github.com/go-sql-driver/mysql/blob/a825be04c652d01442384e9dcdf2cdc3f1eda67f/connection_go18.go#L87)

これはなぜかというと `QueryContext` の実行が終了した後、
rows の読み取り中に、`context.Context` がキャンセルされる場合があるからです。
たとえば以下のコードで、`rows.Err()` は `context.Canceled` になっているべきです。

``` go
ctx, cancel := context.WithCancel(context.Background())
rows, _ := dbt.db.QueryContext(ctx, "SELECT v FROM test")
rows.Next()
if err := rows.Scan(&v); err != nil {
	panic(err)
}

cancel()
time.Sleep(100 * time.Millisecond)

rows.Next()
// rows.Err() は context.Canceled になっているべき
if err := rows.Err(); err != context.Canceled {
	panic(err)
}
```

この挙動は net/http を参考にしています。

``` go
package main

import (
	"context"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"net/http/httptest"
	"time"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	// 1秒わざとレスポンスを返さないサーバー
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Context-Type", "text/plain")
		w.WriteHeader(200)
		fmt.Fprint(w, "Hello, ")
		w.(http.Flusher).Flush()
		time.Sleep(time.Second)
		fmt.Fprint(w, "client\n")
	}))
	defer ts.Close()

	req, err := http.NewRequest("GET", ts.URL, nil)
	if err != nil {
		log.Fatal(err)
	}

	// 0.5秒後にキャンセル
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	go func() {
		time.Sleep(500 * time.Millisecond)
		cancel()
	}()
	defer cancel()

	req = req.WithContext(ctx)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Fatal(err)
	}

	// ioutil.ReadAll は "context canceled" か "context deadline exceeded" で失敗する
	greeting, err := ioutil.ReadAll(res.Body)
	res.Body.Close()
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("%s", greeting)
}
```


### BeginTxの中ではfinishを直接呼んでいるのはなぜ？

`BeginTx` では `finish()` を呼んでいます。
`BeginTx`終了後にトランザクションがキャンセルされる場合を考えると、
`QueryContext` と同様に `tx.finish = mc.finish` となりそうですが、そうはなっていません。

これは database/sql が代わりに監視してくれていて、
`context.Context` がキャンセルされると自動的にRollbackしてくれるからです。

- [Tx.awaitDone() (database/sql)](https://github.com/golang/go/blob/go1.8.3/src/database/sql/sql.go#L1435-L1447)

実は rows にも同様の監視処理が入っているので勝手に `Close` してくれます。
しかし、packetの読み書きを `context.Context` 対応にする必要があり、
実装コスト・実行コストが大きそうだったので手を付けていません。


## まとめ

executor goroutine と watcher goroutine を使った `context.Context` 対応の実装例を紹介しました。
