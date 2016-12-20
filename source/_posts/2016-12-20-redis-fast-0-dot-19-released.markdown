---
layout: post
title: "Redis::Fast 0.19リリースのお知らせ"
date: 2016-12-20 22:38:27 +0900
comments: true
categories: [perl, reids]
---

[Redis::Fast 0.19](https://metacpan.org/pod/Redis::Fast) をリリースしました。
主な変更点は以下の通りです。

- `reconnect_on_error` オプションの追加
- Sentinelのノード一覧が更新されない不具合の修正
- IPv6の実験的サポート

<!-- More -->

## `reconnect_on_error` オプションの追加

[@yoheimuta](https://github.com/yoheimuta)さんからのプルリクエストです。
今まではネットワークエラーが発生した時のみ再接続処理が走っていましたが、
Redisがエラーを返した場合にも再接続を行うようになります。
マスタースレーブ構成をしているときに、
何らかの原因によりRedis::Fastからのコネクションを維持したまま、
マスターがスレーブに降格してしまった場合に対処するための機能です。
以下のように設定することで、新しいマスターに再接続を行うことが可能になります。

``` perl
my $r = Redis::Fast->new(
    reconnect          => 1, # 0以上で再接続有効
    reconnect_on_error => sub {
        my ($error, $ret, $command) = @_;
        if ($error =~ /READONLY You can't write against a read only slave/) {
            return 1; # 再接続を行う。次の再接続まで最低1秒空ける
        }
        return -1; # 再接続は行わない
    },
);
```


## Sentinelのノード一覧が更新されない不具合の修正

Redis::FastにはどれかひとつのSentinelノードに接続すると、
他のノードの情報を自動的に収集する機能があります。
この機能が最新のRedisでは動いていなかったので修正しました。
具体的にいつからなのかまでは追ってないのですが、
Redisのバージョン3.0.6から3.2.6の間のどこかで
ノード一覧の形式が変わってしまったようです。

(最近Sentinelの話題を聞かないけど、みんな使ってるのかな・・・)


## IPv6の実験的サポート

サーバの指定にIPv6のアドレスが使えるようになりました。
`Redis::Fast->new(server => "[::1]:6379")` のような指定ができます。

バックエンドのhiredis自体は以前からIPv6に対応していたのですが、
今までRedis::Fastでは正しく動きませんでした。

とりあえずlocalhostに接続できることは確認しましたが、
手元にIPv6のネットワークがなくて検証もできていないため、
実験的サポートという扱いで・・・。
 誰かIPv6に詳しい方、検証お願いします。


## 感想

- テストがなかなか通らず辛かった
- CPAN Autherを変な幾何学模様から変えたい