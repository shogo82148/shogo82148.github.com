---
layout: post
title: "Javascriptでの関数宣言"
date: 2012-03-23 18:22
comments: true
categories: [javascript, AjaxIME]
---

## Chrome17対応版AjaxIME
Ajaxを使ってIMEを実現した[AjaxIME](http://ajaxime.chasen.org/)がFireFoxでは動くのに最新版のChromeで動かない。
動くように少しいじってみた。

- [Chrome17対応版AjaxIME](http://shogo82148.github.com/AjaxIME/)

<!-- more -->

## 原因

Chromeで動かなかった原因はここ。

``` javascript
if(typeof getComputedStyle == 'undefined') {
    function getComputedStyle() {
        //中身は省略
    }
}
```

FireFoxやChromeには getComputedStyle という関数が定義されているけど、
IEには定義されていない。
if文で有無を判定して、無い場合は動作をエミュレートする関数を定義している。

実行の様子をデバッガで追って見ると、Chromeではエミュレートする必要が無いのになぜか自前で定義した関数が呼び出されていた。
どうやら、Chromeでは 自作 getComputedStyle 関数が if文の中にあったとしてもコード読み込み時に作成されてしまうみたい。
FireFox だと if文の中が実行されない場合には作成されない。

結果だけ書くと、次のように書きなおしたら動いた。 

``` javascript
if(typeof getComputedStyle == 'undefined') {
    getComputedStyle = function() {
        //中身は省略
    }
}
```

あと Chrome だと、Input要素にフォーカスがあたった時に余計な装飾がついてしまうので、CSS上書きして抑制。
IE8でTextRangeが使えない問題は「[IE8でのTextRange.moveToPoint()](http://d.hatena.ne.jp/kanehama/20100330/1269946922)」を参考にして解決。
IE7のエミュレートモードにしているだけで、根本的な解決にはなってないけど、まあIEだしいいでしょ。


## どっちが正しいの？
とりあえず問題は解決したんだけど、FireFoxとChromeで動作が違うけど、どちらの動作が正しいの？
気になったので調べてみた。

「[mixi Engineers' Blog >> 詳細 ECMA-262-3 第5章 関数](http://alpha.mixi.co.jp/entry/2012/10814/)」に関数の定義法についてわかりやすい解説が載っていた。
結論からいうと、一番初めの書き方は「誤り」で実際の動作は実装依存、つまり FireFox の動作も Chrome の動作も正しいとのこと。


## 関数定義と関数式

関数の定義法は大きく分けて、次のような関数定義と関数式に分かれている。
関数式は更に名前なしと名前付きがある。

```javascript
//関数定義
function foo() {
}

//名前なしの関数式
var foo = function() {
};

//名前付きの関数式
var foo = function _foo() {
};
```

普通の関数定義と無名関数があるのは知っててけど、単なるシュガーシンタックスみたいなものかと思った。
mixiのブログによると全くの別物。
関数定義と関数式の大きな違いは、実行時に呼び出し可能になっているかどうか。
関数定義は実行時に呼び出し可能になっているから、定義と呼び出しの順番は関係ない。

```javascript
foo(); //OK
function foo() {
}
foo(); //OK
```

関数式は実行されるまで呼び出し可能にはならないから、定義より前で呼び出すことはできない。

```javascript
foo(); //ERROR!
foo = function() {
};
foo(); //OK
```

関数定義は実行の前に評価する必要があるからif文の中に入れちゃダメ。
他にも関数名が使える範囲に違いがあるみたいだけど、詳しいことはmixiのブログ参照。


## まとめ
関数定義と関数式の違いは重要なので覚えておこう！

ところで、なぜAjaxIMEをいじっているかというと・・・ふふふ・・・
