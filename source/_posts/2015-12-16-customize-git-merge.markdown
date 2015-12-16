---
layout: post
title: "git-mergeの挙動をカスタマイズする"
date: 2015-12-16 22:24
comments: true
categories: git
---

最近gitのコンフリクト解消職人みたいになっていてすごくつらいです。
普通のプログラムであれば順番が重要なので手動でのコンフリクト解消は避けられないのですが、
僕が相手にしているのは最終的にMySQLに食わせるデータなのでそこまで順番は重要ではありません。
順番に挿入したところで、MySQLが順番にかえしてくれるとは限りませんからね。
このようなケースではある程度機械的にマージできるのでは？と調べてみました。

<!-- More -->

## merge driver

いろいろググってみると[gitattributes](http://git-scm.com/docs/gitattributes)でファイル毎にマージの細かい挙動を制御できるようです。
通常マージの方法はgitがよしなに選択してくれますが、merge属性に以下の項目を指定することでマージの方法を強制することができます。

- text
  - テキストファイルとしてマージする。
  - コンフリクトすると `<<<<<<<`, `=======`, `>>>>>>>`でコンフリクトした場所を教えてくれる。
- binary
  - バイナリファイルとしてマージする。
  - コンフリクトするとマージしようとしたファイルを残しておいてくれる。
- union
  - テキストファイルとしてマージする。
  - textと違ってコンフリクトしてもマーカを付けない。どちらの変更も残すように適当にマージしてくれる。
  - 適当なので **コンフリクト時の行の順番は保証されない**

text, binaryはコンフリクトしたときによく見る挙動ですね。
unionは初めて知ったので、簡単なレポジトリを作って挙動を確かめてみました。

``` bash
$ # masterブランチ上でmembers.txtにAliceを追加する
$ git init
$ echo Alice > members.txt
$ git add members.txt
$ git commit -m 'add Alice'
[master (root-commit) 8c39714] add Alice
 1 file changed, 1 insertion(+)
  create mode 100644 members.txt
$
$ # add-bobブランチ上でmembers.txtにBobを追加する
$ git checkout -b add-bob
Switched to a new branch 'add-bob'
$ echo 'Bob' >> members.txt
$ git add members.txt
$ git commit -m 'add Bob'
[add-bob 9c406ae] add Bob
 1 file changed, 1 insertion(+)
$
$ # masterブランチ上でmembers.txtにEveを追加する
$ git checkout -
 Switched to branch 'master'
$ echo 'Eve' >> members.txt
$ git add members.txt
$ git commit -m 'add Eve'
[master 9eabd8a] add Eve
 1 file changed, 1 insertion(+)
$ git merge add-bob
 Auto-merging members.txt
 CONFLICT (content): Merge conflict in members.txt
 Automatic merge failed; fix conflicts and then commit the result.
$ cat members.txt
 Alice
 <<<<<<< HEAD
 Eve
 =======
 Bob
 >>>>>>> add-bob
```

わざとコンフリクトを起こしてみるテストです。
ファイル末尾にEveとBobをそれぞれ別々のブランチで追加したためコンフリクトしてしまっています。

では次にgitattributeを追加して`merge=union`を指定した場合に挙動を確認してみましょう。

``` bash
$ # merge=union属性を追加
$ echo 'members.txt merge=union' > .gitattributes
$ git add -f .gitattributes
$ git commit -m 'add gitattributes'
[master 61d2cfc] add gitattributes
 1 file changed, 1 insertion(+)
  create mode 100644 .gitattributes
$
$ # もう一度マージしてみる
$ git merge add-bob
Auto-merging members.txt
Merge made by the 'recursive' strategy.
 members.txt | 1 +
  1 file changed, 1 insertion(+)
$ cat members.txt
Alice
Eve
Bob
```

通常はコンフリクトするケースですが、今度はうまくマージできました。

## merge driverをカスタマイズする

デフォルトではtext, binary, unionしか用意されていないmerge driverですが、`.git/config`をいじることで自前のmerge driverを追加することができます。
unionでは行の順番が不定になって不便なので、試しに「必ずソートされており重複がないファイルをマージする」ためのmerge driverを作ってみます。
まずはマージするためのコマンド用意しましょう。

``` bash merge-sorted-set.sh
#!/bin/bash
A="$1"
O="$2"
B="$3"
tmpfile=$(mktemp temp.XXXXXX)
cp "$A" "$tmpfile"
git merge-file -p -q --union "$tmpfile" "$O" "$B" | sort | uniq > "$A"
rm "$tmpfile"
```

パスの通った場所にこのファイルを置き、`.git/config`にこれを呼び出す設定を書けば、gitattributeから使用できるようになります。

``` plain .git/config
[merge "zset"]
        name = merge sorted set
        driver = merge-sorted-set.sh %A %O %B
```

- `%A`: 現在のブランチの状態
- `%B`: マージしようとしているブランチの状態
- `%O`: 共通の祖先の状態
- `%L`: コンフリクトマーカの長さ。[1.7から使えるらしい](https://github.com/git/git/commit/23a64c9e771e3caf19cf2ee9a32c8942ddde4a81)
- `%P`: ファイルのパス。[2.5.0から使えるらしい](https://github.com/git/git/commit/ef45bb1f8156030446658d5bfb3983ce214a9e16)

このmerge driverを使ってマージすると、先の例ではAlice, Bob, Eveの順番で並ぶようになります。


## theirs-oursの順番に並べてみる

僕のケースではtheirs-oursの順番で並んでくれると都合が良いので、こんなスクリプトを書いてみました。

``` bash merge-theirs-ours.sh
#!/bin/bash
A="$1"
O="$2"
B="$3"
tmpfile=$(mktemp temp.XXXXXX)
cp "$A" "$tmpfile"
git merge-file -p -q --union "$B" "$O" "$tmpfile" > "$A"
rm "$tmpfile"
```

``` plain .git/config
[merge "theirsours"]
        name = theirs first
        driver = merge-theirs-ours.sh %A %O %B
        recursive = text
```

あとは勝手にコンフリクト解消して欲しいファイルに対して
.gitattributesで`merge=theirsours`を指定すれば通常はコンフリクトする場合でもマージしてくれます。


ただ、さすがに全自動だとちょっと怖いので、以下の様にコンフリクトするようであればユーザに確認(`exit 1`するとコンフリクトした扱いになる)
したほうが無難な気もしますね。

``` bash merge-theirs-ours.sh
#!/bin/bash
A="$1"
O="$2"
B="$3"
if git merge-file -p -q "$A" "$O" "$B" > /dev/null; then
    git merge-file "$A" "$O" "$B";
else
    tmpfile=$(mktemp temp.XXXXXX)
    cp "$A" "$tmpfile"
    git merge-file -p -q --union "$B" "$O" "$tmpfile" > "$A"
    rm "$tmpfile"
    exit 1
fi
```

## まとめ

gitattribute便利。
gitattributeを使って[Git Diffでcsvの差分を見やすく表示する](http://shogo82148.github.io/blog/2015/03/24/git-diff-csv/)のもどうぞ。

ただmerge driverからはファイルのメタ情報に触れないので、「コミット日時が新しい方を残す」みたいなことができないのが残念です。
[ブランチ決め打ちにする](http://stackoverflow.com/questions/7607125/git-merge-conflict-to-always-take-the-newest-file)のはちょっと怖いし、
merge strategyのカスタマイズは大変そう・・・
(一応 `git-merge-hogehoge` をいうコマンドを用意しておけば `git merge --strategy hogehoge` と使えるようです。が、`git-merge-hogehoge <base>... -- <head> <remote> ...` の形式で渡ってくるので、そこから再実装するのはつらい・・・)

## 参考

- [gitattributes](http://git-scm.com/docs/gitattributes)
- [git: How do I add a custom merge strategy?](http://stackoverflow.com/questions/23140240/git-how-do-i-add-a-custom-merge-strategy)
- [Git merge conflict to always take the newest file](http://stackoverflow.com/questions/7607125/git-merge-conflict-to-always-take-the-newest-file)
