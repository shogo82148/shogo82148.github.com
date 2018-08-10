---
layout: post
title: "Web JJY が夏時間に対応しました"
slug: web-jjy-summer-time-support
date: 2018-08-11 07:29:00 +0900
comments: true
categories: [javacript]
---

サマータイムなんて日本人には関係ないと思っていた時期が僕にもありました。
ところが何やら日本にもサマータイムがやってくる動きがあるようです。

- [酷暑対策でサマータイム導入へ　秋の臨時国会で議員立法　３１、３２年限定](https://www.sankei.com/politics/news/180806/plt1808060002-n1.html)

さて、[長波JJY(市販の電波時計のための電波)](http://jjy.nict.go.jp/jjy/trans/index.html)には夏時間の情報が含まれています。
「将来の拡張性のための予備ビット」という扱いなので、対応している時計なんてないだろう、と思っていたら、
なんと[対応している時計が存在している](https://mzsm.me/2018/08/08/jjy-dst/)らしいということを知りました。

その事実を確かめるため、[Webブラウザを使って電波を出してみた](https://shogo82148.github.io/blog/2016/03/29/web-jjy/)で紹介した
[JJYシミュレータWeb版](https://shogo82148.github.io/web-jjy/)に夏時間を有効にするチェックボックスを追加しました。

## CITIZEN 8RZ152 の動作例

<blockquote class="twitter-tweet" data-lang="ja"><p lang="ja" dir="ltr">夏時間への同期、完了しました 😂😂😂 <a href="https://t.co/3tMcCYdXpP">pic.twitter.com/3tMcCYdXpP</a></p>&mdash; Ichinose Shogo (@shogo82148) <a href="https://twitter.com/shogo82148/status/1027691418637107202?ref_src=twsrc%5Etfw">2018年8月9日</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

<blockquote class="twitter-tweet" data-conversation="none" data-lang="ja"><p lang="ja" dir="ltr">念の為書いておきますが、今は午前8時です</p>&mdash; Ichinose Shogo (@shogo82148) <a href="https://twitter.com/shogo82148/status/1027694764697645056?ref_src=twsrc%5Etfw">2018年8月9日</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

DST(Daylight Saving Time)の表示が出て、夏時間に切り替わったことがわかりますが、なぜか6時間もズレています・・・。

<blockquote class="twitter-tweet" data-conversation="none" data-lang="ja"><p lang="ja" dir="ltr">もう、こんな時間だ……そろそろ寝よう……<br><br>？？？お前24時間表記だっただろ？どうしたんだ？？？<br>(今は20時です) <a href="https://t.co/8PViLOaj85">pic.twitter.com/8PViLOaj85</a></p>&mdash; Ichinose Shogo (@shogo82148) <a href="https://twitter.com/shogo82148/status/1027876134736646145?ref_src=twsrc%5Etfw">2018年8月10日</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

<blockquote class="twitter-tweet" data-conversation="none" data-lang="ja"><p lang="ja" dir="ltr">悲報 11日を迎えることができず <a href="https://t.co/pw0k0Qo8RY">pic.twitter.com/pw0k0Qo8RY</a></p>&mdash; Ichinose Shogo (@shogo82148) <a href="https://twitter.com/shogo82148/status/1027988579417346050?ref_src=twsrc%5Etfw">2018年8月10日</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

もはや数字ではないものが出てきた。

## まとめ

夏時間に対応した電波時計の存在は事実でした。
しかし、機種によっては挙動がおかしくなるようです(N=1)。

ぜひ、みなさんもお手元の電波時計で試してみてください！

- [JJYシミュレータWeb版](https://shogo82148.github.io/web-jjy/)

※ 利用の結果生じた損害について、一切責任を負いません。

## 参考

- [標準電波の出し方について](http://jjy.nict.go.jp/jjy/trans/index.html)
- [酷暑対策でサマータイム導入へ　秋の臨時国会で議員立法　３１、３２年限定](https://www.sankei.com/politics/news/180806/plt1808060002-n1.html)
- [Webブラウザを使って電波を出してみた](https://shogo82148.github.io/blog/2016/03/29/web-jjy/)
- [サマータイムで日本中の電波時計がゴミになる(かも)という話](https://mzsm.me/2018/08/08/jjy-dst/)
- [サマータイム導入で「電波時計が狂う」？　メーカーに聞いた](http://www.itmedia.co.jp/news/articles/1808/09/news094.html)

<iframe src="//www.slideshare.net/slideshow/embed_code/key/dcdqZKvIZ1tukL" width="595" height="485" frameborder="0" marginwidth="0" marginheight="0" scrolling="no" style="border:1px solid #CCC; border-width:1px; margin-bottom:5px; max-width: 100%;" allowfullscreen> </iframe> <div style="margin-bottom:5px"> <strong> <a href="//www.slideshare.net/tetsutalow/ss-109290879" title="サマータイム実施は不可能である" target="_blank">サマータイム実施は不可能である</a> </strong> from <strong><a href="https://www.slideshare.net/tetsutalow" target="_blank">UEHARA, Tetsutaro</a></strong> </div>

僕もサマータイム実施は不可能だと思います・・・。
