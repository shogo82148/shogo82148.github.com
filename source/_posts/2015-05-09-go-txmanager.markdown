---
layout: post
title: "Goのトランザクションマネージャ作った"
date: 2015-05-09 15:17
comments: true
categories: [golang]
---

Golangの`database/sql`はBeginとCommitでトランザクションの制御を行うことができます。
クエリの実行が確実に成功するのであれば難しくは無いのですが、
トランザクション内でエラーが発生場合、確実にトランザクションを終了させるのは少し面倒です。
また、ネストができないので、「トランザクションの中から呼び出しても外から呼び出しても、関数の中はトランザクション内」みたいなことができません。
Perlには[DBIx-TransactionManager](https://metacpan.org/release/DBIx-TransactionManager)というものがあるのですが、
このGolang版が欲しくなったので作ってみました。

- [txmanager](https://github.com/shogo82148/txmanager)

<!-- More -->

## 簡単な使い方

`sql.DB` をラップした `txmanager.DB` を使います。
`Begin`, `Commit` する代わりに `TxBegin`, `TxCommit` を使ってトランザクションを開始・終了すると
txmanagerの管理下になります。
確実にトランザクションが終了させるために、トランザクションを開始したら`defer tx.TxFinish()`を忘れないように。

``` go
import (
	"database/sql"

	"github.com/shogo82148/txmanager"
)

func Example(db *sql.DB) {
	dbm := txmanager.NewDB(db)

	// トランザクション開始
	tx, _ := dbm.TxBegin()
	defer tx.TxFinish()

	// INSERTはトランザクションの中で実行される
	_, err := tx.Exec("INSERT INTO t1 (id) VALUES(1)")
	if err != nil {
		tx.TxRollback()
	}
	tx.TxCommit()
}
```

実際にはこれに加えてエラー処理も必要です。
`txmanager.Do` を使うと、トランザクションの開始処理・終了をtxmangerがやってくれるので少し楽になります。

``` go
import (
	"database/sql"

	"github.com/shogo82148/txmanager"
)

func Example(db *sql.DB) error {
	dbm := txmanager.NewDB(db)
	return txmanager.Do(dbm, func(tx txmanager.Tx) error {
		// INSERTはトランザクションの中で実行される
		_, err := tx.Exec("INSERT INTO t1 (id) VALUES(1)")
		return err
	})
}
```

## トランザクションをネストする

以下のようにトランザクションをネストすることができます。
ネストした内側のトランザクションは`TxCommit`しても特に何もしません。
一番外側のトランザクションで`TxCommit`が実行されたときにコミットが行われます。

``` go
import (
	"database/sql"

	"github.com/shogo82148/txmanager"
)

//トランザクションの外からでも中からでもFooを呼び出すことができる
func Example(db *sql.DB) {
	dbm := txmanager.NewDB(db)

	txmanager.Do(dbm, func(tx txmanager.Tx) error {
		txmanager.Do(tx, func(tx txmanager.Tx) error {
			// INSERTはトランザクションの中で実行される
			_, err := tx.Exec("INSERT INTO t1 (id) VALUES(1)")
			return err
		})
		// この時点ではまだコミットされていない
		_, err := tx.Exec("INSERT INTO t1 (id) VALUES(2)")
		return err
	})
	// 全部のトランザクションが終了した時点ではじめてコミットされる
}
```

トランザクションの中で実行するべき処理を、関数に切り出すときなどに便利ですね。

``` go
import (
	"database/sql"

	"github.com/shogo82148/txmanager"
)

func Foo(dbm *txmanager.DB) error {
	// この時点ではトランザクションの中にいるのか、外にいるのか分からない
	return txmanager.Do(dbm, func(tx txmanager.Tx) error {
		// INSERTを確実にトランザクションの中で実行する
		_, err := tx.Exec("INSERT INTO t1 (id) VALUES(1)")
		return err
	})
}

//トランザクションの外からでも中からでもFooを呼び出すことができる
func Example(db *sql.DB) {
	dbm := txmanager.NewDB(db)

	Foo(dbm)

	txmanager.Do(dbm, func(tx txmanager.Tx) error {
		return Foo(tx)
	})
}
```

## コミットしたら何かする

[DBIx::TransactionManager::EndHook](https://github.com/soh335/DBIx-TransactionManager-EndHook)相当の機能も追加してみました。

トランザクションはネスト可能なため、`TxCommit`でコミットを行ったからと言って、その場でコミットが行われるとは限りません。
後からROLLBACKされてしまう可能性があります。
例えば、以下のコードではINSERTした行はロールバックされたにもかかわらず「INSERTに成功したよ！！」というログが流れてしまいます。

``` go
import (
	"database/sql"

	"github.com/shogo82148/txmanager"
)

func Foo(dbm *txmanager.DB) error {
	err := txmanager.Do(dbm, func(tx txmanager.Tx) error {
		_, err := tx.Exec("INSERT INTO t1 (id) VALUES(1)")
		return nil
	})
	if err != nil {
		return err
	}
	log.Println("INSERTに成功したよ！！")
	return nil
}

func Example(db *sql.DB) {
	dbm := txmanager.NewDB(db)

	txmanager.Do(dbm, func(tx txmanager.Tx) error {
		Foo(tx)
		// ...その他トランザクション内で実行しないといけない処理...
		// エラーが発生するとロールバックされる
		return errors.New("何かのエラー！")
	})
}
```

`TxAddEndHook`を使うと全てのトランザクションが正常に終了した場合にのみ処理を実行することができます。

``` go
func Foo(dbm *txmanager.DB) error {
	return txmanager.Do(dbm, func(tx txmanager.Tx) error {
		if _, err := tx.Exec("INSERT INTO t1 (id) VALUES(1)"); err != nil {
			return err
		}
		tx.TxAddEndHook(func() error {
			// 全てのトランザクションが正常に終了した場合にのみ呼ばれる
			log.Println("INSERTに成功したよ！！")
			return nil
		})
		return nil
	})
}
```
