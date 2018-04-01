---
layout: post
title: "Goでデプロイ神社書いてみた"
date: 2015-12-13T10:51:00+09:00
comments: true
categories: [go, golang]
---

[Go その2 Advent Calendar 2015](http://qiita.com/advent-calendar/2015/go2)の13日目の記事です。

- [その1](http://qiita.com/advent-calendar/2015/go)
- [その2](http://qiita.com/advent-calendar/2015/go2)
- [その3](http://qiita.com/advent-calendar/2015/go3)

六曜を知ることができる便利コマンドを作ってみたお話です。

<!-- More -->

## Deploy神社とは

[Maco_Tasu](https://twitter.com/Maco_Tasu)が作ったいつdeployしたら安全かを教えてくれる便利APIです。
詳しくは作者ブログ記事をどうぞ。([Deploy神社APIを作った- 眠すぎて明日が見えない](http://macotasu.hatenablog.jp/entry/2014/11/13/214337))

便利APIなのですが、依存している外部APIが利用できなくなってしまったため、Deploy神社自体が利用できなくなっています。

## 作ってみた

デプロイする時間が分からないと不便なので、Go実装を作ってみました。

- [shogo82148/go-deploy-shrine](https://github.com/shogo82148/go-deploy-shrine)

`go get`してきてお祈りを捧げればデプロイするべき時間を教えてくれます。

``` bash
$ go get github.com/shogo82148/go-deploy-shrine/cli/pray
$ pray
今日は旧暦の11月3日(先勝)です。deployは午前中に済ませましょう。
```

[先勝 - Weblio](http://www.weblio.jp/content/%E5%85%88%E5%8B%9D)

> 六曜の一。急用や訴訟などによいとされ，早く事を行うのがよく，午前は吉，午後は凶という日。先勝日。せんかち。さきがち。

今日12月13日は先勝で午前中にデプロイするのが良いようです。便利ですね。


## 六曜とは

むかしのカレンダーには暦注と呼ばれる「今日の運勢」みたいなものが記載されていたらしいです。
六曜はその暦注のひとつで、現在のカレンダーにも記載されることの多い影響力の大きなものです。

詳しくはWikipediaで。

- [六曜 - Wikipedia](https://ja.wikipedia.org/wiki/%E5%85%AD%E6%9B%9C)

旧暦の(月＋日)を6で割った余りから簡単に求めることができます。

- 0: 大安
- 1: 赤口
- 2: 先勝
- 3: 友引
- 4: 先負
- 5: 仏滅

## 旧暦とは

旧暦の月日を求めることができれば六曜は簡単に出せるのですが、
日本における旧暦である[天保暦](https://ja.wikipedia.org/wiki/%E5%A4%A9%E4%BF%9D%E6%9A%A6)は月の満ち欠けと太陽の動きを元にした暦法であり、
月と太陽の動きを正確に予測する必要があります。

Go版デプロイ神社では「日の出・日の入りの計算―天体の出没時刻の求め方」で紹介されていた計算式を用いています

<iframe src="http://rcm-fe.amazon-adsystem.com/e/cm?lt1=_blank&bc1=000000&IS2=1&bg1=FFFFFF&fc1=000000&lc1=0000FF&t=shogo82148-22&o=9&p=8&l=as4&m=amazon&f=ifr&ref=ss_til&asins=4805206349" style="width:120px;height:240px;" scrolling="no" marginwidth="0" marginheight="0" frameborder="0"></iframe>


## 2033年旧暦閏月問題

天保暦をそのまま当てはめると2033年に月を決定できない問題が知られています。
日本カレンダー暦文化振興協会というところが「閏11月を推奨する」との見解を2015年8月に出しています。

- [2033年旧暦閏月問題の見解](http://www.rekibunkyo.or.jp/year2033problem.html)

Go版デプロイ神社では時憲暦方式を採用したつもりです。


## せめてGoっぽい話題を

引数に日付を渡すとその日の六曜をかえしてくれます。
いろんな形式に対応していて、以下はすべて2006年1月2日の六曜を返します。

``` bash
$ pray 20060102
$ pray 1/2/2006
$ pray 2-Jan-06
$ pray 2-Jan-2006
$ pray 2/Jan/2006
$ pray 'Jan 2 2006'
2006-01-02は旧暦の12月3日(友引)です。昼のdeployはさけましょう。するなら朝晩が吉です。
```

引数の解析には [tkuchiki/parsetime](https://github.com/tkuchiki/parsetime)を使っています。
たいていの日時フォーマットなら解析してくれる便利ライブラリです。


## 最後に

暦法とか天文学とかよくわかってない人間が作ったプログラムなので、結果の保証はできません。
今月の旧暦は[六曜計算 - 高精度計算サイト](http://keisan.casio.jp/exec/system/1186108192)の計算結果と一致することは確認していますが、
他の日でも正しい結果を返すかどうかは未検証です。

Go版デプロイ神社を信じてのデプロイして事故っても、責任は負いかねますのでご了承ください。
