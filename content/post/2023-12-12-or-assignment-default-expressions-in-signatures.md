---
layout: post
title: "Perl 5.38 の「シグネチャのデフォルト式の定義性論理和と論理和」を試してみた"
slug: 2023-12-12-or-assignment-default-expressions-in-signatures
date: 2023-12-12 21:55:00 +0900
comments: true
categories: [perl]
---

この記事は、[Perl Advent Calendar 2023](https://qiita.com/advent-calendar/2023/perl) 12日目の記事です。
11日目は[@shogo82148](https://twitter.com/shogo82148)で「[ExifToolがすごいという話](https://shogo82148.github.io/blog/2023/12/11/2023-12-11-introduce-exiftool/)」でした。

-----

アドベントカレンダーのネタを探して[perldelta](https://metacpan.org/dist/perl/view/pod/perldelta.pod)をさまよい歩くいっちーです。

Perl 5.38.0 から、「シグネチャーのデフォルト式に定義性論理和と論理和が使えるようになった」という記載を見つけたので試してみます。

## 定義性論理和と論理和

「定義性論理和と論理和」と聞いてもピンとこなかったので、一応おさらい。
いわゆる `//` 演算子と `||` 演算子のことです（発音できない）。
英語で defined-or, logical-or と言ったほうが馴染み深い人も多いかもしれません。

「定義性論理和」の和訳は <perldoc.jp> を参考にしました。
[perlop](https://perldoc.jp/docs/perl/5.38.0/perlop.pod#Logical32Defined-Or) の担当をしたひとも
日本訳に相当苦労したことでしょう・・・。

### 論理和

論理和はどちらか一方が真ならば真を、それ以外の場合は偽を返す演算子です。
これは他のプログラミング言語と同じなので、みなさんおなじみだと思います。

Perlがおもしろいのは `true`, `false` というキーワードが（まだ）ないということですね。
`0`, `"0"`, `undef` は真、それ以外はすべて偽として認識されます。

`true`, `false` の代わりに `1`, `0` を使って、 `||` の挙動を確かめてみましょう。

```perl
use 5.38.0;

say 0 || 0; # 0
say 0 || 1; # 1
say 1 || 0; # 1
say 1 || 1; # 1
```

### 論理和の短絡評価

`||` 演算子は短絡評価を行います。
たとえば `1 || $a` という式があったら、`$a` にどんな値が入っていても真なので、`$a`の評価を行いません。

さらに `||` 演算子は **最後に評価した値** を、そのまま式自体の値として返します。
そのままの値を返すので、たとえば以下のように文字列を `||` 演算子にわたすと、そのまま文字列が返ってきます。

```perl
use 5.38.0;

say "Hello" || "World"; # Hello
say undef || "World"; # World
```

### デフォルト値の論理和を使う

論理和のこの性質を利用して、「引数を省略したらデフォルト値を使用する」というイディオムが編み出されました。

たとえば以下のような、「名前を渡すとその人に挨拶をする関数」を考えてみましょう。
ただし、引数を省略した場合はWorldに挨拶するものとします。

```perl
use 5.38.0;

sub hello {
    my ($name) = @_;
    # $name = $name || "World"; と同じ
    # $nameが省略された場合 "World" を代入する
    $name ||= "World";

    say "Hello, $name!";
}

hello("Shogo"); # Hello, Shogo!
hello(); # Hello, World!
```

### 定義性論理和

しかしこの関数には重大なバグがあります。
**「0」さんに挨拶できないのです！**

```perl
use 5.38.0;

sub hello {
    my ($name) = @_;
    # "0" は偽として判断されるので、"World"が代入される
    $name ||= "World";

    say "Hello, $name!";
}

hello("0"); # Hello, World!
```

このような問題に対応するために、`undef` のみを偽として扱う演算子が導入されました。
それが定義性論理和 `//` 演算子です。

```perl
use 5.38.0;

sub hello {
    my ($name) = @_;
    $name //= "World";
    say "Hello, $name!";
}

hello("0"); # Hello, 0!
```

やったね、「0」さん！

## シグネチャのデフォルト式を使う

現代のPerlは **関数に引数リストを持てる！！** ので、以下のように書き直すことができます。

```perl
use 5.38.0;

sub hello($name = "World") {
    say "Hello, $name!";
}

# 名前を渡すと挨拶してくれる
hello("Shogo"); # Hello, Shogo!

# 名前を省略するとデフォルト値を使ってくれる
hello(); # Hello, World!

# "0" も正しく扱える
hello("0"); # Hello, 0!
```

## シグネチャのデフォルト式に論理和を使う

万能に思えるデフォルト式ですが、ひとつ問題があります。
「デフォルト値を指定しない」という意図で `undef` を渡すと、意図した通りには動きません。

```perl
use 5.38.0;

sub hello($name = "World") {
    say "Hello, $name!";
}

hello("Shogo"); # Hello, Shogo!
hello(); # Hello, World!
hello(0); # Hello, 0!

# デフォルト値を使ってほしいのに、 $name = undef として実行されてしまう
hello(undef); # Use of uninitialized value $name in concatenation (.) or string at perlsub.pl line 4.
```

-----

（ここまでが前置き、ここから本題）Perl 5.38からは、以下のように関数を定義することで解決できます。

```perl
use 5.38.0;

sub hello($name //= "World") {
    say "Hello, $name!";
}

hello("Shogo"); # Hello, Shogo!
hello(); # Hello, World!
hello(0); # Hello, 0!

# デフォルト値を使ってくれる
hello(undef); # Hello, World!
```

## まとめ

Perl 5.38から以下のような関数定義が可能になりました。

```perl
use 5.38.0;

sub hello($name //= "World") {
    say "Hello, $name!";
}
```

`hello(undef)` みたいな呼び出し方だとありがたみを感じませんが、変数を渡してあげると便利かもしれませんね。

```perl
use 5.38.0;

sub hello($name //= "World") {
    say "Hello, $name!";
}

hello($ARGV[0]);
```

-----

明日13日目は[@doikoji](https://qiita.com/doikoji)で「低レベルPerlスクリプトのススメ」です。
お楽しみに！

## 参考

- [perl5380delta](https://metacpan.org/dist/perl/view/pod/perl5380delta.pod)
- [perlop - 論理定義性和](https://perldoc.jp/docs/perl/5.38.0/perlop.pod#Logical32Defined-Or)
