---
layout: post
title: "GoのMySQLドライバーにBeforeConnectが追加されました"
slug: 2024-03-11-before-connect-of-mysql-driver
date: 2024-03-11 22:47:00 +0900
comments: true
categories: [aws, mysql, go, golang]
---

先日 [go-sql-driver/mysql v1.8.0](https://github.com/go-sql-driver/mysql/releases/tag/v1.8.0) がリリースされ、
いくつかのオプションが追加されました。
その中からひとつ [BeforeConnect](https://pkg.go.dev/github.com/go-sql-driver/mysql@v1.8.0#BeforeConnect) を紹介したいと思います。

- [Add BeforeConnect callback to configuration object #1469](https://github.com/go-sql-driver/mysql/pull/1469)

## 何が嬉しいの？

パスワード以外の方法で MySQL にログインするのが簡単になります。

### BeforeConnect を使わない従来の方法

たとえば、AWS では IAM 認証を使ってログインする方法を提供しています。
IAM の情報を使って短期間だけ有効なトークンを発行し、そのトークンを使ってログインします。

- [MariaDB、MySQL、および PostgreSQL の IAM データベース認証](https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.html)

トークンの有効期限は短いので、接続を開始する直前にトークンを発行し接続設定を書き換えなければいけません。
しかし、Go はコネクションプールを採用しているため、実際に接続を開始するタイミングを知るのは意外と難しいです。

頑張ってそれを実現するためにわざわざドライバーを書いたこともありました。

- [IAM 認証で AWS RDS へ接続する MySQL ドライバを作った](https://shogo82148.github.io/blog/2019/01/13/rdsmysql/)
- [shogo82148/rdsmysql](https://github.com/shogo82148/rdsmysql)

### BeforeConnect を使った方法

BeforeConnect は、接続を開始する直前に接続設定を書き換える機能です。
[shogo82148/rdsmysql](https://github.com/shogo82148/rdsmysql) を使用せずとも、簡単に IAM 認証を実現できます。

```go
package main

import (
  "context"

  "github.com/aws/aws-sdk-go-v2/config"
  "github.com/aws/aws-sdk-go-v2/feature/rds/auth"
  "github.com/go-sql-driver/mysql"
)

func main() {
  mycnf := mysql.NewConfig()
  mycnf.TLSConfig = "true"
  mycnf.AllowCleartextPasswords = true
  mycnf.DBName = "DatabaseName"
  mycnf.User = "DatabaseUser"
  mycnf.Addr = "mysqldb.123456789012.us-east-1.rds.amazonaws.com:3306"
  var region = "us-east-1"

  cfg, err := config.LoadDefaultConfig(context.TODO())
  if err != nil {
    panic(err)
  }

  beforeConnect := func(ctx context.Context, config *mysql.Config) error {
    // 実際に接続する直前になると呼び出される
    // このタイミングでトークンを発行する
    token, err := auth.BuildAuthToken(ctx, config.Addr, region, config.User, cfg.Credentials)
    if err != nil {
      return err
    }

    // 接続設定を書き換える
    config.Passwd = token
    return nil
  }
  if err := mycnf.Apply(mysql.BeforeConnect(beforeConnect)); err != nil {
    panic(err)
  }

  // 新規コネクションプール作成
  conn, err := mysql.NewConnector(mycnf)
  if err != nil {
    panic(err)
  }
  db := sql.OpenDB(conn)
  defer db.Close()
}
```

## shogo82148/rdsmysql の宣伝

[shogo82148/rdsmysql](https://github.com/shogo82148/rdsmysql) を使うともう少し短くかけます。

```go
package main

import (
  "context"

  "github.com/aws/aws-sdk-go-v2/config"
  "github.com/aws/aws-sdk-go-v2/feature/rds/auth"
  "github.com/go-sql-driver/mysql"
  "github.com/shogo82148/rdsmysql/v2"
)

func main() {
  mycnf := mysql.NewConfig()
  mycnf.DBName = "DatabaseName"
  mycnf.User = "DatabaseUser"
  mycnf.Addr = "mysqldb.123456789012.us-east-1.rds.amazonaws.com:3306"
  var region = "us-east-1"

  cfg, err := config.LoadDefaultConfig(context.TODO(), config.WithRegion(region))
  if err != nil {
    panic(err)
  }

  // BeforeConnect, TLS, AllowCleartextPasswords
  // の設定を全部やってくれる！便利！
  if err := rdsmysql.Apply(mycnf, cfg); err != nil {
    panic(err)
  }

  // 新規コネクションプール作成
  conn, err := mysql.NewConnector(mycnf)
  if err != nil {
    panic(err)
  }
  db := sql.OpenDB(conn)
  defer db.Close()
}
```

Amazon RDS 証明書もダウンロードして、ライブラリに組み込んであります。

## まとめ

- [go-sql-driver/mysql v1.8.0](https://github.com/go-sql-driver/mysql/releases/tag/v1.8.0) に BeforeConnect オプションが追加されました
- BeforeConnectを使ったAWS IAMログインの例を紹介しました
- [shogo82148/rdsmysql](https://github.com/shogo82148/rdsmysql) も便利だから使ってね

## 参考

- [go-sql-driver/mysql v1.8.0](https://github.com/go-sql-driver/mysql/releases/tag/v1.8.0)
- [Add BeforeConnect callback to configuration object #1469](https://github.com/go-sql-driver/mysql/pull/1469)
- [BeforeConnect](https://pkg.go.dev/github.com/go-sql-driver/mysql@v1.8.0#BeforeConnect)
- [IAM 認証で AWS RDS へ接続する MySQL ドライバを作った](https://shogo82148.github.io/blog/2019/01/13/rdsmysql/)
- [MariaDB、MySQL、および PostgreSQL の IAM データベース認証](https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.html)
- [shogo82148/rdsmysql](https://github.com/shogo82148/rdsmysql)
