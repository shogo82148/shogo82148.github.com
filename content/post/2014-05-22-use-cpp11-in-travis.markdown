---
layout: post
title: "travis-ciでC++11のテストをする"
date: 2014-05-22T23:34:00+09:00
comments: true
categories: [c++, travis]
---

今 C++ を書くなら C++11 だよね！と言うわけでC++11の新機能を使ってコードを書いたので、
[travis-cli](https://travis-ci.org/)でテストしたらFAIL。

``` plain
$ g++ -std=gnu++0x hogehoge.cpp
sorry, unimplemented: non-static data member initializers
```

unimplemented・・・だと・・・。

頑張って動かしてみたのでメモ。

<!-- More -->

## autoconf の設定をする

autotoolsを使っていたので、
C++11 に対応しているかのチェックを追加しておきます。

[ax_cxx_compile_stdcxx_11.m4](https://www.gnu.org/software/autoconf-archive/ax_cxx_compile_stdcxx_11.html)をダウンロードし、
configure.ac でm4ファイルをダウンロードするようにしておきます。

``` plain configure.ac
m4_include([m4/ax_cxx_compile_stdcxx_11.m4])
AX_CXX_COMPILE_STDCXX_11
AC_LANG([C++])
```


## travis.yaml を設定する

ぐぐったら[stackoverflowでやり方を見つけました](http://stackoverflow.com/questions/22111549/travis-ci-with-clang-3-4-and-c11)。
標準でテストに使われるコンパイラは古いようなので、新しいバージョンのものをインストールするように設定します。

``` plain
language: cpp

compiler:
  - clang
  - gcc

before_install:
  # g++4.8.1
  - if [ "$CXX" == "g++" ]; then sudo add-apt-repository -y ppa:ubuntu-toolchain-r/test; fi

  # clang 3.4
  - if [ "$CXX" == "clang++" ]; then sudo add-apt-repository -y ppa:h-rayflood/llvm; fi

  - sudo apt-get update -qq

install:
  # g++4.8.1
  - if [ "$CXX" = "g++" ]; then sudo apt-get install -qq g++-4.8; fi
  - if [ "$CXX" = "g++" ]; then export CXX="g++-4.8"; fi

  # clang 3.4
  - if [ "$CXX" == "clang++" ]; then sudo apt-get install --allow-unauthenticated -qq clang-3.4; fi
  - if [ "$CXX" == "clang++" ]; then export CXX="clang++-3.4"; fi
```

これで、clangとgccでテストが走るようになります。
