---
layout: post
title: "Perl 5.45.3で入ったundef-aware equality operatorsで遊んでみた"
slug: undef-aware-equality-operators
date: 2026-11-26 22:21:00 +0900
comments: true
categories: [perl]
---

## 背景

Perl 5.45.3 に `===`, `!==`, `equ`, `neu` という4つの演算子が追加されました。

- [perldelta - Perl 5.45.3](https://metacpan.org/release/BOOK/perl-5.45.3/view/pod/perldelta.pod)
- [perlop - Perl 5.45.3](https://metacpan.org/release/BOOK/perl-5.45.3/view/pod/perlop.pod#Equality-Operators)

これらの演算子は `undef` の扱いを改善するためのものです。

- [PPC 0030 undef-aware Equality Operators](https://github.com/Perl/PPCs/blob/49b0b0cd78b1e76da5cf61ec6910264de27488e8/ppcs/ppc0030-undef-aware-equality.md)

たとえば以下のようなプログラムを考えてみましょう。

```perl
use v5.45;

sub say_bool($v) {
  say $v ? "true" : "false";
}

my $x;

say_bool($x == 0);
say_bool($x eq "");
```

`$x`を初期化していないので`undef`との比較になります。
この場合、数値比較演算子は`undef`をゼロ、文字列比較演算子は空文字として扱います。

```plain
Use of uninitialized value $x in numeric eq (==) at main.pl line 9.
true
Use of uninitialized value $x in string eq at main.pl line 10.
true
```

このような暗黙の型変換が望ましくない場合、`defined`で事前チェックしてあげる必要があります。

```perl
use v5.45;

sub say_bool($v) {
  say $v ? "true" : "false";
}

my $x;

say_bool(defined $x && $x == 0);
say_bool(defined $x && $x eq "");
```

この例では左辺が`undef`の場合のみを考えました。
しかし両辺に`undef`が来る可能性がある場合はどうなるでしょう？

丁寧に`defined`でチェックしてあげると以下のようになります。

```perl
use v5.45;

sub say_bool($v) {
  say $v ? "true" : "false";
}

my ($x, $y);

say_bool(
  (!defined $x && !defined $y)
  || defined $x && defined $y && $x == $y
);
say_bool(
  (!defined $x && !defined $y)
  || defined $x && defined $y && $x eq $y
);
```

これはちょっと読み解くのが大変です。

## 実際に使ってみる

このような問題を解決するがundef-aware Equality Operatorsです。
実際に試してみましょう。

まずはundef-aware Equality Operatorsの入ったバージョンである5.45.3をビルドしましょう。
開発版をビルドするときは`-Dusedevel`をつけるのを忘れずに。これがないとコンパイルできません。

```bash
plenv install 5.45.3 -Dusedevel
plenv local 5.45.3
```

`==`の代わりに`===`を、`eq`の代わりに`equ`を使って比較します。
まだ実験的機能の扱いなのでそのままでは警告がでます。`no warnings 'experimental::equ';`で抑制しましょう。

```perl
use v5.45;
no warnings 'experimental::equ';

sub say_bool($v) {
  say $v ? "true" : "false";
}

my $x;

say_bool($x === 0);
say_bool($x equ "");
```

暗黙の型変換が行われなくなり、いずれも`false`を返します。

```plain
false
false
```

`defined`だらけで大変なことになった、両辺に`undef`が来る可能性があるケースも、以下のようにスッキリ書けます。

```perl
use v5.45;
no warnings 'experimental::equ';

sub say_bool($v) {
  say $v ? "true" : "false";
}

my ($x, $y);

say_bool($x === $y);
say_bool($x equ $y);
```

## まとめ

Perl 5.45.3で入ったundef-aware equality operatorsで遊んでみました。

今までは以下のように`defined`のチェックがたくさん必要だった箇所が、

```perl
(!defined $x && !defined $y)
  || defined $x && defined $y && $x == $y
```

以下のように簡潔に書くことができるようになります。

```perl
$x === $y
```

まだ実験的機能で将来変更が入る可能性はありますが、楽しみな機能ですね。

## 参考

- [PPC 0030 undef-aware Equality Operators](https://github.com/Perl/PPCs/blob/49b0b0cd78b1e76da5cf61ec6910264de27488e8/ppcs/ppc0030-undef-aware-equality.md)
- [perldelta - Perl 5.45.3](https://metacpan.org/release/BOOK/perl-5.45.3/view/pod/perldelta.pod)
- [perlop - Perl 5.45.3](https://metacpan.org/release/BOOK/perl-5.45.3/view/pod/perlop.pod#Equality-Operators)
