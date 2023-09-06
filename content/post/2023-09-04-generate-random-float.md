---
layout: post
title: "ぼくのかんがえたさいきょうの[0.0, 1.0)の乱数を得るための方法"
slug: 2023-09-04-generate-random-float
date: 2023-09-04 23:27:00 +0900
comments: true
categories: [go, golang]
---

Twitterもとい𝕏でこんなスライドが流れてきました。

<iframe class="speakerdeck-iframe" style="border: 0px; background: rgba(0, 0, 0, 0.1) padding-box; margin: 0px; padding: 0px; border-radius: 6px; box-shadow: rgba(0, 0, 0, 0.2) 0px 5px 40px; width: 100%; height: auto; aspect-ratio: 560 / 315;" frameborder="0" src="https://speakerdeck.com/player/b000ac1dfa2d479d83756b0267d3f992" title="[0.0, 1.0) の乱数を得るための“本当の”方法" allowfullscreen="true" data-ratio="1.7777777777777777"></iframe>

$[0.0, 1.0)$ の範囲を保証しつつ、浮動小数点数が表現可能なすべての値をとるのは難しい、というお話です。
なるほど・・・確かに改めて考えてみると「浮動小数点数が表現可能なすべての値」という条件は難しいですね。
でも、スライド中で紹介されていたアルゴリズムには、もうちょっと最適化の余地があるのでは？と考えてみました。

## Goの標準ライブラリでの実装

もとのスライドはC++の話っぽいけど、C++はよくわからないので、Go言語での実装を考えます。

### 除算法

Goの標準ライブラリはスライド中で「除算法」と呼ばれている方法で乱数を生成します。

- Go 1.21.0 の実装: https://github.com/golang/go/blob/33d4a5105cf2b2d549922e909e9239a48b8cefcc/src/math/rand/rand.go#L188-L212

```go
// Float64 returns, as a float64, a pseudo-random number in the half-open interval [0.0,1.0).
func (r *Rand) Float64() float64 {
	// コメント略
again:
	f := float64(r.Int63()) / (1 << 63)
	if f == 1 {
		goto again // resample; this branch is taken O(never)
	}
	return f
}
```

除算法は大変シンプルですが、丸め誤差の影響で誤って 1.0 を返すことがあります。
Goは乱数を再生成することで、この問題を回避しています。

### 過去の実装

実際 Go 1.2 までは 1.0 を返すバグがあったみたいです。

