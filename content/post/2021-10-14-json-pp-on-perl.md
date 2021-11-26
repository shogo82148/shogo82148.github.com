---
layout: post
title: "Perl の JSON::PP での数値の扱いが変わっていた件"
slug: json-pp-on-perl
date: 2021-10-14 20:58:00 +0900
comments: true
categories: [perl]
---

[Setup Perl environment](https://github.com/marketplace/actions/setup-perl-environment) の開発中は、
いろんなバージョンのPerlをビルドして、いろんなバージョンのPerlでコードを実行します。
そんな中でPerlのコアモジュールのひとつである [JSON::PP](https://metacpan.org/pod/JSON::PP) の挙動が変わっていることに気が付きました。
なんでだろう？とずっと気になったまま放置してたんですが、ちょっと調べてみました。

## JSON::PP の挙動の変化

Perl 5.26 と Perl 5.28 で以下のコードを実行してみます。

```perl
use feature say;
use JSON::PP qw/encode_json/;

my $answer = 42;

say encode_json({ answer => $answer });

say "Answer to the Ultimate Question of Life, the Universe, and Everything: $answer";

say encode_json({ answer => $answer });
```

Perl 5.26 で実行した場合: \[Wandbox\]三へ( へ՞ਊ ՞)へ ﾊｯﾊｯ https://wandbox.org/permlink/tEJxPrlX8oaMbj6o

```
{"answer":42}
Answer to the Ultimate Question of Life, the Universe, and Everything: 42
{"answer":"42"}
```

Perl 5.28 で実行した場合: \[Wandbox\]三へ( へ՞ਊ ՞)へ ﾊｯﾊｯ https://wandbox.org/permlink/qs2SQBwuQR6K8Jd4

```
{"answer":42}
Answer to the Ultimate Question of Life, the Universe, and Everything: 42
{"answer":42}
```

出力結果の3行目にご注目ください。Perl 5.26 で実行した場合は `"42"` となっていたのが、Perl 5.28 では `42` になっています。
何が変わったのか、変更点を調べてみました。

結論だけ簡単に書いておくと Perl 5.28 以降を使う場合であっても **この挙動を前提としたコードは書かないほうがいいです**。

## そもそもなんで `"42"` になってたの

### 数値コンテキスト・文字列コンテキストの話

Perl に馴染みの無い方はそもそもさっきのコードで `"42"` が出力されたことに疑問を持つのでは無いでしょうか？
`$answer` に代入をしているのは `my $answer = 42;` の行だけなので、 `$answer` の中身は変わりようが無いですよね？

これにはPerlにおける「コンテキスト」という概念が深く絡んできます。
詳しい解説は僕の手に余るので、詳しく知りたい方は「[Perlの勘所をマスターしよう! コンテキストとリファレンスを我が物に!](https://www.slideshare.net/KondoYoshiyuki/yapc2012-20120929)」を参考にしてください。

概要だけ説明しておくと、Perl は前後の文脈によって変数を「数値として扱う」のか「文字列として扱う」のかが決まります。
例えば以下のコードで、最初の `$answer` は数値加算の文脈で使われているので数値として扱われます。
二番目の `$answer` は文字列連結の文脈で使われているので文字列として扱われます。

```perl
# $answer を数値として扱う
say $answer + 1;

# $answer を文字列として扱う
say "The answer is $answer";
```

### SV のアップグレード

このように同じ変数でも文脈によって数値として扱われたり文字列として扱われたりするのですが、
毎回毎回数値と文字列の変換を行うのは性能的に不利です。
そこでPerlは気を利かせて変換結果をキャッシュしてくれます。
これは以下のようなコードで確認できます。

```perl
use feature say;
use Devel::Peek;

my $answer = 42;

Dump $answer;

say "Answer to the Ultimate Question of Life, the Universe, and Everything: $answer";

Dump $answer;
```

```
SV = IV(0x7f9b81817420) at 0x7f9b81817430
  REFCNT = 1
  FLAGS = (IOK,pIOK)
  IV = 42
Answer to the Ultimate Question of Life, the Universe, and Everything: 42
SV = PVIV(0x7f9b81817e20) at 0x7f9b81817430
  REFCNT = 1
  FLAGS = (IOK,POK,pIOK,pPOK)
  IV = 42
  PV = 0x7f9b80d0f760 "42"\0
  CUR = 2
  LEN = 10
```

これを **SVのアップグレード** と言います。
これについても僕が説明するよりちゃんとした解説があるので、出力の具体的な意味を知りたい方はこちらをどうぞ。

- [Perl Hackers Hub 第16回　Perl内部構造の深遠に迫る（1）](https://gihyo.jp/dev/serial/01/perl-hackers-hub/001601)

このSVのアップグレードは文字列を数値として扱った場合にも発生します。
そして厄介なのが一度SVのアップグレードが起きると、**アップグレード前の型がわからなくなる** ということです。
元が数値だったか文字列だったか判断がつかないので、Perl 5.26 以前は一律文字列としてエンコードするようになってます。

## Perl 5.28 での変更

[JSON::PPのドキュメント](https://metacpan.org/pod/JSON::PP#simple-scalars) にしっかり書いてありました。

> Since version 2.91_01, JSON::PP uses a different number detection logic that converts a scalar that is possible to turn into a number safely. The new logic is slightly faster, and tends to help people who use older perl or who want to encode complicated data structure. However, this may results in a different JSON text from the one JSON::XS encodes (and thus may break tests that compare entire JSON texts). If you do need the previous behavior for compatibility or for finer control, set PERL_JSON_PP_USE_B environmental variable to true before you use JSON::PP (or JSON.pm).

日本語訳 (Powered by DeepL)

> バージョン2.91_01以降、JSON::PPは、数値に変えることが可能なスカラを安全に変換する、異なる数値検出ロジックを使用しています。この新しいロジックはわずかに高速で、古いPerlを使っている人や複雑なデータ構造をエンコードしたい人には役立つ傾向があります。しかし、この方法では、JSON::XS がエンコードするものとは異なる JSON テキストになる可能性があります（したがって、JSON テキスト全体を比較するテストが壊れる可能性があります）。互換性や細かい制御のために以前の動作が必要な場合は、JSON::PP（またはJSON.pm）を使用する前に、環境変数PERL_JSON_PP_USE_Bをtrueに設定してください。

[corelist](https://metacpan.org/dist/Module-CoreList/view/corelist) で調べてみると、Perl 5.28 で同梱されている JSON::PP のバージョンが v2.27300 → v2.97001 に上がったようです。
そのため違いが生まれたんですね。

## JSON::PP と JSON::XS の比較

さてここで気になるのは以下の記述。

> しかし、この方法では、JSON::XS がエンコードするものとは異なる JSON テキストになる可能性があります

どうやら挙動が変更になったのは JSON::PP (JSONエンコーダー/デコーダーの Pure Perl 実装) だけで、
JSON::XS (JSONエンコーダー/デコーダーのC言語実装) は変わっていないようです。

### 数値からアップグレードした値のエンコード

実際に比較してみましょう。
記事の最初に書いた例を JSON::PP と JSON::XS で試してみます。

```perl
use feature say;
use JSON::XS ();
use JSON::PP ();

my $answer = 42;

say "JSON::PP: ", JSON::PP::encode_json({ answer => $answer });
say "JSON::XS: ", JSON::XS::encode_json({ answer => $answer });

say "Answer to the Ultimate Question of Life, the Universe, and Everything: $answer";

say "JSON::PP: ", JSON::PP::encode_json({ answer => $answer });
say "JSON::XS: ", JSON::XS::encode_json({ answer => $answer });
```

```
JSON::PP: {"answer":42}
JSON::XS: {"answer":42}
Answer to the Ultimate Question of Life, the Universe, and Everything: 42
JSON::PP: {"answer":42}
JSON::XS: {"answer":"42"}
```

JSON::XS は文字列に変わってしまいました。

### 文字列からアップグレードした値のエンコード

ここまでの結果だけ見ると、元の型に正しく変換している `JSON::PP` のほうが優れているような気がしてきます。
しかし、元の型を誤って判定してしまう場合もあります。
SVのアップグレードが起こったあとでは Perl の内部表現上全く違いはなく、
元の型を知ることは不可能なので仕方ないことです。

例えば以下の例では、元は文字列だったのに `JSON::PP` は数値に変換してしまいました。

```perl
use feature say;
use JSON::XS ();
use JSON::PP ();

my $answer = "42";

say "JSON::PP: ", JSON::PP::encode_json({ answer => $answer });
say "JSON::XS: ", JSON::XS::encode_json({ answer => $answer });

# 0 と加算しているので $answer は数値として扱われる
say "Answer to the Ultimate Question of Life, the Universe, and Everything ", 0+$answer;

say "JSON::PP: ", JSON::PP::encode_json({ answer => $answer });
say "JSON::XS: ", JSON::XS::encode_json({ answer => $answer });
```

```
JSON::PP: {"answer":"42"}
JSON::XS: {"answer":"42"}
Answer to the Ultimate Question of Life, the Universe, and Everything 42
JSON::PP: {"answer":42}
JSON::XS: {"answer":"42"}
```

## 実装を追ってみる

実装を追ってみると以下の部分で型の判定を行っています。(JSON::PP v4.06)

https://github.com/makamaka/JSON-PP/blob/3173bc24b4089b34a33da3d30e4e8ceb9fb48b36/lib/JSON/PP.pm#L457-L467

```perl
no warnings 'numeric';
# if the utf8 flag is on, it almost certainly started as a string
return if utf8::is_utf8($value);
# detect numbers
# string & "" -> ""
# number & "" -> 0 (with warning)
# nan and inf can detect as numbers, so check with * 0
return unless length((my $dummy = "") & $value);
return unless 0 + $value eq $value;
return 1 if $value * 0 == 0;
return -1; # inf/nan
```

なにかたくさん条件がありますね。
一個ずつ見ていきましょう。

### utf8 フラグのチェック

utf8 フラグは値が utf8 でエンコードされていることを表すフラグです。

```perl
# if the utf8 flag is on, it almost certainly started as a string
return if utf8::is_utf8($value);
```

utf8 フラグが立っていればテキスト文字列として扱われているということなので、そのまま JSON の文字列として扱います。

- [「UTF8 フラグ」って何? perlunifaq - Perl Unicode FAQ](https://perldoc.jp/docs/perl/5.34.0/perlunifaq.pod#What32is32the32UTF832flag63)

### ビット演算子を使った判定

Perl はほとんどの演算子に「文字列用」と「数値用」が用意されています。
例えば文字列の等価性を調べたければ `eq`、数値の等価性を調べたければ `==` といった具合です。
これらの演算子は `eq` なら両辺を文字列に、`==` であれば両辺を数値に変換してから比較を行います。

しかしビット演算子 `&`, `|`, `^` だけは文字列と数値で同じ演算子を使います。
そのためコメントに記載されているように、型に応じて結果が変わります。

```perl
# detect numbers
# string & "" -> ""
# number & "" -> 0 (with warning)
return unless length((my $dummy = "") & $value);
```

一度も数値として扱われたことが無い場合はJSONの文字列として扱います。

ビット演算子だけ「文字列用」と「数値用」に分かれていないのは変だろうということで、
新し目の Perl では文字列用のビット演算子として `&.`, `|.`, `^.` が使えます。
これらの演算子は互換性維持のためデフォルトでは無効になっているので、明示的な有効化が必要です。

- [bitwise - ビット演算子を数値専用と文字列専用に分ける](https://qiita.com/xtetsuji/items/a21c718ca37799d11c7c#bitwise---%E3%83%93%E3%83%83%E3%83%88%E6%BC%94%E7%AE%97%E5%AD%90%E3%82%92%E6%95%B0%E5%80%A4%E5%B0%82%E7%94%A8%E3%81%A8%E6%96%87%E5%AD%97%E5%88%97%E5%B0%82%E7%94%A8%E3%81%AB%E5%88%86%E3%81%91%E3%82%8B)
- [perlop Bitwise String Operators](https://perldoc.perl.org/perlop#Bitwise-String-Operators)

### 文字列比較

```perl
return unless 0 + $value eq $value;
```

ちょっと慣れないと分かりづらいですが `0 + $value` は 「`$value` を数値に変換する」というイディオムです。
また `eq` は両辺を文字列に変換してから比較を行う演算子です。
この行全体としては「`$value`を一度数値に変換してから、もう一度文字列に戻してみてもとに戻るか」を確かめているわけです。

### NaN, Inf のチェック

```perl
# nan and inf can detect as numbers, so check with * 0
return 1 if $value * 0 == 0;
return -1; # inf/nan
```

数学的には `$value` に何が入っていようと 0 をかけたら 0 になるわけですが、
浮動小数点数の場合には例外があります。
それが `Inf` と `NaN` です。 `Inf * 0 = NaN`、 `NaN * 0 = NaN` になります。

ただよくわからないのは、チェックは入っているのにも関わらず、特に `Inf` `NaN` を特別扱いしてないんですよね。
`Inf` と `NaN` はそのまま `Inf` と `NaN` として出力されます。JSONとしては不正な表現です。

## 数値の0と等しいのに数値になったり文字列になるケース

この実装をよく読んでみたら「数値の0と等しいのに数値になったり文字列になるケース」があるということに気が付きました。

```perl
use feature say;
use JSON::XS ();
use JSON::PP ();

sub encode {
    my $answer = shift;

    say "JSON::PP: ", JSON::PP::encode_json({ answer => $answer });
    say "JSON::XS: ", JSON::XS::encode_json({ answer => $answer });

    if ($answer == 0) {
        say "answer is 0."
    }

    say "JSON::PP: ", JSON::PP::encode_json({ answer => $answer });
    say "JSON::XS: ", JSON::XS::encode_json({ answer => $answer });
}

say 'encode "0"';
encode "0";
say '';

say 'encode "0e0"';
encode "0e0";
```

```
encode "0"
JSON::PP: {"answer":"0"}
JSON::XS: {"answer":"0"}
answer is 0.
JSON::PP: {"answer":0}
JSON::XS: {"answer":"0"}

encode "0e0"
JSON::PP: {"answer":"0e0"}
JSON::XS: {"answer":"0e0"}
answer is 0.
JSON::PP: {"answer":"0e0"}
JSON::XS: {"answer":"0e0"}
```

`0e0`は0の指数表記、つまり「0かける10のゼロ乗」です。
`JSON::PP` は数値として扱えるものをすべて数値に変換するわけではなく、こんなふうな例外もあります。

しかもこの例外、Perl界での超有名モジュールで使われているという・・・。

- [Why does DBI's do method return "0E0" if zero rows were affected?](https://stackoverflow.com/questions/13358793/why-does-dbis-do-method-return-0e0-if-zero-rows-were-affected)

## まとめ

- Perl 5.28 以降に同梱されている `JSON::PP` は、それより前のバージョンと数値のエンコード方法が変わっている
- この変更により `JSON::XS` と結果が一致しない場合がある

気が付かない間にJSONエンコード改善された？と思ったのですが、蓋を開けてみると想像以上に闇の深い実装になっていました。

Perlをめったに触ることがなくなった僕が言うのもおこがましいですが、 `JSON::XS` との互換性を壊してまで変更するほどのメリットがあったのかとちょっと疑問です。
(十分初心者泣かせだけど) 内部フラグを元に数値か文字列かを決定する `JSON::XS` のエンコードルールのほうがまだわかりやすい気もします。

そんなわけで、以下のCPANモジュールたちはまだまだ現役のようです。

- [JSON::Types](https://metacpan.org/pod/JSON::Types)
- [Cpanel::JSON::XS::Type](https://metacpan.org/pod/Cpanel::JSON::XS::Type)

JSONにエンコードするときには、これらのモジュールを使って型を明示しましょう。
エンコーダーが古い `JSON::PP` か、新しい `JSON::PP` か、それとも `JSON::XS` か、といった些細なことで悩む必要はなくなります。

## 参考

- [Perlの勘所をマスターしよう! コンテキストとリファレンスを我が物に!](https://www.slideshare.net/KondoYoshiyuki/yapc2012-20120929)
- [Perl Hackers Hub 第16回　Perl内部構造の深遠に迫る（1）](https://gihyo.jp/dev/serial/01/perl-hackers-hub/001601)
- [JSON::PP](https://metacpan.org/pod/JSON::PP)
- [JSON::Types](https://metacpan.org/pod/JSON::Types)
- [Cpanel::JSON::XS::Type](https://metacpan.org/pod/Cpanel::JSON::XS::Type)
- [perlop Bitwise String Operators](https://perldoc.perl.org/perlop#Bitwise-String-Operators)
- [Perl の文法上の新機能が使える feature プラグマ詳解](https://qiita.com/xtetsuji/items/a21c718ca37799d11c7c)
- [「UTF8 フラグ」って何? perlunifaq - Perl Unicode FAQ](https://perldoc.jp/docs/perl/5.34.0/perlunifaq.pod#What32is32the32UTF832flag63)
- [Why does DBI's do method return "0E0" if zero rows were affected?](https://stackoverflow.com/questions/13358793/why-does-dbis-do-method-return-0e0-if-zero-rows-were-affected)
