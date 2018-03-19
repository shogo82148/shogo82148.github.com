---
layout: post
title: "git diffでcsvの差分を見やすく表示する"
date: 2015-03-24T23:08:00+09:00
comments: true
categories: [git]
---

ExcelやGoogle Spreadsheetを使って作ったデータをプログラムに取り込むのにcsv形式が便利でよく使っているんですが、
gitで履歴管理をしてもdiffが見づらい・・・。
gitのdiffがかなり自由にカスタマイズできることを知ったので、いろいろいじってみたメモ。

<!-- More -->

例として、以下のようなcsvファイルを編集することを考えます。

``` plain hogehoge.csv
id,name,param_a,param_b,param_c,param_d,param_e
101,hoge,314,159,265,358,979
102,fuga,271,828,182,845,904
```

一行目は列の見出しになっていて、プログラムからは列番号ではなく`param_d`の様に指定する、
という作りになってます。
`id: 101`の行の`param_d`の数値に変更が入った場合、普通のgitだと以下のようになります。

``` diff git-diff
diff --git a/hogehoge.csv b/hogehoge.csv
index c8dbd17..37f4ff5 100644
--- a/hogehoge.csv
+++ b/hogehoge.csv
@@ -1,3 +1,3 @@
id,name,param_a,param_b,param_c,param_d,param_e
-101,hoge,314,159,265,358,979
+101,hoge,314,159,265,359,979
 102,fuga,271,828,182,845,904
```

二行目に何か変更があったことはわかりますが、
`param_d` だとはすぐにはわかりませんね・・・


## YAMLに変換して比較する

バイナリファイルであっても差分が確認できるよう、
git-diffを実行する前に変換ツールを実行する機能があります。
拡張子がcsvのファイルに対してこの機能が働くように`.gitattributes`に以下の行を足します。

``` plain .gitattributes
*.csv diff=csv
```

`.git/config` に変換ツールの設定を追加します。
`key: value`の形式になっていると見やすそうなので、変換先の形式にはyamlを選びました。

``` plain .git/config
[diff "csv"]
    textconv = csv2yaml
```

ここで指定している`csv2yaml`は自前で用意する必要があります。
インターネット上をさまよえば同名のツールはいくらでもありそうですが、今回は自分でgoを使って書きました。
[csv2yaml.go](https://gist.github.com/shogo82148/8f19cb771dc6f91308a7)をコンパイルしてパスの通る場所においておきましょう。
csv2yamlは自分のよく使うcsvのフォーマットにあわせて以下のようなカスタマイズをしてあります。

- `id`という名前のキーを必ず最初にする
- それ以外のキーはアルファベット順にソートする

この状態で`git diff`を実行すると以下のようになります。

``` diff git-diff
diff --git a/hogehoge.csv b/hogehoge.csv
index c8dbd17..37f4ff5 100644
--- a/hogehoge.csv
+++ b/hogehoge.csv
@@ -3,7 +3,7 @@
   param_a: "314"
   param_b: "159"
   param_c: "265"
-  param_d: "358"
+  param_d: "359"
   param_e: "979"
 - id: "102"
   name: fuga
```

これなら `param_d` が変更されたとすぐに分かりますね。

## hunk-headerを設定する

めでたく`param_d`が変更されていることがわかるようになったのですが、
今度はどの行が変更されたのかがわからなくなってしまいました。

差分の `@@ -3,7 +3,7 @@` となっている部分はhunk-headerといって、自由にカスタマイズすることができます。
`.git/config` に表示したい文字列のパターンを入力しましょう。

``` plain .git/config
[diff "csv"]
    textconv = csv2yaml
    xfuncname = "^- .*$"
```

この状態で差分を確認すると「`id: 101`の`param_d`をいうパラメータ」が更新されたことが一目瞭然ですね！

``` diff git-diff
diff --git a/hogehoge.csv b/hogehoge.csv
index c8dbd17..37f4ff5 100644
--- a/hogehoge.csv
+++ b/hogehoge.csv
@@ -3,7 +3,7 @@ - id: "101"
   param_a: "314"
   param_b: "159"
   param_c: "265"
-  param_d: "358"
+  param_d: "359"
   param_e: "979"
 - id: "102"
   name: fuga
```

`csv2yaml`を作るときに「`id`という名前のキーを必ず最初にする」としたのはこの機能を使うためです。
僕のユースケースでは`id`がわかれば十分なことがほとんどですが、
場合によってはもっと別の情報の方がいいかもしれませんね。

まだ設定したばっかりなので本当に有用かはよくわかってないですが、しばらくこの設定で試してみようと思います。

## 参考

- [gitのdiffを見やすく表示する](http://qiita.com/YasuOza/items/c472f803dab51b7d4f51)
- [gitattributes](http://git-scm.com/docs/gitattributes)
