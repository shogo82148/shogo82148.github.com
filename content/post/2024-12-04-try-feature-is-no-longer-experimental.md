---
layout: post
title: "Perl 5.40でtry/catch機能が安定版になりました"
slug: try-feature-is-no-longer-experimental
date: 2024-12-04 00:00:00 +0900
comments: true
categories: [perl]
---

この記事は、[Perl Advent Calendar 2024](https://qiita.com/advent-calendar/2024/perl) 4日目の記事（代打）です。
3日目は[@kfly8](https://qiita.com/kfly8)で「[Perlの型ライブラリのkuraと組み込みのclassを一緒に利用できるようになりました](https://kfly8.hatenablog.com/entry/2024/11/25/163553)」でした。

-----

[Perl 5.34.0 で導入されたtry/catch機能](https://shogo82148.github.io/blog/2021/12/09/perl-try-catch/)でしたが、今までは実験的機能の扱いでした。
しかし、Perl 5.40.0でついに正式な言語機能として扱われることになりました！

## Perl 5.40.0のtry/catch機能

`:5.40` feature bundle にも `try` feature が追加されました。
`use v5.40` するだけで使えます。

```perl
use v5.40;

try {
    die "dead";
} catch($e) {
    print "catch: $e";
}
```

実行結果は以下の通りです。

```plain
catch: dead at try-catch.pl line 4.
```

## まとめ

Perl 5.40 で try/catch が使えるようになりました。

Perl 5.38 までの try/catch については以下の記事を参照。

- [Perl 5.34.0 の try-catch を触ってみる](https://shogo82148.github.io/blog/2021/12/09/perl-try-catch/)

> 新しい風が吹く、Perlの空に\
> tryとcatchで一筋の光\
> 例外処理が簡単に\
> バグも恐れず、コードも輝く\
> 未来を照らす、5.40
>
> by CodeRabbit

-----

明日5日目は[@shogo82148](https://twitter.com/shogo82148)で「[Perl 5.40に真偽値の排他的論理和を表す新しい演算子が導入されました](https://shogo82148.github.io/blog/2024/12/05/perl-logical-xor-operator/)」です。 お楽しみに！

## 参考

- [Perl 5.34.0 の try-catch を触ってみる](https://shogo82148.github.io/blog/2021/12/09/perl-try-catch/)
- [try/catch feature is no longer experimental](https://metacpan.org/release/HAARG/perl-5.40.0/view/pod/perldelta.pod#try/catch-feature-is-no-longer-experimental)
- [The :5.40 feature bundle adds try](https://metacpan.org/release/HAARG/perl-5.40.0/view/pod/perldelta.pod#The-:5.40-feature-bundle-adds-try)
- [try/catch (5.34〜) - 2024年秋のPerl](https://speakerdeck.com/charsbar/2024nian-qiu-noperl?slide=27)
