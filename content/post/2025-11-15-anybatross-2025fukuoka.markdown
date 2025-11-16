---
layout: post
title: "コードゴルフコンテスト Anybatross YAPC::Fukuoka 2025 に参加した"
slug: anybatross-2025fukuoka
date: 2025-11-15 17:16:00 +0900
comments: true
categories: [perl]
---

YAPC::Fukuoka 2025 の余興で[コードゴルフ](https://ja.wikipedia.org/wiki/%E3%82%B3%E3%83%BC%E3%83%89%E3%82%B4%E3%83%AB%E3%83%95)コンテストが開催されました。

- [コードゴルフコンテスト Anybatross YAPC::Fukuoka 2025 開催のお知らせ](https://techblog.kayac.com/anybatross-yapc2025fukuoka)
- [~~Perl~~Anybatross YAPC::Fukuoka 2025](https://perlbatross.kayac.com/contest/2025fukuoka)

コードゴルフとは、与えられた仕様に対してできる限り短いソースコードで解答するというゲームです。
なんだか面白そうなのでチャレンジしてみました。

## Hole 1

> アルファベットのAやBにあるような、文字の中にある閉じた空間のことをカウンターといいます。
>
> 0〜9までの10種と、アルファベット大文字のA〜Zの26種、合計36種の文字やその他の記号を利用した文字列が渡されるので、カウンターの数を数えてください。アルファベット小文字は来ません。その他の記号のカウンターは数えなくてよいです。
>
> 1行ずつ数えて、その行までの累積個数と、その行での出現個数を出力してください。
>
> - https://perlbatross.kayac.com/contest/2025fukuoka/challenge/1/sample

サンプルのコードが提供されているので、まずはここから始めていきましょう。

> [Score: +1065](https://perlbatross.kayac.com/contest/2025fukuoka/challenge/1/01K9P8RR8BP9WVVXVFMAS6D554)

```perl
use v5.40;
use utf8;

our $COUNTER_MAP = {
    '0' => 1,
    '1' => 0,
    '2' => 0,
    '3' => 0,
    '4' => 1,
    '5' => 0,
    '6' => 1,
    '7' => 0,
    '8' => 2,
    '9' => 1,
    'A' => 1,
    'B' => 2,
    'C' => 0,
    'D' => 1,
    'E' => 0,
    'F' => 0,
    'G' => 0,
    'H' => 0,
    'I' => 0,
    'J' => 0,
    'K' => 0,
    'L' => 0,
    'M' => 0,
    'N' => 0,
    'O' => 1,
    'P' => 1,
    'Q' => 1,
    'R' => 1,
    'S' => 0,
    'T' => 0,
    'U' => 0,
    'V' => 0,
    'W' => 0,
    'X' => 0,
    'Y' => 0,
    'Z' => 0,
};

my $input = do { local $/; <STDIN> };
my @lines = split /\n/, $input;

my @results;
my $accumulated_count = 0;
# 行ごとに処理する
for my $line_num (0..scalar(@lines)-1) {
    # 1行を1文字ずつ分割
    my @chars = split //, $lines[$line_num];

    # 1文字ずつカウンターの数を合計
    my $total_count = 0;
    for my $char (@chars) {
        $total_count += $COUNTER_MAP->{$char} // 0;
    }

    $accumulated_count += $total_count;
    push @results, $accumulated_count . ',' . $total_count;
}

for my $result (@results) {
    print $result;
    # 1行ごとに改行
    print "\n";
}
```

ここから全体の構成をなるべく変えないように少しずつ削っていきます。

- 変数名に一文字変数名を採用する。
- 一度しか代入していない変数は削る。
- `$COUNTER_MAP` の0の要素は不要なので削る。
- 特殊変数 `$_` を使う。

すると以下のようになります。
（読みやすいよう改行だけ補いました）

> [Score: +7](https://perlbatross.kayac.com/contest/2025fukuoka/challenge/1/01K9PF27B9NSWBCAQRWM8VKJYC)

```perl
%M=(split//,'0141618291A1B2D1O1P1Q1R1');
$a=0;
for(<>){
  $b=0;
  $b+=$M{$_}//0 for(split//);
  $a+=$b;
  print"$a,$b\n"
}
```

- よくよく見てみると`$COUNTER_MAP`も一度しか使われていません。変数に代入するのはムダなので削ります。
- `undef` は数値コンテキストでは0と評価されるので `$b+=$M{$_}//0` の `//0` は不要です。

> [Score: -2](https://perlbatross.kayac.com/contest/2025fukuoka/challenge/1/01K9PHV59PP1ZTB0FDPR4H0PXX)

```perl
$a=0;
for(<>){
  $b=0;
  $b+={split//,'0141618291A1B2D1O1P1Q1R1'}->{$_}for split//;
  $a+=$b;
  print"$a,$b\n"
}
```

ここまでとりあえずパーは達成です。
もう数バイトであれば削れそうですが、今のままのアルゴリズムでは限界が見えてきました。

そこでちょっと見かたを変えてみます。
`split`して一文字ごとにカウントしてきましたが、最終的に必要なのはカウンターの合計です。
合計を算出するだけなら各文字の出現回数が分かれば十分です。
[Perlで文字列の出現回数を調べる](https://shogo82148.github.io/blog/2015/04/09/count-substrings-in-perl/) で登場した[画像検索してはいけない演算子](https://metacpan.org/dist/perlsecret/view/lib/perlsecret.pod#Goatse)を使えば一発ですね。

> [Score: -43](https://perlbatross.kayac.com/contest/2025fukuoka/challenge/1/01K9Q0501KN0QQJZ3V91N9NND7)

```perl
$a+=$b=()=(/[04689ABDO-R]/g,/[8B]/g),print"$a,$b\n"for<>;
```

だいぶ短くなりましたが、リストコンテキストとスカラーコンテキストを行き来する分、
若干ムダが多いように見えます。

「スカラーコンテキストで評価したら出現回数を返してくれる便利な演算子ないかな」とperldocを彷徨っていたところ `s///` 演算子に行き着きました。
`s///` は置換を行う際に使う演算子ですが、評価結果として置換した回数を返します。

> [Score: -45](https://perlbatross.kayac.com/contest/2025fukuoka/challenge/1/01K9W2XYF6SFA9SPJZY1SMTWWA)

```perl
print$a+=$b=s/[8B]/0/g+s/[04689ABDO-R]//g,",$b\n"for<>
```

さらに perldoc を彷徨って、`y///` 演算子を使うと同等の処理をもっと短く書けることに気が付きました。

> [Score: -54](https://perlbatross.kayac.com/contest/2025fukuoka/challenge/1/01K9XV7DDMEXM2MBXZS1SARJKS)

```perl
print$a+=$b=y/8B/0/+y/0469ADO-R//,",$b\n"for<>
```

[yamamoto さんの解答](https://perlbatross.kayac.com/contest/2025fukuoka/challenge/1/01K9WZ30XVCANH9CZPD7A8VESR) を見て気がついたのですが、 `""` の中に直接改行って書けるんですね。`\n` を改行に置き換えて -1 バイトです。

> [Score: -55](https://perlbatross.kayac.com/contest/2025fukuoka/challenge/1/01K9XVJQPG4JBAZAKRSNAFNN8Y)

```perl
print$a+=$b=y/8B/0/+y/0469ADO-R//,",$b
"for<>
```


## Hole 2

> アルファベット小文字と半角スペースを用いて分かち書きされたテキストが標準入力で与えられます。このテキストを以下のルールに従って圧縮してください。

Hole 2もまずはサンプルコードを通してランキングに載るところからスタートです。

> [Score: +2798](https://perlbatross.kayac.com/contest/2025fukuoka/challenge/2/01K9P8TVGJ3M0BQBAM0X0EQXCR)

```perl
use v5.40;
use utf8;
use Encode qw/encode_utf8 decode_utf8/;

# 標準入力のすべての行を最後まで取り込み
my $input = do { local $/; <STDIN> };
# 辞書出力用変数
my %dict = ();
# 末尾改行を削除
chomp $input;
# utf8の内部形式に変換 文字単位での分割をutf8の基準で行うため
$input = decode_utf8($input);
while (true) {
    # 空白区切りの単語単位で分割
    my @words = split / /, $input;

    my @bigrams;
    # 単語ごとに処理
    for my $word (@words) {
        # bigramを作成
        my @chars = split //, $word;
        for my $i (0...scalar(@chars) - 2) {
            push @bigrams, $chars[$i] . $chars[$i + 1];
        }
    }
    # bigramの出現頻度を計算
    # 出現する順番も保持する
    my %bigram_freq;
    my %bigram_order;
    for my $bigram (@bigrams) {
        $bigram_freq{$bigram} = ($bigram_freq{$bigram} // 0) + 1;
        if (!exists $bigram_order{$bigram}) {
            my $current_order_size = scalar(keys %bigram_order);
            $bigram_order{$bigram} = $current_order_size;
        }
    }
    # 最も大きい出現頻度を持つbigramを探す
    # 頻度が同じ場合は出現順で比較
    my $max_bigram;
    for my ($bigram, $freq) (%bigram_freq) {
        if (!defined $max_bigram) {
            $max_bigram = $bigram;
            next;
        }
        if ($freq > $bigram_freq{$max_bigram}) {
            $max_bigram = $bigram;
            next;
        }
        if ($freq < $bigram_freq{$max_bigram}) {
            next;
        }
        if ($bigram_order{$bigram} < $bigram_order{$max_bigram}) {
            $max_bigram = $bigram;
        }
    }
    if ($bigram_freq{$max_bigram} < 2) {
        last;
    }

    # 現在の辞書のサイズから置き換え用文字を決定
    my $dict_size = scalar(keys %dict);
    my $replacement = chr(0x41 + $dict_size); # 'A'のコードポイントは0x41
    $dict{$replacement} = $max_bigram;

    my $next_input = "";
    # 単語ごとに置き換える
    for my $i (0...scalar(@words) - 1) {
        my $word = $words[$i];
        my @chars = split //, $word;
        my $skipped = false;
        for my $i (0...scalar(@chars) - 1) {
            if ($skipped) {
                $skipped = false;
                next;
            }
            if ($i == scalar(@chars) - 1) {
                $next_input = $next_input . $chars[$i];
                next;
            }
            my $bigram = $chars[$i] . $chars[$i + 1];
            if ($bigram eq $max_bigram) {
                $next_input = $next_input . $replacement;
                $skipped = true;
                next;
            }
            $next_input = $next_input . $chars[$i];
        }
        if ($i < scalar(@words) - 1) {
            $next_input = $next_input . " ";
        }
    }
    $input = $next_input;
}

my @keys = sort keys %dict;
my @entries = map { "$_:$dict{$_}" } @keys;
my $dictionary_line = join(',', @entries);
say encode_utf8($dictionary_line);
say encode_utf8($input);
```

Hole 1 と同様にコードを整理していくと次のようになりました。

> [Score: +297](https://perlbatross.kayac.com/contest/2025fukuoka/challenge/2/01K9PX2XWTPN8ZSF628ZYTHTHE)

```perl
use Encode qw/encode_utf8 decode_utf8/;

%d=();
chomp($i=do{local$/;decode_utf8<STDIN>});
$a='A';
for(;;) {
    my(%f,%o);
    for(split/ /, $i) {
        @c = split //, $_;
        for(0...@c-2) {
            $b=$c[$_].$c[$_+1];
            $f{$b}++;
            $o{$b}//=keys%o;
        }
    }
    my $m;
    for my ($b, $f) (%f) {
        $m=$b if (!$m||$f>$f{$m}||($f==$f{$m}&&$o{$b}<$o{$m}))
    }
    last if ($f{$m} < 2);
    $d{$a} = $m;
    $i =~ s/$m/$a/g;
    $a++
}

print encode_utf8(join(',',map{"$_:$d{$_}"}sort keys%d)."\n$i\n");
```

わざわざサンプルに `encode_utf8` `decode_utf8` とつけているので、「きっとこれには意味があるのだろう」と思ってそのままにしておいたのですが、思い切って削除してみると見事AC！

> [Score: +37](https://perlbatross.kayac.com/contest/2025fukuoka/challenge/2/01K9VWZEPRGMGY965VGS3342W9)

```perl
chomp($i=<>);
$a='A';
for(;;){
  %f=%o=();
  for(split/ /,$i){
    @c=/./g;
    for(0...@c-2){
      $b=$c[$_].$c[$_+1];
      $f{$b}++;
      $o{$b}//=keys%o
    }
  }

  for my($b,$f)(%f){
    $m=$b if(!$m||$f>$f{$m}||$f==$f{$m}&&$o{$b}<$o{$m})
  }
  last if($f{$m}<2);
  
  $i=~s/$m/$a/g;
  $d{$a++}=$m
}
print join(',',map{"$_:$d{$_}"}sort keys%d)."\n$i\n"
```

改めて問題文をよく見直してみると「アルファベット小文字と半角スペース」と明記してありましたね。「問題文をよく見ろ」という話です。

さてさてここからどうするか・・・ちょっと行き詰まってしまったので、ChatGPT に以下のように聞いてみました。

> あなたはコードゴルフのプロです。以下のPerlのコードを出力結果を変えないよう、短く書いてください
>
> 具体的にどのように処理を書き換えたのか説明してください

返ってきたコードは残念ながら動かないものでしたが、`while(/(?=(..))/g)` という見慣れない記法を使っていて、ナンダコレハとなりました。
perldocを参照すると「ゼロ幅の肯定先読み表明」と呼ぶらしいです。
これを参考に書き換えたのがこちら。

> [Score: -36](https://perlbatross.kayac.com/contest/2025fukuoka/challenge/2/01K9W1FNX1JSRB49ZZGJZ3KPGS)
```perl
chomp($i=do{local$/;<>});

$a='A';
for(;;){
  %f=@e=();
  for(split/ /,$i){
    while(/(?=(..))/g){
      $f{$1}++;
      push@e,$1
    }
  }
  for(@e){
    $m=$_ if$f{$_}>$f{$m}
  }
  last if($f{$m}<2);
  $i=~s/$m/$a/g;
  push@d,"$a:$m";
  $a++
}

print join(',',@d)."\n$i\n"
```

> [Score: -110](https://perlbatross.kayac.com/contest/2025fukuoka/challenge/2/01KA5CRMD6987TVS22V4JF7649)

```perl
$_=<>;
for($a=A;;$a++){
  my%f;
  $f{$_}++for@e=/(?=(\S\S))/g;
  ($m)=sort{$f{$b}-$f{$a}}@e;
  $f{$m}<2?last:s/$m/$a/g;
  push@d,"$a:$m"
}
$"=',';print"@d
$_"
```
