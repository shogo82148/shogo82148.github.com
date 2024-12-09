---
layout: post
title: "Perl 5.41から、UTF-8で書かれたソースコードにはuse utf8が必須になります"
slug: perl-requires-use-utf8
date: 2024-12-08 22:37:00 +0900
comments: true
categories: [perl]
---

この記事は、[Perl Advent Calendar 2024](https://qiita.com/advent-calendar/2024/perl) 8日目の記事（代打）です。
7日目は[@MacOlin](https://qiita.com/MacOlin)で「[JSON::PPのdecodeメソッドの速度比較](https://qiita.com/MacOlin/items/9fff42686f6dac5b0f2e)」でした。

-----

Perl 5.41.2（開発版）から [source::encodingプラグマ](https://metacpan.org/release/ETHER/perl-5.41.2/view/lib/source/encoding.pm)が追加されました。
このプラグマの追加により、UTF-8で書かれたソースコードでは `use utf8` が必須になります。

## TL;DR

ソースコードの先頭に `use utf8` って書いておけばOK。

## use utf8の必須化

たとえば以下のコードにはUTF-8の文字列が含まれていますが、 `use utf8` の指定がありません。

```perl
use v5.41;

# こんにちは世界
```

このコードをPerl 5.41.2（開発版）で実行すると以下のようなエラーを吐いて終了します。

```plain
Use of non-ASCII character 0xE3 illegal when 'use source::encoding "ascii"' is in effect at hoge.pl line 3, at end of line
Execution of hoge.pl aborted due to compilation errors.
```

コメントアウトしてあっても日本語は使えないんですね。

正しく実行するには `use utf8` を明示し、ソースコードがUTF-8で書かれていることを示す必要があります。

```perl
use v5.41;
use utf8;

# こんにちは世界
```

これは `use utf8` をうっかり書き忘れることを防ぐための処置だそうです。

- [perldelta - what is new for perl v5.41.2](https://metacpan.org/release/ETHER/perl-5.41.2/view/pod/perldelta.pod)

## source::encodingプラグマ

`use utf8` 必須化の機能のみを制御するには、`source::encoding` プラグマを利用します。

たとえばソースコードがASCIIで書かれていることを示すには以下のように書きます。

```perl
use source::encoding 'ascii';

# You can use only ASCII characters.
```

`use source::encoding 'ascii'` が指定されているソースコードでASCIIコード範囲外の文字を使うとエラーになります。

```perl
use source::encoding 'ascii';

# 日本語はエラーになる！
```

`use v5.41` feature bundle で `use source::encoding 'ascii'` も有効化されるため、
`use v5.41` が使われているソースコード中で日本語を書くとエラーになります。

日本語のようなASCII範囲外の文字を使いたい場合は `use source::encoding 'utf8'` と書いて、UTF-8でエンコードして保存します。

```perl
use source::encoding 'utf8'; # use utf8; と同じ

# ASCII範囲外の文字が含まれていてもエラーにならない
```

`use utf8` は `use source::encoding 'utf8'` のシノニムなので、`use utf8` と書いても同じ効果を得られます。

文字コードとして指定できるのは `ascii` と `utf8` のみです。
他の文字コードには対応していません。

```perl
use source::encoding 'euc-jp'; # Bad argument for source::encoding: 'euc-jp'
```

## まとめ

以前から `use utf8` をつけて、ソースコードがUTF-8であることを明示できましたが、`use utf8` の設定は必須ではありませんでした。
しかし、Perl 5.41.2（開発版）以降、ソースコードがUTF-8であるのにもかかわらず `use utf8` の指定を忘れると、エラーが発生するようになります。
僕らのような日本語話者にとっては重要な変更ですね。

「ここまでの話難しすぎて何言っているかわからない」という人は、「ソースコードの先頭に `use utf8` って書いておけばOK」とだけ覚えておきましょう。
今どきutf-8以外のエンコーディングでソースコードを書く機会なんてないでしょうから（フラグ）。

なお検証に使用したのは開発版のPerlです。安定版では挙動が変わる可能性があります。

> 🐇\
> 新しいプラグマ、嬉しさ満載、\
> Perlが進化し、未来も開け。\
> エンコーディングの光、さあ照らせ、\
> コードが踊り、心も弾む。\
> ようこそ、変化の時よ！\
> 🌟
>
> by [CodeRabbit](https://coderabbit.ai/)

-----

明日9日目はTBDで「TBD」です。 お楽しみに！

## 参考

- [perldelta - what is new for perl v5.41.2](https://metacpan.org/release/ETHER/perl-5.41.2/view/pod/perldelta.pod)
