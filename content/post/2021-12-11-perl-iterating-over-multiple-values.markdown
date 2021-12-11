---
layout: post
title: "Perl 5.35.5 の iterating over multiple values at a time を先取り"
slug: perl-iterating-over-multiple-values
date: 2021-12-11 13:46:00 +0900
comments: true
categories: [perl]
---

この記事は、[Perl Advent Calendar 2021](https://qiita.com/advent-calendar/2021/perl) の11日目の記事です。
10日目は [@shogo82148](https://twitter.com/shogo82148) で「[Perl 5.35.4 の defer を先取り](https://shogo82148.github.io/blog/2021/12/10/perl-defer/)」でした。

-----

[Perl 5.35.5 から利用可能になった iterating over multiple values at a time](https://metacpan.org/release/LEONT/perl-5.35.5/view/pod/perldelta.pod#iterating-over-multiple-values-at-a-time)
を試してみたお話です。

この構文は安定版にはまだ取り込まれていません。
特に断りのない限り 2021-12-11 現在の最新開発版 Perl 5.35.6 で動作確認をしています。

## まずは Perl 5.35.6 をビルドする

Perl 5.35.6 は開発版なのでビルド済みのバイナリは配布されていません。
しかし plenv を使っていれば特に難しいことはありません。
注意点は開発版の警告を抑制するために `-Dusedevel` オプションをしていることくらいです。

```
plenv install 5.35.6 -Dusedevel
plenv local 5.35.6
```

## ハッシュのキーとバリューのペアの一覧を出力する

[Perl7関連で色々とゴタゴタがあった](https://shogo82148.github.io/blog/2021/05/22/perl-5.34-is-released/) 影響で、
Perlの今後の機能拡張は [RFC(Requests For Comments)](https://github.com/Perl/RFCs) の形式を取っていく事になりました。
この機能はそのRFCの記念すべき(？)第一号です！

- [Multiple-alias syntax for foreach](https://github.com/Perl/RFCs/blob/master/rfcs/rfc0001.md)

さて、プログラムを書いているとハッシュ(連想配列)の全要素に対して何か操作をしたいということは頻繁にあると思います。
これまで Perl には専用の構文はなく、以下のように `while` 文と `each` を組み合わせて書く必要がありました。

```perl
use warnings;
use strict;

my %hash = (
    a => 'Alice',
    b => 'Bob',
    c => 'Charlie',
);

while(my ($key, $value) = each %hash) {
    print "$key => $value\n";
}

1;
```

出力:

```
b => Bob
c => Charlie
a => Alice
```

Perl 5.35.5 に入った機能拡張で同等のことを `for` 文を使って以下のように書くことが出来ます。

```perl
use warnings;
use strict;

my %hash = (
    a => 'Alice',
    b => 'Bob',
    c => 'Charlie',
);

for my ($key, $value) (%hash) {
    print "$key => $value\n";
}

1;
```

出力:

```
for my (...) is experimental at for.pl line 10.
c => Charlie
b => Bob
a => Alice
```

この機能はまだ実験的機能なので上記のように警告が出力されます。
警告を抑制したい場合は `no warnings` プラグマで `experimental::for_list` を無効化します。

```perl
use warnings;
use strict;
no warnings "experimental::for_list";

my %hash = (
    a => 'Alice',
    b => 'Bob',
    c => 'Charlie',
);

for my ($key, $value) (%hash) {
    print "$key => $value\n";
}

1;
```

## 配列から複数の値を一度に取ってくる

Perl では「ハッシュ」と「キーとバリューが交互にあらわれる配列」は交互に変換(というか同一視？)できる場合がよくあります。
そもそもハッシュ専用の構文というのはなく、上の例でも「キーとバリューが交互にあらわれる配列」を `%hash` に代入しています。

この前提をもとに `for my ($key, $value) (%hash)` の部分をよく見ると、
これは「配列を2つずつグループ化(キーとバリューのペアの言い換え)してループを回す機能」と考えることが出来ます。
これをさらに `n` 個に一般化し「配列を `n` 個ずつグループ化してループを回す機能」にすることは自然なことですね(？)

```perl
use warnings;
use strict;
no warnings "experimental::for_list";

my @cube = (
    (0, 0, 0), (0, 0, 1),
    (0, 1, 1), (0, 1, 0),
    (1, 1, 0), (1, 0, 0),
    (1, 0, 1), (1, 1, 1),
);

for my ($x, $y, $z) (@cube) {
    print "$x, $y, $z\n";
}

1;
```

出力:

```
0, 0, 0
0, 0, 1
0, 1, 1
0, 1, 0
1, 1, 0
1, 0, 0
1, 0, 1
1, 1, 1
```

読みやすさのためカッコを補いましたが、以下のように書いても同等です。

```perl
use warnings;
use strict;
no warnings "experimental::for_list";

my @cube = (
    0, 0, 0, 0, 0, 1,
    0, 1, 1, 0, 1, 0,
    1, 1, 0, 1, 0, 0,
    1, 0, 1, 1, 1, 1,
);

for my ($x, $y, $z) (@cube) {
    print "$x, $y, $z\n";
}

1;
```

(他の言語ではあまり見ない斜め上の機能を入れてきたな・・・)

## まとめ

- 次のリリース Perl 5.36.0 からハッシュのキーとバリューのペアを取ってくるのが簡単になるよ
  - ただしまだ実験的機能扱い
- 開発版で良ければ Perl 5.35.5 から使えるよ

-----

明日12日は [@AnaTofuZ](https://qiita.com/AnaTofuZ) で「何かしら書きます」です。お楽しみに！

## 参考

- [Multiple-alias syntax for foreach](https://github.com/Perl/RFCs/blob/master/rfcs/rfc0001.md)
- [iterating over multiple values at a time](https://metacpan.org/release/LEONT/perl-5.35.5/view/pod/perldelta.pod#iterating-over-multiple-values-at-a-time)
- [for my (...) is experimental](https://metacpan.org/release/LEONT/perl-5.35.5/view/pod/perldiag.pod#for-my-(...)-is-experimental)
