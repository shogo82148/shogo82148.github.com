---
layout: post
title: "git で管理しているリポジトリの各ブランチの中身をそれぞれ個別のディレクトリにエクスポートする(git-archive版)"
slug: git-pack-branch
date: 2015-03-20T18:38:00+09:00
comments: true
categories: [git]
---

[git で管理しているリポジトリの各ブランチの中身をそれぞれ個別のディレクトリにエクスポートする](http://moznion.hatenadiary.com/entry/2015/03/20/175035) を読んで、
git-archive を使うともう少しシンプルに書けるんじゃないかと思ってやってみた。

``` bash
git branch | sed -e 's/^[\* ]*//g' | xargs -n1 -I% sh -c 'git archive --prefix=%/ % | tar x'
```

.gitconfig とかでエイリアスを設定しておくといいんじゃないでしょうか

以上
