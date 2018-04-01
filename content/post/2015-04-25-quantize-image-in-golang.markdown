---
layout: post
title: "Go言語で画像の減色を行う"
date: 2015-04-25T21:49:00+09:00
comments: true
categories: [go, golang]
---

ちょっとGIFアニメを作りたくなって、最近Go触ってるしGoでやってみよう！とやってみたメモ。
ImageMagikでいいじゃん説もあるけど、最終的にツールとして配布したいなってことでGoです。

主に減色まわりについて。

<!-- More -->

## 何はともあれ実装してみる

以前、「[ターミナル操作の記録(ttyrec)からGIFアニメを生成するツールを作った](http://d.hatena.ne.jp/sugyan/20140719/1405729672)」という記事を見たので、
これを参考に実装してみる。

``` go naive.go
package main

import (
	"image"
	"image/color/palette"
	"image/gif"
	_ "image/png"
	"os"
)

func main() {
	reader, err := os.Open("Lenna.png")
	if err != nil {
		return
	}
	defer reader.Close()

	img, _, err := image.Decode(reader)
	if err != nil {
		return
	}

	paletted := image.NewPaletted(img.Bounds(), palette.WebSafe)
	for y := img.Bounds().Min.Y; y < img.Bounds().Max.Y; y++ {
		for x := img.Bounds().Min.X; x < img.Bounds().Max.X; x++ {
			paletted.Set(x, y, img.At(x, y))
		}
	}

	f, _ := os.Create("naive.gif")
	defer f.Close()

	opts := &gif.GIF{
		Image:     []*image.Paletted{paletted},
		Delay:     []int{0},
		LoopCount: 0,
	}
	gif.EncodeAll(f, opts)
}
```

画像用意するの面倒だったので静止画になちゃったけど、
`gif.GIF.Image` に複数枚画像を渡すとアニメーションGIFになります。
みんなだいすきLenaさんをGIFに変換してみます。

元画像:
![Lena](http://upload.wikimedia.org/wikipedia/en/2/24/Lenna.png)

変換後:
![naive.gif](/images/2015-04-25-naive.gif)

あれ、なんか肌の色とか全然違う・・・


## 誤差拡散法でディザリングする

皆さんご存知の通りGIFはインデックスカラー方式で色を指定するので、一枚の画像で256色までしか扱えません。
少ない色数でより多い色数を表現するためにディザリングがよく行われます。
Goの標準ライブラリのimage/drawに[フロイド-スタインバーグ・ディザリング](http://ja.wikipedia.org/wiki/%E3%83%95%E3%83%AD%E3%82%A4%E3%83%89-%E3%82%B9%E3%82%BF%E3%82%A4%E3%83%B3%E3%83%90%E3%83%BC%E3%82%B0%E3%83%BB%E3%83%87%E3%82%A3%E3%82%B6%E3%83%AA%E3%83%B3%E3%82%B0)を実装してものがあるので、
それを使ってみます。

`gif.Encode` を使って静止画GIFを作るときにデフォルトでこの方法が使われるみたいですが、
アニメーションGIFを作るときにはディザリング処理の呼び出しを自分でやらないといけないようです。

``` go
package main

import (
	"image"
	"image/color/palette"
	"image/draw"
	"image/gif"
	_ "image/png"
	"os"
)

func main() {
	reader, err := os.Open("Lenna.png")
	if err != nil {
		return
	}
	defer reader.Close()

	img, _, err := image.Decode(reader)
	if err != nil {
		return
	}

	paletted := image.NewPaletted(img.Bounds(), palette.WebSafe)
	draw.FloydSteinberg.Draw(paletted, img.Bounds(), img, image.ZP)

	f, _ := os.Create("floyd_steinberg.gif")
	defer f.Close()

	opts := &gif.GIF{
		Image:     []*image.Paletted{paletted},
		Delay:     []int{0},
		LoopCount: 0,
	}
	gif.EncodeAll(f, opts)
}
```

結果:
![floyd_steinberg.gif](/images/2015-04-25-floyd_steinberg.gif)

最初よりはかなり良くなったものの、なんだかざらついた感じがします。
昔はこんな感じの画像よく見ましたね・・・すごく20世紀な感じがします。


## メディアンカットで減色してみる

20世紀感の原因は[Webセーフカラー](http://www.htmq.com/color/websafe216.shtml)(この言葉ってもはや死語なのでは)を使ってるからです。
21世紀の現在においてはWebセーフカラーでない色を使っても、色が変わることはほとんど無いので、
24bitカラーで表現可能な1677万色の中から自由に256色を選択できます。

で、問題はその256色をどうやって選択するかなんですが、
Goの標準ライブラリにはインターフェースは定義されているものの実装が存在しない(？)みたいです。
いろいろ探しまわって[soniakeys/quant](https://github.com/soniakeys/quant)というパッケージを見つけたのでこれを使ってみます。

``` go
package main

import (
	"github.com/soniakeys/quant/median"
	"image"
	"image/gif"
	_ "image/png"
	"os"
)

func main() {
	reader, err := os.Open("Lenna.png")
	if err != nil {
		return
	}
	defer reader.Close()

	img, _, err := image.Decode(reader)
	if err != nil {
		return
	}

	q := median.Quantizer(256)
	paletted := q.Image(img)

	f, _ := os.Create("median.gif")
	defer f.Close()

	opts := &gif.GIF{
		Image:     []*image.Paletted{paletted},
		Delay:     []int{0},
		LoopCount: 0,
	}
	gif.EncodeAll(f, opts)
}
```

![median.gif](/images/2015-04-25-median.gif)


## メディアンカットで減色してディザリングもやってみる

減色前の画像を渡すと減色したあとの画像を返してくれる[soniakeys/quant](https://github.com/soniakeys/quant)の便利メソッドを
使って実装してみましたが、
ディザリングをしてくれないのでグラデーション部分があまりキレイではありません。

[soniakeys/quant](https://github.com/soniakeys/quant)を使うのはパレットの作成だけにして、
draw.FloydSteinbergでディザリングを行ってみます。

``` go
package main

import (
	"github.com/soniakeys/quant/median"
	"image"
	"image/color"
	"image/draw"
	"image/gif"
	_ "image/png"
	"os"
)

func main() {
	reader, err := os.Open("Lenna.png")
	if err != nil {
		return
	}
	defer reader.Close()

	img, _, err := image.Decode(reader)
	if err != nil {
		return
	}

	q := median.Quantizer(256)
	p := q.Quantize(make(color.Palette, 0, 256), img)
	paletted := image.NewPaletted(img.Bounds(), p)
	draw.FloydSteinberg.Draw(paletted, img.Bounds(), img, image.ZP)

	f, _ := os.Create("median-floyd-steinberg.gif")
	defer f.Close()

	opts := &gif.GIF{
		Image:     []*image.Paletted{paletted},
		Delay:     []int{0},
		LoopCount: 0,
	}
	gif.EncodeAll(f, opts)
}
```

結果:
![median-floyd-steinberg.gif](/images/2015-04-25-median-floyd-steinberg.gif)
