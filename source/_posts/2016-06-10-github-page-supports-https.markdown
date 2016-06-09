---
layout: post
title: "GitHub Pagesがhttpsをサポートしたので切り替えてみた"
date: 2016-06-10 00:53:51 +0900
comments: true
categories: [web]
---

このブログを設置しているGithub PagesがHTTPSに正式対応したらしいので、HTTPSを強制するように設定してみました。

- [HTTPS for GitHub Pages](https://github.com/blog/2186-https-for-github-pages)

<!-- More -->

## やったこと

ページ内にHTTP経由で取得したリソースが含まれていると、
警告が出たり取得自体がブロックされたりしてしまうので、
全てHTTPS経由で取得するように書きなおす必要があります。
画像・CSS・Javascript等のURLを、以下のようにnetwork-path referenceへの置き換えましょう。
HTTPでページを開いた場合はHTTPで、HTTPSでページを開いた場合はHTTPSで、リソースを取得してくれます。

``` plain
<a href="http://google.co.jp">
<a href="//google.co.jp">
```

このサイトはHTTPのレンダリングに[Octopress](https://github.com/imathis/octopress)を使っています。
最新版のOctopressではnetwork-path referenceを使ってくれるので特に対応は不要です。
このサイトの場合は古すぎてHTTP参照だったので、
「[Octopressをアップデートした](http://blog.glidenote.com/blog/2014/02/14/octopress-update/)」を参考にしてアップデートしました。
はてなブックマーク連携など、自分でカスタマイズした部分に関しては手作業で対応したました。


### HTTPS強制の設定

[Securing your GitHub Pages site with HTTPS](https://help.github.com/articles/securing-your-github-pages-site-with-https/) どおりに設定を有効化すればOKです。
ユーザ毎ではなくプロジェクト毎の設定のようなので、
プロジェクト用のページを作っている場合は個別に設定が必要です。


## はてなブックマークについて

HTTPとHTTPSは別URLとして扱われるようなので、過去の記事に対するはてブ数はリセットされてしまいます。
解決方法は無いかと調べてみたものの、現象無理っぽいです。

{% oembed https://twitter.com/masutaka/status/739747936318283776 %}

はてなさんの方で対応してくれないかな・・・
