---
layout: post
title: "GoでMySQLを使ったテストを書くときにつかうユーティリティーライブラリを作った"
slug: 2024-03-20-go-mysql-pool
date: 2024-03-20 21:24:00 +0900
comments: true
categories: [mysql, go, golang]
---

GoでMySQLを使ったテストを書く場合、MySQLのデータベースを初期化する処理や、使い終わったデータベースを削除する処理が必要になります。
毎回似たような処理を書いているので、そろそろライブラリとして切り出せそうだなと思って書いてみました。

- [shogo82148/go-mysql-pool](https://github.com/shogo82148/go-mysql-pool)

## 背景

弊社ではデータベースに関連したテストを書く場合、ローカルでMySQLを起動し、実際にMySQLへ接続する手法を取っています。
SQLの文法エラーを検知するには、実際にMySQLで処理するのが手っ取り早いからです。

この方法を採用する場合、次の問題は「いつMySQLのデータベースを初期化するか」です。
Goでは `TestMain` 関数を用意することで、テストの開始前の処理、テストの終了後の処理を書くことができます。
初期化しているコードは `CREATE DATABASE` するだけの単純なものです。
そんな分量もないので、プロジェクト毎にコピー＆ペーストして使っていました。

```go
// こんな感じのイメージ。
// 実際に使っているコードとは異なります。
package example_test

import (
  "database/sql"
  "testing"
)

// 各ユニットテストで使い回す
var db *sql.DB

func TestMain(m *testing.M) {
  var cleanup func()
  db, cleanup = setup()
  defer cleanup()

  m.Run()
}

func setup() (*sql.DB, func()) {
  // MySQLに接続して新しいデータベースを作る
  db0, err := sql.Open("mysql", "user:password@/")
  if err != nil {
    panic(err)
  }
  _, err = db0.Exec("CREATE DATABASE dbname")
  if err != nil {
    panic(err)
  }

  db, err := sql.Open("mysql", "user:password@/dbname")
  if err != nil {
    panic(err)
  }
  return db, func() {
    // テストが終わったらデータベースを破棄する
    db0.Exec("DROP DATABASE dbname")
    db0.Close()
    db.Close()
  }
}
```

しばらくの間はこのコードで困っていなかったのですが、テストの件数が増えるにしたがって、CIにかかる時間が許容できなくなってきました。
どうしてもデータベースのユニットテストがボトルネックなってしまいます。
それを解消するために、各プロジェクトでさまざまな改善が行われました。

その過程で得られた知見をライブラリとして使い回せないか？と作ったのが [shogo82148/go-mysql-pool](https://github.com/shogo82148/go-mysql-pool) です。

## 使い方

READMEからの引用です。

```go
package example_test

import (
    "context"
    "testing"

    "github.com/go-sql-driver/mysql"
    "github.com/shogo82148/go-mysql-pool"
)

var pool *mysqlpool.Pool

func TestMain(m *testing.M) {
    // プールの初期化処理
    cfg := mysql.NewConfig()
    cfg.User = "username"
    cfg.Passwd = "password"
    cfg.Net = "tcp"
    cfg.Addr = "127.0.0.1:3306"
    pool = &mysqlpool.Pool{
        MySQLConfig: cfg,
        DDL:         "CREATE TABLE foo (id INT PRIMARY KEY)",
    }
    defer pool.Close() // 使い終わったデータベースを初期化する処理

    m.Run()
}

func TestFooBar(t *testing.T) {
    t.Parallel() // 並列化コマンド

    // プールから *sql.DB を取得する
    db, err := pool.Get(context.Background())
    if err != nil {
        t.Fatal(err)
    }
    t.Cleanup(func() {
        pool.Put(db)
    })

    // db を使ったテストを書く
}
```

## 高速化のための工夫

弊社のメンバーが調べてくれた、高速化のための工夫が取り入れられています。

### 一度使ったデータベースのプール

システムの規模が大きくなりテーブルの数が増えると、データベースの初期化を行うだけでそこそこの時間を食います。
そこで一度使ったデータベースは `pool.Put(db)` で回収し、他のテストで使う場合に使い回しを行います。

再利用できるデータベースが存在しない場合は、新規にデータベースを作成します。
新規作成したデータベースは他のデータベースと独立しているので、テストを並列に実行しても問題ありません。

### 必要なテーブルだけTRUNCATE

データベースを使いまわしているので、使う前にデータベースの中身を初期化する必要があります。
テーブルの初期化自体は `TRUNCATE TABLE` で行うことができるのですが、
これもテーブル数が多くなってくるとそこそこの時間を食います。

各テストですべてのテーブルを使うなんてことはまれで、たいていは数個のテーブルしか使いません。
使ったテーブルだ `TRUNCATE TABLE` することができれば、大きな高速化に繋がります。
そこで以下の記事を参考に、テーブルにデータが入っているもしくはオートインクリメントが進んでいるテーブルのみ `TRUNCATE TABLE` することで高速化を図りました。

- [MySQL でテスト用データベースを高速に空にする](https://blog.mono0x.net/2016/04/04/optimize-truncate/)
- [MySQL 8.0のSHOW TABLE STATUSが全然更新されない件](https://yoku0825.blogspot.com/2019/05/mysql-80show-table-status.html)

```sql
-- MySQL 8.0 以降は information_schema の内容がキャッシュされる。
-- 最新の情報を取ってきたいので、キャッシュを無効化する。
SET SESSION information_schema_stats_expiry = 0;

SELECT `table_name`
FROM `information_schema`.`tables`
WHERE `table_schema` = DATABASE() AND (
  `table_rows` > 0 OR `auto_increment` > 1
);
```

## まとめ

GoでMySQLを使ったテストを書く場合に必要となる、「MySQLのデータベースを初期化する処理」「使い終わったデータベースを削除する処理」を
簡単にしてくれるユーティリティーライブラリを書きました。

- [shogo82148/go-mysql-pool](https://github.com/shogo82148/go-mysql-pool)

高速化のために色々工夫が入っているので、ぜひ試してみてください。

## 参考

- [shogo82148/go-mysql-pool](https://github.com/shogo82148/go-mysql-pool)
- [MySQL でテスト用データベースを高速に空にする](https://blog.mono0x.net/2016/04/04/optimize-truncate/)
- [MySQL 8.0のSHOW TABLE STATUSが全然更新されない件](https://yoku0825.blogspot.com/2019/05/mysql-80show-table-status.html)
