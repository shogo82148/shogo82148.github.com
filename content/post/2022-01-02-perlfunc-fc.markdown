---
layout: post
title: "Perl の fc で遊んでみる"
slug: perlfunc-fc
date: 2022-01-02 17:23:00 +0900
comments: true
categories: [perl]
---

この記事は、[Perl Advent Calendar 2021](https://qiita.com/advent-calendar/2021/perl) の穴埋め用の予備記事です。
当日まで担当者が決まらない日が何日もあってドキドキしましたが、いやー、なんとか埋まりましたね。
記事を投稿してくださった皆様ありがとうございました。

さて、今年は万が一枠が埋まらなかった場合に備えて下準備をしておきました。

- [Perl 5.34.0 の try-catch を触ってみる](https://shogo82148.github.io/blog/2021/12/09/perl-try-catch/)
- [Perl 5.35.4 の defer を先取り](https://shogo82148.github.io/blog/2021/12/10/perl-defer/)
- [Perl 5.35.5 の iterating over multiple values at a time を先取り](https://shogo82148.github.io/blog/2021/12/11/perl-iterating-over-multiple-values/)
- [Perl の文字列用ビット操作演算子を使ってみる](https://shogo82148.github.io/blog/2021/12/24/perl-bitwise-operator/)

この辺の記事たちですね。
カレンダーが埋まる見込みが立ったので放置していたのですが、実は調査だけしていたネタがひとつ残っています。
2022年のネタにしても良いんですが、どうせその頃には忘れているので今ここで供養してしまいましょう。

-----

というわけで、今回触ってみたのは [`fc` 関数](https://perldoc.perl.org/perlfunc#fc-EXPR) です。

特に断りのない限り 2021-12-24 現在の最新安定版 Perl 5.34.0 で動作確認をしています。

## Case-Folding

[`fc` 関数](https://perldoc.perl.org/perlfunc#fc-EXPR) は Case-Folding を行う関数です。
そもそも Case-Folding って何？って話なんですが、日本語に対応する概念が存在しないので和訳が難しい・・・。
大雑把にいうと **「大文字・小文字の正規化」** をおこなう関数です。

例えばこのブログから "Case-Folding" という文字列を検索したくなったとしましょう。
表記ゆれがあるかもしれないので、大文字と小文字の違いは無視したい、
つまり "case-folding" や "CASE-FOLDING" も対象にしたいということはよくあると思います。

こんなときこそ `fc` 関数の出番です。
`fc` 関数を使うには `feature` プラグマで明示的に有効化が必要です。

```perl
use utf8;
use warnings;
use strict;
use feature qw(say fc);

say fc "Case-Folding";
say fc "case-folding";
say fc "CASE-FOLDING";

1;
```

出力:

```
case-folding
case-folding
case-folding
```

出力の通り `fc` 関数を通した結果はすべて "case-folding" になります。
あとは通常の文字列比較 `eq` 演算子を使って比較すれば、大文字小文字を無視した検索を実現できます。

検索対象に対しては事前に Case-Folding してインデックスを作成しておくことができるので、
そういった場合に役立ちそうです。
実際の検索は単純な文字列比較になるので、検索の高速化が期待できます。

## 大文字化や小文字化と何が違うの？

ここまで読んだ皆さんは疑問に思うことでしょう。
「大文字化・小文字化と何が違うの？そこになんの違いもありゃしねぇだろうが」

**違うのだ!!!**

例えば先の例 "Case-Folding" では 大文字化 (`uc` 関数) や小文字化 (`lc` 関数)でも
「大文字小文字の標準化」という目的は達成できそうです。

```perl
use utf8;
use warnings;
use strict;
use feature qw(say);

say "lc:";
say lc "Case-Folding";
say lc "case-folding";
say lc "CASE-FOLDING";
say "";

say "uc:";
say uc "Case-Folding";
say uc "case-folding";
say uc "CASE-FOLDING";

1;
```

出力:

```
lc:
case-folding
case-folding
case-folding

uc:
CASE-FOLDING
CASE-FOLDING
CASE-FOLDING
```

-----

具体的な例外のひとつが [ß エスツェット](https://ja.wikipedia.org/wiki/%C3%9F) です。
(というか他にあるの？)
Unicode には SHARP S (尖ったS)という名称で登録されています。

- ẞ
  - 符号位置: U+1E9E
  - 名称: LATIN CAPITAL LETTER SHARP S
  - 収録バージョン: Unicode 5.1.0 (March 2008)
- ß:
  - 符号位置: U+00DF
  - 名称: LATIN SMALL LETTER SHARP S
  - 収録バージョン: Unicode 1.1.0 (June, 1993)

大文字と小文字とで収録時期が15年も離れている点が面白いですね。
なぜこんなことになっているかというと、実は **大文字のエスツェットは最近まで文字として認められていなかった** のです。
ドイツ正書法協議会(がどういう役割を担っているのかよく知らないんだけど・・・)が正式に取り入れたのが 2017年のこと。

大文字のエスツェットが使われるようになる前はどうしていたかというと、代用として "SS" を使っていたらしいです。
ただこれには問題があり、例えば "MASSE" という単語があった場合、もとが "Masse"(塊、群衆) だったのか "Maße"(大きさ、範囲) だったのかわかりません。
またややこしいことに、Unicode が普及する前は小文字のエスツェットも使えない環境があったため "Masse" と綴る場合もあったそうです。
詳しくは [Wikipedia を参照](https://ja.wikipedia.org/wiki/%C3%9F#%E5%A4%A7%E6%96%87%E5%AD%97)。

大文字のエスツェットを認めれば "MAẞE" と "MASSE" の区別が付くわけですが、
こんな歴史的な経緯から「"Maße"を大文字小文字を無視して検索したい」といった場合、"MAẞE", "Masse", "MASSE" も対象になります。
嘘だと思う人はお使いのブラウザで "Maße" や "Masse" でこの記事をページ内検索してみてください。
Chrome 96 ではすべてマッチしました。
(Safari は "ss" を検索すると "ß" にマッチするけど、"ß" を検索すると "ss" にはマッチしない・・・よくわからない)

この歴史的経緯のためなのかよく知りませんが、エスツェットの大文字化・小文字化はちょっと奇妙な動作をします。
"Maße" を表すいろんな表記を `lc`, `uc`, `fc` 関数を使って変換するこんなプログラムを書いてみました。

```perl
use utf8;
use warnings;
use strict;
use Encode qw(encode_utf8 decode_utf8);
use feature qw(say);

sub show {
    my ($name, $sub) = @_;
    my @masse = (
        # 小文字のエスツェット (U+00DF LATIN SMALL LETTER SHARP S)
        'Maße',

        # 大文字のエスツェット (U+1E9E LATIN CAPITAL LETTER SHARP S)
        'MAẞE',

        # エスツェットが使えない環境での代用表記
        'Masse',
        'MASSE',
    );
    for my $s (@masse) {
        say encode_utf8 "$name('$s') -> '" . $sub->($s) . "'";
    }
    say "";
}

show('lc', \&CORE::lc);
show('uc', \&CORE::uc);
show('fc', \&CORE::fc);
```

出力:

```
lc('Maße') -> 'maße'
lc('MAẞE') -> 'maße'
lc('Masse') -> 'masse'
lc('MASSE') -> 'masse'

uc('Maße') -> 'MASSE'
uc('MAẞE') -> 'MAẞE'
uc('Masse') -> 'MASSE'
uc('MASSE') -> 'MASSE'

fc('Maße') -> 'masse'
fc('MAẞE') -> 'masse'
fc('Masse') -> 'masse'
fc('MASSE') -> 'masse'
```

注目すべきなのは **`uc('Maße')` が "MAẞE" ではなく "MASSE" になる点** ですね。
`uc('MAẞE')` は "MAẞE" になるので、大文字小文字の標準化には使えません。
`lc('MAẞE')` と `lc('Maße')` は良さそうですが、 "Masse" や "MASSE" とは異なる結果になります。

`fc` 関数であれば "Maße", "MAẞE", "Masse", "MASSE" がすべて "masse" に標準化されるので、
無事「"Maße"を大文字小文字を無視して検索したい」という要件を満たすことができるわけです。

## Go言語では？

こんな記事を書いておいてなんですが、普段 Perl は使わず Go を書くほうが多いんですよね。
そんなわけで Go はどうなるのかな？と試してみたら以下のような結果になりました (go1.17.5)。

```go
package main

import (
	"fmt"
	"regexp"
	"strings"
)

func main() {
	// ぜんぶ true になってほしい
	fmt.Println(strings.EqualFold("Maße", "Masse"))       // false
	fmt.Println(strings.EqualFold("Maße", "MAẞE"))        // true
	fmt.Println(regexp.MatchString("(?i:Maße)", "Masse")) // false <nil>
	fmt.Println(regexp.MatchString("(?i:Maße)", "MAẞE"))  // true <nil>

	// Perl では maße になる
	fmt.Println(strings.ToLower("MAẞE")) // maße

	// Perl では MASSE になる
	fmt.Println(strings.ToUpper("Maße")) // MAßE
}
```

- https://go.dev/play/p/xdNtqksKqxj

前節で説明したように "Maße" を大文字小文字を無視して比較した場合、Unicode の定義では "Masse" にもマッチするので、
`strings.EqualFold("Maße", "Masse")` は `true` になって欲しいところです。
しかし実際には `false` になってしまいました。
`strings.ToUpper("Maße")` の結果も Perl での結果 "MASSE" とは異なります。

これはバグ？意図的な挙動？ドイツ語に詳しい人教えて・・・

## まとめ

`fc` 関数の話をしていたんですが、エスツェットにすべて持っていかれました。
ドイツ語を扱うかもしれないプログラムを書くときは気をつけましょう。

- 大文字小文字を無視して比較した場合 "Maße", "MAẞE", "Masse", "MASSE" はすべて等しい
- Unicode の定義では 小文字のエスツェット "ß" の大文字は "SS", 大文字のエスツェット "ẞ" の小文字は "ß"
- このチャート見ると良いらしいです https://www.unicode.org/charts/case/

## 参考

- [fc EXPR](https://perldoc.perl.org/perlfunc#fc-EXPR)
- [Unicode Case Charts](https://www.unicode.org/charts/case/)
- [ß - Wikipedia](https://ja.wikipedia.org/wiki/%C3%9F)
