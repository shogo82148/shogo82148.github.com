---
layout: post
title: "githubのタブサイズを変えるChrome拡張を作った"
date: 2014-02-10T08:01:00+09:00
comments: true
categories: [chrome, github]
---

にゃんぱすー。
最近 C# のコードを見ることが多くなってきました。
開発はVSやMonoDevelop等のIDEを使っているのですが、
diffの確認程度ならgithub上で行っています。
しかし、github上の表示は崩れて非常に読みづらい・・・。

<!-- More -->

githubのコードプレビューはタブストップが8文字幅で表示されます。
しかし、有名ドコロのIDEはデフォルトがタブインデント、4文字幅で設定されているので、
どうしても表示が狂ってしまいます。
タブインデントではなくスペースインデントを使えば解決☆
なのですが、スペースインデントの中にタブインデントを混入する場合が多々あるので、僕は疲れました・・・。
混在したときのコードなんて、読めたものじゃないですよ。


そこで、githubのタブサイズを変更する Chrome拡張を作ってみました。
ユーザスタイルシートでもできるんですが、まあ、勉強を兼ねて。

- [GithubTabChange](https://chrome.google.com/webstore/detail/github-tab-change/ljioaacdegnnenakodladamafjodehnd)

インストール後、github上のレポジトリを開くと≡みたいなマークがURLの横に表示されます。
それをクリックでタブサイズの設定変更が可能です。
githubのプレビューの一斉設定だけでなく、
レポジトリ単位でタブサイズを切り替えることができます。

アイコンとか設定画面のデザインとかちゃんとしたものを作る気力はなかったので、
皆さんのprをお待ちしております。

- [GithubTabChange on github](https://github.com/shogo82148/GithubTabChange)

(これ作ってるときに、githubのHTMLソースの中にtab-size-8というクラスを見つけたのですが、実はどこかに隠し機能としてあるんですかね？)
