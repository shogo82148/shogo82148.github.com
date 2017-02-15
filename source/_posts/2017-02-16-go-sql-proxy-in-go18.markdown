---
layout: post
title: "go-sql-proxyがcontextに対応しました"
date: 2017-02-16 07:16:44 +0900
comments: true
categories: golang
---

Go1.8ではdatabase/sqlのcontextサポートが入ります。
(きっと今日の[Go 1.8 Release Party](https://eventdots.jp/event/611405)で詳しく説明があるはず、たぶん)
それにともない[Go言語でSQLのトレースをする](https://shogo82148.github.io/blog/2015/05/13/golang-sql-proxy/)で紹介した
[shogo82148/go-sql-proxy](https://github.com/shogo82148/go-sql-proxy)でもcontextを扱えるようにしました。

<!-- More -->

## Go1.8新機能のサポート

[Golang 1.8 でやってくる database/sql の変更点](http://mattn.kaoriya.net/software/lang/go/20161106232834.htm)で
mattnさんが紹介しているように、Go1.8ではdatabase/sqlにいくつか新機能が追加されます。
(mattnさんの対応が早すぎて、メソッド名とか微妙に変更が入っているので注意)

特に大きなのがcontextのサポートでしょう。以下のようなコードでクエリのキャンセルが可能になります。

``` go
ctx, cancel := context.WithCancel(context.Background())
go func() {
    // 1秒待ってからキャンセル
    time.Sleep(1 * time.Second)
    cancel()
}()

rows, err := db.QueryContext(ctx, "SELECT name FROM test where id = ?", id)
if err != nil {
    log.Fatal(err)
}
```

go-sql-proxyでもcontext対応を行ったので、
proxyを経由した場合でも、キャンセルが可能になります。
(もちろん、originとなるドライバの対応も必要です)

Go1.8ではcontextサポート以外にもいくつか新機能が追加される予定です。
これらについても、originとなるドライバが対応していれば、go-sql-proxy経由でも全く同じように扱えます。


## contextとHookの関連付け

contextにHookを関連付けて、一部のクエリにだけHookを付けることができるようになりました。
例えば以下のようなコードでctxに関連したクエリだけログを出力できます。

``` go
package main

import (
	"context"
	"database/sql"

	"github.com/shogo82148/go-sql-proxy"
)

var tracer = proxy.NewTraceHooks(proxy.TracerOptions{})

func main() {
	// 何もしないproxyをインストール
	proxy.RegisterProxy()

	// 末尾に":proxy"がついた名前でアクセス
	db, _ := sql.Open("origin:proxy", "data source")

	// このコンテキストに関連したクエリだけでログが有効になります
	ctx := proxy.WithHooks(context.Background(), tracer)
	db.ExecContext(ctx, "CREATE TABLE t1 (id INTEGER PRIMARY KEY)")
}
```

グローバルなproxyに既にHookが設定してあった場合は上書きされます。
上書きされたHookは実行されないので注意してください。

「トレースの負荷が気になるから、全体の1%だけ出力したい！」とか
「このAPIだけ重たいから、この部分だけトレースしたい！」とか
そういう場合に便利ではないでしょうか。


## トレースオプションの追加

Tracerに色々オプションをつけたいなと思ったので、`proxy.TracerOptions`を追加しました。
例えばSlowQueryに時間を設定すると、この時間以上経ったクエリだけ表示されます。

```go
var tracer = proxy.NewTraceHooks(proxy.TracerOptions{
	SlowQuery: 10 * time.Second,
})
```

ちなみに初期のトレーサーは`logger.Output(6, "Begin")`みたいな感じで書いてたので、
案の定Go1.8の変更でぶっ壊れました。
頑張ってスタックトレースを辿って、関数名をパースしてパッケージ名を取得(ダイレクトにパッケージ名だけ取る機能は見つからなかった)して、
フィルタリングするようにしたので、もう大丈夫なはず。
その代わりにパフォーマンスが犠牲になったので、
あまり高負荷のところに突っ込まないでくださいね。


## フック関数の変更

context対応に伴い、Hookの差し込み方も変わっています。
`proxy.Hooks`は非推奨の扱いで、`proxy.HooksContext`を使って下さい。
以下の例のようにcontext.Contextが第一引数に追加されています。
デバッグ情報の受け渡しに使えるかも？

``` go
package main

import (
	"database/sql"
	"database/sql/driver"
	"log"
	"time"

	"github.com/mattn/go-sqlite3"
	"github.com/shogo82148/go-sql-proxy"
)

func main() {
	sql.Register("sqlite3-proxy", proxy.NewProxyContext(&sqlite3.SQLiteDriver{}, &proxy.HooksContext{
		PreExec: func(_ context.Context, _ *proxy.Stmt, _ []driver.NamedValue) (interface{}, error) {
			// The first return value(time.Now()) is passed to both `Hooks.Exec` and `Hook.ExecPost` callbacks.
			return time.Now(), nil
		},
		PostExec: func(_ context.Context, ctx interface{}, stmt *proxy.Stmt, args []driver.NamedValue, _ driver.Result, _ error) error {
			// The `ctx` parameter is the return value supplied from the `Hooks.PreExec` method, and may be nil.
			log.Printf("Query: %s; args = %v (%s)\n", stmt.QueryString, args, time.Since(ctx.(time.Time)))
			return nil
		},
	}))

	db, err := sql.Open("sqlite3-proxy", ":memory:")
	if err != nil {
		log.Fatalf("Open filed: %v", err)
	}
	defer db.Close()

	_, err = db.Exec(
		"CREATE TABLE t1 (id INTEGER PRIMARY KEY)",
	)
	if err != nil {
		log.Fatal(err)
	}
}
```
