---
layout: post
title: "LEFT JOINとFOR UPDATEを同時に使うのはやめよう"
slug: do-not-use-left-join-with-for-update
date: 2024-11-07 21:54:00 +0900
comments: true
categories: [mysql]
---

LEFT JOINの何個も繰り返し、FOR UPDATEをしているMySQLのクエリーをいくつか見かけました。
毎回似たようなコメントをするのも面倒なので、まとめておきます。
たとえばこんな感じのクエリーです。

```sql
SELECT * FROM `user`
LEFT JOIN `user_prefecture` USING (`user_id`)
LEFT JOIN `prefecture` USING (`prefecture_id`)
WHERE `user`.`user_id` = 1 FOR UPDATE;
```

## TL;DR

以下の理由から、LEFT JOINとFOR UPDATEを同時に使うのはやめたほうがよい。

- そもそもロックの範囲を間違えている可能性が高い
- デッドロックの危険性が高まる
- ギャップロックの可能性がある

FOR UPDATE はロックの獲得のみに使用し、関連する情報を取得するのは別クエリーに分けよう。

## LEFT JOINとFOR UPDATEを同時に使うのはやめよう

検証用に簡単なテーブルを作ってみます。
ユーザーの居住地（都道府県）を管理するテーブルを考えてみましょう。
ユーザーは自分の居住地を設定しないこともできます。
このような要件をもとに以下のようなテーブルを定義してみました。

```sql
-- ユーザー
CREATE TABLE `user` (
  `user_id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(191)
);

-- 都道府県のマスターデータ
CREATE TABLE `prefecture` (
  `prefecture_id` INTEGER PRIMARY KEY,
  `name` VARCHAR(191)
);

-- ユーザーと都道府県の関連テーブル
CREATE TABLE `user_prefecture` (
  `user_id` BIGINT PRIMARY KEY,
  `prefecture_id` INTEGER,
  CONSTRAINT `user_prefecture_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`),
  CONSTRAINT `user_prefecture_prefecture` FOREIGN KEY (`prefecture_id`) REFERENCES `prefecture` (`prefecture_id`)
);

-- 初期データ
INSERT INTO `user` (`name`) VALUES ("Ichinose"), ("Furusawa"), ("Inoriko"), ("Izu");
INSERT INTO `prefecture` (`prefecture_id`, `name`) VALUES (15, "新潟");
INSERT INTO `user_prefecture` (`user_id`, `prefecture_id`) VALUES (1, 15), (2, 15);
```

以下の初期データを投入してあります。

- ユーザー1は新潟県民
- ユーザー2は新潟県民
- ユーザー3は居住地未設定
- ユーザー4は居住地未設定

検証は2024-11-07現在の最新LTSである MySQL 8.4.3 を利用しました。

```plain
docker run -e MYSQL_ALLOW_EMPTY_PASSWORD=yes -p 3306:3306 -d mysql:8.4.3
```

さて、このシステムでユーザーテーブルにロックをかける必要が出てきました。
その後の処理で、ユーザーの居住地情報も必要になることがわかっています。
そこで「ユーザーテーブルのロック」と「ユーザーの居住地情報の取得」を同時に行えば効率がよいと考え、以下のクエリーを書きました。

```sql
SELECT * FROM `user`
LEFT JOIN `user_prefecture` USING (`user_id`)
LEFT JOIN `prefecture` USING (`prefecture_id`)
WHERE `user`.`user_id` = 1 FOR UPDATE;
```

### そもそもロックの範囲を間違えている可能性が高い

このクエリーを書いた人は「`user` テーブルのユーザー1のみロックがかかる」と考えているのかもしれません。
しかし MySQL の実際の挙動は違います。**関連するすべてのテーブルにもロックがかかります**。
`performance_schema.data_locks` テーブルを参照するとどこにロックが掛かっているかがわかります。
先ほどのクエリーを使ってユーザー1のロックを獲得し、ロックの様子を確かめてみましょう。

```sql
mysql> BEGIN;
Query OK, 0 rows affected (0.00 sec)

mysql> SELECT * FROM `user`
    -> LEFT JOIN `user_prefecture` USING (`user_id`)
    -> LEFT JOIN `prefecture` USING (`prefecture_id`)
    -> WHERE `user`.`user_id` = 1 FOR UPDATE;
+---------------+---------+----------+--------+
| prefecture_id | user_id | name     | name   |
+---------------+---------+----------+--------+
|            15 |       1 | Ichinose | 新潟   |
+---------------+---------+----------+--------+
1 row in set (0.00 sec)

