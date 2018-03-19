---
layout: post
title: "Redis::NamespaceとRedis::Keyをリリースしました"
date: 2013-10-18T23:21:00+09:00
comments: true
categories: [perl, redis]
---

こんばんは、最近シングルトン恐怖症になっているいっちーです。
[Redis::Namespace](https://metacpan.org/release/Redis-Namespace)と
[Redis::Key](https://metacpan.org/release/Redis-Key)をリリースしました。

<!-- More -->

## Redis::Namespace

「[Redis::NamespaceのPerl版書いた](http://shogo82148.github.io/blog/2013/09/14/redis-namespace-perl/)」
で紹介したモジュールをCPANizeしました。
コマンドのキー名に当たる部分に、自動にプレフィックスをつけてくれる賢い奴です。

```perl
use Redis;
use Redis::Namespace;

my $redis = Redis->new;
my $ns = Redis::Namespace->new(redis => $redis, namespace => 'fugu');

$ns->set('foo', 'bar');    # $redis->set('fugu:foo', 'bar');
my $foo = $ns->get('foo'); # my $foo = $redis->get('fugu:foo');
```

RedisにはKey-Value Storeなんてかっこいい名前が付いているけど、
結局はシステム全体で使えるグローバル変数なわけです。
グローバル変数は駆逐するべきです。
いちいちプレフィックスつけて名前の衝突を回避するなんて人間のやることとは思えません。

せめてモジュールローカルとか、クラスローカルとかある程度スコープを制限したいですよね。
Redis::Namespaceを使えば簡単に実現できます。


## Redis::Key

Redis::Key は Redisのキーの簡単なラッパークラスです。
毎回毎回「接続先のRedisサーバ」と「キーの名前」を指定するのは面倒です。
この2つをセットにして、一つのオブジェクトとして扱うことができます。

```perl
use Redis;
use Redis::Key;

my $redis = Redis->new;
my $key = Redis::Key->new(redis => $redis, key => 'hoge');
$key->set('fugu'); # $redis->set('hoge', 'fuga');
$key->get;         # $redis->get('hoge');
```

普通に使っている限りは他のキーにアクセスすることができなくなるので、
Redis::Keyのオブジェクトを他のクラスに渡す、とかしても安心です。

あと、キーの名前の一部をプレースホルダーにして、あとから値を埋め込むこともできます。
キー名の一部に日付やIDを埋め込むっていうことが多いのでつけてみました。

```perl
my $user_keys = Redis::Key->new(redis => $redis, key => 'user:{id}', need_bind => 1);
my $user = $user_keys->bind(id => 1001);
$user->get;  # $redis->get('user:1001');
```

Key-Value Store はお手軽ではありますが、キーの名前に一定のルールを設けてあげないと
さすがに管理できなくなります。
Redis::Key を使ってルールを書くのが楽になるといいですね。


## Redis::Fast と Redis::Namespace と Redis::Key を組み合わせる

Redis::Fast と Redis::Namespace は Redis.pm 互換なので組み合わせて使えます。

```perl
my $redis = Redis::Fast->new;
my $ns1 = Redis::Namespace->new(redis => $redis, namespace => 'hoge');
my $ns2 = Redis::Namespace->new(redis => $ns1, namespace => 'fuga'); # Redis::Namespaceのネストもできる
my $key = Redis::Key->new(redis => $ns2, key => 'key'); # hoge:fuga:key という名前になる
```


なんだか最近Redis関連のモジュールばかり書いてますが、
なんでもRedisに突っ込めばいいと思っているわけではありません。
Redisを使ったコードを読んでいたら目眩がしたからです。
ISUCON3の予選で使ったのはRedisを使いたかったらというより、
Redis::Fastを使いたかったからです。
