---
layout: post
title: "Perl v5.38のPERL_RAND_SEED環境変数を先取り！"
slug: 2022-12-25-perl-rand-seed
date: 2022-12-25 20:54:00 +0900
comments: true
categories: [ perl ]
---

[Perl Advent Calendar 2022](https://qiita.com/advent-calendar/2022/perl)無事完走しました！
＼( ‘ω’)／ウオオオオオアアアーーーッ！
参加してくださった皆様ありがとうございました。

じつはAdvent Calendarに穴が空いたときのために、いくつかネタを用意しておきました。
もう穴埋めは必要なくなったので公開してしまいます。

-----

開発版のPerl 5.37.3に乱数のシード値を固定する機能が入りました。
来年公開予定のPerl 5.38.0にも導入されるはずです。

今までも`srand()`の引数に数値を渡せばシード値の固定はできます。
今回入った修正は、これを環境変数経由で行えるようにするものです。
`PERL_RAND_SEED` 環境変数を使います。

## Perlのコンパイル

Perl 5.37.3は開発版なのでビルド済みのバイナリは配布されていません。
plenvを使っていればビルドは簡単です。
開発版の警告を抑制するために -Dusedevelオプションの指定を忘れずに。

## 動作確認

以下のような乱数を10個だけ出力するスクリプトを用意します。

```
use v5.36;

for (1..10) {
    say rand();
}
```

毎回違う結果が返ってきました。

```
% perl random.pl
0.3062362396895
0.674135064563842
0.0578670173801008
0.202610859737383
0.818887900456577
0.806449494310058
0.941361073774114
0.418245360994739
0.213317030100743
0.850036874006719
% perl random.pl
0.177429965538071
0.0390786576058133
0.735923747570393
0.226016785340967
0.00169495133475905
0.0499404466099662
0.842366507879287
0.0750512089990352
0.765357514136131
0.0965085242066834
% perl random.pl
0.458207000353472
0.00957464109839634
0.335823093113628
0.969883105574759
0.789114886557474
0.0210666821658236
0.661220438915134
0.201664277859059
0.707372787166978
0.915844848671213
```

UNIX-LikeなOSでは`/dev/random`の値をシードに使うので、このようにランダムな値が帰ってきます。

次に`PERL_RAND_SEED`環境変数を設定した場合です。

```
% PERL_RAND_SEED=1 perl random.pl
0.0416303447718782
0.454492444728629
0.834817218166915
0.3359860301452
0.565489403566136
0.00176691239174431
0.18758951699996
0.990434079937664
0.750497133229519
0.366273638152734
% PERL_RAND_SEED=1 perl random.pl
0.0416303447718782
0.454492444728629
0.834817218166915
0.3359860301452
0.565489403566136
0.00176691239174431
0.18758951699996
0.990434079937664
0.750497133229519
0.366273638152734
% PERL_RAND_SEED=1 perl random.pl
0.0416303447718782
0.454492444728629
0.834817218166915
0.3359860301452
0.565489403566136
0.00176691239174431
0.18758951699996
0.990434079937664
0.750497133229519
0.366273638152734
```

毎回同じ値が返ってきましたね。

## 注意

[perlrunに以下のような説明](https://metacpan.org/release/NEILB/perl-5.37.3/view/pod/perlrun.pod#PERL_RAND_SEED)があります。

> PERL_RAND_SEED is intended for performance measurements and debugging and is explicitly NOT intended for stable testing. The only guarantee is that a specific perl executable will produce the same results twice in a row, there is no guarantee that the results will be the same between perl releases or on different architectures.

> PERL_RAND_SEED は性能の測定とデバッグを目的としており、安定したテストを行うことは明確に意図していません。特定の perl 実行ファイルが 2 回続けて同じ結果を出すことだけが保証され、 perl のリリース間や異なるアーキテクチャで同じ結果が出るという保証はどこにもありません。 (DeepLによる翻訳)

## まとめ

- perl5.37.3から`PERL_RAND_SEED` 環境変数を使って乱数のシードを固定化できるようになりました
- ベンチマークとデバッグ目的なので、テストで使う場合は注意しましょう

## 参考

- [perldelta - perl 5.37.3](https://metacpan.org/release/NEILB/perl-5.37.3/view/pod/perldelta.pod)
- [perlrunに](https://metacpan.org/release/NEILB/perl-5.37.3/view/pod/perlrun.pod#PERL_RAND_SEED)
