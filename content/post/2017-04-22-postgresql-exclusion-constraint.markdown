---
layout: post
title: "Re: PostgreSQLで排他制約がめっちゃ便利！！"
slug: postgresql-exclusion-constraint
date: 2017-04-22 19:10:21 +0900
comments: true
categories: ['postgresql']
---

[PostgreSQLで排他制約がめっちゃ便利！！](http://soudai.hatenablog.com/entry/2017/04/16/152905)を拝見したのですが、
とても些細なミスがあるのに気がついてしまいました。
本題とは関係ない重箱の隅をつつくような話なので、わざわざコメントするほどのことでもないかと考えていたのですが、
どうしても試してみたいクエリを思いつき、
偶然にも[Redis、PostgreSQL、MySQLで近傍検索](http://shogo82148.github.io/blog/2017/03/28/database-gis/)したときに
セットアップしたPostgreSQL環境が残っていたのでやってみました。

<!-- More -->

## 試したかったこと

そーだいさんの記事からSQLの実行結果を一部引用します。

``` plain
demo=# SELECT * FROM schedule;

 schedule_id |  room_name  |               reservation_time
-------------+-------------+-----------------------------------------------
           1 | soudai_room | ["2017-04-16 11:30:00","2017-04-16 12:00:00")
           4 | soudai_room | ["2017-04-16 12:00:00","2017-04-16 12:30:00")
           5 | soudai_room | ("2017-04-16 12:30:00","2017-04-16 12:40:00")
           8 | soudai_room | ["2017-04-16 14:30:00","2017-04-16 16:00:00")
(4 行)
```

`schedule_id`の**5**をよく見て下さい。
他のスケジュールは**半開区間**`[)`(開始時刻は期間に**含む**が、終了時刻は期間に**含まない**)になっているのですが、
`schedule_id`の5だけ**開区間**`()`(開始時刻も終了時刻も期間に**含まない**)になっています。
つまり 2017-04-16 12:30:00 ジャストに空き時間があるのです。

**ここに予約を入れてみたい！！！**


## 試してみた

### 環境再現

以下のSQLを実行して、そーだいさんの記事と同じ内容を含んだテーブルを作成します。

``` sql
CREATE TABLE schedule
(
    schedule_id SERIAL PRIMARY KEY NOT NULL,
    room_name TEXT NOT NULL,
    reservation_time tsrange NOT NULL
);

INSERT INTO schedule (schedule_id, room_name, reservation_time) VALUES
    (1, 'soudai_room', '["2017-04-16 11:30:00","2017-04-16 12:00:00")'),
    (4, 'soudai_room', '["2017-04-16 12:00:00","2017-04-16 12:30:00")'),
    (5, 'soudai_room', '("2017-04-16 12:30:00","2017-04-16 12:40:00")'),
    (8, 'soudai_room', '["2017-04-16 14:30:00","2017-04-16 16:00:00")');

-- schedule_idが1から始まってしまい、INSERTした内容と重複してしまうので調整
SELECT setval ('schedule_schedule_id_seq', 8);
```

SELECTを実行すると同じ内容になっていることを確認できます。

``` plain
demo=# SELECT * FROM schedule;
 schedule_id |  room_name  |               reservation_time
-------------+-------------+-----------------------------------------------
           1 | soudai_room | ["2017-04-16 11:30:00","2017-04-16 12:00:00")
           4 | soudai_room | ["2017-04-16 12:00:00","2017-04-16 12:30:00")
           5 | soudai_room | ("2017-04-16 12:30:00","2017-04-16 12:40:00")
           8 | soudai_room | ["2017-04-16 14:30:00","2017-04-16 16:00:00")
(4 rows)
```

さて、ちょうど 2017-04-16 12:30:00 は空き時間になっているので、
以下のクエリは0件になるはずです。

``` sql
SELECT * FROM schedule 
          WHERE reservation_time @> '2017-04-16 12:30:00'::timestamp;
```

``` plain
 schedule_id | room_name | reservation_time
-------------+-----------+------------------
(0 rows)
```

予想通り検索結果は0件になりましたね。

そして、2017-04-16 12:30:00の直前と直後はスケジュールが埋まっています。

``` plain
demo=# SELECT * FROM schedule
          WHERE reservation_time @> '2017-04-16 12:29:59.999999'::timestamp;
 schedule_id |  room_name  |               reservation_time
-------------+-------------+-----------------------------------------------
           4 | soudai_room | ["2017-04-16 12:00:00","2017-04-16 12:30:00")
(1 row)

demo=# SELECT * FROM schedule
          WHERE reservation_time @> '2017-04-16 12:30:00.000001'::timestamp;
 schedule_id |  room_name  |               reservation_time
-------------+-------------+-----------------------------------------------
           5 | soudai_room | ("2017-04-16 12:30:00","2017-04-16 12:40:00")
(1 row)
```

### 排他制約を有効にする

予約を入れるまえに排他制約を有効にしておきましょう。
すでにテーブルを作成しているので、`ALTER TABLE`文でテーブルの定義を変更します。

``` sql
ALTER TABLE schedule ADD EXCLUDE USING GIST (reservation_time WITH &&);
```

排他制約が有効になっているか、そーだいさんの記事と同じクエリを実行してみましょう。

``` sql
INSERT INTO schedule
  (room_name, reservation_time)
     VALUES
  ('soudai_room', '[2017-04-16 15:30, 2017-04-16 17:00)');
```

``` plain
demo=# INSERT INTO schedule
demo-#   (room_name, reservation_time)
demo-#      VALUES
demo-#   ('soudai_room', '[2017-04-16 15:30, 2017-04-16 17:00)');
ERROR:  conflicting key value violates exclusion constraint "schedule_reservation_time_excl"
DETAIL:  Key (reservation_time)=(["2017-04-16 15:30:00","2017-04-16 17:00:00")) conflicts with existing key (reservation_time)=(["2017-04-16 14:30:00","2017-04-16 16:00:00")).
```

期待通り排他制約により実行に失敗してくれました。


### 予約を入れてみる

さあ、ここからが本題です。
ちょうど 2017-04-16 12:30:00 の時間に予約を入れてみましょう。

``` sql
INSERT INTO schedule
  (room_name, reservation_time)
     VALUES
  ('soudai_room', '[2017-04-16 12:30:00, 2017-04-16 12:30:00]');
```

``` plain
demo=# INSERT INTO schedule
demo-#   (room_name, reservation_time)
demo-#      VALUES
demo-#   ('soudai_room', '[2017-04-16 12:30:00, 2017-04-16 12:30:00]');
INSERT 0 1
```

``` plain
demo=# SELECT * FROM schedule;
 schedule_id |  room_name  |               reservation_time
-------------+-------------+-----------------------------------------------
           1 | soudai_room | ["2017-04-16 11:30:00","2017-04-16 12:00:00")
           4 | soudai_room | ["2017-04-16 12:00:00","2017-04-16 12:30:00")
           5 | soudai_room | ("2017-04-16 12:30:00","2017-04-16 12:40:00")
           8 | soudai_room | ["2017-04-16 14:30:00","2017-04-16 16:00:00")
          10 | soudai_room | ["2017-04-16 12:30:00","2017-04-16 12:30:00"]
(5 rows)
```

**やった予約成功！**

PostreSQLのドキュメントによるとtimestamp型の精度は1マイクロ秒らしいので、
部屋を利用できるのは1マイクロ秒だけですが・・・。


## インデックスの使われ方について

インデックスの使われ方について気になったので、少し検証を続行してみます。
僕自身はMySQLを扱う事が多いのですが、MySQLではユニーク制約を設定すると、設定したカラムに自動的にインデックスが張られて、
それが検索時にも使用されます。
PostreSQLの排他制約でもそうなのかな？と疑問に思ったので、実行計画を確認してみました。

今回用意したテーブルだと行数が少なすぎて、
インデックスが利用可能な場合でもフルスキャンが選択されてしまいます。
データを大量に用意するのも面倒ですし、どうやらフルスキャンを無効化するオプション(厳密には、フルスキャン以外に選択肢がない場合があるので、なるべく使わない)があるらしいので、
その状態で実行計画を確認してみましょう。

``` plain
demo=# SET enable_seqscan = OFF;
SET
demo=# EXPLAIN SELECT * FROM schedule
          WHERE reservation_time @> '2017-04-16 12:30:00'::timestamp;
                                           QUERY PLAN
------------------------------------------------------------------------------------------------
 Index Scan using schedule_reservation_time_excl on schedule  (cost=0.13..8.15 rows=1 width=68)
   Index Cond: (reservation_time @> '2017-04-16 12:30:00'::timestamp without time zone)
(2 rows)
```

(読み方よくわかってないけど)Index Scanとあるので、きっとインデックスを使ってくれているのでしょう。


排他制約に`room_name`を入れた場合も試してみました。

``` sql
CREATE EXTENSION btree_gist;
ALTER TABLE schedule ADD EXCLUDE USING GIST (room_name WITH =, reservation_time WITH &&);
```

``` plain
demo=# SET enable_seqscan = OFF;
SET
demo=# EXPLAIN SELECT * FROM schedule
          WHERE room_name = 'soudai_room' AND reservation_time @> '2017-04-16 12:30:00'::timestamp;
                                                           QUERY PLAN
--------------------------------------------------------------------------------------------------------------------------------
 Index Scan using schedule_room_name_reservation_time_excl on schedule  (cost=0.14..8.16 rows=1 width=68)
   Index Cond: ((room_name = 'soudai_room'::text) AND (reservation_time @> '2017-04-16 12:30:00'::timestamp without time zone))
(2 rows)
```

(やっぱり読み方よくわかってないけど)Index Scanとあるので、きっとインデックスを使ってくれているのでしょう。

今回はフルスキャンを手動で無効化しましたが、大量にデータがあれば自動的にインデックスを使ってくれそうです。


## 再発防止策を考えてみる

試したいことを試せたのでここで終わりでもいいんですが、
エンジニアとしてはやはり再発防止策を入れておきたいところです。
色々な範囲関数があるので、それを使えばCHECK制約をかけられるのでは、と書いてみたのがこちら。

``` sql
CREATE EXTENSION btree_gist;
CREATE TABLE schedule
(
    schedule_id SERIAL PRIMARY KEY NOT NULL,
    room_name TEXT NOT NULL,
    reservation_time tsrange NOT NULL,
    CHECK (    lower_inc(reservation_time)),
    CHECK (NOT upper_inc(reservation_time)),
    EXCLUDE USING GIST (room_name WITH =, reservation_time WITH &&)
);
```

さあ、データを投入してみましょう。

``` sql
INSERT INTO schedule (room_name, reservation_time) VALUES
    ('soudai_room', '["2017-04-16 11:30:00","2017-04-16 12:00:00")');
INSERT INTO schedule (room_name, reservation_time) VALUES
    ('soudai_room', '("2017-04-16 12:30:00","2017-04-16 12:40:00")');
```

期間が半区間`[)`になっている最初のクエリは成功しますが、
開区間`()`になっている二番目のクエリは以下のようなエラーを吐いて挿入に失敗します。

``` plain
demo=# INSERT INTO schedule (room_name, reservation_time) VALUES
demo-#     ('soudai_room', '("2017-04-16 12:30:00","2017-04-16 12:40:00")');
ERROR:  new row for relation "schedule" violates check constraint "schedule_reservation_time_check"
DETAIL:  Failing row contains (2, soudai_room, ("2017-04-16 12:30:00","2017-04-16 12:40:00")).
```

## まとめ

制約はユニーク制約くらいしか使ったことがないのですが、いろんな制約があって便利ですね。
(と書いたところで外部キー制約を使った経験を思い出したけど、[MySQLユーザにはいろいろ事情があってね・・・](http://songmu.github.io/slides/fk-night/#0))

特に、時間指定が半区間`[)`か閉区間`[]`かで苦しめられた身からすると、これを制約に入れられるのは非常に魅力的です(ちなみに僕は半区間`[)`推進派です)。
PostgreSQLを利用することがあれば使っていきたい機能ですね(使う機会あるかな・・・)。


## 参考文献

- [PostgreSQLで排他制約がめっちゃ便利！！](http://soudai.hatenablog.com/entry/2017/04/16/152905)
- [8.5. 日付/時刻データ型  - PostgreSQL 9.6.2文書](https://www.postgresql.jp/document/9.6/html/datatype-datetime.html)
- [8.17. 範囲型 - PostgreSQL 9.6.2文書](https://www.postgresql.jp/document/9.6/html/rangetypes.html)
- [ALTER TABLE - PostgreSQL 9.6.2文書](https://www.postgresql.jp/document/9.6/html/sql-altertable.html)
- [9.19. 範囲関数と演算子 - PostgreSQL 9.6.2文書](https://www.postgresql.jp/document/9.6/html/functions-range.html)
- [14.1. EXPLAINの利用 - PostgreSQL 9.6.2文書](https://www.postgresql.jp/document/9.6/html/using-explain.html)
- [19.7. 問い合わせ計画 - PostgreSQL 9.6.2文書](https://www.postgresql.jp/document/9.6/html/runtime-config-query.html#runtime-config-query-enable)
- [我々(主語が大きい)は何故MySQLで外部キーを使わないのか](http://songmu.github.io/slides/fk-night/#0)
