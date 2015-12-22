---
layout: post
title: "UnityのBitmapフォントの収録文字のdiffを取る"
date: 2015-12-22 19:04
comments: true
categories: [unity, git]
---

Unityで文字を描画するには
「[BMFont(Bitmap Font Generator)でビットマップフォントを作る方法](http://d.hatena.ne.jp/nakamura001/20120910/1347241168)」等にあるように
ビットマップフォントを自分で作ってあげないといけないらしいです。
(ダイナミックフォントというものもあるらしいけど、まだ安定性が検証ができていないので使ってない。)

フォントに入っている全部の文字を収録するとでかくなりすぎるので、一部の文字だけ収録するのが一般的だと思います。
入れる文字は自分で選ぶわけですが、フォントファイルを更新する際に、以前は使えた文字が入っていなくてつらい思いをしたので、
gitで差分をみれるようにしてみました。

<!-- More -->

gitのいろんなファイル形式の差分を見やすくする方法は
[Git Diffでcsvの差分を見やすく表示する](http://shogo82148.github.io/blog/2015/03/24/git-diff-csv/)を参照。

csvのときと同じ要領で、まずはfntファイルをdiffを取りやすい形式に変換するスクリプト(fnt2txt)を容易し

``` bash fnt2txt
#!/bin/bash

grep 'char id=' $1 | cut -d' ' -f2 | cut -d= -f2 | perl -MEncode -ne 'printf "%04x: %s\n", $_, encode_utf8 chr($_) if $_ >= 32'
```

fnt2txtを使う設定を`.git/config`に設定します。

``` plain .git/config
[diff "fnt"]
        textconv = fnt2txt
```

最後に拡張子.fntに対してだけこの設定が反映されるようにすればOKです。

``` plain .gitatrribute
*.fnt diff=fnt
```

こんな感じでdiffが見れます。

``` diff git-diff
diff --git a/foo.fnt b/foo.fnt
index 79391c0..e262b2d 100755
--- a/foo.fnt
+++ b/foo.fnt
@@ -93,6 +93,7 @@
 007c: |
 007d: }
 007e: ~
+00a0:  
 00a1: ¡
 00a2: ¢
 00a3: £
```

事故防止に是非ご利用ください。
