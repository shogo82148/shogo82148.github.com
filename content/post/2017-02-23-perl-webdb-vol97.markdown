---
layout: post
title: "WEB+DB PRESS Vol.97にPerlとRedisの記事を寄稿しました"
slug: perl-webdb-vol97
date: 2017-02-23 18:27:53 +0900
comments: true
categories: [perl, redis]
---

昨年末に[Songmu](https://twitter.com/songmu)さんからお話を頂き、
[WEB+DB PRESS Vol.97](http://gihyo.jp/magazine/wdpress/archive/2017/vol97)内の連載「第43回Perl Hackers Hub」に
「PerlでのRedis活用法」というタイトルで寄稿しました。
発売日は**2月24日**です。

<!-- More -->

## 内容

簡単に内容を紹介しておきます。
Perl使いではじめてRedisを使う人向けに書いたつもりです。

### Redisの簡単な説明
Redisのインストール方と、Perlからの接続方法、そしてRedisの型の説明です。
記事の中でも紹介していますが、Redisはその豊富な型が特長です。
読者はきっとPerl使いだろうということで、Perlの型(Perlにも型はあるんだよ！！)と
比較しながら簡単に紹介しています。

### Redisの応用例とCPANモジュールの紹介
Redisを使うとこんなことができるよ、という紹介です。
CPANで公開されているRedis関連のモジュールも合わせて紹介しています。

### Redis自体の注意点
以前Redisを使ったサービスの運用に携わっていたのですが、
そのなかで実際に起きたことを元に、Redisの注意点について書きました。
さいわいサービスが停止するような事故にはありませんでしたが、
メトリックスを眺めながらエンジニア勢でヤバイヤバイ騒いでましたね・・・。
みなさんも気をつけて下さい。


## 執筆してみての感想

昔から文章を書くのにはだいぶ苦手意識があり、
今回の執筆も非常に苦労しました。
一文の前半を書いた時点で
「今から書こうとしている情報は本当に必要なのか」
「自分の記憶違いで間違った情報なのでは」と不安になり、
色々考えているうちに、何書こうとしてたのかわからなくなるんですよね。
まずは適当に書き上げて、後からちゃんと推敲しよう、
とは思いつつもなかなか進められず・・・。
スループットを上げたい。

細かい表現とかも気になってなかなか進まないので、
こういうの入れて頑張ろうと思います！

- [VS Codeでtextlintを使って文章をチェックする](http://qiita.com/azu/items/2c565a38df5ed4c9f4e1)
- [gitbookで技術書を書く環境の構築手順](http://takemikami.com/2017/02/14/gitbook.html)

(執筆が進まないと、こういう環境構築に時間をかけてしまうのもよくないと思うんだ・・・)


## 余談
ところで、**Vol.97**と**第43回**ってどっちも**素数**ですね！
雑なプログラムを書いて調べてみたところ、
両方素数になるのはVol.83, 第29回以来、**7回目**(これも**素数**だ！)。
次はVol.101, 第47回です。
そのときのPerl Hackerは誰になるのでしょうか。楽しみですね！

``` perl
use warnings;
use strict;

sub is_prime {
    my $n = shift;
    return 0 if $n < 2;
    my $i = 2;
    while($i*$i<=$n) {
        return 0 if $n % $i == 0;
        $i++;
    }
    return 1;
}

my $i = 1;
for my $n(1..200) {
    my $m = $n-43+97;
    if (is_prime($n) && is_prime($m)) {
        printf "%3d: Vol.%3d, No.%3d\n", $i, $m, $n;
        $i++;
    }
}
```
