---
layout: post
title: "グロンギ語翻訳辞書をアップデートしました"
slug: update-grongish-dictionary
date: 2016-02-27T10:27:00+09:00
comments: true
categories: []
---

やることがたくさんあるときに限ってどうでもいいことが捗ってこまっているいっちーです。
先日、挑戦状を受け取ったので、グロンギ語翻訳の品質改善に挑戦しました。

<blockquote class="twitter-tweet" data-lang="ja"><p lang="ja" dir="ltr">《緊急告知》2月26日(金)、何かが起こる!!「仮面ライダークウガ」にまつわる新商品のようですが・・・。ページに書かれているのは、グロンギ語？お客様の中で、リントの言葉に翻訳できる方はいらっしゃいますか～？ <a href="https://t.co/hMDQCST6Tz">https://t.co/hMDQCST6Tz</a></p>&mdash; プレミアムバンダイ (@p_bandai) <a href="https://twitter.com/p_bandai/status/699790752985931776?ref_src=twsrc%5Etfw">2016年2月17日</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>


- [仮面ライダークウガより衝撃の新アイテム登場 ボンジ・ジュグギゾ・ガギバギ・グスと判明!(投げやり)](http://nlab.itmedia.co.jp/nl/articles/1602/17/news123.html)

お手軽に試せるページも作ったので、こちらでお試し下さい。

- [グロンギ語翻訳](http://shogo82148.github.io/Grongish/)


<!-- More -->

## 変換の仕組み

変換の仕組みの詳細は[以前書いた記事](http://shogo82148.hatenablog.com/entry/2012/02/11/181441)をどうぞ。
概略だけ書いておくと、
日本語からグロンギ語への変換は[MeCab](http://taku910.github.io/mecab/)を使った読み・品詞推定の結果もとに、
変換ルールを適用して翻訳しています。
グロンギ語から日本語への翻訳は、この翻訳問題が実は仮名漢字変換と同じ問題だということを利用して、
IMEの辞書をグロンギ語対応したものを使っています。

## 変換ロジックの修正

### 旧版の問題点

- ボンジジュグギゾガギバギグス: 紺地重視を再開する
- ゲゲルンギバブゾロヅボパザセザ: ゲームのしなくっ持つのはだれだ
- ゲゲルゾザジレスゾ: ゲームを始めるぞ

「この日」は「ボンジ」が正しいのですが、「ボボジ」と変換していたため正しく認識できていませんでした。
「の」は通常「ガ」になるのですが、助詞として現れたときは「ン」になります。
さらに連体詞の一部として出てきたときも「ン」になるのですが、こちらのルールが抜けていました。


### さらなる改良

旧版は[mecab-skkdic](http://chasen.org/~taku/software/mecab-skkserv/)を元にした辞書を使っていましたが、
[mozc](https://github.com/google/mozc)ベースに変更しました。
mozcの辞書はクラスタリングや語彙化のような粒度調整が行われており、変換精度の向上が期待できます。
どのようが調整が行われたかは[Mozcソースコード徹底解説 ](http://www.slideshare.net/nokuno/tokyotextmining02-mozc)や
[言語処理学会でのMozcの資料](http://www.anlp.jp/proceedings/annual_meeting/2011/pdf_dir/C4-3.pdf)を見るとよいと思います。

mozcの変換エンジンをそのまま使えると良かったのですが、すごく面倒なことがわかったのでギブアップしました。
(依存モジュールの関係で32bit版しかビルドできず64bitのプログラムからは直接呼び出せないとか、C++とかC++とかC++とか)
mozcとMeCabの辞書構造は非常に似ているので、MeCabの辞書形式に変換して利用しています。
mozcには共起辞書を使った補正機能(例えば同じ「かいたい」という読みでも、「猫を飼いたい」「マグロを解体」を出し分ける機能)など、
MeCabにはない機能も入っているので、そのうち挑戦してみたいですね。
ただし、mozcには機能だけ組み込まれていて辞書が入っていないので、mozcを使っただけだと大差ないかもしれません。


### 改良の結果

- ボンジジュグギゾガギバギグス: この日重視を再開する
- ゲゲルンギバブゾロヅボパザセザ: ゲームの資格を持つ子は誰だ
- ゲゲルゾザジレスゾ: ゲームを始めるぞ

だいぶ近くなりました。
「重視」と「遊戯」はグロンギ語で同じ音なので、難しいですね。


## 変換サーバの実装

ライブラリはPythonで書いてあるので、
PythonのWebフレームワークである[Pyramid](http://www.pylonsproject.org/)を使ってAPI化してみました。


### デプロイ時のファイル置き換えをアトミックにする

sakuraのVPS上で[droot](http://yuuki.hatenablog.com/entry/droot)を使って起動しています。
kazuhoさんの「[server-starter が SIGHUP 受け取ると pull 型のデプロイツールが起動して、そいつが新しいディレクトリにイメージを展開して、そこに chroot してアプリケーションが動き出すスタイル](https://twitter.com/kazuho/status/671489245895221248)」を実践してみたくなったので、以下のようなスクリプトを書いてみました。

``` bash
CONTAINER_DIR=/var/containers/hogehoge-$$
tar zfx hogehoge.tar.gz -C $CONTAINER_DIR

droot run --root $CONTAINER_DIR exec gunicorn server:application &
CHILD=$!

_term() {
    kill -TERM "$CHILD" 2>/dev/null
}

trap _term SIGTERM

_cleanup_child() {
    droot rm --root $CONTAINER_DIR
}

trap _cleanup_child EXIT

wait "$CHILD"
```

起動時にイメージの展開を行い、終了時には展開したディレクトリのお掃除をします。
[「デプロイ時のファイルの置き換えを atomic にする」](https://twitter.com/kazuho/status/671489766689341440)ことができている・・・はず。
MeCabの辞書って上書きして大丈夫なの？とか余計なことを考えなくて済むので楽ちんですね。
(mmapしているから直接書き換えるとまずそう。mvすればinodeが変わるから行けるかもしれないけど、単語辞書と品詞辞書とで不整合起きたらまずくないか？とか)
モジュールが遅延ロードされて一部のモジュールだけ最新版になってしまい新旧の互換性が無くて死んだり、
テンプレートだけ都度読み込みになっていたため新旧の互換性が無くて死んだり、といったつらい経験があるのでこれは嬉しいです。

ただ、Dockerイメージをtarで固めたものはそこそこサイズがあって展開に時間がかかるのが不安です。
もたもたしていると Server::Starter が旧プロセスを殺してしまうので、ここは迅速に行う必要があります。
timeoutを付けてパラメータ調整すれば少しは安心かな・・・。


### graceful restart

前述のスクリプトを Server::Starter 経由で起動すれば、プロセスの入れ替わりはできるのですが、
graceful restartするにはサーバのプログラムが Server::Starter に対応している必要があります。
PerlであればStarlet,Starman,Gazelleといった対応モジュールが出回っていますが、
残念ながら今回の変換器はPythonです。

PythonのWSGIサーバであるgunicornはRuby版のunicornと大体同じ作りになっているっぽいので、
[Server::Starterに対応するとはどういうことか](http://d.hatena.ne.jp/limitusus/20131225/1387993119)
で紹介されているのと同じ方法が使えます。

どこでフックして変換コードを差し込めばいいかよくわかなかったので、さっきの起動スクリプトに差し込んでみました。

``` bash
if [[ -n "${SERVER_STARTER_PORT-}" ]]; then
    export GUNICORN_FD=$(echo $SERVER_STARTER_PORT | tr ';' ' ' | xargs -n1 | cut -d= -f2 | xargs | tr ' ' ',')
fi
```

僕はShell Script芸人じゃないので、もっとシンプルな書き方があれば教えていただきたい。


## あとがき

最初の予告ツイートの商品の販売が始まってましたね。

- [仮面ライダークウガ グロンギ ゲゲルの掟セット【プレミアムバンダイ限定】](http://p-bandai.jp/item/item-1000102778/)
- [「仮面ライダークウガ」でグロンギ族の必須アイテム「グゼパ」、初の商品化 襲った人間が数えられる!](http://nlab.itmedia.co.jp/nl/articles/1602/27/news018.html)

商品ページのグロンギ語をいくつか解読してみましたが、あまりうまくいかない・・・。
本家グロンギ語は語順が変わっている場合もあって流石に難しいですね。
