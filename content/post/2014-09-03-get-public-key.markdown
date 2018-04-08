---
layout: post
title: "秘密鍵から公開鍵をつくる"
slug: get-public-key
date: 2014-09-03T13:40:00+09:00
comments: true
categories: []
---

githubに公開鍵を登録しようと思ったけど、
手元に秘密鍵しかなくて困った時のメモ。

<!-- More -->

ssh-keygenを使うとできます。

``` bash
# 秘密鍵を読み込んで公開鍵を出力する
ssh-keygen -y -f ~/.ssh/id_rsa
```

この公開鍵って登録したっけ？
ってときには以下のコマンドでフィンガープリントを確認できます。

``` bash
# 公開鍵のフィンガープリントを取得する
ssh-keygen -l -f ~/.ssh/id_rsa.pub
```
