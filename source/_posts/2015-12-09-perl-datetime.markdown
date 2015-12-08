---
layout: post
title: "Perl の DateTime 利用上の注意点"
date: 2015-12-09 00:00
comments: true
categories: perl
---

この投稿は [Perl 5 Advent Calendar 2015](http://qiita.com/advent-calendar/2015/perl5) の 9日目の記事です。

[Perl の Time::Piece 利用上の注意点](http://developer.hatenastaff.com/entry/2015/12/02/050000)
という記事の最後に[DateTime](https://metacpan.org/release/DateTime)への言及があったのですが、
DateTimeはDateTimeでいろいろとハマりどころがあるんですよね・・・。
僕も今年いくつか罠にハマりました。ちょうどアドベントカレンダーの季節ですし、この機会にハマりどころをまとめてみることにします。

<!-- More -->


## 遅い

いろんなところで言われていることですが **遅い** です。
試しに代表的な日付を扱うモジュールでベンチをとってみました。
(比較のために時間をとるためのPerlの組み込み関数も入れてあります)


``` perl
# いろんな形式で今の時間を取得する
use Benchmark qw/ cmpthese /;
use Time::HiRes ();
use Time::Moment;
use Time::Piece ();
use DateTime;

cmpthese 0, {
    'time'         => sub { time },
	'Time::HiRes'  => sub { Time::HiRes::time },
    'localtime'    => sub { () = localtime },
    'Time::Moment' => sub { Time::Moment->now },
    'Time::Piece'  => sub { Time::Piece->localtime },
    'DateTime'     => sub { DateTime->now( time_zone=>'Asia/Tokyo' ) },
};
```

```
Rate DateTime Time::Piece Time::Moment localtime Time::HiRes  time
DateTime         5303/s       --        -95%         -98%      -99%       -100% -100%
Time::Piece    103765/s    1857%          --         -67%      -71%        -98%  -99%
Time::Moment   313599/s    5814%        202%           --      -11%        -93%  -98%
localtime      354215/s    6580%        241%          13%        --        -92%  -98%
Time::HiRes   4706723/s   88658%       4436%        1401%     1229%          --  -72%
time         16536995/s  311751%      15837%        5173%     4569%        251%    --
```

それにしてもTime::Moment速いですね。組み込みのlocaltimeと互角とは。


## 演算は破壊的

add, subtract等の演算を行うメソッドは破壊的です。
例えば、一時間後の日時を求めたい場合に以下のように書くと、
もとの日時が失われてしまいます。

``` perl
# 1時間後の日時を求める間違った例
use feature 'say';
use DateTime;

my $dt = DateTime->new(year => 2015, month => 12, day => 9);
my $after_an_hour = $dt->add(hours => 1);

say $dt; # 2015-12-09T01:00:00
say $after_an_hour; # 2015-12-09T01:00:00
```

以下のようにcloneしてから演算することで防ぐことができます。

``` perl
# 1時間後の日時を求める間違った例
use feature 'say';
use DateTime;

my $dt = DateTime->new(year => 2015, month => 12, day => 9);
my $after_an_hour = $dt->clone->add(hours => 1);

say $dt; # 2015-12-09T00:00:00
say $after_an_hour; # 2015-12-09T01:00:00
```

## うるう秒の存在

さて問題です。
「日本時間2015年7月1日午前9時の1秒前は何時何分何秒でしょう？」

簡単そうな問題ですが、一応DateTimeに計算してもらって確かめてもらいましょう。

``` perl datetime.pl
use feature qw(say);
use DateTime;
my $dt = DateTime->new( year => 2015, month => 7, day => 1, hour => 9, time_zone => 'Asia/Tokyo' );
say $dt->subtract(seconds => 1);
```

これを現時点での最新バージョンであるDateTime-1.21を使って実行してみます。

``` bash
$ perl datetime.pl
2015-07-01T08:59:60
```

はい、正解は **「8時59分60秒」** です。
「60秒はおかしい。8時59分59秒では？？？」という声が聞こえてきそうですが、60秒が正解です。
今年の7月1日は[3年ぶりにうるう秒が挿入された日](http://gigazine.net/news/20150701-leap-second-insert/)でした。
そのため **通常は存在しない60秒がこの日だけ存在します。**
うるう秒についてはWikipediaの[閏秒](https://ja.wikipedia.org/wiki/%E9%96%8F%E7%A7%92)の項目どうぞ。
インフラを担当されているかたは対応に苦労したかたも多いのではないでしょうか。

うるう秒は存在だけでも厄介ですが、さらに厄介なことに **うるう秒調整のタイミングは実施される半年前になるまでわかりません** 。
次調整が入るとすれば2016年7月1日ですが、2015年の現時点では調整が入るのか入らないのか確かなことは言えません(今までの傾向からないとは思いますが)。
事前に分からないものに対してDateTimeがどう対処しているかというと、**うるう秒の調整が行われることがわかった時点でバージョンアップして対応** しています。
そのため、2015年7月1日のうるう秒の存在を知らないバージョン(具体的には1.17以前)で先ほどのコードを実行すると、
最新版とは異なった結果が帰ってきます。

``` bash
$ cpanm DateTime@1.17
$ perl datetime.pl
2015-07-01T08:59:59
```

さて、うるう秒を正確に扱いたい場合は便利な機能ですが、
DateTimeモジュール以外のプログラムがうるう秒を正しく扱えるとは限らないので無視したいケースも多いと思います。
パッと思いつくのは以下のような対応でしょうか・・・。

- タイムゾーンに `floating` を指定する
  - 「タイムゾーン情報を持っていない」ことを表す特殊なタイムゾーンです
  - うるう秒の調整のようなタイムゾーン情報が必要な機能はすべて無効になります
  - タイムゾーンを扱えるのがDateTimeの利点だったのに・・・
- うるう秒に関する定義を削除した自前ビルドを用意する
  - DateTimeのレポジトリに[うるう秒の挿入タイミング一覧](https://github.com/autarch/DateTime.pm/blob/master/leaptab.txt)が定義されているので、これを削除した自前ビルドを用意する方法
  - なお、この一覧はビルド時にXSのコードの一部として組み込まれるようなので、ランタイムに何とかすることはできない模様
- 一度DateTimeをインストールしたら絶対にバージョンアップを行わない。インストールした日時よりも半年以上未来の日時だけ扱う
  - 通常半年前にうるう秒の調整は決定されるので、DateTimeはリリース後半年以上未来のうるう秒は知りません
  - そのため、半年以上未来の日時を扱う限りはうるう秒とは無縁でいられます

どれもBK臭溢れる対応なので、もっとスマートな対応方法をご存知のかたはご教授いただけると幸いです。


## ある日からある日までの日数を知りたい

DateTimeは演算子オーバーロードされているため、通常の数値を同じように引き算が可能です。
引き算を使ったほうが手軽にできるからと以下のように書いてしまうとハマります。

``` perl
# 日数計算の間違った例
my $dt1 = DateTime->new( year => 2015, month => 12, day => 25, time_zone => 'Asia/Tokyo' );
my $dt2 = DateTime->new( year => 2015, month => 12, day => 9, time_zone => 'Asia/Tokyo' );
my $dur = $dt1 - $dt2;
say $dur->in_units('days'); # 16
```

一見動いているように見えますが、期間が一ヶ月を超えるような場合に間違った結果を返します。

``` perl
# 日数計算の間違った例
my $dt1 = DateTime->new( year => 2015, month => 12, day => 25, time_zone => 'Asia/Tokyo' );
my $dt2 = DateTime->new( year => 2015, month => 11, day => 9, time_zone => 'Asia/Tokyo' );
my $dur = $dt1 - $dt2;
say $dur->in_units('days'); # 16
```

引き算で帰ってくるDateTime::Durationオブジェクトは「1ヶ月と16日」という情報を持っているのですが、
「1ヶ月」の日数が月によってことなるため計算ができないのです。
以下のように差分を求める時点で日数を計算するように伝えるのが正しいやり方です。

``` perl
# 正しいやりかた
my $dt1 = DateTime->new( year => 2015, month => 12, day => 25, time_zone => 'Asia/Tokyo' );
my $dt2 = DateTime->new( year => 2015, month => 11, day => 9, time_zone => 'Asia/Tokyo' );
my $dur = $dt1->delta_days($dt2);
say $dur->in_units('days'); # 46
```


## ある日時からある日時までの秒数を知りたい

日数がわかったところで、次は秒数を求めてみましょう。
これも演算子オーバーロードを使うとハマります。

``` perl
# 秒数計算の間違った例
my $dt1 = DateTime->new( year => 2015, month => 12, day => 10, time_zone => 'Asia/Tokyo' );
my $dt2 = DateTime->new( year => 2015, month => 12, day =>  9, time_zone => 'Asia/Tokyo' );
my $dur = $dt1-$dt2;
say $dur->in_units('seconds'); # 0
```

$durには「1日」という情報が入っているはずなので、普通に考えるとこれから秒数は求められそうです。
1分は60秒で、1時間は60分で、1日は24時間なので、「1日=60×60×24秒」ですよね。
なぜ求められないのでしょう？

・・・そう、**うるう秒** です。
うるう秒が存在するため、1分は59秒の場合もあれば、61秒の場合もあります。
日数を求めるときと同じように、差分を求める時点で秒数の計算を行うように伝えるとうまくいきます。

``` perl
# 正しいやりかた
my $dt1 = DateTime->new( year => 2015, month => 12, day => 10, time_zone => 'Asia/Tokyo' );
my $dt2 = DateTime->new( year => 2015, month => 12, day =>  9, time_zone => 'Asia/Tokyo' );
my $dur = $dt1->subtract_datetime_absolute($dt2);
say $dur->in_units('seconds'); # 86400
```

ちなみに今年はうるう秒の挿入があったので、 **DateTimeの最新版で今年の秒数を計算すると 365×24×60×60秒よりも1秒だけ長くなります** 。
そして今年のうるう秒の挿入を知らない **DateTime1.17では365×24×60×60秒**が帰ってきます。

``` perl
my $dt1 = DateTime->new( year => 2016, month => 1, day => 1, time_zone => 'Asia/Tokyo' );
my $dt2 = DateTime->new( year => 2015, month => 1, day => 1, time_zone => 'Asia/Tokyo' );
my $dur = $dt1->subtract_datetime_absolute($dt2);
say $dur->in_units('seconds'); # 31536001 or 31536000 (DateTimeのバージョンによって異なります)
```

`epoch`は1970年1月1日午前0時(UTC)からの経過秒数を返すメソッドですが、
これは実際の経過時間ではなく形式的な経過秒数(つまりうるう秒を考慮しない)を返します。
そのため、以下のように秒数を求めるとどのバージョンでも同じ結果が帰ってくるはずです。

``` perl
my $dt1 = DateTime->new( year => 2016, month => 1, day => 1, time_zone => 'Asia/Tokyo' );
my $dt2 = DateTime->new( year => 2015, month => 1, day => 1, time_zone => 'Asia/Tokyo' );
say $dt1->epoch() - $dt2->epoch(); # 31536000
```

もうDateTimeなんか使うのやめて`epoch`使おうぜ！！
(もちろん実際の経過時間はうるう秒の+1があるのが正しいので、ケースバイケースですが)


## まとめ

DateTimeは日時をしっかり扱ってくれる素晴らしいモジュールです。
きっと **あなたが思っている以上に日時を正確に厳密に扱ってくれます** 。
そこまで厳密にやるか・・・というところまでしっかり扱ってくれるので、
日時計算に潜んだ様々な闇に触れることになるでしょう。
使う側もそれらのことについてしっかりと理解しておく必要があります。

まあ、具体的に言うと **うるう秒** とか **うるう秒** とかですね！
廃止論とかありましたけど、[とりあえず2023年までは調整がはいる](http://internet.watch.impress.co.jp/docs/news/20151120_731707.html)そうです・・・。

他にもいろいろ罠がありそう・・・知っているかたがいれば教えて下さい。
