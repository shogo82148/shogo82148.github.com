---
layout: post
title: "PerlにClass構文がやってきた"
slug: 2023-12-29-perl-class
date: 2023-12-29 16:37:00 +0900
comments: true
categories: [perl]
---

この記事は、[Perl Advent Calendar 2023](https://qiita.com/advent-calendar/2023/perl) 24日目の記事（代打）です。
23日目は[@doikoji](https://qiita.com/doikoji)で「[【さらばpptxよ】perlとJavaScriptとHTMLで超手軽にスライドを作る](https://qiita.com/doikoji/items/b0d850349a6640d0c396)」でした。

-----

今年のPerlの重大ニュースといえば **「PerlにClass構文がやってきた」** ことですよね\[要出典\]。
（※ただしExperimental）
Advent Calendar でClassをメインに取り上げることなかったなと思ったので、ちょっと触ってみました。


## とりあえず動かしてみる

[perlclass](https://metacpan.org/dist/perl/view/pod/perlclass.pod)の例です。
警告が出ないように `no warnings 'experimental::class'` で抑制だけしました。

```perl
use v5.38;
use feature 'class';
no warnings 'experimental::class';

class My::Example 1.234 {
    field $x;
 
    ADJUST {
        $x = "Hello, world";
    }
 
    method print_message {
        say $x;
    }
}
 
My::Example->new->print_message;
```

実行すると `Hello, world` と出力されます。

```
Hello, world
```

## newの引数を受け取る

`My::Example->new` には引数を渡すことができます。
Perl 5.38時点では `:param` field属性を使って、フィールドを初期化できるようです。

```perl
use v5.38;
use feature 'class';
no warnings 'experimental::class';

class My::Example 1.234 {
    field $message :param; # new の引数で変更できる
 
    method print_message {
        say $message;
    }
}

my $obj = My::Example->new(message => "Hello World");
$obj->print_message;
```

パラメーターのバリデーション処理が欲しくなるところですが・・・今のところないみたい？今後に期待ですね。

## メソッドの中からメソッドを呼び出す

methodの中から、対象のインスタンスを明示せずに他のメソッドを呼び出すとエラーになります。

```perl
use v5.38;
use feature 'class';
no warnings 'experimental::class';

class My::Example 1.234 {
    field $message :param;

    method message {
        return $message;
    }

    method print_message {
        say message; # Cannot invoke method "message" on a non-instance at class.pl line 13.
    }
}

my $obj = My::Example->new(message => "Hello World");
$obj->print_message;
```

`$self` という変数で、現在のインスタンスにアクセスできます。

```perl
use v5.38;
use feature 'class';
no warnings 'experimental::class';

class My::Example 1.234 {
    field $message :param;

    method message {
        return $message;
    }

    method print_message {
        say $self->message;
    }
}

my $obj = My::Example->new(message => "Hello World");
$obj->print_message;
```

## まとめ

Perlにクラスがやってきました！
実験的な導入ということもあり、本当に基本的なことができるのみが、大きな一歩を踏み出しました。
今後の発展が楽しみですね。

-----

明日25日目は[@shogo82148](https://twitter.com/shogo82148)で「[AWS::LambdaがCanada West (Calgary) Regionで利用可能になりました](https://shogo82148.github.io/blog/2023/12/29/2023-12-29-p5-aws-lambda-is-available-on-ca-east-1/)」です。
お楽しみに！

## 参考

- [perlclass - Perl クラス構文リファレンス](https://perldoc.jp/docs/perl/5.38.0/perlclass.pod)
- [perlclass - Perl class syntax reference](https://metacpan.org/dist/perl/view/pod/perlclass.pod)
- [Perl に class 構文がやってきた](https://www.futomi.com/lecture/class.html#gsc.tab=0)
- [ISUCON13で、参考実装のPerl移植をしました](https://kfly8.hatenablog.com/entry/2023/12/03/235925)
