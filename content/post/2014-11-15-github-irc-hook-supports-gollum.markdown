---
layout: post
title: "GithubのIRCフックがgollumをサポートしました"
date: 2014-11-15T22:24:00+09:00
comments: true
categories: [github]
---

GithubのIRCフックがgollum(Wikiページの変更通知)をサポートしました。

<!-- More -->

最近ぴーちんさんがWikiの編集業に精を出していて、編集の度にIRCに「変更しました！」とポストしてました。
「自動で通知してくれるとうれしいよねー」と話していたら、ある秘密を教えてもらいました。

``` plain
acidlemon: githubのwiki編集のIRC通知、ここに秘密が隠されています https://github.com/github/github-services/blob/master/lib/services/irc.rb
acidlemon: Blameおして黄色い変なアイコンを調べれば何をすれば良いかわかるはず
```

おや・・・何処かで見た黄色いアイコンが・・・

真似して[github-services](https://github.com/github/github-services)に[プルリクエスト](https://github.com/github/github-services/pull/970)をだしてマージしてもらった。
で、さっき[対応イベント一覧](https://api.github.com/hooks)見てたらgollum増えてる！
マージのときのコメントで「a few days」と言われたので2,3日かかるのかな？と思ってたけど、24時間経たないうちに反映されたよ！
早い！！

さっそく[Github::Hooks::Manager](https://github.com/Songmu/Github-Hooks-Manager)を使って設定しておきました。
「[project-name] shogo82148 edited wiki page hogehoge」みたいに編集されたページが通知されます。

便利！！！


## SEE ALSO

- [github-services](https://github.com/github/github-services)
- [github の irc hook に幾つかの event type が追加されました - @soh335 memo](http://soh335.hatenablog.com/entry/2013/07/10/100354)
- [GithubのHookについてのまとめとソリューション - おそらくはそれさえも平凡な日々](http://www.songmu.jp/riji/entry/2013-12-05-github-hooks.html)
