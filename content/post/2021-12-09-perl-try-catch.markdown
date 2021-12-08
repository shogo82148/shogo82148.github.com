---
layout: post
title: "Perl 5.34.0 の try-catch を触ってみる"
slug: perl-try-catch
date: 2021-12-09 00:00:00 +0900
comments: true
categories: [perl]
---

この記事は、[Perl Advent Calendar 2021](https://qiita.com/advent-calendar/2021/perl) の9日目の記事です。
8日目は [@doikoji](https://qiita.com/doikoji) で「[Getopt::Longのスペルが覚えられない俺はとうとう覚える努力を放棄してラッパーを作った](https://qiita.com/doikoji/items/af959825991346092245)」でした。

-----

アドベントカレンダー25日もあると疲れてくるので、今日はかる～く行きましょう。
[Perl 5.34.0 から利用可能になった try-catch 構文](https://metacpan.org/release/XSAWYERX/perl-5.34.0/view/pod/perldelta.pod#Experimental-Try/Catch-Syntax)を触ってみたというお話です。

特に断りのない限り 2021-12-09 現在の最新安定版 Perl 5.34.0 で動作確認をしています。

## とりあえず使ってみる

使い方は簡単です。
`use feature` プラグマで有効化し、
`try BLOCK catch (VAR) BLOCK` とするだけ。
最初の `try` ブロックの中で `die` すると `catch` ブロックが実行されます。

```perl
use strict;
use warnings;
use feature qw(try);

try {
    die "dead";
} catch($e) {
    print "catch: $e";
} # no more ";" here !!!

1;
```

出力:

```
try/catch is experimental at try-catch.pl line 5.
try/catch is experimental at try-catch.pl line 7.
catch: dead at try-catch.pl line 6.
```

Perl 5.34.0 ではまだ実験的な機能扱いなので警告がでます。
`no warnings` プラグマで抑制が可能です。

```perl
use strict;
use warnings;
use feature qw(try);
no warnings "experimental::try"; # 警告の抑制

try {
    die "dead";
} catch($e) {
    print "catch: $e";
} # no more ";" here !!!

1;
```

出力:

```
catch: dead at try-catch.pl line 6.
```

## これまでの例外処理

これまでは例外という概念がなかったので、Perl Monger たちはいろんな方法で「例外っぽいもの」を作り出してきました。

### eval

言語の組み込み機能で例外を作り出すには `die` と `eval` を使います。

```perl
use strict;
use warnings;

eval {
    die "dead";
}; # ";" is required !!!
if ($@) {
    print "catch: $@";
}

1;
```

`";" is required !!!` と書いたところのセミコロン忘れるというのがよくあるミスです。
また `$@` という特殊変数の扱いが少し厄介です。
覚えにくいというのもそうなんですが、グローバル変数なので意図せず書き換わってしまう場合があるそうです。
正直自分も詳しくないので詳細は [Try::Tiny#BACKGROUND](https://metacpan.org/pod/Try::Tiny#BACKGROUND) をどうぞ。

### Try::Tiny モジュール

3rd-party のモジュールを使う方法です。
[Try::Tiny](https://metacpan.org/pod/Try::Tiny) はたぶん僕が一番お世話になったモジュールです。

```perl
use strict;
use warnings;
use Try::Tiny;

try {
    die "dead";
} catch {
    print "catch: $_";
}; # ";" is required !!!

1;
```

だいぶ try-catch 構文に近くなりますが、`";" is required !!!` と書いたところにやっぱりセミコロンが必要です。

また `{ ... }` はブロックではなく無名関数の省略記法だというのもよくある罠です。
省略せずに書くとこうなります。

```perl
use strict;
use warnings;
use Try::Tiny;

try(
    sub {
        die "dead";
    },
    catch(
        sub {
            print "catch: $_";
        },
    ),
);

1;
```

この違いがどんな罠を生むかというと、ブロックと関数では制御構文の挙動がことなるという点です。
例えば `return` の場合、`do_something` 関数を抜けるつもりで `return` を書いても抜けることは出来ません。

```perl
use strict;
use warnings;
use Try::Tiny;

sub do_something {
    try {
        return; # do_something を抜けたい
    } catch {
        print "catch: $_";
    };
    print "この行は実行されてしまう\n";
}

do_something();

1;
```

一方 5.34.0 で導入された `try` はブロックなので関数を抜けることができます。

```perl
use strict;
use warnings;
use feature qw(try);
no warnings "experimental::try";

sub do_something {
    try {
        return; # do_something を抜けたい
    } catch ($e) {
        print "catch: $e";
    }
    print "この行は実行されない！！\n";
}

do_something();

1;
```

-----

また `caller` 関数の戻り値が変化するという罠も潜んでいます。

```perl
use strict;
use warnings;
use Try::Tiny;

sub do_something {
    try {
        my ($package, $filename, $line) = caller;
        print "$package, $filename, $line\n";
    } catch {
        print "catch: $_";
    };
}

do_something();

1;
```

実行結果:

```
Try::Tiny, /Users/shogo.ichinose/.plenv/versions/5.34.0/lib/perl5/site_perl/5.34.0/Try/Tiny.pm, 102
```

組み込みの `die` はスタックトーレスを埋め込んでくれないので、 `caller` 関数を使ったヘルパーを時々書くのですが、
この挙動を把握しておかないと痛い目にあいます。
エラーが起きたからログを調査しよう！といったときに `Try/Tiny.pm line 102` という文字列だけ残されていて何度絶望したことか・・・

一方 5.34.0 で導入された `try` はブロックなので `caller` は変化しません。

```perl
use strict;
use warnings;
use feature qw(try);
no warnings "experimental::try";

sub do_something {
    try {
        my ($package, $filename, $line) = caller;
        print "$package, $filename, $line\n";
    } catch ($e) {
        print "catch: $e";
    }
}

do_something();

1;
```

実行結果:

```
main, try-caller.pl, 15
```

### Syntax::Keyword::Try モジュール

[Syntax::Keyword::Try](https://metacpan.org/pod/Syntax::Keyword::Try) はキーワードプラグインという仕組みで
Perl の構文自体を書き換えてしまうモジュールです。

```perl
use strict;
use warnings;
use Syntax::Keyword::Try;

try {
    die "dead";
} catch($e) {
    print "catch: $e";
} # no more ";" here !!!

1;
```

`{ ... }` はれっきとしたブロックなので `return` で `do_something` 関数を抜けることができます。

```perl
use strict;
use warnings;
use Syntax::Keyword::Try;

sub do_something {
    try {
        return; # do_something を抜けたい
    } catch ($e) {
        print "catch: $e";
    }
    print "この行は実行されない！！\n";
}

do_something();

1;
```

-----

5.34.0 で導入された try-catch とほぼ互換性があるのですが、 `caller` 関数の挙動だけ少し違います。

```perl
use strict;
use warnings;
use Syntax::Keyword::Try;

sub do_something {
    try {
        my ($package, $filename, $line) = caller;
        print "$package, $filename, $line\n";
    } catch ($e) {
        print "catch: $e";
    }
}

do_something();

1;
```

```
main, syntax-keyword-try-caller.pl, 9
```

まあ結果を見る限り `Try/Tiny.pm line 102` よりは100倍マシ・・・。

## 今後について

### Feature::Compat::Try モジュール

Perl 組み込みの try-catch を使いたいけど古い Perl を切りたくない、という欲張りな人は
[Feature::Compat::Try](https://metacpan.org/pod/Feature::Compat::Try) モジュールが使えます。
Perl のバージョンに応じて `feature` プラグマと `Syntax::Keyword::Try` モジュールを切り替えてくれます。

```perl
use strict;
use warnings;
use Feature::Compat::Try;

try {
    die "dead";
} catch($e) {
    print "catch: $e";
} # no more ";" here !!!

1;
```

ただし先に書いたように 5.34.0 で導入された try-catch と `Syntax::Keyword::Try` モジュールでは `caller` 関数の挙動が違う点に注意が必要です。

### finally ブロック

try-catch の導入によって近代化への一歩を踏み出した (？) かのように思える Perl ですが、
なんと多くの言語に存在する `finally` ブロックには対応していません。

まあ、まだ「実験的な機能」ですからね。
先に紹介した `Feature::Compat::Try` でも、 `Syntax::Keyword::Try` へフォールバックする際はご丁寧に `finally` を無効化しています。

"Pre-RFC" として議論されているのは見つけたけど、どういう形で実装されるのかは未定のようです。

- [Pre-RFC: try/catch/finally and generic finally blocks](https://www.nntp.perl.org/group/perl.perl5.porters/2021/10/msg261757.html)

## まとめ

- Perl 5.34.0 から `use feature qw(try);` で try-catch 構文が使えます
- `Feature::Compat::Try` モジュールを使うと古い Perl でも使えるよ
- 罠が少ないので便利

-----

明日10日は hogehoge で「fugafuga」です。お楽しみに！ # TODO: 後で埋める

## 参考

- [Experimental Try/Catch Syntax - perldelta](https://metacpan.org/release/XSAWYERX/perl-5.34.0/view/pod/perldelta.pod#Experimental-Try/Catch-Syntax)
- [Perl 7 より先に Perl 5.34 が出るぞという話](https://blog.outer-inside.net/2021/03/perl-5.34-delta.html)
- [Try::Tiny](https://metacpan.org/pod/Try::Tiny)
- [Syntax::Keyword::TryとPerlのキーワードプラグイン (その1)](https://papix.hatenablog.com/entry/2019/12/02/170611)
- [Try Catch Exception Handling](https://metacpan.org/pod/perlsyn#Try-Catch-Exception-Handling)
- [caller EXPR](https://metacpan.org/pod/perlfunc#caller-EXPR)
- [Syntax::Keyword::Try](https://metacpan.org/pod/Syntax::Keyword::Try)
- [Feature::Compat::Try](https://metacpan.org/pod/Feature::Compat::Try)
- [try - try/catch構文の導入](https://qiita.com/xtetsuji/items/a21c718ca37799d11c7c#try---trycatch%E6%A7%8B%E6%96%87%E3%81%AE%E5%B0%8E%E5%85%A5)
- [Pre-RFC: try/catch/finally and generic finally blocks](https://www.nntp.perl.org/group/perl.perl5.porters/2021/10/msg261757.html)
