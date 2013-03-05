---
layout: post
title: "出、出〜〜〜〜wwww emacsをふたつ以上実行奴〜〜〜〜www(emacsclient編)"
date: 2013-03-05 12:35
comments: true
categories: [emacs]
---

emacsを使って編集している最中にシェル操作をしたくなって，
C-z を押してバックグラウンドにしてシェル操作．
その後，emacsに戻ってくるには fg コマンドを打つ必要があるんだけど，
間違えてもう一回 emacs を新しく立ち上げるというミスを何度もやってしまう・・・．

<!-- More -->

これに対し，猫型さんが複数起動しようとすると警告を出してくれるようにしてくれました．
([出、出〜〜〜〜wwww emacsをふたつ以上実行奴〜〜〜〜www](http://nekogata.hatenablog.com/entry/2013/02/28/211447))

警告してくれるのはありがたいんだけど，
これだとシェル操作中に別のファイルの編集をしたいと思っても，警告が返ってくるだけ．
emacs をフォアグラウンドに出して，ファイルの指定をやり直さなきゃいけない．
僕はファイルの編集をしたいんだ！！
わかったから早く編集させろ！！！


## emacsclient

単なる警告じゃなくて，
「裏で動いていたemacsを復帰させ，新しいバッファを開く」
ところまで自動的にやってくれると嬉しいですね．

まず，emacs をデーモンモードで起動しておきます．

``` bash
emacs --daemon
```

emacsclient コマンドでファイルを開くと，
emacs デーモンさんが新しいバッファで開いてくれます．
オプションに -nw を指定しておくと現在の端末で閲覧編集することができます．

``` bash
emacsclient -nw hoge.txt
```

終了するには`C-x 5 0`．
`C-x C-c`でも終了できるけど，
デーモンにバッファが残ってしまうみたい．

aオプションでemacs デーモンが起動してないときに
編集に使うエディタを指定できる．
空っぽにしておくと，emacs をデーモンモードで起動してくれる．

``` bash
emacsclient -nw -a '' hoge.txt
```

emacs デーモンを終了させるのは以下のコマンド．

``` bash
emacsclient -e '(kill-emacs)'
```

emacsclient に対して alias を作っておけば，
複数起動かどうか意識せずに使えますね．

``` bash
alias emacs='emacsclient -nw -a ""'
```

## 参考

- [emacsclientを使おう](http://d.hatena.ne.jp/syohex/20101224/1293206906)
- [emacsclient の使い方の種類と、便利な使い方](http://k-ui.jp/blog/2010/07/28/emacsclient_%E3%81%AE%E4%BD%BF%E3%81%84%E6%96%B9%E3%81%AE%E7%A8%AE%E9%A1%9E%E3%81%A8%E3%80%81%E4%BE%BF%E5%88%A9%E3%81%AA%E4%BD%BF%E3%81%84%E6%96%B9/)
- [emacsclientを終了する方法](http://blog.naru.se/2012/11/emacsclient.html)
