---
layout: post
title: "リアルタイムにテンションを上げてみた"
date: 2012-10-03 11:42
comments: true
categories: 
---

昨日，Twitterで[猫型さん](https://twitter.com/neko_gata_s)の[アイコンのテンションが上がっている](https://twitter.com/uzulla/status/252319924435955713)話をしていたら，
こんな無茶ぶりをされたんですよ．

<blockquote class="twitter-tweet" lang="ja"><p>明日には、いっちーがWebRTCでリアルタイムテンション上がってきたサービス作ってくれるだろうし、猫型さんがアプリの申請出してるだろう</p>&mdash; Takashi Sasakiさん (@civic) <a href="https://twitter.com/civic/status/253126217744646145" data-datetime="2012-10-02T13:36:07+00:00">10月 2, 2012</a></blockquote>
<script src="//platform.twitter.com/widgets.js" charset="utf-8"></script>

いいだろう，その挑戦受けてやる！

<!-- more -->

## WebRTCって？

WebRTCというのはブラウザ上で Real Time Communication を行うAPI群のことことです．

- ローカルデバイス(Webカメラとかマイクとか)へのアクセス
- ブラウザ同士が(サーバを介さずに)直接通信

なんてことができるようになるらしいです．
つまり WebRTCを使えば Skype っぽいものをプラグインのインストールなしにブラウザ上で実現できるってわけですね．
[Chrome の最新安定版で、ウェブの最先端に触れてみよう](http://googlejapan.blogspot.jp/2012/08/chrome.html)から
いろいろなWebRTCを使ったデモを見ることができます．
僕も[似顔絵描いてもらった](http://goo.gl/kDV5i)りしてみました．

## getUserMedia API を使ってみる

まだまだ仕様策定中で対応ブラウザがほとんどない状況ですが，
2012年10月現在，最新版の Chrome 21 で前者のローカルデバイスへアクセスするAPIである getUserMedia API が使えるようです．
早速遊んでみましょう．

``` javascript
navigator.getUserMedia(
    {video: true}, // constrains: 接続先のデバイス
    function successCallback(stream) {
        // アクセス成功
        // stream に LocalMediaStream オブジェクトが入ってる

        // <video id="video"></video> 要素を取ってくる
        var video = document.getElementById('video');
        
        // BlobURLに変換してsrcに入れる
        video.src = URL.createObjectURL(stream);
        
        // 再生
        video.autoplay = true;
    },
    function errorCallback() {
        // エラー！！
    }
);
```

簡単ですね！

現在のところgetUserMediaとURLにはベンタープレフィックスが必要なようです．

## エフェクトを加える

表示しただけじゃつまらないのでエフェクトをかけてみます．
videoタグに対してCSSで変形することもできるはずですが，
もっと自由度が欲しいのでCanvasを使います．

``` javascript
var canvas = document.getElementById('canvas');
var context = canvas.getContext('2d');
requestAnimationFrame(function render() {
    context.drawImage(video, 0, 0, width, height);
    requestAnimationFrame(render);
});
```

Canvasに画像を描画するのと全く同じ方法でカメラ映像も描画できます．
しかし，drawImageでは一コマしか描画されないので，requestAnimationFrameを使って常に最新のコマが表示されるようにしています．
requestAnimationFrame を使うとブラウザの描画タイミングに合わせて呼び出してくれたり，
軽かったりするらしいです．
ベンダープレフィックスが必要なので適宜つけてあげて．

Canvasに描画できてしまえば，あとはなんでもし放題！
strokeやfillで落書きしてみたり，drawImageで画像をオーバレイしみたり，
getImageData + putImageDataを使えばピクセル単位でいろいろいじったりだってできます．


## 顔認識

さて，テンションを上げるには顔部分をブレさせる必要があります．
顔検出が必要ですね．

javascriptの顔検出ライブラリといえば[ccv](https://github.com/liuliu/ccv)というのが有名らしいので，これを使ってみます．
レポジトリ中のccv.jsとface.jsを読み込んで，

``` javascript
var comp = ccv.detect_objects({
    canvas :ccv.grayscale(detection_canvas),
    cascade : cascade,
    interval : 5,
    min_neighbors : 1 });
```

とすると，`[{x:0, y:0, width:100, height:100}]`みたいな感じで顔の場所を取得できます．


## 組み合わせる

組み合わせるとこんな感じ [リアルタイムにテンション上げる](http://shogo82148.github.com/tension-upper/)

元の位置から少しずれた場所に顔画像を重ねることでブレた感じにしてます．
周りの人からテンションの上がり具合が足りないと言われてしましました．
もっといいテンションのあげ方があったら教えてください．


## 参考
- [Media Capture and Streams](http://dev.w3.org/2011/webrtc/editor/getusermedia.html#navigatorusermedia)
- [WebRTCでドラゴンボールごっこ](http://www.slideshare.net/girigiribauer/webrtc-13716640)
- [webRTCで顔認識(face.js)を試してみた。](http://alumi.hateblo.jp/entry/2012/03/22/163845)
- [ccv](https://github.com/liuliu/ccv)
