---
layout: post
title: "Perl の extra_paired_delimiters を先取り！"
slug: 2022-05-16-perl-extra-paired-delimiters
date: 2022-05-16 23:36:00 +0900
comments: true
categories: [perl]
---

そういえば Perl 5.36 もうすぐリリースだなー、なんか面白い変更あるかなー、
と perldelta を眺めていたら、あった！！！！

というわけで Perl 5.36 から導入されるらしい `extra_paired_delimiters` を試してみました。

## Paired Delimiters

他の多くの動的言語では、シングルクォーテーション(`'`) やダブルクォーテーション(`"`)で囲うことで文字列を表します。
これは Perl でも同じです。

```perl
use 5.35.11;
use utf8;

say 'Hello World';
say "Hello World";
```

でもこれだけだとシングルクォーテーションやダブルクォーテーションを含む文字列を表現しようとしたときに、
エスケープが必要になります。
これくらいの短い文字列であれば余裕ですが、あまり長くなると大変です。

```perl
use 5.35.11;
use utf8;

say '\'Hello\' "World"';
say "'Hello' \"World\"";
```

Perl にはそれを解決するための便利な記法があります。
例えば `q(文字列)` と書くと `'文字列'` と書いたのと同じ意味になります。
`( )` 以外にもいくつかペアがあり、以下はすべて同じ意味になります。

```perl
use 5.35.11;
use utf8;

say 'Hello World';
say q(Hello World);
say q<Hello World>;
say q[Hello World];
say q{Hello World};
```

この記法が便利なのは「カッコの対応をチェックしてくれる」という点です。
例えば ` q((Hello) World)` という文字列の場合、ナイーブな実装であれば `(Hello` までが文字列として判定されてしまうでしょう。
しかし Perl は賢いので、 `(Hello)` の先頭と末尾のカッコが対応していることを認識し、
`(Hello) World` をひとつの文字列として扱ってくれます。

```perl
use 5.35.11;
use utf8;

say q((Hello) World);
```

この記法は文字列だけでなく `qr//`, `s///` のような正規表現記法にも使えます。
詳しくは Perl のドキュメントをどうぞ。

- [perlop Regexp Quote-Like Operators](https://metacpan.org/pod/perlop#Regexp-Quote-Like-Operators)
- [perlop Quote-Like Operators ](https://metacpan.org/pod/perlop#Quote-Like-Operators)

## Extra Paired Delimiters

ここまでは古い Perl でも使える機能のお話でした。
今月リリース予定の Perl 5.36 では使えるペアが「大幅に増えます」。

この新機能を使うには `extra_paired_delimiters` feature flag を有効化する必要があります。
また、まだ実験的機能なので普通に使うと警告がでます。
この警告は `no warnings "experimental::extra_paired_delimiters";` で抑制可能です。

この機能を有効化すると、例えば `« »` が区切り文字として使えます。

```perl
use 5.35.11;
use utf8;
use feature "extra_paired_delimiters";
no warnings "experimental::extra_paired_delimiters";

say q«Hello World!»;
```

このへんは日本人にとっては、ありがたいですね。

```perl
use 5.35.11;
use utf8;
use feature "extra_paired_delimiters";
no warnings "experimental::extra_paired_delimiters";

say q「Hello World!」;
say q『Hello World!』;
say q【Hello World!】;
```

僕はあまり馴染みのない文字ですが、常用している地域もあるんでしょうか？

```perl
use 5.35.11;
use utf8;
use feature "extra_paired_delimiters";
no warnings "experimental::extra_paired_delimiters";

say q༺Hello World!༻;
say q꧁Hello World!꧂;
```

・・・なるほど・・・？

視覚的にわかりやすいかも・・・？

```perl
use 5.35.11;
use utf8;
use feature "extra_paired_delimiters";
no warnings "experimental::extra_paired_delimiters";

say q👉Hello World!👈;
say q⏩Hello World!⏪;
say q⏭Hello World!⏮;
```

どうしてこうなった。

完全な一覧はこちらをどうぞ。

- [feature extra_paired_delimiters](https://metacpan.org/release/SHAY/perl-5.35.11/view/lib/feature.pm#The-'extra_paired_delimiters'-feature)

## まとめ

Perl の文字列の区切りにカッコを使用することができます。
今までは4種類 (`( )`, `< >`, `[ ]`, `{ }`)だけでしたが、5.36からその種類が大幅に増えます。
まだ実験的機能なので今後変更・廃止される可能性もありますが、とても・・・ユニークな機能ですね。

いったい Perl はどこへ向かっているんだろう・・・？

スケジュール通りなら Perl 5.36 は 5/20 リリースです！楽しみですね！

## 参考

- [feature extra_paired_delimiters](https://metacpan.org/release/SHAY/perl-5.35.11/view/lib/feature.pm#The-'extra_paired_delimiters'-feature)
- [perl53510delta](https://metacpan.org/release/SHAY/perl-5.35.11/view/pod/perl53510delta.pod#Added-experimental-feature-'extra_paired_delimiters')
- [release_schedule.pod](https://metacpan.org/release/SHAY/perl-5.35.11/view/Porting/release_schedule.pod)
- [perlop Regexp Quote-Like Operators](https://metacpan.org/pod/perlop#Regexp-Quote-Like-Operators)
- [perlop Quote-Like Operators ](https://metacpan.org/pod/perlop#Quote-Like-Operators)
