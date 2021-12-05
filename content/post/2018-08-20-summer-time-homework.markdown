---
layout: post
title: "〜夏休みの自由研究〜 電波時計のサマータイム対応状況を調べてみた"
slug: summer-time-homework
date: 2018-08-20 09:29:00 +0900
comments: true
categories: [javascript, time]
---

僕は知っています。

[ぜひ、みなさんもお手元の電波時計で試してみてください！](https://shogo82148.github.io/blog/2018/08/11/web-jjy-summer-time-support/)

と書いても、試してくれる人なんていないことを。

僕は知っています。

説明書や仕様書に書いてあったとしても、書いてあるとおりに動作する機械なんて、ほんの一握りだということを。

というわけで、楽しい夏休みの自由研究です。
秋葉原で適当に買った1000円から3000円くらいの電波時計に、サマータイムのフラグを有効にした電波を受信させてみて、どういう挙動になるか調査してみました。

## TL;DR

10機種(SEIKO, CITIZEN, CASIO, MAG, ELECOM, その他)に対して、サマータイムフラグを有効にした状態で [Web JJY](https://shogo82148.github.io/web-jjy/) の電波を送信しました。

- 今回の調査範囲では、夏時間の時刻(1時間 or 2時間ズレた時刻)を表示する時計は見つからなかった
- **夏時間実施中(DST)と表示** する時計は実在する
- ~~室内で使うならCASIOの電波時計はクオーツ時計だと思ったほうがいい~~

電波受信の様子を[YouTubeにあげておいた](https://www.youtube.com/playlist?list=PL1yOTDApGhiNGtkco0yNr7styKfU1cFdV)ので興味のある方はどうぞ。

-----

## 背景

2018年、日本は記録的な猛暑に見舞われ、
観測史上最高の気温41.1度を記録し、
熱中症とみられる症状で90人以上が亡くなるという甚大な被害を被った。

- [今週の天気　記録的な猛暑　底知れぬ暑い夏](https://tenki.jp/forecaster/f_hiroaki/2018/07/22/1426.html)
- [日本で猛暑　気温41.1度で観測史上最高](https://www.bbc.com/japanese/44933492)
- [気象庁「災害と認識」熱中症死の疑い６日で９０人超](https://mainichi.jp/articles/20180724/k00/00m/040/113000c)

この記録的猛暑を受け、政府・与党によって2020年の東京五輪・パラリンピックの酷暑対策として、夏の期間だけ時間を2時間繰り上げる「サマータイム(夏時間)」の導入が検討されている。

- [酷暑対策でサマータイム導入へ　秋の臨時国会で議員立法　３１、３２年限定](https://www.sankei.com/politics/news/180806/plt1808060002-n1.html)

これに対して、「電波時計が狂うのではないか」「日本中の電波時計がゴミになる」等、電波時計が正しい時刻を示さなくなるとの指摘が相次いでいる。

- [サマータイム導入で「電波時計が狂う」？　メーカーに聞いた](https://www.sankei.com/life/news/180810/lif1808100016-n1.html)
- [サマータイムで日本中の電波時計がゴミになる(かも)という話](https://mzsm.me/2018/08/08/jjy-dst/)

電波時計は、NICT(情報通信研究機構)が提供している標準電波(JJY)を受信し、時刻の同期を行っている。
この標準電波には、時、分、通算日、年、曜日といったタイムコード情報に加え、
将来の拡張性のための「予備ビット」が設けられている。
この予備ビットに関して、「[標準電波の出し方について](http://jjy.nict.go.jp/jjy/trans/index.html)」には、夏時間情報として意味を持たせる場合の例が記載されているが、これはあくまでも例であり、告示などで正式に決まっているものではない。
しかし、現実に市販されている電波時計のなかにも、仕様上予備ビットの状態を認識する機種がする。

標準電波の送信周波数40kHzを提供する「おおたかどや山標準電波送信所」は1999年6月運用開始、送信周波数60kHzを提供する「はがね山標準電波送信所」は2001年10月運用開始である。
日本でサマータイムが導入されたのは1948年から1951年の期間だけなので、
今後サマータイムが導入されることとなれば、標準電波の運用が始まってから初のサマータイム導入となる。

- [夏時刻法 - Wikipedia](https://ja.wikipedia.org/wiki/%E5%A4%8F%E6%99%82%E5%88%BB%E6%B3%95)
- [長波帯標準電波施設 パンフレット(PDF)](http://www.nict.go.jp/pamphlet/long_wJ-panf.pdf)

そのため、仕様上はサマータイムへ対応している電波時計であっても、初のサマータイム実施によって未知の挙動を示すことが十分に想定される。
そこで、本記事では、実際にサマータイム実施中の電波を電波時計に受信させ、
どのような挙動を示すのかを明らかにする。

## 目的

2018年8月現在日本で市販されている電波時計が、サマータイムの情報を含んだ標準電波(JJY)を受信した場合の挙動を調査し、
仮に、2019年、2020年にサマータイムが導入された場合の影響を明らかにする。

## 実験方法

秋葉原で購入した以下の電波時計に対して、標準電波と同様の電波を送信し、時刻の同期を行う。

- CITIZEN 8RZ152
- CITIZEN 4RL432-019
- SEIKO SQ698S
- SEIKO KR331W
- MAG T-694 SM-Z
- ELECOM CLK-DD001RD
- 京都大和 171038
- (製造元不明) 31756
- CASIO DQD-710J-8JF
- CASIO TTM-160NJ-8JF

電波の送信には、Samsung Galaxy Note8 SC-01K を用いて、[JJYシミュレータWeb版](https://shogo82148.github.io/web-jjy/)を実行する。

## 結果

実験は[フラー株式会社本社](https://fuller-inc.com/company)で行った。
「はがね山標準電波送信所」から離れた場所にあるため、60kHzの標準電波は受信できない。
窓は「おおたかどや山標準電波送信所」のある方角とは逆にあるため、室内からは40kHzの標準電波も受信できない。

「夏時間を有効にする」にチェックを入れた状態で[JJYシミュレータWeb版](https://shogo82148.github.io/web-jjy/)を実行した結果を以下に示す。

### CITIZEN 8RZ152

<iframe width="560" height="315" src="https://www.youtube.com/embed/RLNRNyvxLnQ" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>

時刻の同期に成功し、サマータイム実施中であることを示す「DST」マークが表示された。
表示された時刻は現在時刻そのままで、サマータイムは考慮されていない。

### CITIZEN 4RL432-019

<iframe width="560" height="315" src="https://www.youtube.com/embed/b7gikZGdWuA" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>

時刻の同期に成功し、現在時刻がそのまま表示された。
サマータイムは考慮されておらず、表示からはサマータイム実施中か否かを判断することはできない。

### SEIKO SQ698S

<iframe width="560" height="315" src="https://www.youtube.com/embed/OoUBti-DVcg" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>

時刻の同期に成功し、現在時刻がそのまま表示された。
サマータイムは考慮されておらず、表示からはサマータイム実施中か否かを判断することはできない。

### SEIKO KR331W

<iframe width="560" height="315" src="https://www.youtube.com/embed/gDY8xwoO-is" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>

時刻の同期に成功し、現在時刻がそのまま表示された。
サマータイムは考慮されておらず、表示からはサマータイム実施中か否かを判断することはできない。

### MAG T-694 SM-Z

<iframe width="560" height="315" src="https://www.youtube.com/embed/qfYc1Cg_Ouo" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>

時刻の同期に成功し、現在時刻がそのまま表示された。
サマータイムは考慮されておらず、表示からはサマータイム実施中か否かを判断することはできない。

### ELECOM CLK-DD001RD

<iframe width="560" height="315" src="https://www.youtube.com/embed/DL_WCKmUosY" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>

時刻の同期に成功し、サマータイム実施中であることを示す「DST」マークが表示された。
表示された時刻は現在時刻そのままで、サマータイムは考慮されていない。

### 京都大和 171038

<iframe width="560" height="315" src="https://www.youtube.com/embed/nOrkCtBjdP4" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>

### (製造元不明) 31756

<iframe width="560" height="315" src="https://www.youtube.com/embed/UR4qfKsTcMk" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>

時刻の同期に成功し、現在時刻がそのまま表示された。
サマータイムは考慮されておらず、表示からはサマータイム実施中か否かを判断することはできない。

### CASIO DQD-710J-8JF

<iframe width="560" height="315" src="https://www.youtube.com/embed/JbsbwQsOvWc" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>

電波を受信していることがLCDの表示から読み取れるが、時刻の同期は行われなかった。
そのまま15分程度電波を送信を続けたが、受信に成功することはなかった。

### CASIO TTM-160NJ-8JF

<iframe width="560" height="315" src="https://www.youtube.com/embed/X-7z0Z5Dv78" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>

電波を受信していることがLCDの表示から読み取れるが、時刻の同期は行われなかった。
そのまま15分程度電波を送信を続けたが、受信に成功することはなかった。

## 考察

今回検証に使用した10機種のうち、「CITIZEN 8RZ152」「ELECOM CLK-DD001RD」の2機種で、
標準電波からサマータイムの情報を受け取り、サマータイム実施中の表示を行うことがわかった。
しかし、いずれの機種でも時刻は現在時刻をそのまま表示しており、サマータイムの影響は考慮されていない。

また、電波の送受信を行わない状態で「CITIZEN 8RZ152」「ELECOM CLK-DD001RD」をしばらく放置したところ、サマータイム実施中を示すDSTの表示が消えてしまった。
送信した電波は「夏時間実施中（６日以内に夏時間から通常時間への変更なし）」を表すものなので、電波が受信できない状態でも、少なくとも6日間はDSTの表示を行うべきである。
電波の受信状況は時間や天候の影響を受けるため、常に安定して電波を受信できることは期待できない。
電波の受信状況によってDSTの表示が頻繁に切り替わってしまうと、電波時計の表示から本当にサマータイム実施期間であるかを判断することが難しく、大変不便であると考える。
なお、「背景」で述べたように、標準電波のサマータイム情報は正式に告示されたものではないため、仮に「夏時間実施中（６日以内に夏時間から通常時間への変更なし）」であったとしても、実際に本記事の実験の通りに標準電波が運用されるとは限らないことに注意して欲しい。

CASIOの製品についてはサマータイムの検証を行うことができなかった。
下に示すように屋外に置いたところ正しい時刻を示したので、電波時計として機能することは確認できた。

<blockquote class="twitter-tweet" data-lang="ja"><p lang="ja" dir="ltr">電波受信完了を待ってる <a href="https://t.co/klPoZLAefU">pic.twitter.com/klPoZLAefU</a></p>&mdash; Ichinose Shogo (@shogo82148) <a href="https://twitter.com/shogo82148/status/1031122343194583040?ref_src=twsrc%5Etfw">2018年8月19日</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

## 結論

10機種(SEIKO, CITIZEN, CASIO, MAG, ELECOM, その他)の電波時計に対して、サマータイムフラグを有効にした状態で標準電波と同様の電波を送信した。
その結果、今回の調査範囲では、夏時間の時刻(1時間 or 2時間ズレた時刻)を表示する時計は見つからなかった。

ただし、**夏時間実施中(DST)と表示** する時計は実在することが確認できた。
そのような機種でも、電波の受信状況によりDSTの表示が切り替わってしまうため、
電波時計の表示から本当にサマータイム実施期間であるかを判断することが難しく、大変不便であると考える。

**サマータイムの導入なんてとっとと諦めろ**

## 参考文献

- [今週の天気　記録的な猛暑　底知れぬ暑い夏](https://tenki.jp/forecaster/f_hiroaki/2018/07/22/1426.html)
- [日本で猛暑　気温41.1度で観測史上最高](https://www.bbc.com/japanese/44933492)
- [気象庁「災害と認識」熱中症死の疑い６日で９０人超](https://mainichi.jp/articles/20180724/k00/00m/040/113000c)
- [酷暑対策でサマータイム導入へ　秋の臨時国会で議員立法　３１、３２年限定](https://www.sankei.com/politics/news/180806/plt1808060002-n1.html)
- [サマータイム導入で「電波時計が狂う」？　メーカーに聞いた](https://www.sankei.com/life/news/180810/lif1808100016-n1.html)
- [サマータイムで日本中の電波時計がゴミになる(かも)という話](https://mzsm.me/2018/08/08/jjy-dst/)
- [標準電波の出し方について](http://jjy.nict.go.jp/jjy/trans/index.html)
- [夏時刻法 - Wikipedia](https://ja.wikipedia.org/wiki/%E5%A4%8F%E6%99%82%E5%88%BB%E6%B3%95)
- [長波帯標準電波施設 パンフレット(PDF)](http://www.nict.go.jp/pamphlet/long_wJ-panf.pdf)

## 謝辞

実験に協力してくれた時計たちを格安でお譲りします。詳しくは [@shogo82148](https://twitter.com/shogo82148) まで。
早いもの勝ちですよ！！！

<blockquote class="twitter-tweet" data-lang="ja"><p lang="ja" dir="ltr">実験に協力してくれた時計たち <a href="https://t.co/yN8OPwlaB8">pic.twitter.com/yN8OPwlaB8</a></p>&mdash; Ichinose Shogo (@shogo82148) <a href="https://twitter.com/shogo82148/status/1031508937311318016?ref_src=twsrc%5Etfw">2018年8月20日</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>


~~1000円の製造元すらわからない格安電波時計に感度で負けてるので、CASIOにはもうちょっと頑張って欲しい~~
