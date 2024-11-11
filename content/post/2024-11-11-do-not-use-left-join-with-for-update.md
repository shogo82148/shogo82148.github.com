---
layout: post
title: "LEFT JOINとFOR UPDATEを同時に使うのはやめよう"
slug: do-not-use-left-join-with-for-update
date: 2024-11-11 22:02:00 +0900
comments: true
categories: [mysql]
---

LEFT JOIN を何度も繰り返し、さらに FOR UPDATE しているMySQLのクエリーを見かけました。
毎回似たようなコメントをするのも面倒なので、そのようなクエリーの問題点をまとめておきます。
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

ユーザーは自分の居住地（都道府県）を設定できます。
自分の居住地を明かしたくないユーザーは、居住地を設定を省略することも可能です。
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

とくに `prefecture` テーブルにロックがかかっているのは大問題です。
なぜなら `prefecture` テーブルの情報は複数のユーザーで共有しているため、ロックの影響が他のユーザーにまで及んでしまうのです。
今回の場合、「新潟に住んでいるユーザー全員」がロックの対象となります。
試しに新潟在住のユーザー2のロックを取ってみましょう。以下のようにロック待ち状態になります。

```sql
mysql> BEGIN;
Query OK, 0 rows affected (0.00 sec)

mysql> SELECT * FROM `user`
    -> LEFT JOIN `user_prefecture` USING (`user_id`)
    -> LEFT JOIN `prefecture` USING (`prefecture_id`)
    -> WHERE `user`.`user_id` = 2 FOR UPDATE;
-- 関係ないはずのユーザー2までロック待ち情報になる
```

このように、LEFT JOINとFOR UPDATEを同時に使ったクエリーは、意図しない範囲までロックを獲得している可能性があります。

### デッドロックの危険性が高まる

MySQLは「スキャンしたインデックス」に対してロックを獲得するため、テーブルをまたいだロックは一度に獲得できません。
スキャンしたテーブルから順番にロックを獲得します。
そのため、テーブルをスキャンする順番が非常に重要です。異なった順番でロックをした場合、デッドロックの可能性があります。

さて問題となったこのクエリーを再掲します。
このクエリーでは、どのような順番でMySQLはテーブルをスキャンするでしょうか？

```sql
SELECT * FROM `user`
LEFT JOIN `user_prefecture` USING (`user_id`)
LEFT JOIN `prefecture` USING (`prefecture_id`)
WHERE `user`.`user_id` = 1 FOR UPDATE;
```

多くの人がクエリーに登場した順番でスキャンすることを期待するのではないでしょうか？
今回の例では `user` → `user_prefecture` → `prefecture` の順番です。

しかしそんな保証はどこにもありません。実は **JOINした場合のテーブルのスキャン順序は決まっていない** のです。
スキャンの順番はMySQLの実行計画に依存します。
期待と異なった順番でスキャンが行われた場合、デッドロックが起こります。

### ギャップロックの可能性がある

`LEFT JOIN user_prefecture` という書き方は「`user` に対応する `user_prefecture` が存在しない可能性がある」ことを示唆しています。
今回の例ではユーザー3とユーザー4が該当します。
試しにユーザー3のロックを獲得してみましょう。

```sql
mysql> BEGIN;
Query OK, 0 rows affected (0.00 sec)

mysql> SELECT * FROM `user`
    -> LEFT JOIN `user_prefecture` USING (`user_id`)
    -> LEFT JOIN `prefecture` USING (`prefecture_id`)
    -> WHERE `user`.`user_id` = 3 FOR UPDATE;
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

`LOCK_MODE` が `X` となっているロックは、ギャップロック（行と行の間にかかるロック）です。
ギャップロックがかかった領域へINSERTしようとするとブロックされます。
たとえば、この瞬間にユーザー4が居住地を設定したとしましょう。このような操作はブロックされます。

```sql
mysql> BEGIN;
Query OK, 0 rows affected (0.00 sec)

mysql> INSERT INTO `user_prefecture` (`user_id`, `prefecture_id`) VALUES (4, 15);
-- 関係ないはずのユーザー4の操作がブロックされる
```

ギャップロックは行と行の間をロックするため、影響範囲が非常に広大になりがちです。
ギャップロックは全力で回避しましょう。

### 解決策

「ユーザーテーブルのロック」と「ユーザーの居住地情報の取得」を別のクエリーとして実行しましょう。

```sql
-- ユーザーテーブルのロック
SELECT * FROM `user` WHERE `user_id` = 1 FOR UPDATE;

-- ユーザーの居住地情報の取得
SELECT * FROM `user`
LEFT JOIN `user_prefecture` USING (`user_id`)
LEFT JOIN `prefecture` USING (`prefecture_id`)
WHERE `user`.`user_id` = 1;
```

クエリーが多くなってレイテンシーに影響があるのでは、と考えるかもしれませんが実際は軽微なものです。
ロックにまつわる諸問題を踏むほうがダメージがでかいので、安全策で行きましょう。

### 余談

以下のようにサブクエリーを使う解決方法もあります。
これならクエリーの呼び出し回数は同じです。

```sql
SELECT * FROM (SELECT * FROM `user` WHERE `user`.`user_id` = 1 FOR UPDATE) AS `u`
LEFT JOIN `user_prefecture` USING (`user_id`)
LEFT JOIN `prefecture` USING (`prefecture_id`);
```

```sql
mysql> BEGIN;
Query OK, 0 rows affected (0.00 sec)

mysql> SELECT * FROM (SELECT * FROM `user` WHERE `user`.`user_id` = 1 FOR UPDATE) AS `u`
    -> LEFT JOIN `user_prefecture` USING (`user_id`)
    -> LEFT JOIN `prefecture` USING (`prefecture_id`);
+---------------+---------+----------+--------+
| prefecture_id | user_id | name     | name   |
+---------------+---------+----------+--------+
|            15 |       1 | Ichinose | 新潟   |
+---------------+---------+----------+--------+
1 row in set (0.00 sec)

mysql> SELECT OBJECT_NAME,INDEX_NAME,LOCK_TYPE,LOCK_MODE,LOCK_STATUS,LOCK_DATA FROM performance_schema.data_locks;
+-------------+------------+-----------+---------------+-------------+-----------+
| OBJECT_NAME | INDEX_NAME | LOCK_TYPE | LOCK_MODE     | LOCK_STATUS | LOCK_DATA |
+-------------+------------+-----------+---------------+-------------+-----------+
| user        | NULL       | TABLE     | IX            | GRANTED     | NULL      |
| user        | PRIMARY    | RECORD    | X,REC_NOT_GAP | GRANTED     | 1         |
+-------------+------------+-----------+---------------+-------------+-----------+
2 rows in set (0.00 sec)
```

しかし、ちょっとトリッキーな気もするので、個人的にはオススメしません。

## まとめ

以下の理由から、LEFT JOINとFOR UPDATEを同時に使うのはやめたほうがよい。

- そもそもロックの範囲を間違えている可能性が高い
- デッドロックの危険性が高まる
- ギャップロックの可能性がある

FOR UPDATE はロックの獲得のみに使用し、関連する情報を取得するのは別クエリーに分けよう。

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
