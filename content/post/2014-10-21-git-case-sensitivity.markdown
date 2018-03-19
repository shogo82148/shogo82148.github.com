---
layout: post
title: "Gitで作業ディレクトリの変更を破棄したのに差分が出続けて困った話その2"
date: 2014-10-21 00:56
comments: true
categories: [git]
---

先日「[Gitで作業ディレクトリの変更を破棄したのに差分が出続けて困った話](http://shogo82148.github.io/blog/2014/10/04/gitattribute-eol-equals-crlf/)」と
いうのを書きましたが、より強力な敵が現われました。
このときは文字コードが原因で `git checkout -- <file>` しても差分が残り続けるというもので、`git add` してコミットし直すことで回避出来ました。
しかし、今度の敵は `git checkout -- <file>` しても `git add <file>`しても差分が残り続けます。

なんだ・・・このボスを倒したら新たなラスボスが現れた感・・・

acidlemon先生の手助けにより事無きを得たのですが、
ちょっと不明な点もあったので、その点もあわせてメモを残しておきます。

<!-- More -->

## 症状

`git checkout -- <file>` しても、`git add <file>` しても、`git reset --hard HEAD` しても、
何をしても差分が出続ける・・・なんだこいつ・・・

``` plain
$ git checkout -- AwesomeFeature
$ git add .
$ git status
On branch master
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
    (use "git checkout -- <file>..." to discard changes in working directory)
	
	modified:   AwesomeFeature/HogeHoge.txt
	
	no changes added to commit (use "git add" and/or "git commit -a")
```

操作は全てMac上で行いました。


## 原因

原因はファイル名の大文字小文字でした。
`git ls-files` でgitに管理されているファイルの一覧を表示します。

```
$ git ls-files
AwesomeFeature/HogeHoge.txt
AwesomeFeature/hogehoge.txt
README.txt
```

大文字小文字だけが違う「HogeHoge.txt」と「hogehoge.txt」が管理されています。

しかしワーキングディレクトリにあるのは「HogeHoge.txt」のみです。

```
$ ls AwesomeFeature/
HogeHoge.txt
```

Macのファイルシステムは大文字小文字を区別しないので、
ワーキングディレクトリ上で「HogeHoge.txt」と「hogehoge.txt」を同時に扱えません。
しかしgitは両者を区別するので、よくわからない差分が生まれてしまったわけです。

両方同時に扱えないので、どちらか片方を消して解決します。
`git diff`で「HogeHoge.txt」と「hogehoge.txt」の差分が見れるのでどっちを残すが選択、
`git checkout -- <file>`で必要なほうをワーキングディレクトリに反映後、
`git rm --cached <file>`で不要なファイルをレポジトリから削除です。
「hogehoge.txt」を残す場合は以下のような感じです。全てファイル名を明示してるのがポイントです(症状のところではディレクトリ名指定だった)。

```
$ # 差分確認
$ # 今はHogeHoge.txtの方がワーキングディレクトリに反映されているので、hogehoge.txtに変更があるように見える
$ git diff
diff --git a/AwesomeFeature/hogehoge.txt b/AwesomeFeature/hogehoge.txt
index 3488202..1150100 100644
--- a/AwesomeFeature/hogehoge.txt
+++ b/AwesomeFeature/hogehoge.txt
@@ -1 +1 @@
-this is hogehoge.txt
+this is HogeHoge.txt
$
$ # hogehoge.txt の内容をワーキングディレクトリに反映
$ git checkout -- AwesomeFeature/hogehoge.txt
$
$ # 今度はHogeHoge.txtに変更があるように見える
$ git diff
diff --git a/AwesomeFeature/HogeHoge.txt b/AwesomeFeature/HogeHoge.txt
index 1150100..3488202 100644
--- a/AwesomeFeature/HogeHoge.txt
+++ b/AwesomeFeature/HogeHoge.txt
@@ -1 +1 @@
-this is HogeHoge.txt
+this is hogehoge.txt
$
$ # HogeHoge.txtの方はgitから削除
$ git rm AwesomeFeature/HogeHoge.txt
rm 'AwesomeFeature/HogeHoge.txt'
$ git commit -m 'rm AwesomeFeature/HogeHoge.txt'
```

「HogeHoge.txt」があるブランチと「hogehoge.txt」があるブランチをマージするとこうなるようです。
gitの扱いに慣れてない人が触っているレポジトリなのでトラブルが絶えない・・・それにしたってなんでこう見事に地雷を踏抜いて行くんだ・・・(ヽ´ω`)


## まとめ

大文字小文字を区別しないファイルシステムなんか滅んでしまえ。