- [math/rand: rand.Float{32,64}() can erroneously return 1 #6721](https://github.com/golang/go/issues/6721)
- Go 1.2 での実装: https://github.com/golang/go/blob/402d3590b54e4a0df9fb51ed14b2999e85ce0b76/src/pkg/math/rand/rand.go#L97-L98

```go
// Float64 returns, as a float64, a pseudo-random number in [0.0,1.0).
func (r *Rand) Float64() float64 { return float64(r.Int63()) / (1 << 63) }
```

これに対して、分子と分母を53bitに丸める修正が入りました。

```go
func (r *Rand) Float64() float64 {
	return float64(r.Int63n(1<<53)) / (1<<53)
}
```

53bitまでの整数なら`float64` 型で正確に表現できるため、これなら誤差の入り込む余地はありません。
しかし、Go 1との互換性を壊してしまう（同じシード値からは同じ乱数列が生成されてほしい）とのことで、今の実装になっています。

また、互換性の問題以外にも「浮動小数点数が表現可能なすべての値を取らない」という問題点もあります。
たとえば分母分子は整数なので、返り値が $(0, 2^{-53})$ の区間の値を取る可能性はゼロです。
一方 `float64` は $2^{-1074}$ のように、$(0, 2^{-53})$ の区間の中の値を表現できます。
この実装でいいじゃん？と思ったけど、今回のスライドで難しさを痛感しました。

## ２ステップに分けて考える

さて、スライド資料では除算法から浮動小数点数に話が移りますが、
その前に僕たちは除算法を別の観点で考え直してみましょう。

$x$ を `r.Int63()` の出力、 $y$ を `r.Float64` の出力とします。
Goの現在の実装は以下のように表現できます。

$$
y = \frac{x}{2^{63}}
$$

単なる割り算なんですが、ちょっと見方を変えて考えてみます。
2進数の世界で $2^n$ をかけたり割ったりする操作は、小数点を移動させる操作に対応します。

「小数点の移動」という観点で上の式をよく見ると・・・
「`001011...` という63bitのビット列 $x$ と、実数 $y = 0.001011...$ を同一視する式」
と考えることができます。

あ、これは **固定小数点数** だ！

実は $x$ を決めた時点で「$[0.0, 1.0)$ の範囲の乱数を生成する処理」はすでに終わっていたのです。
ただし出力が固定小数点方式だっただけで。
そのままでは扱いにくいので「固定小数点方式で表現された $x$ を浮動小数点数 $y$ に変換する処理」をしている、
と考えることはできないでしょうか。

そうすると、「$[0.0, 1.0)$ の範囲の浮動小数点数の乱数を生成する処理」は、
「固定小数点数の乱数を作る問題」と「固定小数点数を浮動小数点数に変換する問題」に分けて考えることができます。

いきなり `float64` や `float32` は桁数が多くてつらいので、
`float16`（[半精度浮動小数点数]）を例に考えてみましょう。

### 固定小数点数の乱数を作る問題

固定小数点数の乱数を作るのは簡単ですね。
整数部は必ず0です。
そして小数点のあとに0/1をランダムに並べれば、任意の精度の乱数を生成できます。

```
x = 0.(このあとにランダムに0/1の配列を並べる)
```

`float16` の 0 でない最小の値は $2^{-24}$ なので、24桁準備しておけば `float16` の表現できる範囲をすべてカバーできます。
例として以下のbit列を使って考えます。

```
x = 0.0 0 1 0 1 1 0 0 1 1 1 0 1 1 0 0 0 0 0 0 0 1 0 0
```

### 固定小数点数を浮動小数点数に変換する問題

割り算という固定概念を捨て、
「固定小数点数を浮動小数点数に変換する問題」と捉えれば他にもやり方はあります。
そう、[浮動小数点数]の仕様にしたがってエンコードすればよいのです。

浮動小数点数は $1.xxx\times 2^n$ になるよう正規化されています。
まずはこの先頭の1を見つけましょう。

```
x = 0.0 0 1 0 1 1 0 0 1 1 1 0 1 1 0 0 0 0 0 0 0 1 0 0
        ↑上の桁から見て行って、最初の1を見つける
```

`float16` の有効桁数は10桁なので、1のあとの10桁が仮数部です。

```
x = 0.0 0 1 0 1 1 0 0 1 1 1 0 1 1 0 0 0 0 0 0 0 1 0 0
          1.0 1 1 0 0 1 1 1 0 1
            ^^^^^^^^^^^^^^^^^^^ 仮数部
```

小数点を3つ動かしているので、指数部は $-3$ です。

```
x = 0.0 0 1 0 1 1 0 0 1 1 1 0 1 1 0 0 0 0 0 0 0 1 0 0
      y = 1.0 1 1 0 0 1 1 1 0 1 × 2^(-3)
```

仮数部と指数部の情報がわかったので、16bitに収まるよう組み立てます。
指数部は下駄履き表現されるので、実際に記録されるのは $-3 + 15 = 12$、
ビット列に直すと`01100`です。今は0以上の数を扱っているので符号は `0`。
[半精度浮動小数点数]の仕様にしたがって組み立てれば以下のようになります。

```
 |  指数部  |       仮数部       |
0|0 1 1 0 0|0 1 1 0 0 1 1 1 0 1|
↑
符号ビット
```

できあがり！

## 実装

C++はよくわからないので、Goで実装しました。

- [shogo82148/random-float](https://github.com/shogo82148/random-float)

固定小数点数をナイーブに計算するとたくさんの乱数を消費してしまうので、
遅延評価を行います。
浮動小数点数のビット表現を求めたあとは、[math.Float64frombits](https://pkg.go.dev/math#Float64frombits) を使って
`float64` に変換します。

```go
const (
	mask64     = 0x7ff       // mask for exponent
	shift64    = 64 - 11 - 1 // shift for exponent
	bias64     = 1023        // bias for exponent
	signMask64 = 1 << 63     // mask for sign bit
	fracMask64 = 1<<shift64 - 1
)

type Rand struct {
	src rand.Source
	s64 rand.Source64 // non-nil if src is source64
}

func (r *Rand) float64s64() float64 {
	var exp = bias64 - 1
	var frac uint64
	for {
		i := r.s64.Uint64()
		l := bits.Len64(i) // 上位から順にみて、最初に現れる1を見つける
		exp -= 64 - l
		if exp <= 0 {
			// float64 で表せる最小の数に到達したときの処理
			frac = uint64(r.s64.Uint64())
			exp = 0
			break
		}

		// 1が53bit目に来るよう正規化
		if l > shift64 {
			frac = uint64(i >> (l - shift64 - 1))
			break
		} else if l > 0 {
			s := shift64 - l + 1
			frac = uint64(i << s)

			// 仮数部のビット数が足りないので、残りをランダムに埋める
			i = r.s64.Uint64()
			frac |= uint64(i) & (1<<s - 1)
			break
		}

		// 1が見つからなかったので、次の64bitを生成する
	}
	return math.Float64frombits(uint64(exp)<<shift64 | frac&fracMask64)
}
```

この方式なら $[0.0, 1.0)$ の範囲の表現可能なすべての `float64` が出現します。
欠点は必要な乱数列の数が多くなることがある点でしょうか。
`float64` の場合ワーストケースで 1074 bit必要です。
もっとも、ワーストケースにハマる確率は $2^{-1022}$ です。

## まとめ

「ぼくのかんがえたさいきょうの $[0.0, 1.0)$ の乱数を得るための方法」を実装しました。
「固定小数点数の乱数を作る問題」と「固定小数点数を浮動小数点数に変換する問題」に分けて考えることで問題をシンプルにしました。
$[0.0, 1.0)$ の範囲の表現可能なすべての `float64` が出現します。

## 参考

- [\[0.0, 1.0) の乱数を得るための“本当の”方法](https://speakerdeck.com/hole/rand01)
- Go 1.21.0 の乱数の実装: https://github.com/golang/go/blob/33d4a5105cf2b2d549922e909e9239a48b8cefcc/src/math/rand/rand.go#L188-L212
    - 今の実装になった経緯がコメントしてあります
- [shogo82148/random-float](https://github.com/shogo82148/random-float)

[浮動小数点数]: https://ja.wikipedia.org/wiki/%E6%B5%AE%E5%8B%95%E5%B0%8F%E6%95%B0%E7%82%B9%E6%95%B0
[固定小数点数]: https://ja.wikipedia.org/wiki/%E5%9B%BA%E5%AE%9A%E5%B0%8F%E6%95%B0%E7%82%B9%E6%95%B0
[半精度浮動小数点数]: https://ja.wikipedia.org/wiki/%E5%8D%8A%E7%B2%BE%E5%BA%A6%E6%B5%AE%E5%8B%95%E5%B0%8F%E6%95%B0%E7%82%B9%E6%95%B0

## 余談

`float32`, `float64` はビット数の割り当てがちょっと違うだけでほぼ同じ処理です。
共通化できないかと、ジェネリック使ってみました。

```go
// https://github.com/shogo82148/random-float/blob/542b7127f90e9f9d031fce833f73e8c17f67662c/float.go

type bitsN interface {
	uint64 | uint32
}

type intN interface {
	int64 | uint64
}

type floatN interface {
	float64 | float32
}

type floatNFromBits[B bitsN, F floatN] func(B) F

type srcN[I intN] func() I

func randFloat[I intN, B bitsN, F floatN](src srcN[I], bias, shift, num int, mask B, float floatNFromBits[B, F]) F {
	var exp = bias - 1
	var frac B
	for {
		i := src()
		l := bits.Len64(uint64(i))
		exp -= num - l
		if exp <= 0 {
			frac = B(src())
			exp = 0
			break
		}
		if l > shift {
			frac = B(i >> (l - shift - 1))
			break
		} else if l > 0 {
			frac = B(i << (shift - l + 1))
			i = src() >> (num - shift + l - 1)
			frac |= B(i)
			break
		}
	}
	return float(B(exp)<<shift | frac&mask)
}

func (r *Rand) Float32() float32 {
	if r.s64 != nil {
		return randFloat(r.s64.Uint64, bias32, shift32, 64, fracMask32, math.Float32frombits)
	} else {
		return randFloat(r.src.Int63, bias32, shift32, 63, fracMask32, math.Float32frombits)
	}
}

func (r *Rand) Float64() float64 {
	if r.s64 != nil {
		return randFloat(r.s64.Uint64, bias64, shift64, 64, fracMask64, math.Float64frombits)
	} else {
		return randFloat(r.src.Int63, bias64, shift64, 63, fracMask64, math.Float64frombits)
	}
}
```

動作はしたけど、愚直に書いたほうが実行速度は速かったので、不採用。
