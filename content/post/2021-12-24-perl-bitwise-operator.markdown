---
layout: post
title: "Perl の文字列用ビット操作演算子を使ってみる"
slug: perl-bitwise-operator
date: 2021-12-24 09:56:00 +0900
comments: true
categories: [perl]
---

この記事は、[Perl Advent Calendar 2021](https://qiita.com/advent-calendar/2021/perl) の24日目の記事です。
23日目は [@hitode909](https://qiita.com/hitode909) で「[リポジトリ内のソースコードを機械的にリファクタリングし続けるスクリプトを作る](https://blog.sushi.money/entry/2021/12/23/112211)」でした。

-----

今日はちょっと前から使えるようになってたけど滅多にお世話になることのない、「文字列用ビット操作演算子」を触ってみたというお話です。

特に断りのない限り 2021-12-24 現在の最新安定版 Perl 5.34.0 で動作確認をしています。

## 旧来のビット演算子

Perl の多くの演算子には「数値用」と「文字列用」があります。
例えば比較演算子であれば `==`, `!=` は数値用、 `eq`, `ne` は文字列用といった具合です。

しかし、ビット操作用の演算子だけには、なぜかその区別がなかったのです。
以下は [perlop Bitwise String Operators](https://metacpan.org/dist/perl/view/pod/perlop.pod#Bitwise-String-Operators) から引っ張ってきた例です。
`|` は論理和を求める演算子ですが、両辺の型に応じて結果が変わります。

```perl
use warnings;
use strict;
use feature qw/say/;

say  150  |  105;  # = 255  (0x96 | 0x69 = 0xFF)
say '150' |  105;  # = 255
say  150  | '105'; # = 255
say '150' | '105'; # = 文字列の '155' (ASCII)
```

結果:

```
255
255
255
155
```

最後の文字列同士の計算だけ結果が違うのは、文字列同士の場合はバイト毎に論理和の計算が行われるためです。

```
0x31 ('1') | 0x31 ('1') = 0x31 ('1')
0x35 ('5') | 0x30 ('0') = 0x31 ('5')
0x30 ('0') | 0x35 ('5') = 0x31 ('5')
```

このちょっと面白い(面白くはない)挙動については、[Perl の JSON::PP での数値の扱いが変わっていた件](https://shogo82148.github.io/blog/2021/10/14/json-pp-on-perl/)でも簡単に触れました。

## bitwise feature

「これはちょっと分かりにくいよね」ということで Perl 5.22 から「数値用」「文字列用」の演算子を分けることができるようになりました。
後方互換性のためにデフォルトでは無効化されているので、 `feature` プラグマで明示的に有効化する必要があります。

`bitwise` を有効化すると、今までのビット演算子は「数値用」になります。
両辺が両方とも文字列であった場合も、数値に変換されてから演算されます。

```perl
use warnings;
use strict;
use feature qw/say bitwise/;

say  150  |  105;  # = 255  (0x96 | 0x69 is 0xFF)
say '150' |  105;  # = 255
say  150  | '105'; # = 255
say '150' | '105'; # = 255
```

結果:

```
255
255
255
255
```

「文字列用」にはドット付きの `&. |. ^. ~.` を使います。

```perl
use warnings;
use strict;
use feature qw/say bitwise/;

say  150  |. 105;  # = '155'
say '150' |. 105;  # = '155'
say  150  |.'105'; # = '155'
say '150' |.'105'; # = '155'
```

結果:

```
155
155
155
155
```

Perl 5.22 から Perl 5.26 までは「実験的機能」扱いなので警告がでます。
Perl 5.28 からは警告なしで使えます。

## feature bundle 経由で使ってみる

Perl 5.28 から正式な機能として扱われるようになったので、
最小バージョンを明示することでも有効化できます。

```perl
use warnings;
use v5.28; # Perl 5.28 以降で使える機能を有効化

# 以下は use v5.28 に含まれるので省略可
# use strict; 
# use feature qw/say bitwise/;

say  150  |. 105;  # = '155'
say '150' |. 105;  # = '155'
say  150  |.'105'; # = '155'
say '150' |.'105'; # = '155'
```

有効化される機能は `say` `bitwise` だけではありません。
完全な一覧は [FEATURE BUNDLES](https://perldoc.perl.org/feature#FEATURE-BUNDLES) を参照してください。

## まとめ

- 文字列専用ビット演算子 `&. |. ^. ~.` を使ってみました
- Perl 5.28 から正式に採用
- `use v5.28` or `use feature 'bitwise'` で使えます

正直こんな演算子が追加されていたなんて、最近まで知らなかった・・・。

-----

明日25日は [@karupanerura](https://qiita.com/karupanerura) で「[Perlと型とコンテキスト](https://qiita.com/karupanerura/items/361b620a123d80ad9fbe)」です。お楽しみに！

## 参考

- [bitwise - ビット演算子を数値専用と文字列専用に分ける](https://qiita.com/xtetsuji/items/a21c718ca37799d11c7c#bitwise---%E3%83%93%E3%83%83%E3%83%88%E6%BC%94%E7%AE%97%E5%AD%90%E3%82%92%E6%95%B0%E5%80%A4%E5%B0%82%E7%94%A8%E3%81%A8%E6%96%87%E5%AD%97%E5%88%97%E5%B0%82%E7%94%A8%E3%81%AB%E5%88%86%E3%81%91%E3%82%8B)
- [perlop Bitwise String Operators](https://metacpan.org/dist/perl/view/pod/perlop.pod#Bitwise-String-Operators)
- [Perl の JSON::PP での数値の扱いが変わっていた件](https://shogo82148.github.io/blog/2021/10/14/json-pp-on-perl/)
- [FEATURE BUNDLES](https://perldoc.perl.org/feature#FEATURE-BUNDLES)
