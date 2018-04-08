---
layout: post
title: "Redisを使ってユニークなIDを配布する"
slug: unique-id-supplier-using-redis
date: 2017-02-26 19:37:45 +0900
comments: true
categories: [go, golang, redis]
---

スケーラブルにIDを生成する方法として
Twitterの[snowflake](https://github.com/twitter/snowflake)が有名です。
1024台までスケールすることが出来ますが、各snowflakeのサーバにユニークなWoker IDを割り振る必要があります。
IDを振るためのサーバにIDを振るのが問題になるとは難しいですね。

各snowflakeサーバにIDを振る親玉Worker ID配布サーバを作るというアイデアはあったのですが、
Worker IDサーバの可用性を考えるのが大変で手を付けていませんでした。
最近になってWorker IDサーバとしてRedisを使い、ソート済みセット型で管理すれば楽できるのでは？
と思いついたので、やってみたというお話です。

<!-- More -->

## 概要

レポジトリはこちらです。

- [shogo82148/yaraus](https://github.com/shogo82148/yaraus)

他の[snowflake](https://github.com/twitter/snowflake)-likeなID発番サーバの実装として
[katsubushi](http://techblog.kayac.com/katsubushi-introduction.html)や
[sonyflake](https://github.com/sony/sonyflake)なんていうのもあります。
これらのID発番サーバにRedisを使ってWorker IDを割り振るコマンドです。
Redis3.2以上推奨です。


## 使い方

Go製なので`go get`でインストールできます。

``` bash
go get github.com/shogo82148/yaraus/cmd/yaraus
```


``` bash
# 1から1023までのIDが使えるようにRedisを初期化
$ yaraus init -min 1 -max 1023

# ユニークなIDが必要な処理を実行する
$ yaraus run -- echo {}
2017/02/25 17:19:16 getting new id...
2017/02/25 17:19:16 client id: YourHostName-1488010756.738-1, id: 1
2017/02/25 17:19:16 sleep 2s for making sure that other generates which has same id expire.
2017/02/25 17:19:18 starting...
1
2017/02/25 17:19:18 releasing id...

# katsubushiと一緒に使う例
$ yaraus run -- ./katsubushi -worker-id={} -port=7238

# ステータス情報もとれます
$ yaraus stats
{
    "client_id_count": 4,
    "client_get_id_count": 4,
    "client_get_id_success": 4,
    "get_id_no_available_id": 0,
    "extend_ttl_count": 8,
    "extend_ttl_success": 8,
    "extend_ttl_ownership_error": 0,
    "extend_ttl_expire_warning": 0,
    "unusing_ids": 1023,
    "using_ids": 0,
    "using_ttl_max": 0,
    "using_ttl_mid": 0,
    "using_ttl_min": 0
}
```

ステータスの意味は以下の通りです。

- `client_id_count`: 今までに接続してきたクライアントの延べ数
- `client_get_id_count`: ID取得を試みた回数
- `client_get_id_success`: ID取得に成功した回数
- `get_id_no_available_id`: 利用可能なIDが無くて失敗した回数
- `extend_ttl_count`: Expireを伸ばそうと試みた回数
- `extend_ttl_success`: Expireを伸ばすのに成功した回数
- `extend_ttl_ownership_error`: IDが横取りされた回数
- `extend_ttl_expire_warning`: IDが横取りされそうだったのを防いだ回数
- `unusing_ids`: 未使用のIDの数
- `using_ids`: 使用中のIDの数
- `using_ttl_max`: IDの寿命の最大値(秒単位)
- `using_ttl_mid`: IDの寿命の中央値(秒単位)
- `using_ttl_min`: IDの寿命の最小値(秒単位)


## 実装アイデア

Redisのセット型を使えば、ID配布自体は簡単です。
Perlでの実装は以下のようになります。(Go実装なのに例がPerlなのは、僕が一番慣れているので・・・)

``` perl
# あらかじめPoolにIDを蓄えておく
$redis->sadd('pool', "id$_") for 1..10;

# ランダムに選ぶ
my $id = $redis->spop('pool');

# 使い終わったら戻す
$redis->sadd('pool', $id);
```

多めに見積もって1IDあたり1kB使うと仮定しても、1000個のIDで約1MBです。
余裕で全部メモリにのるので、オンメモリのRedisでも全く問題ありません。

しかし、この方法では、IDを受け取ったクライアントが突然死してしまった場合に
永遠にIDが開放されないため、そのうちIDが枯渇してしまいます。

そこで思いついたのが、ソート済みセット型を使ったExpire付き機能付きID配布です。
「ソート済みセットのスコアにExpireの予定時刻を入れる」というルールでIDを管理します。
ソート済みセットを使えば、「スコアが一番小さいID＝Expireしている可能性が一番高いID」
を簡単に取得できます。
現在時刻と比較して実際にExpireしているかをチェックし、ExpireしていたらID取得成功です。
Perlのコードに起こすと以下のようになります。

``` perl
# PoolにID追加
$redis->zadd('pool', time, "id$_") for 1..10;

# IDを取得
RETRY:
my ($id, $score) = $redis->zrange('pool', 0, 0, "WITHSCORE");

# expireしているかチェック
if $score < time {
    # ID取得失敗、しばらく待ってID取得やり直し
    sleep 1;
    goto RETRY
}

# expireの期間延長
my $expire = 10; # 10秒でexpire
$redis->zadd('pool', time + $expire, $id);

# $idを使ったなにかの処理

# 使い終わったらExpire扱い
$redis->zadd('pool', time, $id);
```

クライアントが突然死していまうと、Expireが更新されないため
どんどんRankがあがっていき、最終的には別のクライアントに再利用されます。

この方法であれば、Expireしてからの期間が長いIDから再利用されるというのも利点です。
どうしてもサーバとクライアントで時刻のズレが生じてしまうので、
サーバはExpireした！と思っても、クライアントがまだ使用中ということは十分に考えられます。
そのためExpireしたIDをすぐに再利用してしまうと、多重使用になってしまう可能性があります。
Expireしてからの期間が長いIDから再利用することで、この問題を緩和できるというわけです。

(Googleさんみたいに分散データベース管理に原子時計を導入していれば話は別ですが・・・)

ソート済みセット型のScoreは64bitの浮動小数点型なので、
scoreにunix timestampを使うとマイクロ秒程度の精度になってしまいますが、
この用途であれば十分足りるでしょう。


## 実装上の工夫

このアイデアなら楽できる！と思ったものの、
実際にコードに起こすとなると考慮すべきことがたくさんあって大変でした。

### ID取得とExpire期間延長をアトミックにする

先のコード例をそのまま実装すると同時アクセスがあった場合にIDプールが壊れます。
それを防ぐために
「IDを取得」「expireしているかチェック」「expireの期間延長」はアトミックに実行する必要があります。

Redisの場合、Luaスクリプトを使えば簡単ですね。
慣れないLuaに少し手こずりましたが、一度覚えてしまうと全部Luaにしたくなってしまう麻薬ですね、あれは。

### Luaスクリプト内で時刻を取得する

このアイデアは時刻が肝なので、可能であれば時刻の管理もRedisサーバに一任したいところです。
しかし、Luaスクリプト内ではOS機能のモジュールが無効化されており、時刻の取得はできません。
ファイルもいじれる危ないモジュールなので仕方ないですね。

ではどうするかというと、LuaからRedisのTIMEコマンドを呼び出して時刻を取得します。
しかしながら、この方法も一筋縄ではいかず、何もせずに呼び出すとコマンドの実行に失敗してしまいます。

TIMEコマンドが失敗する原因はLuaスクリプトのレプリケーションの方法にあります。
Redisのレプリケーション方法は、マスターからスクリプトをまるごとスレーブに送り、スレーブ側でスクリプト再実行する方式です。
そのため、TIMEコマンドのように実行するタイミングによって結果が変わるコマンドは、
マスターとスレーブで不整合が起きてしまう可能性があるため実行できないのです。

この問題を解決するため、Redis3.2から `redis.replicate_commands` が追加されました。
この関数を呼び出すと、Luaスクリプト内で実行したRedisへの書き込みコマンドを転送するレプリケーション方式に変わります。
実行結果だけを送るのでTIMEコマンドも安全に実行できるというわけです。

``` lua
redis.replicate_commands()
local t = redis.call("TIME")
time = t[1] + t[2]*1e-6 -- 秒単位に変換
```

なお、`redis.replicate_commands`が使えない場合は、クライアントの時刻を使うようフォールバックするので、
3.2よりまえのRedisでも動作はします。

ちなみにレプリケーションの挙動を変えるコマンドは他にもあって、
`redis.set_repl`を使うとレプリケーション自体を止めることも出来るらしいです。
怖い。

### 若い番号のIDから配布する

これはあまり重要ではないんですが、Expireまでの期間が同じだった場合、
若い番号のIDから順に配布するようにしました。
「エライ人順にIPアドレスを設定しろ」みたいなアレなので、
別に考慮しなくてもいいんですが、数字を見ると順番に並べたくなってしまうのが人間というものです。

Redisのソート済みセットはスコアが同じ場合、メンバーの辞書順に並びます。
`Itoa(id)`した結果をそのまま辞書順ソートすると

``` plain
1, 10, 11, 12, ..., 2, 20, 21, ...
```

のようなおかしな順番になってしまいます。
そこで、「1桁のときは頭にAを付ける」「2桁のときはB」「3桁のときはC」...
と先頭の文字で数字の桁数が分かるようにしました。

``` plain
A1, A2, A3, ..., A9, B10, B11, B12, ... B99, C100, C101, C102, ...
```

この規則はRFC2550をヒントにしました。
RFC2550にはZまで使い切ったあとのことも書いてあるんですが、そこまではしていません。
可読性にこだわらなければ他にも方法はあるのですが、redis-cliで見れたほうが嬉しいじゃないですか。

- [RFC 2550 Y10K and Beyond](https://tools.ietf.org/html/rfc2550)
- [参考日本語訳 RFC 2550 Y10K とその先](http://www.cam.hi-ho.ne.jp/mendoxi/rfc/rfc2550j.html)

### レプリケーション完了を待つ

可用性を求めるならば、Redisサーバー自体が突然死する可能性も考えなければなりません。
この問題に対応するにはマスタースレーブ構成を取るのが一般的でしょう。
マスタースレーブ構成ではフェールオーバー時に多少のデータ消失が起こる可能性があります。
レプリケーションが終わっていない分のデータが消失するためです。

キャッシュ用途であれば許容できるかもしれませんが、
ID配布でこれが起こるのは致命的です。
配布したIDをもとにデータベースへの書き込みを行うので、整合性が崩れ、修復困難なダメージを与えてしまう可能性があります。

この問題を最小限に抑えるために、2.8からWAITコマンドが追加されています。
WAITコマンドを使うと、今まで書き込んだデータがレプリケーションされたかを検出できます。

```
# ROLEコマンドでスレーブの台数を確認
127.0.0.1:6379> ROLE
1) "master"
2) (integer) 83
3) 1) 1) "::1"     # 一台スレーブ
      2) "6378"
      3) "83"

# 適当に書き込み
127.0.0.1:6379> SET foo bar
OK

# 1つのスレーブのレプリケーションが完了するのを待つ(Timeout 1000ms)
127.0.0.1:6379> WAIT 1 1000
(integer) 1 # レプリケーションが完了したスレーブの台数
```

レプリケーションの完了＝コマンドの実行完了と解釈すれば、
データの消失を最小限に抑えることができます。

ちなみに、WAITコマンドのtimeoutはミリ秒ですが、今回使用した[go-redis/redis](https://godoc.org/gopkg.in/redis.v5)は
これを秒として扱っていました。
(こういうのRedis::Fast開発時にもあった気がする)
単位重要ですね。
time.ParseDurationで時間指定をすると、毎回単位指定が必要になって面倒ですが、
こういうミスを防ぐためには有用そうです。
積極的に使っていきたい。

### 横取り検出

WAITコマンドでデータの消失を最小限にしたとしても、0にできるわけではありません。
消失が起こった場合の対応も必要です。
ID配布した記録が消えて横取りが出来る可能性があるので、
IDに所有者(貸出先の方が正しかったかも)を一緒に記録しておくことにしました。

各クライアントにクライアントIDを付与しておきます。(現状の実装はhostname+timestamp+連番)
横取りされた方は、自分のクライアントIDとIDの所有者を比較し、横取りが分かった時点で速やかにID開放します。
横取りした方は、ID取得からID使用までしばらく時間を開けます(-delayでこの時間は変更可能)
これは横取りされた方のID開放が終わるまで、猶予時間を与えるためです。


## 動作条件等

何度か書いていますが、このアイデアは時刻が肝です。
各サーバ間の時刻同期が正しく行われている必要があります。
普通にNTPを使っていればmsのオーダーで同期が取れるので問題ないでしょう。

・・・ただし、みんな大嫌いなうるう秒があります。
うるう秒の対応の仕方がまちまちなので、ことなった対応方針が適用されたサーバーが混ざると大変です。

例えば、マネージドなRedisとしてElastiCacheを使うと、
うるう秒挿入のタイミングでElastiCacheは[AWS調整時刻](http://aws.typepad.com/aws_japan/2015/05/look-before-you-leap-the-coming-leap-second-and-aws.html)で動作します。
残念ながらAWS調整時刻を返すNTPは提供されていないようです。

デフォルトの設定はこの辺を考慮してマージンを取っているので大丈夫なはず・・・。
使う人がいるかはわかりませんが、検証頑張って！


## 名前について

「Yet Another Ranged Unique id Supplier」の略です。
いい名前が思いつかなかったので、fujiwaraさん製のRanged Unique id Supplierが既にあったのでそこから拝借しました。
Yet Anatherは、こう付けると流行ると「言語のしくみ」に書いてあったからです。

<iframe style="width:120px;height:240px;" marginwidth="0" marginheight="0" scrolling="no" frameborder="0" src="//rcm-fe.amazon-adsystem.com/e/cm?lt1=_blank&bc1=000000&IS2=1&bg1=FFFFFF&fc1=000000&lc1=0000FF&t=shogo82148-22&o=9&p=8&l=as4&m=amazon&f=ifr&ref=as_ss_li_til&asins=B01N7JZXMD&linkId=8ee3d3dfb649430b1d0abd35881e5f56"></iframe>


## まとめ

- RedisをID発番サーバID配布サーバとして活用する方法を考えてみました
- 可用性を求めていったらレプリケーションの高度な使い方がわかってきた
  - `redis.replicate_commands`でスクリプトのレプリケーション方式を変更する
  - WAITコマンドでレプリケーションを待つ
- フェールオーバのこととか考えると全然楽じゃなかった・・・

思いつきを試したかっただけなのですが、勉強になったので良しとしましょう。
