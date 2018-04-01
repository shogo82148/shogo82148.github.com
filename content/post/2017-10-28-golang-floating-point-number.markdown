---
layout: post
title: "Go言語の浮動小数点数のお話"
date: 2017-10-28 20:12:48 +0900
comments: true
categories: [go, golang]
---

元ネタ:

{% oembed https://twitter.com/RIORAO/status/922871767147749376 %}

{% oembed https://twitter.com/RIORAO/status/923599110262874112 %}

コンピューターで浮動小数点数を扱ったことのある人なら一度は経験する、
数学上の計算とコンピューター上の計算が合わない計算の一例ですね。

この件に関して、Go言語では正しく(=数学的な結果と同じように)計算できるとの情報が。

{% oembed https://twitter.com/inukirom/status/923721661408411650 %}

しかしながら、inukiromさんのこの推察、半分はあってますが、半分は間違っていると思います。
なぜGo言語でこのような結果になったのか、検証してみました。

<!-- More -->

## Goの数値定数の型について

以前[Go言語でコンパイル時フィボナッチ数列計算](https://shogo82148.github.io/blog/2017/02/19/golang-compile-time-fib/)で紹介した
[Better C - Go言語と整数 #golang](https://qiita.com/sonatard/items/464a9d45c689386edfe1)にもあるように、
Goの定数には「型がない(場合がある)」「任意の精度で計算してくれる」という特徴があります。

このため、普通はどう考えてもオーバーフローしそうなこんな演算も・・・

``` go
package main

import (
	"fmt"
)

func main() {
	var i uint64 = 31415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679 % 1000000007
	fmt.Println(i)
}
```

- [play.golang.org/p/FkMVpY2Fa3](https://play.golang.org/p/FkMVpY2Fa3)

型がない定数同士の演算は 162132938 と正しい答えを出してくれます。

しかし、明示的に型を指定すると、今度はオーバーフローしてしまいます。

``` go
package main

import (
	"fmt"
)

func main() {
	var i uint64 = uint64(31415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679) % 1000000007
	fmt.Println(i)
}
```

```
tmp/sandbox436519650/main.go:8:23: constant 31415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679 overflows uint64
```

## 問題の計算

さて、最初の問題に戻りましょう。
以下のコードで、0.1, 0.2, 0.3 は「型のない定数」なので、「任意の精度で計算して」くれます。
その計算結果を `float64` に変換すると全く同じ数値になるので、 `c` は `true` になります。

``` go
package main

import (
	"fmt"
)

func main() {
	a := 0.3 - 0.2
	b := 0.2 - 0.1
	c := a == b
	fmt.Println(c)
}
```

- [play.golang.org/p/X36rciE8by](https://play.golang.org/p/X36rciE8by)

一方、以下のように明示的に型を与えると、 `float64` の精度でしか計算してくれません。
この場合は他のほとんどの言語同様、 `c` は `false` となります。

``` go
package main

import (
	"fmt"
)

func main() {
	a := float64(0.3) - float64(0.2)
	b := float64(0.2) - float64(0.1)
	c := a == b
	fmt.Println(c)
}
```

- [play.golang.org/p/9_jKFfc5Hy](https://play.golang.org/p/9_jKFfc5Hy)

> おそらくGoはコンパイラがa=0.1とb=0.1に変換していると思われます。

というわけで、先程のinukiromさんのこの推察ツイートのこの部分は正解です。


## 計算されるのは実行時？コンパイル時？

次にこんな二つのコードを用意して `GOSSAFUNC=main go run main.go` を実行し、
[SSA](https://shinpei.github.io/blog/2016/08/13/what-ssa-brings-to-go-17)による最適化の様子を見てみます。
違いは `x`, `y`, `z` が `const` で宣言されているか、`var` で宣言されているか、だけです。

``` go
package main

import (
	"fmt"
)

func main() {
	var (
		x = 0.3
		y = 0.2
		z = 0.1
	)
	a := x - y
	b := y - z
	c := a == b
	fmt.Println(c)
}
```

``` go
package main

import (
	"fmt"
)

func main() {
	const (
		x = 0.3
		y = 0.2
		z = 0.1
	)
	a := x - y
	b := y - z
	c := a == b
	fmt.Println(c)
}
```

結果は以下のツイートの通り。

{% oembed https://twitter.com/shogo82148/status/924156133522120705 %}

最適化の結果コンパイル時に計算が行われ、(計算結果に多少の誤差はありますが)
`var` の場合でも `const` の場合でも `x`, `y`, `z` は消えてしまいました。

> constはコンパイル時に計算されますが、varは実行時に計算されるためです。 

そういうわけで、この部分は間違いです。
Goのコンパイラは賢いので、 `var` であってもコンパイル時に計算可能ならば計算してくれます。
(比較演算子は範囲外？みたいだけど・・・)


## 任意の精度で計算の限界に迫る

ここまでは `a` や `b` は `float64` という型を持っていました。
次に以下のように書き換えて `a` も `b` も「型の無い定数」にしてみましょう。
すると少し面白い結果が得られます。

``` go
package main

import (
	"fmt"
)

func main() {
	const a = 0.3 - 0.2
	const b = 0.2 - 0.1
	var c = a == b
	fmt.Println(c)
	fmt.Printf("%e\n", float64(a-b))
}
```

- [play.golang.org/p/T26lQ0Ajvw](https://play.golang.org/p/T26lQ0Ajvw)

```
false
9.322926e-156
```

`c` が `false` になってしまいました。
「任意の精度で計算」と言ってもコンピューター上の計算である以上、有効桁数には限界があります。
`a` と `b` の差が `9.322926e-156` になったことから、おそらく有効桁数150桁程度で計算していると考えられます。

ここでちょっとソースコードを覗いてみると・・・

- [mpfloat.go](https://github.com/golang/go/blob/master/src/cmd/compile/internal/gc/mpfloat.go#L18)

512bitの精度で計算しているようです。
{% m %}512 \times \log 2 = 154.1273577...{% em %} なので、有効桁数150桁程度という予想通りです。


## まとめ

何事にも限界ってものがある。
