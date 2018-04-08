---
layout: post
title: "Perl の Redis ライブラリを調べた"
slug: perl-redis-libraries
date: 2013-08-24T17:51:00+09:00
comments: true
categories: [perl, redis]
---

最近[Redis](http://redis.io/) を使ったコードを書くようになったのですが、
キー名を毎回指定するのがだるいです。
Ruby には [redis-objects](https://github.com/nateware/redis-objects) というのがあって、
Redisのキーをオブジェクトとして扱うことができるようです。
きっと、Perl にも似たようなのあるだろ、って思って調べてみました。

<!-- More -->

## ほしいもの

低レベルなRedisのライブラリはたいていメソッドとRedisのコマンドが一対一対応していて、
次のようなコードになると思います。

``` perl hogehoge.pl
$redis->set('key-name', 'piyopiyo');
$redis->get('key_name');
```

でも、Redisに何か操作をしたいわけじゃなくて、
Redisのキーに対して操作をしたいので、
次のように書けるべきだと思うんです。

``` perl expected.pl
my $key = key($redis, 'key-name');
$key->set('piyopiyo');
$key->get();
```


## Redis::Hash, Redis::List

[Redis::Hash](http://search.cpan.org/~melo/Redis/lib/Redis/Hash.pm)と
[Redis::List](http://search.cpan.org/~melo/Redis/lib/Redis/List.pm)は
Perlのハッシュや配列と同じ操作で Redis にアクセスできるようにするライブラリ。

``` perl Redis::Hash
use utf8;
use warnings;
use strict;
use 5.014;

use Redis::Hash;

tie my %my_hash, 'Redis::Hash', 'hash_prefix', (server => 'localhost:6379');

# set hash_prefix:hogehoge piyopiyo
# set hash_prefix:fugafuga fugufugu
$my_hash{hogehoge} = 'piyopiyo';
$my_hash{fugafuga} = 'fugufugu';

# get hash_prefix:hogehoge piyopiyo
say $my_hash{hogehoge}; # piyopiyo

# keys hash_prefix:*
say join ',', keys %my_hash; #fugafuga,hogehoge

# keys hash_prefix:*
# get hash_prefix:fugafuga
# get hash_prefix:hogehoge
say join ',', values %my_hash; #fugufugu,piyopiyo

# del hash_prefix:hogehoge
delete $my_hash{hogehoge};
```

tie とかよくわかない。
Perl の黒魔術を見た気がしました。

普通のハッシュや配列に見えるのは面白いけど、
Redisっぽい機能がまったく使えないのはつらい。
`tied(%my_hash)->cmd` って書けばコマンド発行できるけど、
それなら最初から直接 [Redis.pm](http://search.cpan.org/~melo/Redis/lib/Redis.pm) を
使えよって話になります。

あと、tie するごとにコネクションを張り直しているようなので、
たくさんのハッシュやリストを作ると大変なことになりそうです。


## Redis::Client

これも tie すると、Redis上のデータをハッシュや配列として扱うことができます。
tie できるのは [String](http://search.cpan.org/~friedo/Redis-Client/lib/Redis/Client/String.pm),
[List](http://search.cpan.org/~friedo/Redis-Client/lib/Redis/Client/List.pm),
[Hash](http://search.cpan.org/~friedo/Redis-Client/lib/Redis/Client/Hash.pm),
[Set](http://search.cpan.org/~friedo/Redis-Client/lib/Redis/Client/Set.pm),
[Zset](http://search.cpan.org/~friedo/Redis-Client/lib/Redis/Client/Zset.pm)。
それぞれがRedisで使えるデータ型に対応している。

``` perl Redis::Client::String
use utf8;
use warnings;
use strict;
use 5.014;

use Redis::Client;

my $client = Redis::Client->new;
tie my $str, 'Redis::Client::String', key => 'my_string', client => $client;

$str = 'foo';
say $str;
```

ひとつのキーに対してひとつのオブジェクトを割り当てるのは良さげ。
また、ハッシュ型、セット型、ソート済みセット型といった、Redis特有のデータ型に対応しているのもGood。
でも、ただストアするだけならこれで十分だけど、もう少し高度な機能も使いたい・・・。


## Tie::Redis

[Tie::Redis](http://search.cpan.org/~dgl/Tie-Redis/lib/Tie/Redis/Hash.pm) も
tie を使ってPerlのデータ構造っぽく扱えるようにするライブラリ。

Redis全体を一つのハッシュとして扱ったり、
Redisの文字列型、ハッシュ型、リスト型を扱えるみたい。

## Redis::Object

[Redis::Oject](http://search.cpan.org/~ukautz/Redis-Object/README.pod)は
ORM風なRedis用ライブラリ。

``` perl RedisDatabase.pm
package MyRedisDatabase;

use Moose;
extends qw/ Redis::Object /;

has tables => (
    isa     => 'ArrayRef[Str]',
    is      => 'ro',
    default => sub { [ qw/SomeTable/ ] },
);

__PACKAGE__->meta->make_immutable;
```

``` perl RedisDatabase/SomeTable.pm
package MyRedisDatabase::SomeTable;

use Moose;
with qw/ Redis::Object::Table /;

has hoge => ( isa => 'Str', is => 'rw', default => 'Something' );

__PACKAGE__->meta->make_immutable;
```

``` perl redis-object.pl
use utf8;
use strict;
use warnings;
use 5.014;

use MyRedisDatabase;

# init database
my $db = MyRedisDatabase->new(
    server => 'localhost:6379'
);

# create item
my $item = $db->create( SomeTable => {
    hoge => "Hello",
} );

# fetch item by id
$item = $db->find( SomeTable => $item->id );

# update item
$item->hoge( "piyo" );
```

ORMっぽいけど、あんまり複雑な検索はできないらしい。
ここまでするなら普通にMySQLとORMつかったほうが良さそう。


## まとめ

みんな tie が大好き。

tie しないのがほしいな・・・。
