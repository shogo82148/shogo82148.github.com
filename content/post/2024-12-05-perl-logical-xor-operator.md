---
layout: post
title: "Perl 5.40に真偽値の排他的論理和を表す新しい演算子が導入されました"
slug: perl-logical-xor-operator
date: 2024-12-05 21:24:00 +0900
comments: true
categories: [perl]
---

Perl 5.40.0 から、真偽値の排他的論理和を表す `^^` 演算子が導入されました。

## 背景

Perl には「[コンテキスト（文脈）](https://qiita.com/karupanerura/items/361b620a123d80ad9fbe)」と呼ばれる概念があります。
Perlはプログラム内の文脈によって、今扱っているデータをどんな種類（数値なのか文字列なのか）で解釈するかを決定します。

たとえば `$x + $y` は数値加算の演算子であり、`$x` や `$y` は数値コンテキストで解釈されます。
数値コンテキストではデータは数値として評価されます。
もし `$x` や `$y` に文字列が入っていた場合は、一度数値に変換してから演算が行われます。

そして、Perlにはコンテキスト毎に異なった演算子が存在します。
たとえば、「論理積」を表す演算子の場合、
「整数の論理積」「文字列の論理積」「真偽値の論理積（優先度高）」「真偽値の論理積（優先度低）」の4種類の演算子があります。
「論理和」や「排他的論理和」を加えて表にまとめてみると以下のようになります。

| コンテキスト       | 論理積 | 論理和 | 排他的論理和  |
| ---------------- | ------ | ------ | ------------- |
| 数値             | `&`    | `\|`   | `^`           |
| 文字列           | `&.`   | `\|.`  | `^.`          |
| 真偽値(優先度高) | `&&`   | `\|\|` |        |
| 真偽値(優先度低) | `and`  | `or`   | `xor`         |

さて、この表をよく見ると「真偽値の排他的論理和」の部分にひとつだけ空白があります。
「この空白を埋めよう！」というモチベーションで追加されたのが `^^` 演算子です。
`^^` は両辺の真偽値コンテキストで評価し、その排他的論理和を計算します。

## 試してみた

実際に試してみました。

```perl
use v5.40;

sub say_bool($v) {
    say $v ? "true" : "false";
}

say_bool false ^^ false;
say_bool false ^^  true;
say_bool  true ^^ false;
say_bool false ^^ false;
```

Perl 5.40 で実行してみると、真理値表通りの結果が得られましたね。

```plain
false
true
true
false
```

## xor演算子との違いは？

`xor` 演算子と `^^` 演算子の違いは優先順位です。

たとえば以下のコードは `(say_bool false) xor false;` と解釈されてしまって、
期待したとおりには動きません。

```perl
use v5.40;

sub say_bool($v) {
    say $v ? "true" : "false";
}

say_bool false xor false;
say_bool false xor  true;
say_bool  true xor false;
say_bool false xor false;
```

```plain
Useless use of logical xor in void context at xor-legacy.pl line 7.
Useless use of logical xor in void context at xor-legacy.pl line 8.
Useless use of logical xor in void context at xor-legacy.pl line 9.
Useless use of logical xor in void context at xor-legacy.pl line 10.
false
false
true
false
```

正しく動作させるにはカッコを補う必要があります。

```perl
use v5.40;

sub say_bool($v) {
    say $v ? "true" : "false";
}

say_bool(false xor false);
say_bool(false xor  true);
say_bool( true xor false);
say_bool(false xor false);
```

## まとめ

Perl 5.40.0 から、真偽値の排他的論理和を表す `^^` 演算子が導入されました。
`&&`, `||` の排他的論理和バージョンで、優先度の高い `xor` 演算子として動作します。

## 参考

- [Perlと型とコンテキスト](https://qiita.com/karupanerura/items/361b620a123d80ad9fbe)
- [New ^^ logical xor operator - perldelta v5.40.0](https://metacpan.org/release/HAARG/perl-5.40.0/view/pod/perldelta.pod#New-%5E%5E-logical-xor-operator)
- [New logical xor operator, spelled ^^ #21996](https://github.com/Perl/perl5/pull/21996)
