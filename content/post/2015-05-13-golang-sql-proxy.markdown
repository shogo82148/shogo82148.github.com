---
layout: post
title: "Go言語でSQLのトレースをする"
date: 2015-05-13T01:22:00+09:00
comments: true
categories: ["golang"]
---

ぴっぴ先輩が「Go言語で発行したクエリを確認したい」って言ってて、
「MySQL使っているならGeneral Logを吐けばよいのでは？」と返したんだけども、
もっと汎用的な方法はないものかと考えてみました。

<!-- More -->

Golangの `database/sql` はどんなDBでも対応できるよう、ドライバを自由に入れ替えることができます。
ドライバは単に`database/sql/driver`にあるインターフェースを満たしている何かなので、
ユーザが自由に作ることができるし、`interface`を経由して直接呼び出すことも可能です。
この仕組を使って、別のドライバにそのまま渡すプロキシを作れば、ログを吐けるのでは？ということでやってみました。

- [go-sql-proxy](https://github.com/shogo82148/go-sql-proxy)

## 使い方

まず最初にgo-sql-proxyをドライバとして登録します。

``` go
hooks := &proxy.Hooks{
	// Hook functions here(Open, Exec, Query, etc.)
}
sql.Register("new-proxy-name", proxy.NewProxy(&another.Driver{}, hooks))
```

あとは登録したドライバと使って新しいDBハンドラを開くだけです。

``` go
db, err := sql.Open("new-proxy-name", dataSourceName)
```

このハンドラを使ってクエリ実行を行うと、Hooksで登録した関数が呼び出されます。
元のドライバを直接使った場合と同じように振る舞うので、既存のコードを一切変えること無くHookを差し込めて便利！

## トレーサの例

簡単なトレーサを書いてみるとこんな感じ。
発行したSQLのクエリをログに吐き出します。

``` go
package proxy

import (
	"database/sql"
	"database/sql/driver"
	"log"

	"github.com/mattn/go-sqlite3"
	"github.com/shogo82148/txmanager"
)

func main() {
	sql.Register("sqlite3-proxy", NewProxy(&sqlite3.SQLiteDriver{}, &Hooks{
		Open: func(conn *Conn) error {
			log.Println("Open")
			return nil
		},
		Exec: func(stmt *Stmt, args []driver.Value, result driver.Result) error {
			log.Printf("Exec: %s; args = %v\n", stmt.QueryString, args)
			return nil
		},
		Query: func(stmt *Stmt, args []driver.Value, rows driver.Rows) error {
			log.Printf("Query: %s; args = %v\n", stmt.QueryString, args)
			return nil
		},
		Begin: func(conn *Conn) error {
			log.Println("Begin")
			return nil
		},
		Commit: func(tx *Tx) error {
			log.Println("Commit")
			return nil
		},
		Rollback: func(tx *Tx) error {
			log.Println("Rollback")
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


## おまけ機能

`proxy.NewTraceProxy` を使うと上記のコードと同様のプロキシを簡単につくれます。
`db.Exec`, `db.Query` 等の呼び出しもとを報告するという便利機能付き。
ただ、`logger.Output(6, "Begin")` みたいな感じで「6個スタックトレースをさかのぼってログに表示」という実装をしているので、
`database/sql`のアップデートと共にすぐに壊れそう。(`database/sql`で何回関数呼び出しがあったかに強く依存している)
一応、Go1.1から1.4までで同じ結果を返すことは確認はしてるんだけど、将来のことまではちょっと分からない・・・。
あんまり信用はしないほうがいいかも。

こういう情報を知りたい場合どうするのがいいんだろうね。
この前作った[txmanger](http://shogo82148.github.io/blog/2015/05/09/go-txmanager/)のレベルでプロキシを作ったほうがいいのかなあ。
