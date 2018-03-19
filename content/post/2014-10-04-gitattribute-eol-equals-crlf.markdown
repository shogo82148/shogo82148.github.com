---
layout: post
title: "gitで作業ディレクトリの変更を破棄したのに差分が出続けて困った話"
date: 2014-10-04 15:05
comments: true
categories: [git]
---

gitで変更した覚えの無いファイルに差分が出ていたので、
作業ディレクトリの変更を破棄したのに、
`git status`で差分が出続けて困ったのでメモ。

<!-- More -->

## 症状

gitでは`git checkout -- <file>` ってコマンドを叩くと、
作業ディレクトリの変更を破棄できます。

``` plain
$ git checkout -- hoge.txt
$ git status
On branch master
Changes not staged for commit:
 (use "git add <file>..." to update what will be committed)
 (use "git checkout -- <file>..." to discard changes in working directory)

   modified:   hoge.txt
```

しかし、差分が出続ける...
`git checkout -- <file>` ならさっきやったよ！

`git reset --hard HEAD` して全変更を破棄してもダメでした。


## 原因

.gitattributesに改行コードの指定があったからでした。

``` plain .gitattributes
*.txt text=auto eol=crlf
```

これが指定されていると、CRLFなファイルをコミットしようとしても、
レポジトリには改行コードがLFで保存されるようになる。

``` plain
$ cat .gitattributes # .gitattributes には eol=crlf が指定されている
*.txt text=auto eol=crlf
$ hexdump hoge.txt   # hoge.txt は改行コードCRLFで保存されている
0000000 48 65 6c 6c 6f 20 57 6f 72 6c 64 21 21 0d 0a
000000f
$ git add hoge.txt
$ git commit -m 'add hoge.txt'  # 改行コードがCRLFなhoge.txtをコミット
$ git cat-file -p master^{tree} # レポジトリにコミットされているオブジェクトを確認
100644 blob 523f058ebd4f1a280b5a33a79af8f22b74415f37   .gitattributes
100644 blob 936977184a9fa89d82f86957a90b92d4924b6573   hoge.txt
$ git cat-file -p 936977184a9fa89d82f86957a90b92d4924b6573 | hexdump # 改行コードがLF(末尾が0a)になっている！！
0000000 48 65 6c 6c 6f 20 57 6f 72 6c 64 21 21 0a
000000e
```

ところがレポジトリ上にCRLFなファイルがコミットされていると、
コミットすべき内容と一致しないので差分がでてしまう。

``` plain
$ git cat-file -p master^{tree}
100644 blob 523f058ebd4f1a280b5a33a79af8f22b74415f37   .gitattributes
100644 blob 23c3aefeda706ec02f4a724edc2faf1913a547ef   hoge.txt
$ git cat-file -p 23c3aefeda706ec02f4a724edc2faf1913a547ef | hexdump # 改行コードはCRLF(末尾が0d 0a)
0000000 48 65 6c 6c 6f 20 57 6f 72 6c 64 21 21 0d 0a
000000f
$ git status # 差分がでてしまう
On branch master
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git checkout -- <file>..." to discard changes in working directory)

	modified:   hoge.txt

  no changes added to commit (use "git add" and/or "git commit -a")
```

作業ディレクトリが壊れているわけでなく、レポジトリの内容がおかしい(`eol=crlf`が設定されているときは全てのファイルはLFでコミットされているべき)ので、
今回はコミットして正しい状態にすることで解決。
差分計算の効率化のためにタイムスタンプを最初に見ているみたいなので、
touchしただけで差分が！ってなってびっくりした。

## まとめ

CRLF滅びろ

## 追記

[続編](http://shogo82148.github.io/blog/2014/10/21/git-case-sensitivity/)がでました
