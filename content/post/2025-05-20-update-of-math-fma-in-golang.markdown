---
layout: post
title: "Goのmath.FMAの挙動を修正した"
slug: update-of-math-fma-in-golang
date: 2025-05-20 19:53:00 +0900
comments: true
categories: [go, golang]
---

Goのコントリビューターになったぞ！

- [673856: math: fix portable FMA implementation when x*y ~ 0, x*y < 0 and z = 0](https://go-review.googlesource.com/c/go/+/673856)

どんなバグがあって、どう修正したかを記録として残しておきます。

## バグの内容

以下のコードを実行すると期待と異なる結果が返ってくる、というものです。

- <https://go.dev/play/p/DgFhrLf1CuF>

```go
package main

import (
	"fmt"
	"math"
)

var portableFMA = math.FMA

func main() {
	fmt.Println(math.FMA(0x1p-1022, -0x1p-1022, 0))
	fmt.Println(portableFMA(0x1p-1022, -0x1p-1022, 0))
}
```

go version go1.24.3 linux/amd64 で実行すると、以下のような結果になります。

```plain
-0
0
```

呼び出し方が違うだけで同じ関数を呼び出しているので、同じ結果が返ってきてほしいところです。

```plain
-0
-0
```

### そもそもFMAって何をする関数？

そもそもFMAが何をする関数かというと、[融合積和演算(Fused Multiply-Add, FMA)](https://ja.wikipedia.org/wiki/%E7%A9%8D%E5%92%8C%E6%BC%94%E7%AE%97) を計算する関数です。
$\mathrm{FMA}(x, y, z) = x \times y + z$ を高い精度で計算してくれます。

普通に `x*y + z` を計算すると、 `x*y` の演算結果が浮動小数点数の値として丸められてしまい、最終演算結果に大きな誤差が発生してしまいます。
この誤差を回避するための関数が FMA です。
FMAは数学的に正確な $x \times y + z$ を計算し、一度の丸めのみで浮動小数点数の値へと変換します。

### なぜ呼び出し方によって結果が異なるの？

なぜ呼び出し方によって結果が異なるのでしょう？

最近のCPUには「FMA専用の命令」というものが存在し、高速にFMAを計算できます。
Goのコンパイラは `math.FMA` の呼び出しを検知し、自動的にCPUのFMA命令に置き換える最適化をしてくれます。

しかし、`var portableFMA = math.FMA` のように一度変数に代入すると、このような最適化が行えません。
途中で `portableFMA` の値が別の関数に書き換えられてしまう可能性があるためのです。
このような場合、CPUのFMA命令は使用されず、Pure Goで実装された `math.FMA` が呼び出されます。

まとめると、前者はCPUのFMA命令が実行され、後者はPure Goで実装されたFMA関数が実行されます。
CPUの実装か、Pure Goの実装かで、結果が異なるというわけです。

### 答えは大体合ってるし、「バグ」とまでは言えないのでは？

数値計算において誤差はつきものです。
浮動小数点数演算のテストで `math.Abs(got - want) < 1e-9` のようなコードを書いた経験のあるプログラマーも多いのではないでしょうか。
実装によってある程度誤差があるのは仕方ないことなのでは・・・と考えるひとも多いかもしれません。

しかし、FMA演算に関しては「バグ」だと言い切ることができます。
なぜなら、加減乗除・`math.Sqrt`・`math.FMA` に関しては IEEE 754 という規格で、どのような結果が得られるかがビット単位で決まっているからです。

### -0って何？

実行結果を見て「-0って何？」と思ったひとも多いのではないでしょうか。
実はIEEE 754で定義されている「ゼロ」には符号がついており、「正のゼロ」と「負のゼロ」が存在します。
`0` は「正のゼロ」、 `-0` は「負のゼロ」を表します。
「正のゼロ」は「負のゼロ」と等しいのですが、 $1 / +0 = +\infty$ 、 $1 / -0 = -\infty$ となるという違いがあります。

### 結局0と-0のどっちが正しいの？

CPUのFMA命令は`-0`、 Pure Go 実装は `0` を返しましたが、結局どちらが正しいのでしょう？
正解は `-0` で、CPUのFMA命令のほうが正しいです。

数学的に厳密に計算すると `0x1p-1022 * -0x1p-1022 + 0 = -0x1p-2044` になります。
浮動小数点数では絶対値が `0x1p-1022` より小さい数は表現できないため、
浮動小数点数に変換される過程でアンダーフローが起こり `-0` に丸められます。

## バグ修正

CPUの実装がミスっていたら手も足も出ないですが、Pure Goの実装なら僕でも修正できそうです。
というわけでチャレンジしてみました。

### 修正内容

そんなに長くないのでパッチの内容を全部載せてしまいます。

```diff
diff --git a/src/math/all_test.go b/src/math/all_test.go
index c253b7bc025d34..4e5f4517629dd8 100644
--- a/src/math/all_test.go
+++ b/src/math/all_test.go
@@ -2126,6 +2126,11 @@ var fmaC = []struct{ x, y, z, want float64 }{
 	// Issue #61130
 	{-1, 1, 1, 0},
 	{1, 1, -1, 0},
+
+	// Issue #73757
+	{0x1p-1022, -0x1p-1022, 0, Copysign(0, -1)},
+	{Copysign(0, -1), 1, 0, 0},
+	{1, Copysign(0, -1), 0, 0},
 }
 
 var sqrt32 = []float32{
diff --git a/src/math/fma.go b/src/math/fma.go
index ba03fbe8a93b27..c806b914dab5b6 100644
--- a/src/math/fma.go
+++ b/src/math/fma.go
@@ -96,9 +96,16 @@ func FMA(x, y, z float64) float64 {
 	bx, by, bz := Float64bits(x), Float64bits(y), Float64bits(z)
 
 	// Inf or NaN or zero involved. At most one rounding will occur.
-	if x == 0.0 || y == 0.0 || z == 0.0 || bx&uvinf == uvinf || by&uvinf == uvinf {
+	if x == 0.0 || y == 0.0 || bx&uvinf == uvinf || by&uvinf == uvinf {
 		return x*y + z
 	}
+	// Handle z == 0.0 separately.
+	// Adding zero usually does not change the original value.
+	// However, there is an exception with negative zero. (e.g. (-0) + (+0) = (+0))
+	// This applies when x * y is negative and underflows.
+	if z == 0.0 {
+		return x * y
+	}
 	// Handle non-finite z separately. Evaluating x*y+z where
 	// x and y are finite, but z is infinite, should always result in z.
 	if bz&uvinf == uvinf {
```

数学的には $x \times y + 0 = x \times y$ ですが、浮動小数点数演算に関してはこれは成り立ちません。
具体的には `x*y = -0` になった場合です。
このようなケースは別でハンドリングする必要があります。

### パッチの提出方法

前回 x/tools の修正を行ったときは Gerrit にパッチを投げました。

- [ghq list が interrupted system call で死ぬ問題を直した](https://shogo82148.github.io/blog/2021/02/28/fix-ghq-list-fails-with-interrupted-system-call/)

確か当時はそれしか方法がなかったんですが、今では GitHub 経由でパッチを送れます！

- [math: fix portable FMA implementation when x*y ~ 0, x*y < 0 and z = 0 #73759 ](https://github.com/golang/go/pull/73759)

小さなプルリクエストだったので、12時間も経たずにマージしてもらえました。
やったね！

## まとめ

Goのバグっぽい挙動を見つけたので、レポート、修正まで行いました。
いつのリリースに含まれるかはわからないですが、 `math.FMA` の挙動が修正されているはずです。

イシューの提出、パッチの提案など、GitHubでできることも増えてきたので、普段からGitHubを使い慣れているひとには楽になりました。

> ふわふわウサギがコードを見て\
> FMAのゼロに耳を立て\
> バグを直して跳ね回る\
> IEEEのルールも忘れずに\
> サイン付きゼロで春が来た\
> テストも増えて安心だ\
> 🐇✨
>
> by [CodeRabbit](https://www.coderabbit.ai/)

## 参考

- [積和演算](https://ja.wikipedia.org/wiki/%E7%A9%8D%E5%92%8C%E6%BC%94%E7%AE%97)
- [673856: math: fix portable FMA implementation when x*y ~ 0, x*y < 0 and z = 0](https://go-review.googlesource.com/c/go/+/673856)
- [math: portable FMA implementation incorrectly returns +0 when x*y ~ 0, x*y < 0 and z = 0 #73757](https://github.com/golang/go/issues/73757)
- [math: fix portable FMA implementation when x*y ~ 0, x*y < 0 and z = 0 #73759 ](https://github.com/golang/go/pull/73759)
