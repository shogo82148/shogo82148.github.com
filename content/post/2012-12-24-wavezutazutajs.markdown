---
layout: post
title: "JavaScript版WaveZutaZuta作ってみた"
slug: wavezutazutajs
date: 2012-12-24T13:51:00+09:00
comments: true
categories: [JavaScript, WebAudio]
---

「[WaveZutaZutaというおもちゃを書いている話](http://nekogata.hatenablog.com/entry/2012/12/23/155250)」
という記事を見ていたら，誰かがツイッターで
「いっちーがJavaScriptに移植してくれる」と発言．

あ，はい．やってみましょう．

<!-- More -->

## どんな感じのものなの？

音声ファイルをテキトーに切り貼りできるライブラリです．
[WaveZutaZutaJS](https://shogo82148.github.io/WaveZutaZutaJS/)にブラウザで実行出来るサンプルを置いたので
実際試してみるのが一番わかりやすいと思います．
適当な音声ファイルをドラッグ＆ドロップして，playボタンを押すと音が流れるので，いろいろ遊んでみてください．

テキストボックスには楽譜が書かれています．
楽譜の書き方は「[WaveZutaZutaというおもちゃを書いている話](http://nekogata.hatenablog.com/entry/2012/12/23/155250)」
と同じです．

> ちなみに、楽譜ファイルの読み方、書き方ですが、aからzまでの文字それぞれにずたずたにされたwaveファイルの"破片"がアサインされていて、-は音をのばす(タイ)を意味し、0は休符を意味します。*を指定すると、a-zのうちどれかをランダムで鳴らします。1文字が64分音符ひとつ分の長さです。空白文字は無視されます。


## 使い方

[リポジトリ](https://github.com/shogo82148/WaveZutaZutaJS)の WaveZutaZutaJS.js がライブラリの本体です．
次のように使います．

``` javascript
var data = new ArrayBuffer(); // ずたずたにしたい音声データを入れておく
var context = new AudioContext();
var zuta = new WaveZutaZuta(context);
zuta.onSuccess = function(self, source) {
    // 元の音声の先頭5秒から3秒間流す
    zuta.setNote('a', 5);
    var node = zuta.getAudioNode([{sound: 'a': length: 3}]);
    node.connect(context.destination);
};
zuta.loadAudio(data);
```

`data` には入力音声のバイナリデータを入れておきます．
形式はブラウザが対応していれば何でもOKです．
Chromeなら wav, mp3, mp4 など，メジャーな形式はたいてい読めると思います．

`getAudioNode`で返ってくるのは AudioNode なので，WaveZutzZutaJS の出力にさらにエフェクトをかけることができます．
例えば，次のコードで周波数フィルタを通すことができます．

``` javascript
var data = new ArrayBuffer(); // ずたずたにしたい音声データを入れておく
var context = new AudioContext();
var zuta = new WaveZutaZuta(context);
zuta.onSuccess = function(self, source) {
    // 元の音声の先頭5秒から3秒間流す
    zuta.setNote('a', 5);
    var node = zuta.getAudioNode([{sound: 'a': length: 3}]);

    // 周波数フィルタを用意
    var filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1000;

    // 接続
    node.connect(filter);
    filter.connect(context.destination);
};
zuta.loadAudio(data);
```


## 簡単な技術解説

### decodeAudioData

WebAudioの`decodeAudioData`を使うと音声データからPCMデータを得ることができます．
これを使うと音声データを配列として得ることができるので，
WeveZutaZutaJSではこの配列を切り貼りしてずたずたにしています．

```javascript
var data = new ArrayBuffer() // 音声データ
var context = new AudioContext();
context.decodeAudioData(data, function(buf) {
    //buf には AudioBuffer 型の音声データが入っている

    var float32array = getChannelData(0);
    // float32array を適当にいじる
});
```

### JavaScriptNode

JavaScriptNode は音源やフィルタ・アナライザを JavaScript のコードを使って書くことの出来るものです．
例えば，正弦波を生成するコードは次のようになります．

``` javascript
var context = new AudioContext();
var node = context.createJavaScriptNode(2048, 0, 1); // バッファの大きさ，入力の数，出力の数
var x;
node.onaudioprocess = function(buf) {
    var data = buf.outputBuffer.getChannelData(0);
    var i;
    for(i = 0; i < data.length; ++i) {
        data[i] = Math.sin(x++);
    }
};
node.connect(context.destination);
```
