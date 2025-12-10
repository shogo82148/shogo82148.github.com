---
layout: post
title: "Perl 5.43.5 の Signatures Named Parameters を先取り"
slug: signatures-named-parameters-in-perl
date: 2025-12-10 16:23:00 +0900
comments: true
categories: [perl]
---

## 背景

2025年12月10日時点の最新版のPerl 5.43.5（開発版）で、
サブルーチンの名前付きパラメーター呼び出し（Signatures Named Parameters）がサポートされました。
これは [PPC0024](https://github.com/Perl/PPCs/blob/209b515ea88c85b152e256eb1cbeb166451fa992/ppcs/ppc0024-signature-named-parameters.md) を実装したものです。

どういう機能かさっそく遊んでみましょう。

## Perl 5.43.5 のビルド

Signatures Named Parameters はまだ安定版のPerlには取り込まれていません。
使用するには開発版のPerlをビルドする必要があります。

```plain
plenv install 5.43.5 -Dusedevel
plenv local 5.43.5
```

## 試してみる

ビルドが完了したら実際に試してみましょう。

まだ実験的な（Experimental）機能という位置づけなので、今回検証した挙動は将来変更される可能性があります。
注意してください。

### 普通に呼び出し

サブルーチンの仮引数部に `:$alpha` と書くと名前付きパラメーターとして扱われます。
サブルーチンの中からは `$alpha` という変数名でアクセス可能です。
呼び出し側からは `alpha => "A"` のように指定します。

```perl
use v5.43.5;
use experimental qw(signature_named_parameters);

sub foo (:$alpha, :$beta) {
  print "The value of alpha was $alpha\n";
  print "The value of beta was $beta\n";
}

foo(alpha => "A", beta => "B");
```

出力：

```plain
The value of alpha was A
The value of beta was B
```

実験的な（Experimental）機能なので、何も指定がないと警告がでます。
警告は `use experimental qw(signature_named_parameters);` で抑制可能です。

### ハッシュ変数を使ってパラメーターを渡す

ハッシュ変数をパラメーターとして渡すことが可能です。

```perl
use v5.43.5;
use experimental qw(signature_named_parameters);

sub foo (:$alpha, :$beta) {
  print "The value of alpha was $alpha\n";
  print "The value of beta was $beta\n";
}

my %params = (
  alpha => "X",
  beta  => "Y",
);
foo(%params);
```

出力：

```plain
The value of alpha was X
The value of beta was Y
```

### デフォルト値の設定

デフォルト値の設定も可能です。

```perl
use v5.43.5;
use experimental qw(signature_named_parameters);

sub foo (:$alpha, :$beta = "default") {
  print "The value of alpha was $alpha\n";
  print "The value of beta was $beta\n";
}

foo(alpha => "X");
```

出力：

```plain
The value of alpha was X
The value of beta was default
```

### パラメーターの設定エラー

シグネチャーと合わないパラメーターを渡した場合どうなるのかも試してみました。

まずはパラメーターが不足している場合：

```perl
use v5.43.5;
use experimental qw(signature_named_parameters);

sub foo (:$alpha, :$beta) {
  print "The value of alpha was $alpha\n";
  print "The value of beta was $beta\n";
}

# Missing required named parameter 'beta' to subroutine 'main::foo' at ./sample4.pl line 10.
foo(alpha => "X");
```

"Missing required named parameter 'beta'" とパラメーターが不足していることを教えてくれました。

次は逆にパラメーターが多すぎる場合：

```perl
use v5.43.5;
use experimental qw(signature_named_parameters);

sub foo (:$alpha, :$beta) {
  print "The value of alpha was $alpha\n";
  print "The value of beta was $beta\n";
}

# Unrecognized named parameter 'gamma' to subroutine 'main::foo' at ./sample3.pl line 10.
foo(alpha => "X", beta => "Y", gamma => "Z");
```

"Unrecognized named parameter 'gamma'" と未知のパラメーターが存在することを教えてくれました。

### 吸い込みパラメーター

名前付きパラメーターは、吸い込みパラメーター（slurpy parameter）と一緒に使うこともできます。
吸い込みパラメーターは未知のパラメーターを集めてくれます。

```perl
use v5.43.5;
use experimental qw(signature_named_parameters);

sub foo (:$alpha, :$beta, @rest) {
  print "The value of alpha was $alpha\n";
  print "The value of beta was $beta\n";
  for my $val (@rest) {
    print "Additional value: $val\n";
  }
}

foo(alpha => "X", beta => "Y", "extra1", "extra2");
```

出力：

```plain
The value of alpha was X
The value of beta was Y
Additional value: extra1
Additional value: extra2
```

吸い込みパラメーターはハッシュ変数にすることもできます。

```perl
use v5.43.5;
use experimental qw(signature_named_parameters);

sub foo (:$alpha, :$beta, %rest) {
  print "The value of alpha was $alpha\n";
  print "The value of beta was $beta\n";
  for my ($key, $val) (%rest) {
    print "The value of $key was $val\n";
  }
}

foo(alpha => "X", beta => "Y", extra1 => "value1", extra2 => "value2");
```

出力：

```plain
The value of alpha was X
The value of beta was Y
The value of extra1 was value1
The value of extra2 was value2
```

## まとめ

Perl 5.43.5（開発版）から導入された、サブルーチンの名前付きパラメーター呼び出し（Signatures Named Parameters）を試してみました。
引数の過不足のチェックは自前で実装すると意外と漏れがちなので、過不足チェックをデフォルトでやってくれるのはいいですね。

繰り返しになりますが、Signatures Named Parametersは実験的な（Experimental）機能という位置づけです。
今回検証した挙動は将来変更される可能性があるので注意してください。

## 参考

- [2025年 秋のPerl](https://speakerdeck.com/charsbar/2025nian-qiu-noperl?slide=67)
- [perldelta - Perl 5.43.5](https://metacpan.org/release/CONTRA/perl-5.43.5/view/pod/perldelta.pod)
- [perlsub - Perl 5.43.5](https://metacpan.org/release/CONTRA/perl-5.43.5/view/pod/perlsub.pod#Signatures)
- [PPC0024](https://github.com/Perl/PPCs/blob/209b515ea88c85b152e256eb1cbeb166451fa992/ppcs/ppc0024-signature-named-parameters.md)

