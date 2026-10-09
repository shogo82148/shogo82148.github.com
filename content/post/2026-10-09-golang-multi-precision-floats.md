---
layout: post
title: "Go言語で半精度浮動小数点数や四倍精度浮動小数点数などを扱うモジュールを書いた"
slug: golang-multi-precision-floats
date: 2026-10-09 19:23:00 +0900
comments: true
categories: [go, golang]
---

## 背景・目的

最近はAIの発展がすごいですね。
その裏では [半精度浮動小数点数](https://ja.wikipedia.org/wiki/%E5%8D%8A%E7%B2%BE%E5%BA%A6%E6%B5%AE%E5%8B%95%E5%B0%8F%E6%95%B0%E7%82%B9%E6%95%B0)、[bfloat16](https://ja.wikipedia.org/wiki/Bf16) といった低い精度の浮動小数点数が使われているらしいです。
今ではさらに低精度化が進んで8bit浮動小数点数やら1.58bitの言語モデルなんてのも出てきました。
この機会に浮動小数点数と仲良くなってみようと、浮動小数点数を扱うGoのライブラリーを書いてみました。

- [shogo82148/floats](https://github.com/shogo82148/floats)

## 使い方

[v0.4.1](https://github.com/shogo82148/floats/releases/tag/v0.4.1) 現在、以下の5つの型に対応してます。

- `Float16`: [半精度浮動小数点数](https://ja.wikipedia.org/wiki/%E5%8D%8A%E7%B2%BE%E5%BA%A6%E6%B5%AE%E5%8B%95%E5%B0%8F%E6%95%B0%E7%82%B9%E6%95%B0)
- `Float32`: [単精度浮動小数点数](https://ja.wikipedia.org/wiki/%E5%8D%98%E7%B2%BE%E5%BA%A6%E6%B5%AE%E5%8B%95%E5%B0%8F%E6%95%B0%E7%82%B9%E6%95%B0)
- `Float64`: [倍精度浮動小数点数](https://ja.wikipedia.org/wiki/%E5%80%8D%E7%B2%BE%E5%BA%A6%E6%B5%AE%E5%8B%95%E5%B0%8F%E6%95%B0%E7%82%B9%E6%95%B0)
- `Float128`: [四倍精度浮動小数点形式](https://ja.wikipedia.org/wiki/%E5%9B%9B%E5%80%8D%E7%B2%BE%E5%BA%A6%E6%B5%AE%E5%8B%95%E5%B0%8F%E6%95%B0%E7%82%B9%E6%95%B0)
- `Float256`: [Octuple-precision floating-point format](https://en.wikipedia.org/wiki/Octuple-precision_floating-point_format)

`Float32`、`Float64` はそれぞれGoの built-in 型 `float32`、`float64` に対応します。
[shogo82148/floats](https://github.com/shogo82148/floats) はそれに加え、`Float16`、`Float128`、`Float256` をサポートします。
`Float16` は `float32` の半分しかメモリーを使用しませんが、その分精度が悪いです。
`Float128` は精度は高いですが `float64` の倍メモリーを消費します。
また、ソフトウェアによるエミュレーションが走るため計算速度は遅いです。
`Float256` はもっとも精度が良い型です。これを実装しているライブラリーは珍しいのではないでしょうか。

それぞれの型に対応する `NewFloatN` 関数が存在するので、それを使って初期化します。
`Add`, `Sub`, `Mul`, `Quo` メソッドを使うとなんと加減乗除ができます！

```go
package main

import (
  "fmt"

  "github.com/shogo82148/floats"
)

func main() {
  a := floats.NewFloat16(1.0)
  b := floats.NewFloat16(2.0)
  fmt.Printf("%g + %g = %g\n", a, b, a.Add(b))
  fmt.Printf("%g - %g = %g\n", a, b, a.Sub(b))
  fmt.Printf("%g * %g = %g\n", a, b, a.Mul(b))
  fmt.Printf("%g / %g = %g\n", a, b, a.Quo(b))
}
```

```plain
1 + 2 = 3
1 - 2 = -1
1 * 2 = 2
1 / 2 = 0.5
```

上の例からわかる通り `fmt.Printf` 関数を使った表示にも対応しています。

さらに [`math` パッケージ](https://pkg.go.dev/math) に存在する数学関数にも対応しています。

```go
package main

import (
  "fmt"

  "github.com/shogo82148/floats"
)

func main() {
  a := floats.NewFloat256(2.0)
  fmt.Printf("√%g = %g\n", a, a.Sqrt())
  fmt.Printf("sin %g = %g\n", a, a.Sin())
  fmt.Printf("cos %g = %g\n", a, a.Cos())
  fmt.Printf("tan %g = %g\n", a, a.Tan())
}
```

```plain
√2 = 1.41421356237309504880168872420969807856967187537694807317667973799073247
sin 2 = 0.9092974268256816953960198659117448427022549714478902683789730115309673
cos 2 = -0.416146836547142386997568229500762189766000771075544890755149973781964935
tan 2 = -2.18503986326151899164330610231368254343201774622766316456295586996677375
```

`math` パッケージだと `√2 = 1.4142135623730951` までしか計算できませんが、
`Float256` は約71桁の有効桁数を持つため、こんな超高精度で計算できます。

## 成果

このパッケージはもともとお勉強のために作ったライブラリーでした。
実はお勉強の成果が Go の標準ライブラリーにフィードバックされています。

- [Goのmath.FMAの挙動を修正した](https://shogo82148.github.io/blog/2025/05/20/update-of-math-fma-in-golang/)

[shogo82148/floats](https://github.com/shogo82148/floats) には `Float16` 版 FMA を実装してあるのですが、
この実装は [math.FMA](https://pkg.go.dev/math#FMA) を ~~パクって~~ 参考にして実装していました（過去形）。
`Float16` 版 FMA を [Berkeley SoftFloat](https://github.com/ucb-bar/berkeley-softfloat-3) でテストした結果、
`Float16` 版 FMA にバグを見つけました。
同じバグが参考元である [math.FMA](https://pkg.go.dev/math#FMA) にもあるのでは？と検証したところ [#73757](https://github.com/golang/go/issues/73757) を見つけた、というわけです。

- [math: portable FMA implementation incorrectly returns +0 when x*y ~ 0, x*y < 0 and z = 0 #73757](https://github.com/golang/go/issues/73757)

## 生成AIを使った実装

最初は生成AIを使わずに手書きしていたのですが、 `math` パッケージの移植が大変すぎて途中から生成AIの手を借りて実装しました。
Claude Code先生に「精度とパフォーマンスを改善してください」と頼むだけで、
10〜100倍の高速化を達成してくれるのでびっくりです。

ちなみに僕の書いた `Float16` 版 FMA は Claude Code 先生の最適化によって実質4行になってしまいました。

```go
// https://github.com/shogo82148/floats/blob/v0.4.1/float16.go#L324-L334

// FMA16 returns x * y + z, computed with only one rounding.
// (That is, FMA16 returns the fused multiply-add of x, y, and z.)
func FMA16(x, y, z Float16) Float16 {
	// The product of two float16 values has 22 bits, and it is exact in float64.
	// The sum p + z is exact unless the exponents of p and z are very different:
	// then either |p| >= 2^19 and the result overflows whatever z is,
	// or |p| < 2^-32 |z| and the result is z, which is on the float16 grid,
	// so the sum never rounds twice in a way that changes the result.
	p := float64(x.Float32()) * float64(y.Float32())
	return Float64(p + float64(z.Float32())).Float16()
}
```

最初はビット演算と整数演算を駆使して頑張って実装したのですが、
CPUにネイティブに実装されてる浮動小数点数演算のほうが高速なんですね。
ちょっと悲しい気持ちです。
さいわい（？）テスト用の[リファレンス実装](https://github.com/shogo82148/floats/blob/v0.4.1/fma_test.go#L532-L614)としてソースコードには残してもらえました。
良かったよかった。

## まとめ

浮動小数点数のお勉強のために、浮動小数点数を扱うGoのライブラリーを書きました。

- [shogo82148/floats](https://github.com/shogo82148/floats)

お勉強で得られた知見をもとにGoの標準ライブラリーにフィードバックを行っています。
[shogo82148/floats](https://github.com/shogo82148/floats) 自体もきっと便利なのでぜひ使ってください。

## 参考

- [shogo82148/floats](https://github.com/shogo82148/floats)
- [bfloat16](https://ja.wikipedia.org/wiki/Bf16)
- [半精度浮動小数点数](https://ja.wikipedia.org/wiki/%E5%8D%8A%E7%B2%BE%E5%BA%A6%E6%B5%AE%E5%8B%95%E5%B0%8F%E6%95%B0%E7%82%B9%E6%95%B0)
- [単精度浮動小数点数](https://ja.wikipedia.org/wiki/%E5%8D%98%E7%B2%BE%E5%BA%A6%E6%B5%AE%E5%8B%95%E5%B0%8F%E6%95%B0%E7%82%B9%E6%95%B0)
- [倍精度浮動小数点数](https://ja.wikipedia.org/wiki/%E5%80%8D%E7%B2%BE%E5%BA%A6%E6%B5%AE%E5%8B%95%E5%B0%8F%E6%95%B0%E7%82%B9%E6%95%B0)
- [四倍精度浮動小数点形式](https://ja.wikipedia.org/wiki/%E5%9B%9B%E5%80%8D%E7%B2%BE%E5%BA%A6%E6%B5%AE%E5%8B%95%E5%B0%8F%E6%95%B0%E7%82%B9%E6%95%B0)
- [Octuple-precision floating-point format](https://en.wikipedia.org/wiki/Octuple-precision_floating-point_format)
- [Berkeley SoftFloat](https://github.com/ucb-bar/berkeley-softfloat-3)
- [Goのmath.FMAの挙動を修正した](https://shogo82148.github.io/blog/2025/05/20/update-of-math-fma-in-golang/)
