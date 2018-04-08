---
layout: post
title: "TinySegmenterをLaTeXに移植してみた"
slug: tinysegmenter-for-tex
date: 2012-12-16T13:11:00+09:00
comments: true
categories: [NLP, LaTeX]
---

この記事は[TeX & LaTeX Advent Calendar](http://atnd.org/events/34318)の傘下記事です．
15日はk16.shikanoさんの「[TeX がむかついたので実装したけど挫折してる話](http://note.golden-lucky.net/2012/12/tex.html)」,
17日は@egtraさんの「[LCDF TypetoolsでOpenTypeフォントを使う(DVIPDFMXで)](http://dev.activebasic.com/egtra/2012/12/18/522/)」です．

neruko3114が参加しているのを見てなんだか楽しそうだったで参加してみました．
とはいってもネタも思いつかなったので，過去に作ったものをTeXに移植してみました．
ターゲットは[TinySegmenter](http://chasen.org/~taku/software/TinySegmenter/)．
以前作った[TinySegmenterMaker](https://github.com/shogo82148/TinySegmenterMaker)でLaTeXを出力できるようになったよ！

<!-- More -->

## 使ってみる

[TinySegmenterMaker](https://github.com/shogo82148/TinySegmenterMaker)のレポジトリをダウンロードするなり`git clone`するなりして
落としてきます．
レポジトリに入っているのはモデルファイルとスクリプトだけです．
これらを使ってTeXのスタイルファイルを作ります．

```bash
$ cd /path/to/TinySegmenterMaker/
$ ./maker tex < RWCP.model
```

カレントディレクトリにtinysegmenter.styができます．
TeX から見えるところにおいておきましょう．
これを使うソースコードは次のようになります．

```tex
\documentclass{jarticle}
\usepackage{tinysegmenter}
\begin{document}
\TinySegmenter{-}{私の名前は中野です}
\end{document}
```

platexで処理するとこんな感じに表示されるはず．

```plain
私-の-名前-は-中野-です
```

## 仕組み

TinySegmeneterは元の文章の一部を切り取ってハッシュに入れる動作をしている．
でも，LaTeXにはハッシュみたいなデータ構造がないのでコントロールシーケンスで代用．
`\@ifundefined`で有無を確認し，`\csname\endcsname`で置き換え．
コントロールシーケンスの一部に日本語を使わないといけないので，日本語LaTeX環境でしか動かない．
ただ，一部句点などの扱いが違う？よくわからない．

あとは，文字種の取得が必要なんだけど，ここでも同じことをしてます．
すべてのアルファベット・ひらがな・カタカナ・数字について，その文字種をベタ書き．
それ以外は全部漢字扱い．
そのため，それ以外の文字を使うとオリジナルとは違う結果になるかも．

最後は足し算．これはカウンタを使えば簡単ですね．


## 応用編

TinySegmenterMakerでは自由にモデルを差し替えることができます．
以前JavaScript版のTinySegmenterを使って，
[聞こえますか…自動生成…してみた…よ…](http://shogo82148.github.com/blog/2012/12/05/kikoemasuka/)
ということをしてみました．
LaTeXだってできるはず．

[聞こえますか…](https://github.com/shogo82148/kikoemasuka)
に心に呼びかけるためのモデルファイルが含まれています．
これをダウンロードして読み込ませます．

```bash
$ ./maker tex < model
```

これを自分のドキュメントに読み込ませてみます．

```tex
\documentclass{jarticle}
\usepackage{tinysegmenter}
\begin{document}
(…\TinySegmenter{…}{聞こえますか聞こえますかあなたの心に直接語りかけています}…)
\end{document}
```

私の声が聞こえましたか・・・？

```plain
(…聞こえますか…聞こえますか…あなたの…心に…直接語りかけています…)
```
