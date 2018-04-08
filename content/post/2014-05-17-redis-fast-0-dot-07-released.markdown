---
layout: post
title: "Redis::Fast 0.07 をリリースしました！"
slug: redis-fast-0-dot-07-released
date: 2014-05-17T16:27:00+09:00
comments: true
categories: [redis, perl]
---

[Redis::Fast 0.07](https://metacpan.org/release/Redis-Fast) をリリースしました。
現時点での最新バージョンである Redis.pm 1.974 とコンパチブルになります。

<!-- More -->

主な修正点は以下の通りです

- Redis Sentinel 対応
- トランザクション内での再接続禁止
- 再接続にDB選択し直し

## Redis Sentinel 対応

Redis Sentinel というのは自動フェールオーバーの仕組みらしいです。
(ソースはコピペしたきただけで仕組みはあまり理解していない)
どんなものかは本家ドキュメントや実際に検証してみた人の記事をご参照ください。

- [Redis Sentinel Documentation](http://redis.io/topics/sentinel)
- [Redis 2.8 の Sentinel の動きを検証してみた](http://chrone.hatenablog.com/entry/2014/02/28/212616)
- [Redis Sentinelを動かしてみた](http://blog.kenjiskywalker.org/blog/2013/01/24/redis-sentiel-howto/)

前から移植作業は進めてたのですが、本家 Redis.pm でもテストがコケたりしてちょっと不安だったのでリリースを見送ってました。
今日 Redis.pm の安定版がリリースされたのでこっちも追従しますよ！！

コネクションを作るときに `sentinels` を渡すと Redis Sentinel から接続情報を取ってきてくれます。
一緒に `reconnect` を設定しておいてあげると、Masterに何かあった時に接続情報を再取得→
自動的に Slave へフェールオーバーしてくれます。

``` perl
use Redis::Fast;
my $redis = Redis::Fast->new(
    sentinels => [ '127.0.0.1:26379' ],
	service => 'mymaster',
	reconnect => 1,
);
```

## トランザクション内での再接続禁止

Redisにも簡単な[トランザクション機能](http://redis.io/topics/transactions)があって、
複数の命令を同時に実行することができます。
トランザクション中に再接続が発生するとトランザクションがリセットされてしまうので、
接続前の命令を再投入する必要があるのですが、Redis.pm/Redis::Fastの再接続処理はそこまで面倒を見てくれません。
以前のバージョンではそこの面倒を見てくれないのに適当に処理してしまい、
トランザクションが中途半端なまま実行されてしました。

0.07 からはトランザクション内では再接続を行わずに例外を吐きます。
トランザクションを最初からやり直すなど、よしなに対応してください。


## 再接続時にDB選択し直し

一つのRedis-Serverが複数のデータベースを持てるようになっていて、
[SELECT](http://redis.io/commands/select)コマンドを使って切り替え可能です。
今までのバージョンでは、SELECTコマンドでデータベースを切り替えていても、
再接続時にリセットされてしまう問題がありました。
0.07では再接続の中でSELECTを実行し直すので、再接続を気にする必要はありません。