mysql> SELECT OBJECT_NAME,INDEX_NAME,LOCK_TYPE,LOCK_MODE,LOCK_STATUS,LOCK_DATA FROM performance_schema.data_locks;
+-----------------+------------+-----------+---------------+-------------+-----------+
| OBJECT_NAME     | INDEX_NAME | LOCK_TYPE | LOCK_MODE     | LOCK_STATUS | LOCK_DATA |
+-----------------+------------+-----------+---------------+-------------+-----------+
| user_prefecture | NULL       | TABLE     | IX            | GRANTED     | NULL      |
| user            | NULL       | TABLE     | IX            | GRANTED     | NULL      |
| prefecture      | NULL       | TABLE     | IX            | GRANTED     | NULL      |
| user            | PRIMARY    | RECORD    | X,REC_NOT_GAP | GRANTED     | 1         |
| user_prefecture | PRIMARY    | RECORD    | X,REC_NOT_GAP | GRANTED     | 1         |
| prefecture      | PRIMARY    | RECORD    | X,REC_NOT_GAP | GRANTED     | 15        |
+-----------------+------------+-----------+---------------+-------------+-----------+
6 rows in set (0.00 sec)
```

`user` テーブルだけでなく `user_prefecture`, `prefecture` テーブルにもロックがかかっていることが確認できます。

ここで `prefecture` テーブルにロックがかかっているのは大問題です。
なぜなら `prefecture` テーブルの情報は複数のユーザーで共有しているため、ロックの影響が他のユーザーにまで及んでしまうのです。

```sql
mysql> BEGIN;
Query OK, 0 rows affected (0.00 sec)

mysql> SELECT * FROM `user`
    -> LEFT JOIN `user_prefecture` USING (`user_id`)
    -> LEFT JOIN `prefecture` USING (`prefecture_id`)
    -> WHERE `user`.`user_id` = 2 FOR UPDATE;
-- 関係ないはずのユーザー2までロック待ち情報になる
```

### デッドロックの危険性が高まる

<!-- TODO -->

### ギャップロックの可能性がある

```sql
mysql> BEGIN;
Query OK, 0 rows affected (0.00 sec)

mysql> SELECT * FROM `user` LEFT JOIN `user_prefecture` USING (`user_id`) LEFT JOIN `prefecture` USING (`prefecture_id`) WHERE `user`.`user_id` = 3 FOR UPDATE;
+---------------+---------+---------+------+
| prefecture_id | user_id | name    | name |
+---------------+---------+---------+------+
|          NULL |       3 | Inoriko | NULL |
+---------------+---------+---------+------+
1 row in set (0.00 sec)

mysql> SELECT OBJECT_NAME,INDEX_NAME,LOCK_TYPE,LOCK_MODE,LOCK_STATUS,LOCK_DATA FROM performance_schema.data_locks;
+-----------------+------------+-----------+---------------+-------------+------------------------+
| OBJECT_NAME     | INDEX_NAME | LOCK_TYPE | LOCK_MODE     | LOCK_STATUS | LOCK_DATA              |
+-----------------+------------+-----------+---------------+-------------+------------------------+
| user_prefecture | NULL       | TABLE     | IX            | GRANTED     | NULL                   |
| user            | NULL       | TABLE     | IX            | GRANTED     | NULL                   |
| user            | PRIMARY    | RECORD    | X,REC_NOT_GAP | GRANTED     | 3                      |
| user_prefecture | PRIMARY    | RECORD    | X             | GRANTED     | supremum pseudo-record |
+-----------------+------------+-----------+---------------+-------------+------------------------+
4 rows in set (0.00 sec)
```

```sql
mysql> BEGIN;
Query OK, 0 rows affected (0.00 sec)

mysql> ININSERT INTO `user_prefecture` (`user_id`, `prefecture_id`) VALUES (4, 15);
ERROR 1064 (42000): You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near 'ININSERT INTO `user_prefecture` (`user_id`, `prefecture_id`) VALUES (4, 15)' at line 1
mysql> INSERT INTO `user_prefecture` (`user_id`, `prefecture_id`) VALUES (4, 15);
```

### 解決策

<!-- TODO -->

## まとめ

<!-- TODO -->

> 🐇うさぎの歌\
> LEFT JOINとFOR UPDATE、\
> 一緒に使うのはダメだよ、\
> ロックの範囲、気をつけて、\
> デッドロックの罠に、\
> ひょっこりハマるかも、\
> みんなで注意、楽しく学ぼう！ 🌟
>
> by [CodeRabbit](https://coderabbit.ai/)

## 参考

- [MySQL DBロック自由自在！](https://zenn.dev/neinc_tech/articles/b71893a78064dd)
- [MySQLのdata_locksのLOCK_MODEに現れる値について](https://zenn.dev/utsushiiro/articles/ada7dea55b4fb9)
- [【行ロック】JOINしたテーブルの行ロックを改めて整理する](https://qiita.com/moshimo_good/items/40a203e830f05feb9b81)
- [innodbでサブクエリを使ったときの FOR UPDATE のロックの範囲](https://ngyuki.hatenablog.com/entry/20120425/p1)
