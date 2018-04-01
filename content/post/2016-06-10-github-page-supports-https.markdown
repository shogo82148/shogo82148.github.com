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

<blockquote class="twitter-tweet" data-lang="ja"><p lang="ja" dir="ltr">自分のブログは http から https に移行したけど、記事についたはてブを移行することは出来なかった（はてなのサポートに聞いた）。分からないでもないけど、https 移行の躊躇材料になるという点においてはイケてない。</p>&mdash; Takashi Masuda (@masutaka) <a href="https://twitter.com/masutaka/status/739747936318283776?ref_src=twsrc%5Etfw">2016年6月6日</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>


はてなさんの方で対応してくれないかな・・・


## 2016/06/30追記: DISQUSのマイグレーション

記事にコメントをつけるのに使っている[DISQUS](https://disqus.com/)をマイグレーションするのを忘れてて、
過去のコメントが見れなくなっていたので追記。

[DISQUS](https://disqus.com/)のホームから「Admin」「Edit Settings」で設定画面を開き、
Website URLの近くの「Changing domains? Learn how.」をクリックします。
すると「Migration Tools」が開くので、「Start URL mapper」「you can download a CSV here」をクリック。
5分くらいするとDISQUSがコメントを管理しているURL一覧がメールで届くので、
それを元に新旧URLの対応表を作ります。

今回はプロトコルの変更なので、以下のような雑なワンライナーで変換しました。
(改行コードがCRLFで地味に面倒だった)

```
grep http:// links.csv | perl -e '$/="\r\n";while(<>){chomp;print "$_,@{[$_=~s/^http:/https:/r]}$/"}' > new-links.csv
```

最後に設定画面からCSVをアップロードします。
以上で作業完了です。
最後に「24時間以内に反映するよ」的なメッセージが表示されましたが、僕の場合は5分くらいで反映が確認できました。

残るははてブ。はてなさん頼む〜〜〜。
