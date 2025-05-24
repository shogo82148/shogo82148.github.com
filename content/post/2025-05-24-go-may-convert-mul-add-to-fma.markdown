---
layout: post
title: "Goは積和演算をFMAに変換する場合があるという話"
slug: go-may-convert-mul-add-to-fma
date: 2025-05-24 21:24:00 +0900
comments: true
categories: [go, golang]
---

## TL;DR

- Goは `x*y + z` を `math.FMA(x, y, z)` にコンパイルする場合がある
- 再現性のある実行結果を得たい場合は `float64(x*y) + z` と書くか、明示的に `math.FMA(x, y, z)` を呼び出す
- 再現性は求めずに速度を出したい場合は `x*y + z` と書く

## FMAのバグ発生条件の謎

先日Goに `math.FMA` のバグ修正のパッチを送りました。

- [Goのmath.FMAの挙動を修正した](https://shogo82148.github.io/blog/2025/05/20/update-of-math-fma-in-golang/)

ありがたいことにスッとマージしてもらえたのですが、実は発生条件にちょっと謎がありました。

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">検証の結果こんな感じです。<br><br>arm64のFMA命令: -0<br>arm64のmath.FMA: -0<br>x86_64のFMA命令: -0<br>x86_64のmath.FMA: 0<br><br>Pure Goで書かれた math.FMA の実行結果が変わるのが謎なんですよね 🤔</p>&mdash; f96fd3a0-bdb9-4f10-b69f-8f765c1d341c ICHINOSEShogo (@shogo82148) <a href="https://twitter.com/shogo82148/status/1924007984998515057?ref_src=twsrc%5Etfw">May 18, 2025</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script> 

問題となったのは以下のコードです。

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

go version go1.24.3 darwin/arm64 で実行すると、以下のような結果になります。
呼び出し方にかかわらず同じ結果が得られており、期待通りの結果です。

```plain
-0
-0
```

ところが、 go version go1.24.3 linux/amd64 で実行すると、以下のような結果になります。
呼び出し方によって実行結果が異なっており、バグの再現を確認できます。

```plain
-0
0
```

そう、このバグはamd64上でしか再現しないのです！

## 浮動小数点数の最適化に関する仕様

バグは解決したものの、amd64上でしか再現しない理由が気になっていました。
FMAに関して特殊な仕様があるのか？と思い、Goの仕様を読んでみたら少しだけ理解が進みました。

- [Floating-point operators - The Go Programming Language Specification](https://go.dev/ref/spec#Floating_point_operators)

> An implementation may combine multiple floating-point operations into a single fused operation, possibly across statements, and produce a result that differs from the value obtained by executing and rounding the instructions individually. An explicit floating-point type conversion rounds to the precision of the target type, preventing fusion that would discard that rounding. 
>
> For instance, some architectures provide a "fused multiply and add" (FMA) instruction that computes x*y + z without rounding the intermediate result x*y. These examples show when a Go implementation can use that instruction: 
>
> ```go
> // FMA allowed for computing r, because x*y is not explicitly rounded:
> r  = x*y + z
> r  = z;   r += x*y
> t  = x*y; r = t + z
> *p = x*y; r = *p + z
> r  = x*y + float64(z)
>
> // FMA disallowed for computing r, because it would omit rounding of x*y:
> r  = float64(x*y) + z
> r  = z; r += float64(x*y)
> t  = float64(x*y); r = t + z
> ```

ChatGPT先生による和訳:

> 実装によっては、複数の浮動小数点演算を1つの融合演算にまとめることがあり、文をまたいで行われることもあります。この場合、各命令を個別に実行して丸めた結果とは異なる値が生成される可能性があります。明示的な浮動小数点型変換は、変換先の型の精度に丸めを行うため、その丸めを無視するような融合は防がれます。
>
> たとえば、一部のアーキテクチャでは「融合積和演算（FMA）」命令が提供されており、これは中間結果である x\*y を丸めることなく x\*y + z を計算します。以下の例は、Go の実装がその命令を使用できる場合を示しています。
>
> ```go
> // x*y が明示的に丸められていないため、r の計算に FMA の使用が許可される例:
> r  = x*y + z
> r  = z;   r += x*y
> t  = x*y; r = t + z
> *p = x*y; r = *p + z
> r  = x*y + float64(z)
>
> // x*y の丸めを省略してしまうため、r の計算に FMA の使用が許可されない例:
> r  = float64(x*y) + z
> r  = z; r += float64(x*y)
> t  = float64(x*y); r = t + z
> ```

要するに `x*y + z` を `math.FMA(x, y, z)` にコンパイルする場合があるということです。
要注意なのは、この最適化はCPUアーキテクチャーに依存すること、そして、必ずしも最適化が行われるとは限らないということです。

実はFMA関数の実装には `x*y + z` が使われています。

```go
	// https://github.com/golang/go/blob/go1.24.3/src/math/fma.go#L98-L101
	// Inf or NaN or zero involved. At most one rounding will occur.
	if x == 0.0 || y == 0.0 || z == 0.0 || bx&uvinf == uvinf || by&uvinf == uvinf {
		return x*y + z
	}
```

arm64アーキテクチャーはこれをFMAに最適化しますが、amd64アーキテクチャーでは最適化が行われません。
これが前述の実行結果の違いにつながったのです。

## FMAの性能を検証してみる

さて、実行結果に差が出る理由はわかりました。
しかし、なぜamd64ではFMAへの最適化が行われないのでしょう？
単純に考えれば命令数の少ないFMAのほうが速そうです。
ベンチマークを取って検証してみましょう。

```go
package main

import (
	"math"
	"runtime"
	"testing"
)

var portableFMA = math.FMA

func BenchmarkPortableFMA(b *testing.B) {
	for b.Loop() {
		runtime.KeepAlive(portableFMA(1.0, 2.0, 3.0))
	}
}

func BenchmarkMathFMA(b *testing.B) {
	for b.Loop() {
		runtime.KeepAlive(math.FMA(1.0, 2.0, 3.0))
	}
}

func FMA(x, y, z float64) float64 {
	return math.FMA(x, y, z)
}

func BenchmarkFMA(b *testing.B) {
	for b.Loop() {
		runtime.KeepAlive(FMA(1.0, 2.0, 3.0))
	}
}

func mayFMA(x, y, z float64) float64 {
	return x*y + z
}

func BenchmarkMayFMA(b *testing.B) {
	for b.Loop() {
		runtime.KeepAlive(mayFMA(1.0, 2.0, 3.0))
	}
}

func mulAdd(x, y, z float64) float64 {
	return float64(x*y) + z
}

func BenchmarkMulAdd(b *testing.B) {
	for b.Loop() {
		runtime.KeepAlive(mulAdd(1.0, 2.0, 3.0))
	}
}
```

- `BenchmarkPortableFMA`: Pure Go で実装されたFMA
- `BenchmarkMathFMA`: `math.FMA`、対応するアーキテクチャーであればFMA命令を利用する
- `BenchmarkFMA`: `math.FMA` を呼び出す関数、`BenchmarkMathFMA` は関数呼び出しのオーバーヘッドを考慮しておらず公平ではないため追加
- `BenchmarkMayFMA`: アーキテクチャーによってはFMA命令に最適化される・・・かもしれない
- `BenchmarkMulAdd`: FMA命令を使わない積和演算

### arm64アーキテクチャーでのベンチマーク結果

arm64アーキテクチャーの Apple M1 Pro 上でベンチマークを取った結果です。

```plain
$ go test -bench .
goos: darwin
goarch: arm64
pkg: example.com
cpu: Apple M1 Pro
BenchmarkPortableFMA-10    	140746482	         8.526 ns/op
BenchmarkMathFMA-10        	1000000000	         1.000 ns/op
BenchmarkFMA-10            	566292946	         2.097 ns/op
BenchmarkMayFMA-10         	571696724	         2.097 ns/op
BenchmarkMulAdd-10         	573655584	         2.097 ns/op
PASS
ok  	example.com	6.217s
```

`BenchmarkFMA` と `BenchmarkMulAdd` がほぼ同じ結果、つまりFMA命令と積和演算はほぼ同じ速度になりました。
同じ速度であればFMA命令のほうが精度が高いので、`mayFMA` はFMA命令へ置き換えるのが良さそうです。
実際Goはどう判断したのか、逆アセンブルした結果を見てみましょう。

```plain
go test -o main_test .
go tool objdump -S main_test > dump.txt
```

`FMA` 関数を逆アセンブルした結果です。
`FMADDD` という命令が使われていることが確認できますね。
arm64よく知らないけど、名前からしてFMAを計算する命令なのでしょう。

```plain
TEXT example%2ecom.FMA(SB) /Users/shogo/tmp/2025-05-18-fma/main_test.go
        return math.FMA(x, y, z)
  0x10010cab0           1f400820                FMADDD F0, F2, F1, F0
  0x10010cab4           d65f03c0                RET
  0x10010cab8           00000000                ?
  0x10010cabc           00000000                ?
```

`mayFMA` 関数を逆アセンブルした結果です。
`FMA` 関数と同様の結果となっており、積和演算がFMA演算へと最適化されたことがわかります。
予想通りですね。

```plain
TEXT example%2ecom.mayFMA(SB) /Users/shogo/tmp/2025-05-18-fma/main_test.go
        return x*y + z
  0x10010cab0           1f400820                FMADDD F0, F2, F1, F0
  0x10010cab4           d65f03c0                RET
  0x10010cab8           00000000                ?
  0x10010cabc           00000000                ?
```

`mulAdd` 関数を逆アセンブルした結果です。
`FMULD` と `FADDD` というふたつの命令に分かれていることが確認できます。
仕様通り `float64(x*y) + z` はFMA命令への最適化を阻害する効果があるようです。

```plain
TEXT example%2ecom.mulAdd(SB) /Users/shogo/tmp/2025-05-18-fma/main_test.go
        return float64(x*y) + z
  0x10010cb40           1e610801                FMULD F1, F0, F1
  0x10010cb44           1e622820                FADDD F2, F1, F0
  0x10010cb48           d65f03c0                RET
  0x10010cb4c           00000000                ?
```

### amd64アーキテクチャーでのベンチマーク結果

Amazon EC2 で m5.large を借りてベンチマークを回してみました。

```plain
$ go test -bench .
goos: linux
goarch: amd64
pkg: example.com
cpu: Intel(R) Xeon(R) Platinum 8259CL CPU @ 2.50GHz
BenchmarkPortableFMA-2          60701370                19.13 ns/op
BenchmarkMathFMA-2              844946583                1.419 ns/op
BenchmarkFMA-2                  528670326                2.270 ns/op
BenchmarkMayFMA-2               703064860                1.705 ns/op
BenchmarkMulAdd-2               740604318                1.620 ns/op
PASS
ok      example.com     5.964s
```

`BenchmarkFMA` が `BenchmarkMulAdd` より遅い、つまりFMA命令を使ったほうが積和演算より遅いという結果になりました。

arm64のときと同様に逆アセンブルしてみます。
`FMA` 関数を逆アセンブルした結果です。
`runtime.x86HasFMA` を見て条件分岐しています。名前からしてCPUがFMA命令に対応しているかを表すフラグでしょう。
全体的に命令数も多く、いかにも遅そうです。
（ところでこの逆アセンブルの結果あってる？機械語読める人おしえて）

```plain
TEXT example%2ecom.FMA(SB) /home/ec2-user/tmp/2025-05-24-fma/main_test.go
func FMA(x, y, z float64) float64 {
  0x5205c0              493b6610                CMPQ SP, 0x10(R14)
  0x5205c4              762d                    JBE 0x5205f3
  0x5205c6              55                      PUSHQ BP
  0x5205c7              4889e5                  MOVQ SP, BP
  0x5205ca              4883ec18                SUBQ $0x18, SP
        return math.FMA(x, y, z)
  0x5205ce              0fb605fda21a00          MOVZX runtime.x86HasFMA(SB), AX
  0x5205d5              85c0                    TESTL AX, AX
  0x5205d7              7409                    JE 0x5205e2
  0x5205d9              c4e2f9b9d16690eb        MOVL $-0x146f992f, CX
  0x5205e1              08e8                    ORL CH, AL
  0x5205e3              99                      CDQ
  0x5205e4              19f8                    SBBL DI, AX
  0x5205e6              ff0f                    DECL 0(DI)
  0x5205e8              10d0                    ADCL DL, AL
  0x5205ea              0f10c2                  MOVUPS X2, X0
  0x5205ed              4883c418                ADDQ $0x18, SP
  0x5205f1              5d                      POPQ BP
  0x5205f2              c3                      RET
func FMA(x, y, z float64) float64 {
  0x5205f3              f20f11442408            MOVSD_XMM X0, 0x8(SP)
  0x5205f9              f20f114c2410            MOVSD_XMM X1, 0x10(SP)
  0x5205ff              f20f11542418            MOVSD_XMM X2, 0x18(SP)
  0x520605              e83666f5ff              CALL runtime.morestack_noctxt.abi0(SB)
  0x52060a              f20f10442408            MOVSD_XMM 0x8(SP), X0
  0x520610              f20f104c2410            MOVSD_XMM 0x10(SP), X1
  0x520616              f20f10542418            MOVSD_XMM 0x18(SP), X2
  0x52061c              eba2                    JMP example%2ecom.FMA(SB)
```

`mayFMA` を逆アセンブルした結果です。
`MULSD` と `ADDSD` というふたつの命令に分かれました。

```plain
TEXT example%2ecom.mayFMA(SB) /home/ec2-user/tmp/2025-05-24-fma/main_test.go
        return x*y + z
  0x5206a0              f20f59c1                MULSD X1, X0
  0x5206a4              f20f58c2                ADDSD X2, X0
  0x5206a8              c3                      RET
```

`mulAdd` を逆アセンブルした結果です。
`mayFMA` と同等の結果が得られました。

```plain
TEXT example%2ecom.mulAdd(SB) /home/ec2-user/tmp/2025-05-24-fma/main_test.go
        return float64(x*y) + z
  0x520740              f20f59c1                MULSD X1, X0
  0x520744              f20f58c2                ADDSD X2, X0
  0x520748              c3                      RET
```

## godbolt に突っ込んでみる

FMA関数の逆アセンブルの結果が怪しかったので、[godbolt](https://godbolt.org/)に突っ込んでみました。

```plain
main_FMA_pc0:
        TEXT    main.FMA(SB), ABIInternal, $32-24
        CMPQ    SP, 16(R14)
        PCDATA  $0, $-2
        JLS     main_FMA_pc51
        PCDATA  $0, $-1
        PUSHQ   BP
        MOVQ    SP, BP
        SUBQ    $24, SP
        FUNCDATA        $0, gclocals·g5+hNtRBP6YXNjfog7aZjQ==(SB)
        FUNCDATA        $1, gclocals·g5+hNtRBP6YXNjfog7aZjQ==(SB)
        FUNCDATA        $5, main.FMA.arginfo1(SB)
        FUNCDATA        $6, main.FMA.argliveinfo(SB)
        PCDATA  $3, $1
        MOVBLZX runtime.x86HasFMA(SB), AX
        TESTL   AX, AX
        JEQ     main_FMA_pc34
        VFMADD231SD     X1, X0, X2
        NOP
        JMP     main_FMA_pc42
main_FMA_pc34:
        PCDATA  $1, $0
        CALL    math.FMA(SB)
        MOVUPS  X0, X2
main_FMA_pc42:
        MOVUPS  X2, X0
        ADDQ    $24, SP
        POPQ    BP
        RET
main_FMA_pc51:
        NOP
        PCDATA  $1, $-1
        PCDATA  $0, $-2
        MOVSD   X0, 8(SP)
        MOVSD   X1, 16(SP)
        MOVSD   X2, 24(SP)
        CALL    runtime.morestack_noctxt(SB)
        PCDATA  $0, $-1
        MOVSD   8(SP), X0
        MOVSD   16(SP), X1
        MOVSD   24(SP), X2
        JMP     main_FMA_pc0
```

`runtime.x86HasFMA` をチェックし、CPUがFMA命令に対応していれば `VFMADD231SD` 命令を、対応していなければ `math.FMA` 関数を呼び出すというコードになっています。
なんだかそれっぽいですね。

## まとめ

CPUアーキテクチャーによって実行結果が異なる、という謎を調査しました。
仕様書を読んだ結果、Goは `x*y + z` を `math.FMA(x, y, z)` にコンパイルする場合があるということがわかりました。
アーキテクチャーによってこの最適化が行われない場合があるため、今回のような差が生まれてしまったようです。

CPUがFMA命令を持っていたとしても、FMA命令を使ったほうが高速とは限らないということもわかりました。
実際amd64ではFMA命令を使ったほうが低速でした。

再現性のある実行結果を得たい場合はコードの書き方に注意が必要です。
`float64(x*y) + z` とキャストをいれることで、アーキテクチャーに依存した最適化を阻害できます。
精度が必要な場合は明示的に `math.FMA(x, y, z)` を呼び出しましょう。

再現性は別に求めず速度を出したい場合は `x*y + z` と書きましょう。
必要に応じてFMA命令を使用した最適化を行ってくれます。

## 参考

- [Floating-point operators - The Go Programming Language Specification](https://go.dev/ref/spec#Floating_point_operators)
- [Goのmath.FMAの挙動を修正した](https://shogo82148.github.io/blog/2025/05/20/update-of-math-fma-in-golang/)
- [godbolt](https://godbolt.org/)
