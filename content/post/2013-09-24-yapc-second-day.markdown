---
layout: post
title: "YAPCへ行ってきた(二日目)"
slug: yapc-second-day
date: 2013-09-24T07:52:00+09:00
comments: true
categories: [perl, yapcasia]
---

前回のポストにつづいてYAPC二日目。
聞いたトークの内容を簡単にメモ。

## Perl で書く結合テスト

前半はSWET(Software Engineer in Test), TE(Test Engineer)といった業種の話。
後半はテスト手法の分類(誰がする？テストの対象は？方法は？目的は？)について。


スライドはこちら→[Perlで書く結合テスト(]http://ikasama.hateblo.jp/entry/2013/09/22/234521)


## これからのPerlプロダクトのかたち

世界一高速な処理系を目指して開発中の[gperl](https://github.com/goccy/gperl)と、
その過程でできたツールの紹介。
PerlをLLVMにコンパイルすることがで、高速動作するらしい。
恐ろしい・・・。

Perlは文脈によってトークンの意味が変わってしまうから、トークナイザーを作るのに苦労したとのこと。
(例えば、`hoge * fuga` とあったときに、`*`が掛け算なのかブロブなのかわからない)
コンパイルの高速化のために文法を工夫しているKuinを見習って欲しいですね。


## Emacs実践入門 Perl編

typester先生によるEmacs入門。
PerlCompletion とか helm とか便利そう。
あんまりEmacsカスタマイズできていないので、今度いろいろ入れて遊んでみよう。


## Perlでレコメンデーション

登壇者はJubatusのPerlモジュールを書いたりしているらしい。
Jubatus に触ってみようと考え始めてからどれだけの月日が経っただろう・・・
そのうち触ってみます。そのうち。


## 中規模チャットサービスの運用事例

handlename先生のLobi運用のお話。
今日もcronのメールが迷惑メールフィルタによって闇に葬りさられる悲しいことがあったので、
cronの結果をIRCに飛ばすのとか参考にして何とかしたい。


## PhantomJSによる多岐にわたる広告枠の確実な表示テスト

最近の広告はJavascriptを使った遅延読み込みをするので、
ちゃんと表示されるかを静的に判断することができない。
そこで PhantomJS を使ってテストするお話。


## フルテストも50msで終わらせたい 〜 FreakOutの取り組み 〜

さすがにフルテストは50msで終わりません。
Ukigumoを使って複数台のサーバでテストを分散実行する取り組みを紹介。

スライド→http://yapcasia.org/2013/talk/show/767463b0-d8fd-11e2-971a-72936aeab6a4

## LT
前日にアイデアだけLTで紹介したHTTP::Body::Builderが、別の人の手によって実現されていたのには驚いた。
YAPC恐ろしいところだ・・・。


## HUB

懇親会参加しない組だったので、
@sasaplus1 さん, @kazuph さん, @aokcub とHUBで飲み会。
なぜ学内にHUBがあるんだ・・・？

NDS勢やNiigata.pm勢、あと何故かスタッフになっていた @jewel_x12 とも会えて楽しかったです！
