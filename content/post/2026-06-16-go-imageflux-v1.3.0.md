---
layout: post
title: "go-imageflux の紹介と v1.3.0 リリースのお知らせ"
slug: go-imageflux-v1.3.0
date: 2026-06-16 16:53:00 +0900
comments: true
categories: [go, golang, imageflux]
---

## 背景・目的

週末を利用して [go-imageflux](https://github.com/shogo82148/go-imageflux) の [v1.3.0](https://github.com/shogo82148/go-imageflux/releases/tag/v1.3.0) をリリースしました。
[v1.3.0](https://github.com/shogo82148/go-imageflux/releases/tag/v1.3.0) でちょっと大きめな変更を入れたので、
この変更を入れた背景等について説明します。
また、[go-imageflux](https://github.com/shogo82148/go-imageflux) についてこのブログで紹介してなかったので、改めて紹介したいと思います。

## ImageFlux の紹介

Webサイトを作っていると「画像が重すぎてサイトの表示が遅い！」という悩み、よくあると思います。
表示領域の広さに合わせて画像をリサイズするのが理想ですが、毎回毎回手作業でやるのも面倒です。

そんな悩みを解消してくれるのが[ImageFlux 画像変換・配信エンジン](https://imageflux.sakura.ad.jp/image/)（以下、ImageFlux）。
ImageFlux は画像のリサイズやフォーマットの変換などを行ってくれるマネージドサービスです。

弊社でも画像の配信にImageFluxを利用しています。

- [導入事例 スマートフォンアプリ特有の課題「過酷な通信環境下での画像表示」をImageFluxで解決](https://imageflux.sakura.ad.jp/case-study/fuller-inc/)

## go-imageflux の紹介

ImageFluxを利用するにはURLに画像変換用のパラメーターを埋め込む必要があります。
これをGoで簡単に行えるようにと作ったのが、ImageFlux向けのURLビルダー[go-imageflux](https://github.com/shogo82148/go-imageflux) です。

たとえば、「画像の幅を200ピクセルに、WebP対応のブラウザー向けにはWebPを配信したい」場合は、以下のようなコードを書きます。

```go
// 画像を提供するホストの設定
proxy := &imageflux.Proxy{
    Host: "demo.imageflux.jp",
}

// 画像リサイズ・変換フォーマット等の設定。
// キャッシュに乗りやすいよう、あらかじめ何パターンか用意しておく想定。
cfg := &imageflux.Config{
    // 画像の幅を 200px に設定。
    Width: 200,

    // ブラウザーが対応している場合は WebP に変換。
    Format: imageflux.FormatWebPAuto,
}

// パラメーターを埋め込んだURLを発行。
u := proxy.Image("/images/1.jpg", cfg).SignedURL()
fmt.Println(u)

// Output:
// https://demo.imageflux.jp/c/w=200%2Cf=webp:auto/images/1.jpg
```

![ImageFlux](https://demo.imageflux.jp/c/w=200%2Cf=webp:auto/images/1.jpg)

## v1.3.0 からの変更点

今回 v1.3.0 をリリースしたのですが、このバージョンには以下のような変更を加えてあります。

- SignedURL が SignedURLWithoutComma 相当の挙動をするようになりました
- テキストオーバーレイ対応

### SignedURL が SignedURLWithoutComma 相当の挙動をするようになりました

既存のユーザーに一番影響があると思われるのが、`(*Image).SignedURL` の返すURLの変更です。
`(*Image).SignedURLWithoutComma` と同じ動作をするようになりました。
この変更によりアップデート時に一時的にキャッシュヒット率が低下する可能性があります。
ImageFluxが返却する画像に変更はありません。

この変更により、返却されたURLをimgタグの [srcset属性](https://developer.mozilla.org/ja/docs/Web/API/HTMLImageElement/srcset) などに使いやすくなります。
srcset属性はカンマ区切りでURLを指定するため、カンマを含むURLではブラウザーが混乱する可能性があります。
v1.3.0 以降の `(*Image).SignedURL` はURLにカンマを含まないため安全に利用できます。

たとえば以下は画面の画素密度に応じて読み込む画像を切替える例です。

```html
<img
    width="200"
    alt="ImageFlux"
    src="https://demo.imageflux.jp/c/w=200%2Cf=webp:auto/images/1.jpg"
    srcset="
        https://demo.imageflux.jp/c/w=400%2Cf=webp:auto/images/1.jpg 2x
    ">
```

<img
    width="200"
    alt="ImageFlux"
    src="https://demo.imageflux.jp/c/w=200%2Cf=webp:auto/images/1.jpg"
    srcset="
        https://demo.imageflux.jp/c/w=400%2Cf=webp:auto/images/1.jpg 2x
    ">

これまでは利用用途に応じて `SignedURL` と `SignedURLWithoutComma` を使い分ける必要がありましたが、
ユーザーは `SignedURL` だけを利用すればよくなりました。

というのは表向きの理由で、単に僕が `,` と `%2C` の出し分けコードを書くのが面倒になったというだけです。
デメリットはURLがカンマひとつにつき2バイト長くなる程度で、メリットが上回ると判断しました。

### テキストオーバーレイ対応

v1.3.0からはテキストオーバーレイに対応しました。
画像の上にテキストを描画する機能です。

たとえば、画像の上に「テキストが合成できます」というテキストを描画する設定例は以下のようになります。

```go
// 画像を提供するホストの設定
proxy := &imageflux.Proxy{
    Host: "demo.imageflux.jp",
}

cfg := &imageflux.Config{
    Width: 400,
    // テキストオーバーレイで「テキストが合成できます」という文章を表示。
    Texts: []*imageflux.Text{
        {
            Font: &imageflux.Font{
                Name: "Ryumin R-KL",
            },
            Size:       30,
            Width:      400,
            Height:     80,
            Align:      imageflux.TextAlignCenter,
            Foreground: color.White,
            Text:       "テキストが\n合成できます",
        },
    },
}

// パラメーターを埋め込んだURLを発行。
u := proxy.Image("/bridge.jpg", cfg).SignedURL()
fmt.Println(u)

// Output:
// https://demo.imageflux.jp/c/w=400%2Ct=(font=Ryumin%20R-KL%2Csize=30%2Cf=ffffff%2Cw=400%2Ch=80%2Calign=1%2Ctext=%E3%83%86%E3%82%AD%E3%82%B9%E3%83%88%E3%81%8C%0A%E5%90%88%E6%88%90%E3%81%A7%E3%81%8D%E3%81%BE%E3%81%99)/bridge.jpg
```

![テキストオーバーレイの例。橋の画像に「テキストが合成できます」というテキストが書かれている。](https://demo.imageflux.jp/c/w=400%2Ct=(font=Ryumin%20R-KL%2Csize=30%2Cf=ffffff%2Cw=400%2Ch=80%2Calign=1%2Ctext=%E3%83%86%E3%82%AD%E3%82%B9%E3%83%88%E3%81%8C%0A%E5%90%88%E6%88%90%E3%81%A7%E3%81%8D%E3%81%BE%E3%81%99)/bridge.jpg)

利用できるフォント等については、パラメーターリファレンスのテキストオーバーレイの章を参照してください。

- [画像変換パラメータリファレンス - テキストオーバーレイ](https://console.imageflux.jp/docs/image/conversion-parameters#text-overlay)

## まとめ

[ImageFlux 画像変換・配信エンジン](https://imageflux.sakura.ad.jp/image/) をGoから簡単に扱えるようにする
[go-imageflux](https://github.com/shogo82148/go-imageflux) について紹介しました。
v1.3.0から `(*Image).SignedURL` の返すURLが変更になったので注意してください。
また、テキストオーバーレイ機能が使えるようになったので、ぜひ活用してください。

> 🐇 週末にリリース、v1.3.0！\
> カンマ消えた URL、スッキリきれいに\
> テキストも重なる、画像の上で\
> srcset 対応、うさぎも跳ねる 🎉\
> go-imageflux 、今日もお役立ち！
>
> by [CodeRabbit](https://www.coderabbit.ai/)

## 参考文献

- [ImageFlux 画像変換・配信エンジン](https://imageflux.sakura.ad.jp/image/)
- [【ImageFlux】テキストオーバーレイ機能を提供開始](https://www.sakura.ad.jp/corporate/information/announcements/2025/04/23/1968219315/)
- [導入事例 スマートフォンアプリ特有の課題「過酷な通信環境下での画像表示」をImageFluxで解決](https://imageflux.sakura.ad.jp/case-study/fuller-inc/)
- [srcset 属性](https://developer.mozilla.org/ja/docs/Web/API/HTMLImageElement/srcset)
- [go-imageflux](https://github.com/shogo82148/go-imageflux)
