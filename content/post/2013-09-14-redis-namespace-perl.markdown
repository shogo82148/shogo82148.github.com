---
layout: post
title: "Redis::NamespaceのPerl版書いた"
slug: redis-namespace-perl
date: 2013-09-14T18:36:00+09:00
comments: true
categories: [perl, redis]
---

[Redis](http://redis.io/) のキーにプリフィックスつけるの面倒だなー自動的につけてくれないかなーと思い、
調べてみると Ruby に [Redis-Namespace](https://github.com/resque/redis-namespace) というものがあるらしい。
だけども、Perl では探しても見つからなかったので書いてみた。

レポジトリはこちら→[Redis::Namespace](https://github.com/shogo82148/Redis-Namepace)

<!-- More -->

## 使い方

インターフェースは [Perl Redis](http://search.cpan.org/~melo/Redis/) と一緒。
コマンドのキー名に当たる部分に、自動的にプレフィックスをつけてくれる。

``` perl
use Redis;
use Redis::Namespace;

my $redis = Redis->new;
my $ns = Redis::Namespace(redis => $redis, namespace => 'fugu');

$ns->set('foo', 'bar');    # $redis->set('fugu:foo', 'bar');
my $foo = $ns->get('foo'); # my $foo = $redis->get('fugu:foo');
```

大体のコマンドには対応したつもり。
別のプレフィックスがついたキーには基本的にアクセスできなくなるので、
キー名の管理が少し楽になると思います。

でも、flushdb とか flushall すると全部消えるので気をつけてね！
