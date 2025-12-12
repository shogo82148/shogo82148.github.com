---
layout: post
title: "Perl 5.42.0 の any と all キーワードを試してみた"
slug: any-and-all-keywords-in-perl
date: 2025-12-11 23:14:00 +0900
comments: true
categories: [perl]
---

この記事は、[Perl Advent Calendar 2025](https://qiita.com/advent-calendar/2025/perl) 11日目の記事です。 10日目は[@shogo82148](https://x.com/shogo82148)で「[Perl 5.43.5 の Signatures Named Parameters を先取り](https://shogo82148.github.io/blog/2025/12/10/signatures-named-parameters-in-perl/)」でした。

-----

## 背景・目的

Perl 5.42.0 から any と all キーワードが使えるようになったそうです。
まだ実験的機能ですが遊んでみます。

## 試してみた

まずは `all` キーワードから試してみます。
まだ実験的機能扱いなので、明示的に機能を有効化することと、警告を無効化することが必要です。

```perl
use v5.42;
use feature 'keyword_all';
no warnings 'experimental::keyword_all';

my @numbers = (2, 4, 8, 16);

if ( all { $_ % 2 == 0 } @numbers ) {
  say "All the numbers are even";
}
```

出力：

```plain
All the numbers are even
```

`(2, 4, 8, 16)` はすべて偶数なので、意図した結果が得られました。

-----

次は `any` キーワードを試してみます。
`all` キーワードと同様に実験的機能扱いです。
明示的な機能の有効化と、警告の無効化が必要です。

```perl
use v5.42;
use feature 'keyword_any';
no warnings 'experimental::keyword_any';

my @numbers = (2, 4, 8, 16);

if ( any { $_ % 2 == 0 } @numbers ) {
  say "Any of the numbers are even";
}
```

出力：

```plain
Any of the numbers are even
```

偶数が含まれているので、期待通りの結果ですね。

## まとめ

Perl 5.42.0 から `any` と `all` キーワードが使えるようになったので、簡単に触ってみました。
意図した通りに動いてくれたので満足です。

ドキュメントによると `any` も `all` も他の実装より高速に動作するそうです。
余力があればベンチマーク取って確認したかったけど、力尽きてしまいました。
[@charsbar](https://x.com/charsbar)の[2025年 秋のPerl](https://speakerdeck.com/charsbar/2025nian-qiu-noperl?slide=30)にベンチマークの結果が載っているのでこちらをどうぞ。

その他にもベンチマーク取ってみたぞ！という記事をお待ちしております。

-----

明日12日はTBDさんで「TBD」です。

> 🐰 ナンドパラメータの魔法が舞う\
> anyとallの光が輝く\
> 明日また新たな物語\
> Perlの森をくぐり抜けて\
> 可能性の扉がひらく ✨
>
> by [CodeRabbit](https://www.coderabbit.ai/)

## 参考

- [2025年 秋のPerl](https://speakerdeck.com/charsbar/2025nian-qiu-noperl?slide=30)
- [perldelta - Perl 5.42.0](https://metacpan.org/release/BOOK/perl-5.42.0/view/pod/perldelta.pod)
