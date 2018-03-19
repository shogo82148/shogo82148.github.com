---
layout: post
title: "Redisのトランザクション・スクリプト・ランキングを扱うPerlモジュールを公開しました"
date: 2016-03-18T22:16:00+09:00
comments: true
categories: [perl, redis]
---

以前[Redisでスコアを複数設定できるランキングを作ってみた](http://shogo82148.github.io/blog/2016/02/06/redis-leader-board-multi/)けど、
Githubの肥やしになっていてもあれなので、CPANizeしました。
あわせて、この実装のために作ったユーティリティモジュールも別モジュールとして公開しました。

- [Redis::LeaderBoardMulti](https://metacpan.org/pod/Redis::LeaderBoardMulti)
- [Redis::Script](https://metacpan.org/pod/Redis::Script)
- [Redis::Transaction](https://metacpan.org/pod/Redis::Transaction)

<!-- More -->

## Redis::LeaderBoardMulti

最初の基準で順位を決められなかった場合の第二基準が欲しいというときに使うモジュールです。
インターフェースがRedis::LeaderBoard互換になるように調整したので、
前回とインターフェースがちょっと変わっています。

``` perl
se Redis;
use Redis::LeaderBoard;
my $redis = Redis->new;
my $lb = Redis::LeaderBoardMulti->new(
    redis => $redis,
    key   => 'leader_board:1',
    order => ['asc', 'desc'], # asc/desc, desc as default
);
# Redis::LeaderBoardに合わせて複数指定できるようになりました
$lb->set_score(
    'one' => [100, time],
    'two' => [ 50, time],
);
my ($rank, $score, $time) = $lb->get_rank_with_score('one');
```

Redis::LeaderBoard互換なのでそのまま入れ替えられるはずですが、以下のような実装上の制限があります。

- スコアはすべて64bit符号付き整数
  - Redis::LeaderBoardのスコアは倍精度浮動小数点型なので小数も扱えるが、Redis::LeaderBoardMultiは整数だけ
- Redis 2.8.9以降のみで動きます
- 同順の場合の出現順
  - Redis::LeaderBoard は ZRANK, ZREVRANK を使い分けているので、orderパラメータによって昇順/降順が変わります
  - Redis::LaederBoardMulti は ZRANK しか使わないので、必ず昇順になります

一応 Lua Script を使わないオプションもそのまま残してありますが、特に理由がない限りデフォルト(Lua Script を使う)で使うといいと思います。
どうしてもロックの範囲が広くなってしまう場合があり、楽観的ロックでは効率が悪いケースがあるためです。


## Redis::Script

EVALSHAを簡単に使うためのモジュールです。
EVALコマンドを使うとLua Scriptの実装ができますが、毎回毎回実行するスクリプト全体を送る必要があります。
EVALSHAコマンドはその代わりにスクリプトのSHA1ハッシュを送ることで、帯域の節約ができるというコマンドです。
しかしEVALSHAはSHA1ハッシュを事前に登録する必要があり、どのタイミングで登録を行うかが問題になってきます。

[EVALコマンドのドキュメント](http://redis.io/commands/eval)によると、
「EVALSHAで実行してみて `NOSCRIPT No matching script` で失敗したらEVALでやり直す」というのがおすすめらしいです。
EVALコマンドはSHA1ハッシュの登録も行ってくれるので、初回 `NOSCRIPT` になっても次回からはEVALSHAが成功します。

そんなに複雑なことではないのですが、毎回書くのも大変なのでモジュールとして切り出したのが Redis::Script です。
以下のようにスクリプトオブジェクトを作っておいて、パラメータを渡して実行します。

``` perl
use Redis;
use Redis::Script;
my $script = Redis::Script->new(script => "return {KEYS[1],KEYS[2],ARGV[1],ARGV[2]}");
my ($key1, $key2, $arg1, $arg2) = $script->eval(Redis->new, ['key1', 'key2'], ['arg1', 'arg2']);
```

`$script` が計算済みのSHA1ハッシュを保存しておいてくれるので、計算リソースの節約にもなるはずです。
(ベンチとってみたところ、スクリプトのサイズが1kBから10kBくらいにならないと効果なさそうでしたが・・・)


## Redis::Transaction

Redisのトランザクションを簡単に行うためのモジュールです。

MULTI-EXECは単に実行するだけなら、MULTIとEXECで囲うだけでよいので簡単です。
例えば、 `foo` と `bar` を同時にインクリメントしたい場合、以下のようにすると実現できます。

``` perl
$redis->multi;
$redis->incr('foo');
$redis->incr('bar');
$redis->exec; # 他のクライアントからはfooとbarが全く同時にインクリメントされたように見える
```

ただ、このような素朴な実装だと、途中でネットワークが不調になった場合などに再接続処理が止まったままになる可能性があります。
例えば以下のようにトランザクションの中で例外が発生すると、以後そのコネクションを使おうとしたときにエラーになります。
コネクションの永続化をしている場合はしばらくエラーが出続けることになり問題です。

``` perl
eval {
    $redis->multi; # トランザクション開始
    $redis->incr('foo');
    $redis->incr('bar');
    die "ネットワークトラブル！"
    $redis->exec;
};
$redis->ping; # 繋がらなくなる
```

Redis::Transaction はこのような問題を防ぐためのモジュールです。
トランザクションが失敗したときの後始末をよしなにやってくれるので、万が一エラーになっても安心です。

``` perl
multi_exec Redis->new, 1, sub { # 1は失敗したときのリトライ回数
    my $redis = shift;
    $redis->incr('foo');
    $redis->incr('bar');
    die "ネットワークトラブル！"
};
$redis->ping; # 繋がる！
```

WATCH-MULTI-EXECを使った楽観的ロックも扱えます。
Redisのトランザクションは楽観的ロックなので、
処理中に他のクライアントが書き換えを行った場合に失敗する可能性があります。
その場合でもリトライを行ってくれて便利です。

``` perl
# $redis->incr('mykey') をトランザクションを使って実現する
watch_multi_exec Redis->new, ['mykey'], 10, sub {
    my $redis = shift;
    return $redis->get('mykey');
}, sub {
    my ($redis, $value) = @_;
    $redis->set('mykey', $value + 1);
};
```


## まとめ

Redisのトランザクション・スクリプト・ランキングを扱うPerlモジュールを紹介しました。
それぞれは小さなモジュールですが、
トラブル発生時にも問題にならないようちゃんとした実装しようとすると、
意外と考えることが多く面倒なものです(特にトランザクション周りとか)。
適当に実装してしまったこころ当たりのある人は、ぜひ試してみてください。
