---
layout: post
title: "travisがいつのまにやらcsharpをサポートしていた件"
date: 2015-03-29T11:54:00+09:00
comments: true
categories: [travis, csharp]
---

いつもテスト実行でお世話になっているtravisさんが[C#をサポートしていました](http://docs.travis-ci.com/user/languages/csharp/)。

<!-- More -->

以前から [C#をサポートして欲しいという要望](https://github.com/travis-ci/travis-ci/issues/649)はあったのですが、
2014年12月あたりからついに使えるようになってたみたいです。

以前はC言語のフリをして、設定ファルで頑張ってmonoをインストールする必要があったのですが、

``` yaml .travis.yml
## Travis CI Integration

language: c
install:
  - sudo apt-get install mono-devel mono-gmcs
script:
  - xbuild hogehoge.sln
```

今はlanguageにcsharpを設定して、solutionを指定するだけです。

``` yaml .travis.yml
## Travis CI Integration

language: csharp
solution: hogehoge.sln
```

[MiniMeggagePack](https://github.com/shogo82148/MiniMessagePack) もこちらの設定を使うようにしてみました。

nunitを使ってテストする場合は結局`sudo apt-get install nunit-console`する必要があるみたいですが、
複数バージョンのmonoでテストできたりしていい感じです。
ただ、ドキュメントにはmono2.10.8もサポートしているとあるのにmonoのインストールが404で失敗したり、
他のバージョンでも時たまmonoのインストールにコケたり、
3.8.0でnunitのテストが上手く動かなかったり、不安定な感じがしてます。
徐々に改善していくといいなー。

## 参考

- [Building a C#, F#, or Visual Basic Project](http://docs.travis-ci.com/user/languages/csharp/)
