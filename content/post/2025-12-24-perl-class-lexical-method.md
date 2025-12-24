---
layout: post
title: "Perlクラスのレキシカルメソッドを試してみる"
slug: perl-class-lexical-method
date: 2025-12-24 22:24:00 +0900
comments: true
categories: [perl]
---

この記事は、[Perl Advent Calendar 2025](https://qiita.com/advent-calendar/2025/perl) 23日目の記事です。 22日目は[@shogo82148](https://x.com/shogo82148)で「[Perlのフィールド変数の:writer属性を試してみる](https://shogo82148.github.io/blog/2025/12/24/perl-class-writer-attribute/)」でした。

## 背景

ネタが尽きてきたので、引き続き[perldelta](https://metacpan.org/release/BOOK/perl-5.42.0/view/pod/perldelta.pod)から頑張ってネタを探すシリーズをやっていこうと思います。

クラスにレキシカルメソッドが実装されたらしいので、これを試してみます。

## レキシカルメソッドの使い方

[perlclass](https://metacpan.org/release/BOOK/perl-5.42.0/view/pod/perlclass.pod) からの例です。
class機能はまだ実験的な機能扱いなので、機能の有効化と、警告の無効化が必要なことに注意してください。

```perl
use v5.42;
use utf8;
use feature 'class';
no warnings 'experimental::class';

class LexicalMethod {
    my method abc ($x, $y) {
        say "Internal method abc invoked with x=$x y=$y";
    }

    method xyz {
        $self->&abc("x", "y");
    }
}

my $obj = LexicalMethod->new();
$obj->xyz();

# エラーになる例:
$obj->abc("hello", "world");
```

実行すると以下のような結果が得られます：

```plain
Internal method abc invoked with x=x y=y
Can't locate object method "abc" via package "LexicalMethod" at ./my-method.pl line 20.
```

レキシカルメソッドは現在のスコープ内からのみ参照できます。
これを使うことで他の言語で言うところのプライベートメソッドを実現できます。
スコープ内から呼び出すときは `$self->abc` ではなく、 `$self->&abc` になる点に注意が必要そうですね。

さきほどの実行例から、実際にスコープ外がアクセスしようとすると「そんなメソッドは定義されてないよ」と怒られてエラーになることがわかります。

## まとめ

Perl 5.42.0に導入されたレキシカルメソッドで遊んでみました。
class機能自体がまだ実験的機能の扱いなので、レキシカルメソッドにも変更が入る可能性があります。
利用する人は注意してください。

-----

明日24日はTBDさんでTBDです。

## 参考

- [perldelta - perl-5.42.0](https://metacpan.org/release/BOOK/perl-5.42.0/view/pod/perldelta.pod)
- [perlclass - perl-5.42.0](https://metacpan.org/release/BOOK/perl-5.42.0/view/pod/perlclass.pod)
