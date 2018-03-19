---
layout: post
title: "Google Test を使ってC++のテストしてみた"
date: 2014-05-18T21:24:00+09:00
comments: true
categories: [c, c++, google test]
---

C++ なライブラリを書こうと思い、C++のテストってどうやるんだろうと調べたメモ。
テストフレームワークとして [Google C++ Testing Framework](https://code.google.com/p/googletest/) を使用、
コンパイルにはautotoolを使ってtravis-ciでテストするところまでやってみました。

やってみた結果→
[cpp-test](https://github.com/shogo82148/cpp-test)

<!-- More -->

## Testを書く
Google Test の[入門ガイド](http://opencv.jp/googletestdocs/primer.html)に書いてあったテストをコピペしてきました。

``` c++ test/factorial.cpp
#include "gtest/gtest.h"

int Factorial(int n);

TEST(FractionTest, hoge) {
    EXPECT_EQ(1, Factorial(1));
    EXPECT_EQ(2, Factorial(2));
    EXPECT_EQ(6, Factorial(3));
    EXPECT_EQ(40320, Factorial(8));
}
```

テストの対象となる関数はこちら。

``` c++ src/factorial.cpp
// calculate 1 * 2 * 3 * ... * n
int Factorial(int n) {
    if(n == 0) return 1;
    return n * Factorial(n - 1);
}
```

## テスト用実行ファイルのビルドをする

せっかくならしっかりしたものをつくろうと、Autotoolsを使ってビルドしてみました。
[新しめの Autotools (Autoconf&Automake) を使ってみよう](http://www.spa.is.uec.ac.jp/~kinuko/slidemaker/autotools/) を参考に
Makefileのひな形を書いていきます。

[Google Test と Travice CI で、C言語で書いたライブラリの継続的インテグレーションをしてみた結果](http://kikuchy.hatenablog.com/entry/2014/01/12/Google_Test_%E3%81%A8_Travice_CI_%E3%81%A7%E3%80%81C%E8%A8%80%E8%AA%9E%E3%81%A7%E6%9B%B8%E3%81%84%E3%81%9F%E3%83%A9%E3%82%A4%E3%83%96%E3%83%A9%E3%83%AA%E3%81%AE%E7%B6%99%E7%B6%9A%E7%9A%84%E3%82%A4)
ではGoogle Testをシステムにインストールしていますが、
システムへのインストールは推奨されていないのと、手元で動かすのが面倒だったので
[Fused Source File](https://code.google.com/p/googletest/wiki/V1_6_AdvancedGuide#Fusing_Google_Test_Source_Files)
を作ってGoogle Testを自分のプロジェクトに同梱しちゃいました。

Google Testのプロジェクトで`python fuse_gtest_files.py OUTPUT_DIR` を実行すると
`gtest/gtest.h` と `gtest/gtest-all.cc` が作られるので、
この２つのファイルを自分のプロジェクトにコピーしてきます。
あとは Makefile.am でこれらのファイルをコンパイル＆リンクするように設定します。
自分のプロジェクトでは使っていなくても、Google Test のコンパイルには pthread が必要なので忘れずに。
(clangでは無くても動くらしく、clangで試していたらgccで動かなくてちょっとはまった)

```makefile test/Makefile.am
TESTS = factorial_test
check_PROGRAMS = factorial_test
factorial_test_SOURCES = factorial.cpp gtest_main.cc gtest-all.cc
factorial_test_LDADD = ../src/libfactorial.a
factorial_test_LDFLAGS = -pthread
```

`make check` でテストが走るようになります。
Google Test のソースがプロジェクトに含まれているので、
新しくプログラムをインストールしたり、特別な設定をしたりといったことは必要ありません。

## travis-ci でテストする

travisのC++のテストは、標準で`./configure && make && make test`を実行してくれますが、
autotoolsで作ったMakefileだと上手く動かないので以下のように.travis.ymlを設定します。

``` yaml .travis.yml
language: cpp
script: autoreconf -fi && ./configure && make && make check
```

gnuなプロジェクトのお作法にしたがって、以下のように書き換えてあります。

- configureスクリプトはautotoolsで自動生成されるファイルなのでレポジトリには入れず、テスト前に生成する
- make check でテストが走るのが普通らしい

configureスクリプトを自動生成するのでautoconfのバージョンに注意してください。
autoconfは2014/05/18現在2.69が最新版ですが、travis-ciは2.68がインストールされているようです。
最新版のautoconfでconfigure.acのひな形を作ると`AC_PREREQ([2.69])`のように必要バージョンが設定されてしまい、
テストのときにconfigureファイルを作れなくて死にます。
バージョン指定を削除するか、古いバージョンに書き換えましょう。

C++のお作法がよくわかっていないですが、ちょっとずつ頑張っていきます。
