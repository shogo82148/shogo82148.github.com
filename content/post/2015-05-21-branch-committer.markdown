---
layout: post
title: "各ブランチの最後にコミットした人を知る"
date: 2015-05-21 00:50
comments: true
categories: [git]
---

ブランチが大量にあるので整理したい、けど大人数で開発しているから誰がどのブランチいじってるか分からない、
ということがあったので、出し方のメモ。

<!-- More -->

githubのbranch一覧も見ればいいじゃん！っていう意見もあると思うんだけど、
「自分のbranch一覧」は見れるんですが「特定のだれかのbranch一覧」が見れない・・・。

git-for-each-refを使うと各ブランチに対していろいろ操作できるようです。
各ブランチの最後にコミットした人一覧を出すには以下のコマンド。

``` bash
git for-each-ref --format='%(authordate:short) %(authorname) %(refname)' --sort=-committerdate refs/remotes/origin/
```

formatは自由にいじれるのでいろいろ遊べます。
例えば、ブランチをたくさん抱え込んでいる人の一覧を表示する例。

``` bash
git for-each-ref --format="%(authorname)" refs/remotes/origin/ | sort | uniq -c | sort -nr
```


## 参考

- [git-for-each-ref - Output information on each ref](http://git-scm.com/docs/git-for-each-ref)
- [リモートブランチも含め更新日時が新しい順番にソートする](http://d.hatena.ne.jp/syohex/20131225/1387948682)
- [ブランチ一覧を更新時刻つきで表示したい場合、gitのfor-each-refが使える。](http://shuzo-kino.hateblo.jp/entry/2014/07/03/232310)
