---
layout: post
title: "Test::mysqld::Multiというモジュールを書いてみた"
date: 2015-06-20 10:41
comments: true
categories: [perl]
---

[Test::mysqld](https://metacpan.org/pod/Test::mysqld)のインスタンスを一度に大量に作りたい人向けに
Test::mysqld::Multiというモジュールを書いてみました。

**2016/12/22追記**: Test::mysqld::MultiはTest::mysqld 0.20 の一部として取り込まれました
([p5-Test::mysqld#13](https://github.com/kazuho/p5-test-mysqld/pull/13))。
APIは少し変わっているので、詳しくは[POD](https://metacpan.org/pod/Test::mysqld)を参照してください。
合わせて[App::Prove::Plugin::MySQLPool](https://metacpan.org/pod/App::Prove::Plugin::MySQLPool) 0.06 より、
本記事で紹介した高速化が利用できます。

<!-- More -->

## 背景

先日[Jenkins EC2 Plugin で Spot Instance を使ってテストを回す](http://tkuchiki.hatenablog.com/entry/2015/04/24/192851)というのを、
tkuchikiさんにお願いして僕の関わっているプロジェクトでやっていただきました。
CPUのたくさん載ったインスタンスを安く使えるようになったので、
8並列で動いてたテストを24並列で動かせるようになりました。やった3倍速だ！！！
9分程かかってたテストが7分で終わるようになりました！！！
あれ・・・思ったほど早くなってない・・・。

ログを眺めているとproveコマンドが立ち上がってから、実際にテストが走り始めるまで数分の時間がありました。
[App::Prove::Plugin::MySQLPool](http://maaash.jp/2013/03/perl-app-prove-plugin-mysqlpool/)を使っているのですが、
ここで時間がかかっているようです。

App::Prove::Plugin::MySQLPoolはテストの並列度分だけMySQLのインスタンスを立ち上げますが、
一個インスタンスを立ち上げたら、それにアクセスできるようになるまでずっと待っているようです。
MySQLの起動に5秒かかるとして24並列で動かしたら2分かかるわけで無視できない長さになります。

## 作ったもの

n個一度に立ち上げて全部にアクセスできるまで待つ実装にすれば速くなるのでは！ってことでTest::mysqld::Multiというのを書いて、
App::Prove::Plugin::MySQLPoolからそれを使うようにしました。
とりあえず[test-mysql-multiブランチ](https://github.com/mash/App-Prove-Plugin-MySQLPool/compare/master...shogo82148:test-mysqld-multi)にコミットしてあります。
App::Prove::Plugin::MySQLPoolに取り込んでもらうか別のモジュールとして分離するか、後々のことは未定。
今のプロジェクトで使ってみてちょっとの間様子見してみます。
7分かかってたテストが5分程度で終わるようになったので、効果はあるようです。

ちなみに、並列度が24と半端なのはそれ以上並列度を上げても速くならなかったため。
32コアあるマシンなんだけど使い切れてません。
どこにボトルネックがあるんだろうな・・・。

## まとめ

プロセス一覧にmysqldが24個並ぶの楽しい
