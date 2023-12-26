---
layout: post
title: "5.36以降でのサブルーチンプロトタイプを復習する"
slug: 2023-12-24-perl-prototype
date: 2023-12-24 22:13:00 +0900
comments: true
categories: [perl]
---

この記事は、[Perl Advent Calendar 2023](https://qiita.com/advent-calendar/2023/perl) 21日目の記事（代打）です。
20日目は[@doikoji](https://qiita.com/doikoji)で「[低レベルperlスクリプトのススメ（その２）](https://qiita.com/doikoji/items/c80a18dfefb96abc864b)」でした。

-----

いよいよネタが尽きて途方にくれているいっちーです。
ネタも尽きてn番煎じな気はしますが、サブルーチンプロトタイプの書き方について復習です。

## プロトタイプ

サブルーチンプロトタイプとは一言でいうと、引数パーサーの挙動をカスタマイズする仕組みです。
たとえば、Perlの組み込み関数 `push` は第一引数の配列に要素を追加する関数ですが、
これと同じものを普通は定義できません。

```perl
sub my_push {
    # TODO: 中身を実装する
}

my @hoge = (1, 2);
my_push @hoge, 3, 4, 5;
# my_push 1, 2, 3, 4, 5; と配列が展開されてしまって、 `@hoge` にはアクセスできない
```

「[Perlのサブルーチンプロトタイプについて](https://songmu.jp/riji/archives/2009/03/perl_1.html)」から自作pushの例を引用します。

```perl
sub my_push(\@@){
  my ($arr_ref, @arr) = @_;
  for(@arr){
    $$arr_ref[$#$arr_ref+1] = $_;
  }
}
```

```perl
my @hoge = (1, 2);
my_push @hoge, 3, 4, 5;
# my_push \@hoge, 3, 4, 5; と解釈される
```

## Perl 5.36からの変更点

Perl 5.36から v5.36 feature bundle で 'signatures'-featureが有効化されるようになりました。
待望のサブルーチンへの引数リスト導入です！

```perl
use v5.36;

sub foo ($left, $right) {
    return $left + $right;
}
```

これ自体は歓迎すべきことですが、旧来のプロトタイプ宣言の方法と文法が衝突しています。
そのためプロトタイプには新しい宣言方法が導入されました。
さきほどの `my_push` は以下のようになります。

```perl
use v5.36;

sub my_push :prototype(\@@) ($arr_ref, @arr) {
  for(@arr){
    $$arr_ref[$#$arr_ref+1] = $_;
  }
}
```


## まとめ

力尽きたのでここまで・・・サブルーチンプロトタイプでできることは参考文献を参照してください。

Perl 5.36 から引数リストの書き方が変わりました。
それに合わせてプロトタイプの書き方も変わっています。
新しい方法にも慣れていきましょう！

-----

明日22日目は[@shogo82148](https://twitter.com/shogo82148)で「[PerlのHTTP::Tinyがv0.083からデフォルトでTLSの証明書を検証するようになった件](https://shogo82148.github.io/blog/2023/12/27/2023-12-27-perl-http-tiny-now-verify-tls/)」です。
お楽しみに！

## 参考

- [perlsub - perldoc.perl.org](https://perldoc.perl.org/perlsub#Prototypes)
- [[Perl] サブルーチンプロトタイプとデフォルト変数で遊ぶ](https://qiita.com/tani-ro-hei/items/b6714fc04138b0e98d3b)
- [Perlのサブルーチンプロトタイプについて](https://songmu.jp/riji/archives/2009/03/perl_1.html)
