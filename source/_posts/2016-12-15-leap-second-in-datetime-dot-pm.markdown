---
layout: post
title: "DateTime.pmにうるう秒の修正が入った話"
date: 2016-12-15 22:17:47 +0900
comments: true
categories: perl
---

こんにちは、[DateTime.pm](https://metacpan.org/pod/DateTime) Watcherのいっちーです。
本日面白いパッチがDateTime.pmに取り込まれたので、ご紹介したいと思います。

<!-- More -->

そのpullreqがこちらです。Closedになっていますが、該当コミットはmasterに取り込まれています。

- [The leap second in 2012 was on 2012-07-01 not 2012-06-01. #48](https://github.com/houseabsolute/DateTime.pm/pull/48)

> per https://confluence.qps.nl/display/KBE/UTC+to+GPS+Time+Correction the leap second in 2012 was on 2012-07-01 not 2012-06-01. It's is well known that leap seconds only occur directly before Jan 1st or July 1st.

適当な和訳「2012年に挿入されたうるう秒は2012年6月1日ではなく2012年7月1日です。よく知られているように、今までに挿入されたうるう秒は1月1日と7月1日の直前だけです。」

``` diff
diff --git a/lib/DateTime/LeapSecond.pm b/lib/DateTime/LeapSecond.pm
index 66e1b2b..4a38be2 100644
--- a/lib/DateTime/LeapSecond.pm
+++ b/lib/DateTime/LeapSecond.pm
@@ -108,7 +108,7 @@ sub _initialize {
             1999  Jan. 1  +1
             2006  Jan. 1  +1
             2009  Jan. 1  +1
-            2012  Jun. 1  +1
+            2012  Jul. 1  +1
             2015  Jul. 1  +1
             2017  Jan. 1  +1
             )
```

なぜ4年間誰も気が付かなかった。


## このバグの影響

結論から言うと、**この修正によるDateTime.pmの挙動への影響はありません**。
これを書いている時点で最新版のver1.41には、上記の修正は取り込まれていませんが、
うるう秒は2012年7月1日に正しく挿入されます。

以前[Perl の DateTime 利用上の注意点](//shogo82148.github.io/blog/2015/12/09/perl-datetime/)で
うるう秒の確認をしたときと同様に検証してみましょう。

``` perl
use feature qw(say);
my $dt;

use DateTime;

$dt = DateTime->new( year => 2012, month => 7, day => 1, hour => 9, time_zone => 'Asia/Tokyo' );
say $dt->subtract(seconds => 1);

$dt = DateTime->new( year => 2012, month => 6, day => 1, hour => 9, time_zone => 'Asia/Tokyo' );
say $dt->subtract(seconds => 1);
```

``` plain
$ perl datetime.pl
2012-07-01T08:59:60
2012-06-01T08:59:59

$ PERL_DATETIME_PP=1 perl datetime.pl
2012-07-01T08:59:60
2012-06-01T08:59:59
```

DateTime.pmにはXSの実装とPurePerlの実装が含まれていますが、
どちらの実装でも2012年7月1日に正しくうるう秒が挿入され、2012年6月1日にはうるう秒はありません。


{% oembed https://twitter.com/kazoo04/status/808195587518578688 }

まさに、「コード見たら絶対動かないはずなのになぜか思った通りにちゃんと動く」といった感じです。


## なぜ正しく動くのか

なぜ正しく動くのか、その答えはうるう秒一覧の解析を行う部分にありました。

- [DateTime.pm/lib/DateTime/LeapSecond.pm](https://github.com/houseabsolute/DateTime.pm/blob/ff0e3780ea1c841eb17a0245f5f8061cf10c28d3/lib/DateTime/LeapSecond.pm#L40-L41)

``` perl
my $utc_epoch
    = DateTime->_ymd2rd( $year, ( $mon =~ /Jan/i ? 1 : 7 ), $mday );
```

**Jan.(1月)以外はすべて7月として扱っている！**

Janか否かが重要なので、JunだろうがJulだろうが7月として扱われるので、結果的に正しく動くわけです。
「バグを埋め込んでいたけど、実装が適当でたまたま動いていた」というよくあるパターンですね。
将来3月末や9月末に挿入されるようになったとき大丈夫なんでしょうか・・・。
まあ、必要になるのは数百年後とかなので、僕には関係ない・・・そう、関係ないのです・・・。


## まとめ

- DateTime.pmのうるう秒一覧にbug fix
- 動作に影響は無いので、ユーザ側では特に気にする必要はない
  - うるう秒自体を気にしないといけないのは仕方がない・・・
- JanとかJunとかJulとか似てて紛らわしいんだよ！！数字書け！！


## ちなみに

最新版のver1.41は来年(2017年)の1月1日のうるう秒に対応済みです。

``` perl
use feature qw(say);
my $dt;

use DateTime;

$dt = DateTime->new( year => 2017, month => 1, day => 1, hour => 9, time_zone => 'Asia/Tokyo' );
say $dt->subtract(seconds => 1);
```

``` plain
$ perl datetime.pl
2017-01-01T08:59:60
```

みなさん準備は出来ていますか 😇
