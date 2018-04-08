---
layout: post
title: "Perlで文字列の出現回数を調べる"
slug: count-substrings-in-perl
date: 2015-04-09T23:28:00+09:00
comments: true
categories: [perl]
---

Perlで特定の文字列の出現回数を調べたくなって、調べてみたメモ。

<!-- More -->

ググるとすぐに見つかった。
[perlで指定文字列の出現回数を取得する(正規表現)](http://d.hatena.ne.jp/shuer/20120907/1347025991)

> 指定文字列の出現回数は正規表現を使って
> 
> `$count++ while($str =~ m/$pattern/g);`
>
> もしくは
> 
> `$count = (() = $str =~ m/$pattern/g);`

が、一瞬何をやっているのか把握できない・・・。
こういう意味なのかなーって予想はしてみたけど、あってるか一応調査。

## whileを使った方法

`//g` をスカラーコンテキストの中でマッチさせると、
前回マッチした場所を覚えておいてくれて、次のマッチでその場所から検索を再開してくれるらしい。
([Using regular expressions in Perl - perlretut](http://perldoc.perl.org/perlretut.html#Using-regular-expressions-in-Perl))
マッチした場所は `pos` で取得可能。

``` perl
my $str = "hoge fuga foo bar";
while ($str =~ m/[a-z]+/g) {
    say pos $str;
}
```

`while`を後置にして、ループの回数を数えるようにすれば、最初の方法になる。

## ループを使わない方法

これが一番謎だった。

`//g` をリストコンテキストで評価すると、マッチした文字列がリストになって帰ってくるらしい。
([Quote-Like Operators - perlop](http://perldoc.perl.org/perlop.html#Regexp-Quote-Like-Operators))

複数の変数に一括して代入するときに `($foo, $bar) = (1, 2)` みたいな書き方をするけど、
`() = ...` の部分はこれの代入先の変数が一個もないケース。
要するに「リストコンテキストで評価してね」という意味のイディオムみたい。

まとめると、以下のような処理を簡略化して一行にしたのがループを使わない方法みたいです。

``` perl
my $str = "hoge fuga foo bar";
my @matches = $str =~ m/[a-z]+/g; # @matches = qw(hoge fuga foo bar);
my $count = scalar(@matches);     # $count = 4;
```

ちなみに代入演算子は右に書いた物が優先されるので、実はカッコは無くてもOK。

``` perl
my $count = () = $str =~ m/$pattern/g;
```

余計に闇な感じになった。
何故「リストコンテキストで評価してね」に専用のキーワードがないのか。
Perl難しすぎる。

## 参考

- [Using regular expressions in Perl - perlretut](http://perldoc.perl.org/perlretut.html#Using-regular-expressions-in-Perl)
- [Quote-Like Operators - perlop](http://perldoc.perl.org/perlop.html#Regexp-Quote-Like-Operators)
- [List value constructors](http://perldoc.perl.org/perldata.html#List-value-constructors)
