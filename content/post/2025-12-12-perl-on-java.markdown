---
layout: post
title: "PerlOnJavaで遊んでみた"
slug: perl-on-java
date: 2025-12-11 23:14:00 +0900
comments: true
categories: [perl]
---

## 背景

アドベントカレンダーのネタを探しインターネットの海を彷徨っていたところ、
[fglock/PerlOnJava](https://github.com/fglock/PerlOnJava)というプロジェクトを見つけました。
なんと、Javaで実装されたPerlのインタープリターです！！
これは熱い！！！

## 試してみた

今のところビルド済みのバイナリーは提供されていないようなので、
自前でビルドしてあげる必要があります。

macOS上で試してみました。
Javaの開発環境が必要なので、brewを使ってインストールしておきます。

```bash
brew install gradle
PATH=$(brew --prefix openjdk)/bin:$PATH
```

あとはcloneしてmakeしてあげるだけです。

```bash
git clone git@github.com:fglock/PerlOnJava.git
cd PerlOnJava
make
```

`jperl` というスクリプト経由でPerlを実行できるようになります。

```bash
./jperl -E 'say "Hello World"'
```

う、動いたああああーーーー！！！！

## ベンチマーク

JVM上で実行されていることもあって、やはり性能が気になりますよね。
[竹内関数](https://ja.wikipedia.org/wiki/%E7%AB%B9%E5%86%85%E9%96%A2%E6%95%B0) を使ってベンチマークを取ってみました。

```perl
use v5.42;
use strict;
use warnings;
use Benchmark qw(timethis);

sub tarai($x, $y, $z)
{
    return $y if $x <= $y;
    tarai(  tarai($x-1, $y, $z),
            tarai($y-1, $z, $x),
            tarai($z-1, $x, $y));
}

timethis(10, sub { tarai(12, 6, 0) });
```

まずは普通のPerlから。

```plain
timethis 10: 17 wallclock secs (17.15 usr +  0.04 sys = 17.19 CPU) @  0.58/s (n=10)
```

次はPerlOnJava。

```plain
timethis 10: 18 wallclock secs (18.22 usr +  0.12 sys = 18.33 CPU) @  0.55/s (n=10)
```

約6.6% PerlOnJavaのほうが遅いという結果になりました。
遅いとはいえ僅差ですね。
簡単なマイクロベンチしか取っていませんが、この速度なら既存のPerlの置き換えとして使えるかも・・・？

ところでしれっと [Benchmark](https://metacpan.org/pod/Benchmark) を使ってみたのですが、なんか普通に動きました。
互換性の高さがうかがえますね。


## Perl 5.42 の新機能を使ってみる

最新版の[v5.42.2](https://github.com/fglock/PerlOnJava/releases/tag/v5.42.2)はPerlの5.42.0と互換性があるそうです。

そんなわけで「[Perl 5.42.0 の any と all キーワードを試してみた](https://shogo82148.github.io/blog/2025/12/11/any-and-all-keywords-in-perl/)」で試したコードをPerlOnJavaで動かしてみたところ、見事に動きました。

```perl
use v5.42;
use feature 'keyword_any';
no warnings 'experimental::keyword_any';

my @numbers = (2, 4, 8, 16);

if ( any { $_ % 2 == 0 } @numbers ) {
  say "Any of the numbers are even";
}
```

## まとめ

Javaで実装されたPerlのインタープリター[fglock/PerlOnJava](https://github.com/fglock/PerlOnJava)を見つけたので遊んでみました。
速度も申し分ないし、互換性も高そうだし、かなり有望なプロジェクトだと感じました。
「perlだけがPerlを解釈することができる」とよく言われますが、この状況に一石を投じるとこはできるのでしょうか。
これからの進化が楽しみです。


-----

## 参考

- [fglock/PerlOnJava](https://github.com/fglock/PerlOnJava)
- [竹内関数](https://ja.wikipedia.org/wiki/%E7%AB%B9%E5%86%85%E9%96%A2%E6%95%B0)
