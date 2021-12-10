---
layout: post
title: "Perl 5.35.4 の defer を先取り"
slug: perl-defer
date: 2021-12-10 00:00:00 +0900
comments: true
categories: [perl]
---

この記事は、[Perl Advent Calendar 2021](https://qiita.com/advent-calendar/2021/perl) の10日目の記事です。
9日目は [@shogo82148](https://twitter.com/shogo82148) で「[Perl 5.34.0 の try-catch を触ってみる](https://shogo82148.github.io/blog/2021/12/09/perl-try-catch/)」でした。

-----

アドベントカレンダー25日もあると疲れてくるので、今日もかる～く行きましょう。
[Perl 5.35.4 から利用可能になった defer 構文](https://metacpan.org/release/WOLFSAGE/perl-5.35.4/view/pod/perldelta.pod#defer-blocks)を触ってみたというお話です。

defer 構文は安定版にはまだ取り込まれていません。
特に断りのない限り 2021-12-10 現在の最新開発版 Perl 5.35.6 で動作確認をしています。

## まずは Perl 5.35.6 をビルドする

Perl 5.35.6 は開発版なのでビルド済みのバイナリは配布されていません。
しかし plenv を使っていれば特に難しいことはありません。
注意点は開発版の警告を抑制するために `-Dusedevel` オプションをしていることくらいです。

```
plenv install 5.35.6 -Dusedevel
plenv local 5.35.6
```

## defer を使ってみる

使い方はいつものように `use feature` プラグマで有効化し、
`defer BLOCK` とするだけ。

```perl
use strict;
use warnings;
use feature 'say';
use feature 'defer';
 
{
    say "This happens first";
    defer { say "This happens last"; }
 
    say "And this happens inbetween";
}

1;
```

出力:

```
defer is experimental at defer.pl line 8.
This happens first
And this happens inbetween
This happens last
```



まだ実験的な機能扱いなので警告がでます。
`no warnings` プラグマで抑制が可能です。

```perl
use strict;
use warnings;
use feature 'say';
use feature 'defer';
no warnings 'experimental::defer'; # 警告を抑制

{
    say "This happens first";
    defer { say "This happens last"; }
 
    say "And this happens inbetween";
}

1;
```

出力:

```
This happens first
And this happens inbetween
This happens last
```

## これまでの defer

### Scope::Guard モジュール

Perl のガーベージコレクションがリファレンスカウントだということを利用して defer を実現するモジュールです。

```perl
use strict;
use warnings;
use feature 'say';
use Scope::Guard qw(guard);

{
    say "This happens first";
    my $guard = guard { say "This happens last"; };
 
    say "And this happens inbetween";
}

1;
```

出力:

```
This happens first
And this happens inbetween
This happens last
```

変数の寿命でスコープを抜けたことを検知するので、必ず変数に格納しなければならないのがちょっとした罠です。
後の処理で一切使ってないんですけどね。

また `guard { ... }` は try-catch のときと同じようにブロックに見せかけた無名関数なので、
`caller` 関数の値が変わるという罠に注意です。

### Syntax::Keyword::Defer モジュール

キーワードプラグインの[Syntax::Keyword::Defer モジュール](https://metacpan.org/pod/Syntax::Keyword::Defer) です。

```perl
use strict;
use warnings;
use feature 'say';
use Syntax::Keyword::Defer;
 
{
    say "This happens first";
    defer { say "This happens last"; }
 
    say "And this happens inbetween";
}

1;
```

Perl 5.35.4 から利用可能になった defer 構文と使い方はほぼ一緒です。
try-catch と同様に、古いPerlでは`Syntax::Keyword::Defer` モジュールにフォールバックする [Feature::Compat::Defer](https://metacpan.org/pod/Feature::Compat::Defer) があります。

## Go との違い

僕の知る限り、組み込みで `defer` に対応しているのは Go 言語があります。
Perl と Go では defer の実行タイミングが違うので要注意です。
(どちらかというと Go のほうが間違えやすい気がする)

Perl の defer はスコープを抜けるときに実行されます。

```perl
use strict;
use warnings;
use feature 'say';
use feature 'defer';
no warnings 'experimental::defer';

sub do_something {
    {
        defer { say "Hello, 世界"; }
    
        say "スコープを抜けた直後に実行される";
    }
    say "関数の最後ではない";
}

do_something();

1;
```

実行結果:

```
スコープを抜けた直後に実行される
Hello, 世界
関数の最後ではない
```

一方 Go は関数を抜けるときに実行されます。

```go
package main

import "fmt"

func do_something() {
	{
		defer fmt.Println("Hello, 世界")
		fmt.Println("スコープを抜けた直後ではなく")
	}
	fmt.Println("関数を抜けた直後に実行される")
}

func main() {
	do_something()
}
```

実行結果:

```
スコープを抜けた直後ではなく
関数を抜けた直後に実行される
Hello, 世界
```

また変数の扱いも違います。
Perl では `defer` ブロック内で使っている変数を、
`defer` の後で書き換えるとその変更は `defer` の実行時に反映されます。

```perl
use strict;
use warnings;
use feature 'say';
use feature 'defer';
no warnings 'experimental::defer';

sub do_something {
    my $hello = "世界";
    defer { say "Hello, $hello"; }
    $hello = "chooblarin";
}

do_something();

1;
```

実行結果:

```
Hello, chooblarin
```

一方 Go では `defer` で使っている変数を後から書き換えても、 `defer` 実行時には反映されません。
これも Go の挙動が罠っぽい。

```go
package main

import "fmt"

func do_something() {
	hello := "世界"
	defer fmt.Println("Hello,", hello)
	hello = "chooblarin"
}

func main() {
	do_something()
}
```

実行結果:

```
Hello, 世界
```

## まとめ

- 次のリリース Perl 5.36.0 から `defer` が使えるよ
- 開発版で良ければ Perl 5.35.4 から使えるよ

-----

明日11日は hogehoge で「fugafuga」です。お楽しみに！ # TODO: 後で埋める

## 参考

- [defer BLOCK](https://metacpan.org/release/WOLFSAGE/perl-5.35.4/view/pod/perldelta.pod#defer-blocks)
- [Scope::Guard](https://metacpan.org/pod/Scope::Guard)
- [Syntax::Keyword::Defer](https://metacpan.org/pod/Syntax::Keyword::Defer)
- [Feature::Compat::Defer](https://metacpan.org/pod/Feature::Compat::Defer)
