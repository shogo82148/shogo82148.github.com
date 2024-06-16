---
layout: post
title: "Perlに真偽値の排他的論理和を表す新しい演算子が導入されました"
slug: 2024-12-31-perl-logical-xor-operator
date: 2024-12-31 21:24:00 +0900
comments: true
categories: [perl]
---

Perl 5.40.0 から、真偽値の排他的論理和を表す `^^` 演算子が導入されました。

## 背景

Perl では、演算子はどんな演算を行うかをオペランドの型と独立して決定します。
たとえば `$x + $y` は常に数値加算です。
`$x` や `$y` に数値でないものが含まれている場合、まずそれらを数値に変換しようとします。
これはまた、数値比較用と文字列比較用の 2 種類の演算子があるということです。

たとえば「論理積」を例に上げると
「整数の論理積」「文字列の論理積」「真偽値の論理歴」の三種類の演算子があります。
「論理和」や「排他的論理和」を加えて表にまとめてみると以下のようになります。

| 演算の対象       | 論理積 | 論理和 | 排他的論理和  |
| ---------------- | ------ | ------ | ------------- |
| 整数             | `&`    | `\|`   | `^`           |
| 文字列           | `&.`   | `\|.`  | `^.`          |
| 真偽値(優先度高) | `&&`   | `\|\|` |        |
| 真偽値(優先度低) | `and`  | `or`   | `xor`         |

よく見ると「真偽値の排他的論理和」の部分にひとつだけ空白があります。
今回の機能追加は「この空白を埋めよう！」というものです。

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

真理値表通りの結果が得られましたね。

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

```
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

他の言語では同様の演算子を見かけたことがないですね・・・
知っているひとがいたら教えてください。
