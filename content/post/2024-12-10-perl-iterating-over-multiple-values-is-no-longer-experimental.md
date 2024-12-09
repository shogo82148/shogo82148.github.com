---
layout: post
title: "Perl 5.40からiterating over multiple values at a time機能が安定版になりました"
slug: perl-iterating-over-multiple-values-is-no-longer-experimental
date: 2024-12-10 00:00:00 +0900
comments: true
categories: [perl]
---

この記事は、[Perl Advent Calendar 2024](https://qiita.com/advent-calendar/2024/perl) 10日目の記事（穴埋め）です。
9日目は[@shogo82148](https://twitter.com/shogo82148)で「[Perl 5.41から、UTF-8で書かれたソースコードにはuse utf8が必須になります](https://shogo82148.github.io/blog/2024/12/09/perl-requires-use-utf8/)」でした。

-----

以前、開発版のPerlで試した iterating over multiple values at a time 機能ですが、

- [Perl 5.35.5 の iterating over multiple values at a time を先取り](https://shogo82148.github.io/blog/2021/12/11/perl-iterating-over-multiple-values/)

Perl 5.40 から正式な機能として利用できるようになりました。

## 試してみた

この機能を使うと、ハッシュ（連想配列）の全要素に対して操作したい、ということが簡単にできます。
前回と同じコードを試してみましょう。

```perl
use v5.40;

my %hash = (
    a => 'Alice',
    b => 'Bob',
    c => 'Charlie',
);

for my ($key, $value) (%hash) {
    print "$key => $value\n";
}
```

警告が出力されずに問題なく実行できます。

```plain
a => Alice
b => Bob
c => Charlie
```

もちろん3つ以上同時に取得することもできます。

```perl
use v5.40;

my @cube = (
    (0, 0, 0), (0, 0, 1),
    (0, 1, 1), (0, 1, 0),
    (1, 1, 0), (1, 1, 1),
    (1, 0, 1), (1, 0, 0),
);

for my ($x, $y, $z) (@cube) {
    print "$x, $y, $z\n";
}
```

出力は以下のようになります。

```plain
0, 0, 0
0, 0, 1
0, 1, 1
0, 1, 0
1, 1, 0
1, 1, 1
1, 0, 1
1, 0, 0
```

## まとめ

Perl 5.40 からハッシュのキーとバリューのペアを取ってくるのが簡単になります。

-----

明日11日目はTBDで「TBD」です。 お楽しみに！

## 参考

- [Perl 5.35.5 の iterating over multiple values at a time を先取り](https://shogo82148.github.io/blog/2021/12/11/perl-iterating-over-multiple-values/)
- [for iterating over multiple values at a time is no longer experimental](https://metacpan.org/release/HAARG/perl-5.40.0/view/pod/perldelta.pod#for-iterating-over-multiple-values-at-a-time-is-no-longer-experimental)
- [forと複数ループ変数 - 2024年秋のPerl](https://speakerdeck.com/charsbar/2024nian-qiu-noperl?slide=30)
