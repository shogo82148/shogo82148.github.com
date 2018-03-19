---
layout: post
title: "Githubさんにpack exceeds maximum allowed sizeって言われた"
date: 2014-09-13T10:51:00+09:00
comments: true
categories: [git]
---

Githubに手元のレポジトリをpushしようとしたら、
「Pushできないよ！！」って言われたときのメモ。

<!-- More -->

コミット数が17kほどあって、画像とかサイズが比較的大きいファイルがたくさんあるレポジトリを、
一度に全部pushしようとしたら「制限を超えてます」って言われてダメだった。

``` plain
$ git push origin master
Counting objects: 280874, done.
Delta compression using up to 4 threads.
Compressing objects: 100% (60497/60497), done.
remote: fatal: pack exceeds maximum allowed size
error: pack-objects died of signal 13
error: failed to push some refs to 'git@github.com:***/****.git'
```

ググってみると、おんなじような症状が見つかった。

- [Github remote push pack size exceeded](http://stackoverflow.com/questions/15125862/github-remote-push-pack-size-exceeded)

リモートへのPushはオブジェクトを全部一つにPackしてしまうので、
一度に大量のコミットをPushしようとすると制限に引っかかるらしい。
(そして、サイズを制限する方法はないみたい)

解決策は「2回以上に分けてPushしてね」とのこと

``` plain
git push remoteB <some previous commit on master>:master
...
git push remoteB <some previous commit after the last one>:master
git push remoteB master
```

頑張ってコミットログを遡ってコミットハッシュを調べるのはつらかったので、
打ってあったタグからコミットハッシュを調べてPushした。

``` plain
git push origin `git show v0.1.0 | grep commit | cut -d' ' -f2`:master
```

タグは単なるコミットハッシュの別名ではなくひとつのオブジェクトなので、
コミットだけをPushしたいときはタグと関連づいたコミットを調べる必要がある。
今回はタグの情報からgrepとcutで必要なとこだけ切り抜くってことをしたけど、
もっとスマートな方法があるなら知りたい。
この方法で古いコミットから順番に何度かに分けてPushしたらうまくいった。

今回は見つけた情報に通りに<コミットハッシュ>:<ブランチ名>でPushしたけど、
コミットオブジェクトがリモートに転送されてればいいわけだから、
単にタグをプッシュしてあとから消すでも良かったかもしれない。

``` plain
git push origin v0.1.0
git push origin :v0.1.0
```

こちらは未確認。

歴史を守るって大変なことなんだなあ(ヽ´ω`)
