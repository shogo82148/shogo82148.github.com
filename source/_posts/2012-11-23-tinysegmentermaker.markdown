---
layout: post
title: "TinySegmenterの学習ツールを作ってみた"
date: 2012-11-23 14:37
comments: true
categories: [NLP]
---

[TinySegmenter][]は工藤さん作のJavaScriptだけで書かれたコンパクトな分かち書きソフトウェアです．
わずか20kバイト程度のサイズしかなく，お手軽に使える分かち書きソフトウェアですが，
当たり前のことながら学習データに使った新聞記事以外の文章の精度はイマイチ．
改善しようにも学習用のプログラムが公開されていないのでモデルの修正が大変です．

ないなら作ってしまいましょう！

<!-- More -->

## ダウンロード

ソースはgithubで公開しています．cloneするなりzipファイルを落としてくるなりしてください．

- [TinySegmenterMaker](https://github.com/shogo82148/TinySegmenterMaker)

## 学習方法

スペースで分かち書きしたコーパスをあらかじめ準備しておきます．
コーパスから分かち書きの情報と素性を取り出します．

``` bash
$ ./extract < corpus.txt > features.txt
```

AdaBoostを用いて学習します．
新しい弱分類器の分類精度が0.001以下，繰り返し回数が10000回以上となったら学習を終了します．

``` bash
$ g++ -O3 -o train train.cpp # コンパイル
$ ./train -t 0.001 -n 10000 features.txt model # 学習
```

きちんと分割できるが実際に試してみます．

``` bash
$ ./segment model
私の名前は中野です
私 の 名前 は 中野 です
```

## ライブラリの作成

[TinySegmenter][]は実装が簡単なためいろいろな言語へ移植されています．
モデルの更新のたびにそれらへの言語の移植バージョンを作るのは大変です．
というわけで，makerコマンドで各種言語用のライブラリを作れます．
学習結果のモデルはライブラリのなかに組み込まれ，ファイル単体で簡単に使用することができます．
allを指定することで，対応しているすべての言語向けのライブラリを出力します．

``` bash
$ ./maker javascript < model
$ ./maker perl < model
$ ./maker ruby < medel
$ ./maker python < model
$ ./maker cpp < model
$ ./maker all < model # 上のライブラリをすべて作成します
```


## AdaBoostについておさらい

[AdaBoost][]が面白そうだと前々から思っていて，
現実逃避にこれを使っているという[TinySegmenter][] の実装をしてみました．
簡単に[AdaBoost][]についてお勉強しておきましょう．

性能が悪い分類器だってたくさん集まれば高性能な分類器になれるはず！という
三人よれば文殊の知恵みたいな考え方としてBoostingがあります．
その学習方法の一つが[AdaBoost][]です．

### 初期化
データxが与えられたときのyを推定する問題を考えます．
あらかじめm個の学習データが与えられたとしましょう．

{% math %}
(x_1, y_1), \cdots, (x_m, y_m) ただし，y_i \in \{-1, +1\}
{% endmath %}

与えられたすべてのデータを判別するのが最終目標ですが，
弱い分類器にそこまで求めるのは酷です．
そこで分類器の評価の際に，間違えては困るデータに重み付けをすることにします．
その重みをDとしましょう．
はじめはどれが重要かわからないので重みは全て同じ，
扱いやすいように合計1になるように正規化しておきます．

{% math %}
D_1(i) = \frac{1}{m}, i = 1, \cdots, m.
{% endmath %}

### 弱分類器の選択

弱分類器 h_t を選びます．
弱分類器の作り方はなんでもいいのですが，+1か-1を結果として返し，{% m %}| 0.5 - \epsilon_t|{% em %} がなるべく大きくなるようなものを選びます．
{% m %}\epsilon_t{% em %} は分類に失敗したデータの割合(重み考慮)で，次式で定義されます．

{% math %}
\epsilon_t = \sum_{i=1}^m D_t(i) [y_i \not = h_t]
{% endmath %}

εが0か1に近い分類器は分類性能が高いということなので，最終的な分類器を構成するときに重みを大きくしたほうがいいような気がします．
εが1に近いということはほとんどの分類に失敗しているということなので，性能が高いというのは変な気がするけど，
必ず間違うのなら負号を反対にしてしまえばいいのです．

整理すると，重み関数の条件は，0か1に近くなると絶対値が大きく，0.5以上で負，0.5以下で正となるような関数，ということになります．
このような条件を満たす関数は無限に考えられますが，次の式使うといいらしいです(論理的背景があるんだろうけど理解はしていない)．

{% math %}
\alpha_t = \frac{1}{2} \log \frac{1-\epsilon_t}{\epsilon}
{% endmath %}


### 重みの更新

弱分類器の選択を何度も繰り返せば性能がどんどん上がっていくはずですが，ただ単に良い分類器を選ぶだけでは性能は上がりません．
今ある弱分類器で正しく分類できなかったデータを正しく分類してくれる(つまり今の欠点を補ってくれる)
弱分類器を次の候補とするべきです．

そこで，うまく分類できたデータの重みを少なく，分類できなかったデータの重みを大きくしましょう．

{% math %}
D_{t+1}(i) = \frac{D_t(i)\exp (-\alpha_t y_i h_t(x_i))}{Z_t}
{% endmath %}

Z_tは正規化のための係数です．
弱分類器の選択と重みの更新を繰り返すことで分類精度が上がっていきます．

### 分類する

最終的な分類器は
{% math %}
H(x) = \sum_{t=1}^T \alpha_t h_t(x)
{% endmath %}
となります．H(x)の負号が分類器の予測結果です．


## 実演
数式だけだとわかりにくと思うので分類の実演．
青丸と赤丸をAdaBoostで分類するテスト．弱分類器として座標軸と平行な直線を選択します．
重みの大きいデータは色が濃くなります．
分類に失敗しているデータは色が濃く，優先的に分類されることを確認できると思います．

<script type="text/javascript" src="http://jsdo.it/blogparts/1XZV/js"></script>

## 単語分割に応用

さて，学習の方法が分かったので単語分割への応用を考えます．
[TinySegmenter][]は，単語分割を文字と文字の間を分割するか/しないかという二値分類の問題と捉えます．
分類の手がかりとなる素性には，前後の文字列，文字種，以前の分類結果を使っています．

弱分類器には素性の有無を使っています．
このようなxが○以上とか素性がある/ないみたいな
ANDとかORを使わずに作れる弱分類器を 決定株(decision stump) というらしいです．
こうすることで弱分類器の重みが，そのまま素性の重みになります．


## 再学習機能

[AdaBoost][]の更新式を眺めていると

{% math %}
D_{T}(i) = \frac{\exp (H(x_i))}{Z_T}
{% endmath %}

と表すことができるということがわかります．
これはつまり，学習済みのモデルから学習中に使う変数がすべて復元できるということです．

この考えに基づいてTinySegmenterMakerでは再学習機能を実装してみました．

``` bash
$ ./train -t 0.0001 -n 10000 -M model_old features.txt model_new
```

この機能を使えば10000回とりあえず回してみて，不十分だからもう10000回追加，みたいなことができます．
同じコーパスを使っていれば，10000+10000回と20000回の結果はほぼ同じ結果になるはずです(もちろん浮動小数点演算の誤差が多少あるけど)．

この変数の復元は，元のモデルの学習に使ったものとは違うコーパスでも可能なので，
リポジトリに登録されているモデルを元に自分で用意したコーパスで学習することも可能なはず．
(どの程度性能が変わるのかとか論理的な解析・評価はしてないので，実際使えるものなのかはよくわからない)

オリジナルTinySegmenterのモデルからも再学習は可能だけど，こちらはスケールをいじってあるから再学習の効果はもっとよくわからない．


## ダイナミックプログラミング版TinySegmenter

分類器が返すスコアの絶対値は分類の確信度を表していると仮定して，
文章全体の確信度の合計が最大になる単語分割を採用するプログラムも書いてみた(tinysegmenter.dp.jp)．
AdaBoost自身がこの値をデータの重み付けに使っているくらいなので，この仮定はだいたいあっているんじゃないか
と勝手に考えているけど，論理的な裏付けをとったわけじゃないし性能評価もしてない．



## 参考

- [TinySegmenter][]
- [Adaboost][]
- [BimyouSegmenter][]
- [Text::TinySegmenter](http://search.cpan.org/dist/Text-TinySegmenter/)
- [TinySegmenterをPythonで書いてみた](http://www.programming-magic.com/20080726203844/)
- [TinySegmenterをRubyに移植](http://d.hatena.ne.jp/llamerada/20080224/1203818061)
- [TinySegmenter in D](http://d.hatena.ne.jp/repeatedly/20101105/1288946662)
- [tinysegmenter-cpp](http://code.google.com/p/tinysegmenter-cpp/)
- [PHP版TinySegmenter作ってみた](http://www.programming-magic.com/20080816010106/)
- [VBAでTinySegmenterしてみる](http://pub.ne.jp/arihagne/?entry_id=2768818)
- [TinySegmenter.NET : 分かち書きを行うC#のクラス](http://wiki.dobon.net/index.php?free%2FTinySegmenter.NET)
- [TinySegmenterをiPhone(Objective-C)に移植してみました](http://blog.bornneet.com/Entry/276/)
- [TinySegmenter.mをRegexKitLiteに対応させてみた](http://blog.bornneet.com/Entry/277/)
- [cmecab-java MeCabのJavaバインディング＋Lucene/Solr用トークナイザ・フィルタ](https://code.google.com/p/cmecab-java/)
  - おんなじインターフェースでTinySegmenterも使えるみたい
  - [TinySegmenter.java](https://code.google.com/p/cmecab-java/source/browse/trunk/src/net/moraleboost/tinysegmenter/TinySegmenter.java)
- [tiny-segmenter - xyzzy Lisp だけで実装されたコンパクトな分かち書きソフトウェア](http://miyamuko.s56.xrea.com/xyzzy/tiny-segmenter.html)

[TinySegmenter]: http://chasen.org/~taku/software/TinySegmenter/
[AdaBoost]: http://en.wikipedia.org/wiki/AdaBoost
[BimyouSegmenter]: http://ultraist.hatenablog.com/entry/20120603/1338675881
