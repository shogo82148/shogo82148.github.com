---
layout: post
title: Redis::Fastってモジュールを書いた
date: 2013-09-28T00:18:00+09:00
comments: true
categories: [perl, redis]
---

[hiredis](https://github.com/redis/hiredis)をPerlから扱うためのライブラリとして
[Redis::hiredis](http://search.cpan.org/~neophenix/Redis-hiredis/lib/Redis/hiredis.pm)ってのがあるけど、
なんだか微妙だって聞いたので自分でPerlのhiredisバインディング書いてみたよ。

* [https://github.com/shogo82148/Redis-Fast](https://github.com/shogo82148/Redis-Fast)

(READMEからRedis.pmをそのまま持ってきたことがまるわかりですね。なんとかしよう。)

<!-- More -->

## 使い方

[Redis.pm](http://search.cpan.org/~melo/Redis-1.961/lib/Redis.pm)と全く同じインターフェースなので、
そのまま置換できる、はず。

``` perl
use Redis::Fast;
my $redis = Redis::Fast->new;

### synchronize mode
$redis->set('hoge', 'piyo');
print $redis->get('hoge');  # piyo

### asynchronize mode
$redis->get('hoge', sub {
    my ($result, $error) = @_;
    print $result;  # piyo
});
$redis->wait_all_responses;

### pubsub
$redis->publish('fugu', 'fuga');
$redis->subscribe('fugu', sub {
    my ($message, $topic, $subscribed_topic) = @_;
});

my $timeout = 10;
$redis->wait_for_messages($timeout) while 1;
```

以前作った、[Redis::Namespace](https://github.com/shogo82148/Redis-Namepace)にもそのまま使えます。

``` perl
use Redis::Fast;
use Redis::Namespace;

my $redis = Redis::Fast->new;
my $ns = Redis::Namespace(redis => $redis, namespace => 'fugu');

$ns->set('foo', 'bar');    # $redis->set('fugu:foo', 'bar');
my $foo = $ns->get('foo'); # my $foo = $redis->get('fugu:foo');
```

## ベンチマーク

### Redis.pm

``` plain Redis.pm
Benchmark: running 00_ping, 10_set, 11_set_r, 20_get, 21_get_r, 30_incr, 30_incr_r, 40_lpush, 50_lpop, 90_h_get, 90_h_set for at least 5 CPU seconds...
   00_ping:  8 wallclock secs ( 0.69 usr +  4.77 sys =  5.46 CPU) @ 5538.64/s (n=30241)
    10_set:  8 wallclock secs ( 1.07 usr +  4.01 sys =  5.08 CPU) @ 5794.09/s (n=29434)
  11_set_r:  7 wallclock secs ( 0.42 usr +  4.84 sys =  5.26 CPU) @ 5051.33/s (n=26570)
    20_get:  8 wallclock secs ( 0.69 usr +  4.82 sys =  5.51 CPU) @ 5080.40/s (n=27993)
  21_get_r:  7 wallclock secs ( 2.21 usr +  3.09 sys =  5.30 CPU) @ 5389.06/s (n=28562)
   30_incr:  7 wallclock secs ( 0.69 usr +  4.73 sys =  5.42 CPU) @ 5671.77/s (n=30741)
 30_incr_r:  7 wallclock secs ( 0.85 usr +  4.31 sys =  5.16 CPU) @ 5824.42/s (n=30054)
  40_lpush:  8 wallclock secs ( 0.60 usr +  4.77 sys =  5.37 CPU) @ 5832.59/s (n=31321)
   50_lpop:  7 wallclock secs ( 1.24 usr +  4.17 sys =  5.41 CPU) @ 5112.75/s (n=27660)
  90_h_get:  7 wallclock secs ( 0.63 usr +  4.65 sys =  5.28 CPU) @ 5716.29/s (n=30182)
  90_h_set:  7 wallclock secs ( 0.65 usr +  4.74 sys =  5.39 CPU) @ 5593.14/s (n=30147)
```

### Redis::hiredis

``` plain Redis::hiredis
Benchmark: running 00_ping, 10_set, 11_set_r, 20_get, 21_get_r, 30_incr, 30_incr_r, 40_lpush, 50_lpop for at least 5 CPU seconds...
   00_ping: 10 wallclock secs ( 0.15 usr +  5.13 sys =  5.28 CPU) @ 8998.48/s (n=47512)
    10_set:  9 wallclock secs ( 0.12 usr +  4.90 sys =  5.02 CPU) @ 8552.39/s (n=42933)
  11_set_r:  9 wallclock secs ( 0.14 usr +  4.95 sys =  5.09 CPU) @ 8555.01/s (n=43545)
    20_get:  9 wallclock secs ( 0.09 usr +  5.42 sys =  5.51 CPU) @ 8785.48/s (n=48408)
  21_get_r:  9 wallclock secs ( 0.20 usr +  4.94 sys =  5.14 CPU) @ 8181.52/s (n=42053)
   30_incr:  9 wallclock secs ( 0.12 usr +  5.29 sys =  5.41 CPU) @ 8622.55/s (n=46648)
 30_incr_r:  8 wallclock secs ( 0.16 usr +  4.92 sys =  5.08 CPU) @ 8113.39/s (n=41216)
  40_lpush:  9 wallclock secs ( 0.21 usr +  5.15 sys =  5.36 CPU) @ 8547.57/s (n=45815)
   50_lpop:  8 wallclock secs ( 0.12 usr +  4.91 sys =  5.03 CPU) @ 9024.06/s (n=45391)
```

### Redis::Fast

Redis.pm の3〜5割増しくらいで速くなる。
Redis::hiredisと比べると1割〜2割くらい遅い。

``` plain Redis::Fast
Benchmark: running 00_ping, 10_set, 11_set_r, 20_get, 21_get_r, 30_incr, 30_incr_r, 40_lpush, 50_lpop, 90_h_get, 90_h_set for at least 5 CPU seconds...
   00_ping:  9 wallclock secs ( 0.18 usr +  4.84 sys =  5.02 CPU) @ 7939.24/s (n=39855)
    10_set: 10 wallclock secs ( 0.31 usr +  5.40 sys =  5.71 CPU) @ 7454.64/s (n=42566)
  11_set_r:  9 wallclock secs ( 0.31 usr +  4.87 sys =  5.18 CPU) @ 7993.05/s (n=41404)
    20_get: 10 wallclock secs ( 0.27 usr +  4.84 sys =  5.11 CPU) @ 8350.68/s (n=42672)
  21_get_r: 10 wallclock secs ( 0.32 usr +  5.17 sys =  5.49 CPU) @ 8238.62/s (n=45230)
   30_incr:  9 wallclock secs ( 0.23 usr +  5.27 sys =  5.50 CPU) @ 8221.82/s (n=45220)
 30_incr_r:  8 wallclock secs ( 0.28 usr +  4.91 sys =  5.19 CPU) @ 8092.29/s (n=41999)
  40_lpush:  9 wallclock secs ( 0.18 usr +  5.06 sys =  5.24 CPU) @ 8312.02/s (n=43555)
   50_lpop:  9 wallclock secs ( 0.20 usr +  4.84 sys =  5.04 CPU) @ 8010.12/s (n=40371)
  90_h_get:  9 wallclock secs ( 0.19 usr +  5.51 sys =  5.70 CPU) @ 7467.72/s (n=42566)
  90_h_set:  8 wallclock secs ( 0.28 usr +  4.83 sys =  5.11 CPU) @ 7724.07/s (n=39470)
```

### pipeline mode

毎回レスポンスを待っているとI/Oがボトルネックになってあんまり速度上がらないけど、
レスポンスを待たずにコマンドをどんどん送りつけると差が原著になります。

``` perl bench.pl
#!/usr/bin/perl

use warnings;
use strict;

use Time::HiRes qw/time/;
use Redis;
use Redis::Fast;
use Redis::hiredis;


my $count = 100000;

{
    my $r = Redis->new;
    my $start = time;
    for(1..$count) {
        $r->set('hoge', 'fuga', sub{});
    }
    $r->wait_all_responses;
    printf "Redis.pm:\n%.2f/s\n", $count / (time - $start);
}

{
    my $r = Redis::hiredis->new;
    $r->connect("127.0.0.1", 6379);
    my $start = time;
    for(1..$count) {
        $r->append_command('set hoge fuga');
    }
    for(1..$count) {
        $r->get_reply();
    }
    printf "Redis::hiredis:\n%.2f/s\n", $count / (time - $start);
}

{
    my $r = Redis::Fast->new;
    my $start = time;
    for(1..$count) {
        $r->set('hoge', 'fuga', sub{});
    }
    $r->wait_all_responses;
    printf "Redis::Fast:\n%.2f/s\n", $count / (time - $start);
}
```

大体Redis.pmの4倍速い。でもRedis::hiredisと比べると2割ほど遅い。
Fastを名乗るのは早すぎた。

``` plain bench
Redis.pm:
22588.95/s
Redis::hiredis:
105159.88/s
Redis::Fast:
81098.01/s
```

Perl API よくわからない。Socket通信まったくわからない。
