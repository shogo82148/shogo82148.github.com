---
layout: post
title: "Redis、PostgreSQL、MySQLで近傍検索"
date: 2017-03-28 19:59:49 +0900
comments: true
categories: [mysql, redis, postgresql]
---

「[サーバーで付近の情報を通知するサービスのつくり方](http://techblog.kayac.com/serverside-geohash)」
という、Geohashを使って近傍検索を実現する記事をみつけました。
最近[Redisに関する記事](https://shogo82148.github.io/blog/2017/02/23/perl-webdb-vol97/)を書いた関係で、
この記事をみて「GeohashはRedisと一緒に使うともっと便利だよ！」と思わず宣伝したくなったのですが、
MySQL5.7でInnoDBに空間インデックス(Spatial Index)のサポートが入ったので
「MySQLでももっと簡単にできるのでは？」と思い、
RedisやMySQLを含めたいろんなDBで近傍検索を実現する方法を調べてみました。

以前、[スマートフォンのセンサを活用して花火の打ち上げ場所を推定するアプリ](https://shogo82148.github.io/blog/2012/08/02/fireworks/)を作った関係で、
地球上での距離計算の実装も気になったので、それについても調査してみました。

<!-- More -->

## 関連知識

### GeoHash

[Geohash（ジオハッシュ）](https://ja.wikipedia.org/wiki/%E3%82%B8%E3%82%AA%E3%83%8F%E3%83%83%E3%82%B7%E3%83%A5)
は緯度・経度を短い文字列に変換する方法です。
距離が近い2地点のGeohashは似たような文字列になるという特徴があります(一部例外あり)。
この特徴を利用すると、文字列検索だけで近傍検索が実現できます。

### 地球上の二点間の距離

地球は完全な球体ではなく、回転楕円体であることが知られています。
地球の形がわからないと緯度・経度などを決められないので、
[地球楕円体](https://ja.wikipedia.org/wiki/%E5%9C%B0%E7%90%83%E6%A5%95%E5%86%86%E4%BD%93)が定義されています。
近似方法によっていくつか種類があるのですが、GPSなどで使われているWGS84がよく使われているようです。

国土地理院が提供している[測量計算サイト](http://vldb.gsi.go.jp/sokuchi/surveycalc/main.html)では
[距離と方位角の計算](http://vldb.gsi.go.jp/sokuchi/surveycalc/surveycalc/bl2stf.html)を使って緯度・経度から距離を計算できます。
回転楕円体上の距離の厳密解は求められない(要出典)ので、
[数値計算](http://vldb.gsi.go.jp/sokuchi/surveycalc/surveycalc/algorithm/bl2st/bl2st.htm)によって求めることになります。
計算式を見て分かる通り非常に複雑なので、なんらかの近似をしている実装がほとんどです。


## 各種DBでの実現方法

### Redis

Redisでは3.2から[GEO](https://redis.io/commands#geo)関連の機能をサポートしています。
ソート済みセットにGeohashを組み合わせて実現しています。

簡単に試してみました。データは以下の記事から拝借したものを使用します。

- [MySQLで指定した緯度経度から半径nメートル内検索っぽいのを実現するSQL](http://d.hatena.ne.jp/ilo/20090212/1234448136)
- [PostgreSQLとOracleで緯度経度から半径nメートル内検索を実行してみる。](https://www.infoscoop.org/blogjp/2015/01/21/tutorial_for_geodb/)

[`GEOADD`](https://redis.io/commands/geoadd)でデータ挿入です。
ちなみにデータを削除する`GEODEL`は用意されていないとのこと。
中身はソート済みセットなので、[ZREM](https://redis.io/commands/zrem)でいいんですね。

``` plain
$ cat command.txt
GEOADD geotable 139.777254 35.713768 上野駅         139.774029 35.711846 西郷隆盛像
GEOADD geotable 139.774744 35.712737 上野の森美術館 139.770872 35.712351 不忍池弁財天
GEOADD geotable 139.775696 35.716293 野口英世博士像 139.775803 35.715420 国立西洋美術館
GEOADD geotable 139.776544 35.716319 国立科学博物館 139.772776 35.717186 東京都美術館
GEOADD geotable 139.776462 35.718883 東京国立博物館 139.794547 35.715280 花やしき
GEOADD geotable 139.792692 35.710635 雷門
$ redis-cli < command.txt
(integer) 2
(integer) 2
(integer) 2
(integer) 2
(integer) 2
(integer) 1
```

`GEOHASH`で各地点のGeohashを取得できます。

``` plain
$ redis-cli
127.0.0.1:6379> GEOHASH geotable 上野駅 西郷隆盛像 上野の森美術館
1) "xn77htqxy10"
2) "xn77hthkdf0"
3) "xn77htkcg80"
```

`GEORADIUS`で近傍検索ができます。
上野駅から半径300m以内の地点を求める例です。
データに日本語を使ったので非常にわかりにくいですが、
上野駅から近い順に「上野駅」「国立西洋美術館」「上野の森美術館」「国立科学博物館」の距離と座標を返してくれました。

``` plain
$ redis-cli
127.0.0.1:6379> GEORADIUS geotable 139.777254 35.713768 300 m WITHCOORD WITHDIST ASC
1) 1) "\xe4\xb8\x8a\xe9\x87\x8e\xe9\xa7\x85"
   2) "0.1203"
   3) 1) "139.77725297212600708"
      2) "35.71376868735887911"
2) 1) "\xe5\x9b\xbd\xe7\xab\x8b\xe8\xa5\xbf\xe6\xb4\x8b\xe7\xbe\x8e\xe8\xa1\x93\xe9\xa4\xa8"
   2) "225.4920"
   3) 1) "139.77580457925796509"
      2) "35.71541879083360271"
3) 1) "\xe4\xb8\x8a\xe9\x87\x8e\xe3\x81\xae\xe6\xa3\xae\xe7\xbe\x8e\xe8\xa1\x93\xe9\xa4\xa8"
   2) "254.1580"
   3) 1) "139.77474242448806763"
      2) "35.71273705584702896"
4) 1) "\xe5\x9b\xbd\xe7\xab\x8b\xe7\xa7\x91\xe5\xad\xa6\xe5\x8d\x9a\xe7\x89\xa9\xe9\xa4\xa8"
   2) "290.8339"
   3) 1) "139.77654486894607544"
      2) "35.71631861684517872"
```

上野駅と上野駅の距離は当然0mなはずですが、ちょっとだけズレてます。
これはソート済みセットの制約で緯度・経度それぞれ53bitを26bitにまるめているからです(たぶん)。
距離の計算は[半径6372797.560856mの完全な球体](https://github.com/antirez/redis/blob/4.0/src/geohash_helper.c#L52)で近似し、
[Haversine formula](https://en.wikipedia.org/wiki/Haversine_formula)というのを使っています。

ちなみに扱える緯度・経度には以下の制限があり、極付近の座標は扱えません。

- 経度 -180度から180度
- 緯度 -85.05112878度から85.05112878度

これは Spherical Mercator(球面メルカトル図法) の制限らしいです。
Google Maps, OpenStreetMap, Bing 等でよく見る地図は平面ですが、本来の地球は丸いので、うまく平面にマッピングする必要があります。
このときにどうしても本来の地形から歪んでしまうわけですが、
極付近では歪みが無限大になってしまいうまく平面の地図にできないのです。

ただ、Redis自体は平面へのマッピングをしないので、別にこの制限要らな気もします。
まあ、コーナーケースなので他にも問題がありそうですし、
そもそも北極・南極向けにサービス作らないので気にしないでおきましょう。


### PostgreSQL

日本語で書かれた先行事例を見つけたので、PostgreSQLの紹介から。
以下の記事にあるように、PostGISというオプション機能をインストールすると簡単に実現できます。

- [PostgreSQLとOracleで緯度経度から半径nメートル内検索を実行してみる。](https://www.infoscoop.org/blogjp/2015/01/21/tutorial_for_geodb/)


``` sql
-- PostGISを有効化
CREATE EXTENSION postgis;

-- テーブルの作成
CREATE TABLE geotable (
    id   SERIAL NOT NULL PRIMARY KEY,
    name varchar (255) NOT NULL,
    geom geography(POINT, 4326) NOT NULL
);

-- データの挿入
INSERT INTO geotable (name, geom) VALUES
('上野駅', ST_GeographyFromText('SRID=4326;POINT(139.777254 35.713768)')),
('西郷隆盛像', ST_GeographyFromText('SRID=4326;POINT(139.774029 35.711846)')),
('上野の森美術館', ST_GeographyFromText('SRID=4326;POINT(139.774744 35.712737)')),
('不忍池弁財天', ST_GeographyFromText('SRID=4326;POINT(139.770872 35.712351)')),
('野口英世博士像', ST_GeographyFromText('SRID=4326;POINT(139.775696 35.716293)')),
('国立西洋美術館', ST_GeographyFromText('SRID=4326;POINT(139.775803 35.71542)')),
('国立科学博物館', ST_GeographyFromText('SRID=4326;POINT(139.776544 35.716319)')),
('東京都美術館', ST_GeographyFromText('SRID=4326;POINT(139.772776 35.717186)')),
('東京国立博物館', ST_GeographyFromText('SRID=4326;POINT(139.776462 35.718883)')),
('花やしき', ST_GeographyFromText('SRID=4326;POINT(139.794547 35.71528)')),
('雷門', ST_GeographyFromText('SRID=4326;POINT(139.792692 35.710635)'));

-- 空間インデックスの作成
CREATE INDEX gist_geotable on geotable USING GIST (geom);
```

`ST_GeoHash`でGeohashを求めることができます。

``` sql
SELECT name, ST_AsText(geom), ST_GeoHash(geom) FROM geotable;
```

``` plain
         name          |          st_astext          |      st_geohash
-----------------------+-----------------------------+----------------------
 上野駅             | POINT(139.777254 35.713768) | xn77htqxy0fu2t0y69sv
 西郷隆盛像       | POINT(139.774029 35.711846) | xn77hthkdfw51p8cmr68
 上野の森美術館 | POINT(139.774744 35.712737) | xn77htkcg8enm86bp3j7
 不忍池弁財天    | POINT(139.770872 35.712351) | xn77ht4p92sp8jdqkjzf
 野口英世博士像 | POINT(139.775696 35.716293) | xn77htvw3z9495yr4dxd
 国立西洋美術館 | POINT(139.775803 35.71542)  | xn77htv9kkbffr4ptjcy
 国立科学博物館 | POINT(139.776544 35.716319) | xn77htynts3mer092t8v
 東京都美術館    | POINT(139.772776 35.717186) | xn77hw57twp9x63n6vus
 東京国立博物館 | POINT(139.776462 35.718883) | xn77hwqjedkhwdmmwp0n
 花やしき          | POINT(139.794547 35.71528)  | xn77jjg2949rgdfxbrjp
 雷門                | POINT(139.792692 35.710635) | xn77jhcvtbf5mdcexf85
(11 rows)
```

近傍検索には[`ST_DWithin`](http://cse.naro.affrc.go.jp/yellow/pgisman/2.0.0/ST_DWithin.html)を使います。
[`ST_Distance`](http://cse.naro.affrc.go.jp/yellow/pgisman/2.0.0/ST_Distance.html)や
[`ST_Distance_Sphere`](http://cse.naro.affrc.go.jp/yellow/pgisman/2.0.0/ST_Distance_Sphere.html)、
[`ST_Distance_Spheroid`](http://cse.naro.affrc.go.jp/yellow/pgisman/2.0.0/ST_Distance_Spheroid.html)等
を使って距離を計算して絞り込むことも出来ますが、これらの関数はインデックスを使ってくれません。
`ST_DWithin`は
[GiSTインデックス](http://cse.naro.affrc.go.jp/yellow/pgisman/2.0.0/using_postgis_dbmanagement.html#id286995989)
を利用してくれるので高速に処理してくれます。

``` sql
SELECT
    name,
    ST_AsText(geom),
    ST_Distance('SRID=4326;POINT(139.777254 35.713768)', geom) as dist
FROM geotable
WHERE ST_DWithin(geom, ST_GeographyFromText('SRID=4326;POINT(139.777254 35.713768)'), 300.0)
ORDER BY dist;
```

``` plain
         name          |          st_astext          |     dist
-----------------------+-----------------------------+---------------
 上野駅             | POINT(139.777254 35.713768) |             0
 国立西洋美術館 | POINT(139.775803 35.71542)  | 225.468916585
 上野の森美術館 | POINT(139.774744 35.712737) | 254.308127877
 国立科学博物館 | POINT(139.776544 35.716319) | 290.242707221
 ```

`ST_`で始まる関数は[OpenGIS](http://www.opengeospatial.org/standards/sfs)やSQL/MMで標準化されているものらしいです。


### MySQL

MySQLに関しては以下の記事を見つけました。
この記事が書かれた頃はMyISAMでしか空間インデックスをサポートしていませんでしたが、
5.7からInnoDBでもサポートされるようになったので、
InnoDBでも同様のことができるはずです。

- [mysql空間テーブルの作り方](http://qiita.com/kochizufan/items/a68b30ba74849483f75c)

MySQL5.7で入った機能についてはこちらを参照。
空間インデックス以外にも大量に変更があるので、アップグレードする人は確認をおすすめします。

<iframe style="width:120px;height:240px;" marginwidth="0" marginheight="0" scrolling="no" frameborder="0" src="//rcm-fe.amazon-adsystem.com/e/cm?lt1=_blank&bc1=000000&IS2=1&bg1=FFFFFF&fc1=000000&lc1=0000FF&t=shogo82148-22&o=9&p=8&l=as4&m=amazon&f=ifr&ref=as_ss_li_til&asins=B01LCJRCYE&linkId=ac9d8d9e348bd97dc858337c94e82696"></iframe>

MySQLもPostgreSQLもOpenGISに準拠する方針みたいなので、
PostgreSQLと同じ感じでSQLが書けると信じたいところですが、
当然ながらそうは行きません。

一番大きな違いは`geography`型には対応しておらず`geometry`型しか使えないということです。
`geography`型は測地系の情報を持っている(つまり地球が回転楕円体だということを知っている)のですが、
`geometry`型は測地系の情報が無いため、平面しか扱えません。

``` sql
CREATE DATABASE test; -- 5.6以前は勝手に作ってくれたけど、5.7からは無いらしい
USE test;
CREATE TABLE IF NOT EXISTS `geotable` (
  `id`   int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR (255) NOT NULL,
  `geom` geometry NOT NULL,
  PRIMARY KEY (`id`),
  SPATIAL KEY `geom` (`geom`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

座標の指定も`ST_GeographyFromText`ではなく`ST_GeomFromText`を使います。

``` sql
INSERT INTO geotable (name, geom) VALUES
('上野駅', ST_GeomFromText('POINT(139.777254 35.713768)')),
('西郷隆盛像', ST_GeomFromText('POINT(139.774029 35.711846)')),
('上野の森美術館', ST_GeomFromText('POINT(139.774744 35.712737)')),
('不忍池弁財天', ST_GeomFromText('POINT(139.770872 35.712351)')),
('野口英世博士像', ST_GeomFromText('POINT(139.775696 35.716293)')),
('国立西洋美術館', ST_GeomFromText('POINT(139.775803 35.71542)')),
('国立科学博物館', ST_GeomFromText('POINT(139.776544 35.716319)')),
('東京都美術館', ST_GeomFromText('POINT(139.772776 35.717186)')),
('東京国立博物館', ST_GeomFromText('POINT(139.776462 35.718883)')),
('花やしき', ST_GeomFromText('POINT(139.794547 35.71528)')),
('雷門', ST_GeomFromText('POINT(139.792692 35.710635)'));
```

PostgreSQLと同様にGeohashを求める[`ST_GeoHash`があります](https://dev.mysql.com/doc/refman/5.7/en/spatial-geohash-functions.html)が、
桁数を指定する必要があるという違いがあります。

``` sql
SELECT name, ST_AsText(geom), ST_GeoHash(geom, 11) FROM geotable;
```

``` plain
+-----------------------+-----------------------------+----------------------+
| name                  | ST_AsText(geom)             | ST_GeoHash(geom, 11) |
+-----------------------+-----------------------------+----------------------+
| 上野駅                | POINT(139.777254 35.713768) | xn77htqxy0f          |
| 西郷隆盛像            | POINT(139.774029 35.711846) | xn77hthkdfw          |
| 上野の森美術館        | POINT(139.774744 35.712737) | xn77htkcg8e          |
| 不忍池弁財天          | POINT(139.770872 35.712351) | xn77ht4p92s          |
| 野口英世博士像        | POINT(139.775696 35.716293) | xn77htvw3z9          |
| 国立西洋美術館        | POINT(139.775803 35.71542)  | xn77htv9kkb          |
| 国立科学博物館        | POINT(139.776544 35.716319) | xn77htynts3          |
| 東京都美術館          | POINT(139.772776 35.717186) | xn77hw57twp          |
| 東京国立博物館        | POINT(139.776462 35.718883) | xn77hwqjedk          |
| 花やしき              | POINT(139.794547 35.71528)  | xn77jjg2949          |
| 雷門                  | POINT(139.792692 35.710635) | xn77jhcvtbf          |
+-----------------------+-----------------------------+----------------------+
11 rows in set (0.00 sec)
```

MySQLにも距離を求める`ST_Distance`はあるのですが、これは平面専用です。
地球上での距離を求めるには[`ST_Distance_Sphere`を使います](https://dev.mysql.com/doc/refman/5.7/en/spatial-convenience-functions.html)。
MySQL5.7から追加された関数で、これを使うと半径6370986mの球体で近似したときの距離を計算できます。

そして残念なことにPostgreSQLにはあった`ST_DWithin`はMySQLにはありません。
`ST_Distance_Sphere`を使えばクエリは書けるのですが、インデックスを使ってくれないので非効率です。
そのため、矩形の範囲指定で大雑把に絞り込んだあとで`ST_Distance_Sphere`を使って詳細に絞り込むことになります。


``` sql
SET @ueno = ST_GeomFromText('POINT(139.777254 35.713768)');
SELECT
    name,
    ST_AsText(geom),
    ST_Distance_Sphere(@ueno, geom) AS dist
FROM geotable
WHERE ST_Distance_Sphere(@ueno, geom) <= 300
AND ST_Within(geom, ST_Buffer(@ueno, DEGREES(300/(6370986*COS(RADIANS(ST_Y(@ueno))))), ST_Buffer_Strategy('point_square')))
ORDER BY dist;
```

``` plain
+-----------------------+-----------------------------+--------------------+
| name                  | ST_AsText(geom)             | dist               |
+-----------------------+-----------------------------+--------------------+
| 上野駅                | POINT(139.777254 35.713768) |                  0 |
| 国立西洋美術館        | POINT(139.775803 35.71542)  | 225.62014319497658 |
| 上野の森美術館        | POINT(139.774744 35.712737) | 253.96163316266237 |
| 国立科学博物館        | POINT(139.776544 35.716319) | 290.81011310408957 |
+-----------------------+-----------------------------+--------------------+
4 rows in set (0.00 sec)
```

緯度によって経度1度あたりの長さが違うので、矩形選択の範囲に補正を入れてあります。
本当は緯度の補正は無くても良いはずですが、広めならいいだろ！ってことで雑に書いています。
本番で使いたい人は補正＆バリデーション頑張ってください(特に極の辺りで大変なことになるので)。


### その他DB

力尽きたので簡単に。

SQLiteは[SpatiaLite](https://www.gaia-gis.it/fossil/libspatialite/index)という拡張モジュールで空間データを扱えるようです。

全文検索エンジンの[Groonga](http://groonga.org/ja/)も近傍検索に対応していて、
距離の計算方法は以下の3つから選べるようです。
([`geo_distance`](http://groonga.org/ja/docs/reference/functions/geo_distance.html))

- `rectangle`: 方形近似して距離を計算
- `sphere`: [半径6357303m](https://github.com/groonga/groonga/blob/v7.0.0/lib/grn_geo.h#L42)の完全な球体と仮定して計算
- `ellipsoid`: WGS84地球楕円体を[ヒュベニの距離計算式](http://yamadarake.jp/trdi/report000001.html)で近似

ヒュベニの距離計算式というのが出てきましたが、`ellipsoid`で使っているのは簡易版で、
[本来のヒュベニの距離計算式](http://www.amano-tec.com/apps/paceruler.html)は非常に複雑で難しい・・・。


## まとめ

Redis、PostgreSQL、MySQLで近傍検索をやってみました。

- Redisは近傍検索だけならお手軽
- PostgreSQL+PostGISは今回触った中では最強。地理データを真面目に扱うならいいかも
- MySQLは5.6以前よりは扱いやすくなったものの、空間インデックスを効果的に使うには一工夫必要

PostgreSQL+PostGISと比べると、どうしてもMySQL5.7は見劣りしますね。
しかし、検索をSQLで書けるという利点は大きいので、利用を検討する価値はあると思います。

ところで、大体のDBで地球を完全な球で近似する実装が入ってるんですが、
半径が微妙に違うんですよね。

- Redis: 6 372 797.560 856m
- PostgreSQL: 6 370 986m
- MySQL: 6 370 986m
- Groonga: 6 357 303m
- 赤道半径: 6 378 137m
- 極半径: 6 356 752.314 245m

0.24%しか違わないので、実用上は全く問題ないんですが、
出典がよくわからないし気になります。
