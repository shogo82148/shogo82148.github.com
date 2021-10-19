---
layout: post
title: "Perl 5.26 & Unicode 9.0 で変わる書記素クラスタ(grapheme cluster)のお話"
slug: unicode9-grapheme-cluster
date: 2017-08-25 07:08:44 +0900
comments: true
categories: [perl]
---

[WEB+DB PRESS Vol.100](http://gihyo.jp/magazine/wdpress/archive/2017/vol100)が発売されましたね。
記念すべき Vol.100 おめでとうございます！

<a href="https://www.amazon.co.jp/WEB-DB-PRESS-Vol-100-%E6%B2%B3%E5%8E%9F/dp/4774191299/ref=as_li_ss_il?_encoding=UTF8&psc=1&refRID=KWT48YN41EFBHYXPM8YQ&linkCode=li2&tag=shogo82148-22&linkId=c41e466f8dad4ea5b2c2287f1e6c5efc" target="_blank"><img border="0" src="//ws-fe.amazon-adsystem.com/widgets/q?_encoding=UTF8&ASIN=4774191299&Format=_SL160_&ID=AsinImage&MarketPlace=JP&ServiceVersion=20070822&WS=1&tag=shogo82148-22" ></a><img src="https://ir-jp.amazon-adsystem.com/e/ir?t=shogo82148-22&l=li2&o=9&a=4774191299" width="1" height="1" border="0" alt="" style="border:none !important; margin:0px !important;" />

WEB+DB PRESS の連載「Perl Hackers Hub」今回のテーマは「【第46回】Perl 5.26で変わること」です。
Perl 5.26 で追加になった機能、アップグレードの際に気をつけなければならないところ( 特に @INC 問題とか )などに触れられているので、
Perl Monger の方はぜひ読むとよいと思います。

追加された機能のひとつとして Unicode 9.0 サポートが挙げられているのですが、以下のような簡単な紹介に留まっています。

> Unicode 9.0にはオリンピックで活躍するであろう金銀 銅メダルの絵文字などが追加されました。

Unicode 9.0 で変わるのはそれだけではありません！
Unicode 9.0 での **書記素クラスタ(grapheme cluster)** の扱いを少し前に調査したので紹介します。

<!-- More -->

## 書記素クラスタ(grapheme cluster)とは

書記素クラスタ(grapheme cluster)とは、人間にとって自然な1文字を表すものです。

たとえば "é" という文字は一見1文字に見えますが、 `length` で文字数をカウントすると2文字としてカウントされます。

```
$ perl -Mutf8 -E 'say length "é"'
2
```

これは `length` がUnicodeのコードポイント数を数えており、
"é"が"e"(U+0065) + アクセント記号(U+0301) の2つのコードポイントで構成されているためです。

他にも[異字体セレクタ](https://ja.wikipedia.org/wiki/%E7%95%B0%E4%BD%93%E5%AD%97%E3%82%BB%E3%83%AC%E3%82%AF%E3%82%BF)というのがあったり、
[絵文字シーケンス](http://qiita.com/_sobataro/items/47989ee4b573e0c2adfc#%E7%B5%B5%E6%96%87%E5%AD%97%E3%82%B7%E3%83%BC%E3%82%B1%E3%83%B3%E3%82%B9)というのがあったりして、
コードポイントの数＝文字数とは限りません。

これらの文字たちを1文字として数えるための概念が書記素クラスタ(grapheme cluster)です。

## Unicode 9.0での変更点

Unicode 8.0以前も書記素クラスタはあるのですが、
"👨‍👨‍👦"のような家族の絵文字が3文字とカウントされてしまったり、
"🇯🇵🇯🇵🇯🇵"のように国旗が連続していると1文字にカウントされてしまったりと、
問題がありました。
Unicode 9.0からはこれらの問題が解決されています。

詳しくは[書記素クラスタに関する Unicode 9.0 以降と 8.0 以前の違い](http://qiita.com/_sobataro/items/47989ee4b573e0c2adfc#%E6%9B%B8%E8%A8%98%E7%B4%A0%E3%82%AF%E3%83%A9%E3%82%B9%E3%82%BF%E3%81%AB%E9%96%A2%E3%81%99%E3%82%8B-unicode-90-%E4%BB%A5%E9%99%8D%E3%81%A8-80-%E4%BB%A5%E5%89%8D%E3%81%AE%E9%81%95%E3%81%84)を参照してください。


## Perlでの書記素クラスタ

### 書記素クラスタの使い方

Perlでは正規表現`\X`が書記素クラスタにマッチします
([Misc in perlrebackslash](https://perldoc.perl.org/perlrebackslash.html#Misc))。

``` perl
use utf8;
use 5.24.1;
binmode(STDOUT, ":utf8");

my $str = "eé";
my @characters;

@characters = split //, $str;
say "splitを使った場合: ", join " ", @characters;

# 書記素クラスタ
@characters = $str =~ /\X/g;
say "書記素クラスタを使った場合: ", join " ", @characters;
```

- [[Wandbox]三へ( へ՞ਊ ՞)へ ﾊｯﾊｯ](https://wandbox.org/permlink/ImSQW7QAkadczlqt)


文字数をカウントは「[Perlで文字列の出現回数を調べる](https://shogo82148.github.io/blog/2015/04/09/count-substrings-in-perl/)」の
方法が使えます。

``` perl
use utf8;
use 5.24.1;

my $str = "eé";

my $length =()= $str =~ /\X/g;
say $length;
```

(後から知ったことですが、この `=()=` を使ったハックには [画像検索してはいけない名前](https://metacpan.org/pod/distribution/perlsecret/lib/perlsecret.pod#Goatse) がついているらしいです)

### Perl5.24とPerl5.26の違い

Perl 5.26 は Unicode 8.0 をサポートしているので、書記素クラスタの問題点が改善されています。
たとえば、Perl 5.24では "🇯🇵🇯🇵🇯🇵"が1文字としてカウントされてしまいますが・・・

``` perl
use utf8;
use 5.24.1;

my $length =()= "🇯🇵🇯🇵🇯🇵" =~ /\X/g;
say $length; # => 1
```

- [[Wandbox]三へ( へ՞ਊ ՞)へ ﾊｯﾊｯ](https://wandbox.org/permlink/QKl5K45F8BvvPMfz)

Perl 5.26 では3文字としてカウントされます。

``` perl
use utf8;
use 5.26.0;

my $length =()= "🇯🇵🇯🇵🇯🇵" =~ /\X/g;
say $length; # => 3
```

- [[Wandbox]三へ( へ՞ਊ ՞)へ ﾊｯﾊｯ](https://wandbox.org/permlink/s05vJF33MlCj9Qvl)


## FYI: 他の言語の対応状況

### Ruby

[Unicode 絵文字にまつわるあれこれ (絵文字の標準とプログラム上でのハンドリング)](http://qiita.com/_sobataro/items/47989ee4b573e0c2adfc)で紹介されているように、
[Ruby 2.4.0](https://github.com/ruby/ruby/blob/17c2828581a4dcd9babb5c754f240aa86523c673/NEWS#L133-L143)から対応してます。
Ruby 2.4.0は2016年12月25日に正式リリースされているので、この記事を書いている現在(2017年8月25日)は安心して使えます。

### Python

残念ながら標準の正規表現ライブラリ [re](https://docs.python.jp/3/library/re.html) は書記素クラスタに対応していません。
サードパーティーの[regex](https://pypi.python.org/pypi/regex/)がUnicode 10に対応しているらしいので、
そちらを使うと書記素クラスタを扱えるようです。

### Golang

> https://github.com/google/re2/wiki/Syntax
> extended Unicode sequence (NOT SUPPORTED)

正規表現は対応していません、残念・・・

- https://github.com/golang/go/issues/14820

`x/text` に書記素クラスタを扱う機能を追加しようというIssueはありますが、今のところ進捗はないようです。

## 参考

- [Unicodeのgrapheme cluster (書記素クラスタ)](https://hydrocul.github.io/wiki/blog/2015/1025-unicode-grapheme-clusters.html)
- [Unicode 絵文字にまつわるあれこれ (絵文字の標準とプログラム上でのハンドリング)](http://qiita.com/_sobataro/items/47989ee4b573e0c2adfc)
- [文字数をカウントする7つの方法](https://engineering.linecorp.com/ja/blog/detail/52)
