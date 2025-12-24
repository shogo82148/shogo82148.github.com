---
layout: post
title: "Perlのフィールド変数の:writer属性を試してみる"
slug: perl-class-writer-attribute
date: 2025-12-24 17:49:00 +0900
comments: true
categories: [perl]
---

この記事は、[Perl Advent Calendar 2025](https://qiita.com/advent-calendar/2025/perl) 22日目の記事です。 21日目は[@hkoba](https://x.com/hkoba)で「[Rust の libperl-sys で XS を書いてみた](https://hkoba.hatenablog.com/entry/2025/12/22/222609)」でした。

## 背景

ネタが尽きてきたので、[perldelta](https://metacpan.org/release/BOOK/perl-5.42.0/view/pod/perldelta.pod)から頑張ってネタを探すシリーズをやっていこうと思います。

クラスのフィールド変数に `:writer` 属性というのが追加されたらしいので、今回はそれを試してみます。

## `:writer` 属性の使い方

[perldelta](https://metacpan.org/release/BOOK/perl-5.42.0/view/pod/perldelta.pod) からの例です。
class機能はまだ実験的な機能扱いなので、機能の有効化と、警告の無効化が必要なことに注意してください。

```perl
use v5.42;
use feature 'class';
no warnings 'experimental::class';

class Point {
    field $x :reader :writer :param;
    field $y :reader :writer :param;
}

my $p = Point->new( x => 20, y => 40 );
$p->set_x(60);

say "x: ", $p->x;  # 60
say "y: ", $p->y;  # 40
```

`:writer` 属性を使うと変数 `x` に対して `set_x` というメソッドが生えてきます。
これを使って変数 `x` の値を変更することが可能です。

## メソッドチェーン

自動生成されたメソッドはインスタンス自身を戻り値として返します。
これを利用して `$p->set_x(60)->set_y(80);` のようにメソッドチェーンを書けます。

```perl
use v5.42;
use feature 'class';
no warnings 'experimental::class';

class Point {
    field $x :reader :writer :param;
    field $y :reader :writer :param;
}

my $p = Point->new( x => 20, y => 40 );
$p->set_x(60)->set_y(80);

say "x: ", $p->x;  # 60
say "y: ", $p->y;  # 80
```

## メソッド名のカスタマイズ

メソッド名は変数名から自動的に生成されますが、カスタマイズすることも可能です。
たとえば `set_x` の代わりに `write_x` で変数への書き込みを行いたい場合は、`:writer(write_x)` のように指定します。

```perl
use v5.42;
use feature 'class';
no warnings 'experimental::class';

class Point {
    field $x :reader :writer(write_x) :param;
    field $y :reader :writer(write_y) :param;
}

my $p = Point->new( x => 20, y => 40 );
$p->write_x(60)->write_y(80);

say "x: ", $p->x;  # 60
say "y: ", $p->y;  # 80
```

## まとめ

Perl 5.42.0に導入された `:writer` 属性で遊んでみました。
class機能自体がまだ実験的機能の扱いなので、`:writer` 属性にも変更が入る可能性があります。
利用する人は注意してください。

-----

明日23日は[@shogo82148](https://x.com/shogo82148)で「[Perlクラスのレキシカルメソッドを試してみる](https://shogo82148.github.io/blog/2025/12/24/perl-class-lexical-method/)」です。

> 🐰 新しいブログが仲間入り\
> Perl のクラス、:writer で輝く\
> セッターメソッド、自動で生成\
> メソッドチェーン、スムーズに流れる\
> 技術の知識、共有して嬉しい ✨
>
> by [CodeRabbit](https://www.coderabbit.ai/)

## 参考

- [perldelta - perl-5.42.0](https://metacpan.org/release/BOOK/perl-5.42.0/view/pod/perldelta.pod)
- [perlclass - perl-5.42.0](https://metacpan.org/release/BOOK/perl-5.42.0/view/pod/perlclass.pod)
