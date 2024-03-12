---
layout: post
title: "GoのMySQLドライバーを使うときはmysql.NewConnectorとsql.OpenDBを使おう"
slug: 2024-03-12-use-mysql-new-connector-and-sql-open-db
date: 2024-03-12 23:07:00 +0900
comments: true
categories: [mysql, go, golang]
---

これから新規に書くコードでは [mysql.NewConnector](https://pkg.go.dev/github.com/go-sql-driver/mysql@v1.8.0#NewConnector) と
[sql.OpenDB](https://pkg.go.dev/database/sql@go1.22.1#OpenDB)を使ったほうが良さそう、という話。

## 昔からある書き方

go-sql-driver/mysql のDSNを文字列結合で実現するのは意外と大変なので、
某所ではDSNの生成を [mysql.Config](https://pkg.go.dev/github.com/go-sql-driver/mysql@v1.8.0#Config) を使って行っています。

```go
// DSNの生成
cfg := mysql.NewConfig()
cfg.User = "user"
cfg.Passwd = "password"
cfg.DBName = "dbname"
dsn := cfg.FormatDSN()

// 接続
db, err := sql.Open("mysql", dsn)
if err != nil {
	panic(err)
}
```

## 新しい書き方

実はDSNを生成しなくとも、
[mysql.Config](https://pkg.go.dev/github.com/go-sql-driver/mysql@v1.8.0#Config)から
[*sql.DB](https://pkg.go.dev/database/sql@go1.22.1#DB) を取得できます。

```go
cfg := mysql.NewConfig()
cfg.User = "user"
cfg.Passwd = "password"
cfg.DBName = "dbname"

// *mysql.Config を直接渡す
conn, err := mysql.NewConnector(cfg)
if err != nil {
  panic(err)
}
db := sql.OpenDB(conn)
```

## なぜ新しい書き方を勧めるのか

[mysql.Config](https://pkg.go.dev/github.com/go-sql-driver/mysql@v1.8.0#Config) には文字列にシリアライズできないフィールドが存在するからです。
そのためDSNに変換したときに、情報のロスが起こります。

たとえば先日 BeforeConnect オプションの紹介をしました。

- [GoのMySQLドライバーにBeforeConnectが追加されました](https://shogo82148.github.io/blog/2024/03/11/2024-03-11-before-connect-of-mysql-driver/)

しかしこのオプションはDSNでは表現できません。
そのため「古い書き方」ではうまく動作せず、「新しい書き方」のみで意図した挙動となります。

## まとめ

以下の書き方を使いましょう。

```go
cfg := mysql.NewConfig()
cfg.User = "user"
cfg.Passwd = "password"
cfg.DBName = "dbname"

// *mysql.Config を直接渡す
conn, err := mysql.NewConnector(cfg)
if err != nil {
  panic(err)
}
db := sql.OpenDB(conn)
```

## 参考

- [mysql.NewConnector](https://pkg.go.dev/github.com/go-sql-driver/mysql@v1.8.0#NewConnector)
- [sql.OpenDB](https://pkg.go.dev/database/sql@go1.22.1#OpenDB)
- [GoのMySQLドライバーにBeforeConnectが追加されました](https://shogo82148.github.io/blog/2024/03/11/2024-03-11-before-connect-of-mysql-driver/)
