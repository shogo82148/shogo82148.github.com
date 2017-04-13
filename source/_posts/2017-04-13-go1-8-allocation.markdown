---
layout: post
title: "Go言語のヒープに確保するデータの初期化コストについて調べてみた(Go1.8.1版)"
date: 2017-04-13 08:23:08 +0900
comments: true
categories: [golang]
---

{% oembed https://twitter.com/kaoriya/status/851983856966283265 %}

こちらのツイートに対して、以下のベンチ結果が紹介されていました。

- [Go言語のヒープに確保するデータの初期化コストについて調べてみた](http://ryochack.hatenablog.com/entry/2014/06/08/225606)

しかし[hnakamur2](https://twitter.com/hnakamur2)さんも言及しているように、
これはGo1.2.2時の結果。
その後、GoのコンパイラがGo実装になったり、SSAが導入されたりと、
今のコンパイラの実装は当時とは全く違うものになっています。

というわけで、現時点での最新のバージョン(Go1.8.1)で、同様の検証をおこなってみました。

<!-- More -->

## 検証コード

検証に使用したコードはGo1.2.2のときと全く同じものです。

``` go
// alloc_overhead.go

package main

type container struct {
	v [64]byte
}

func MakeContainer() *container {
	c := container{}
	return &c
}

func MakeContainerOneLine() *container {
	return &container{}
}

func MakeContainerNew() *container {
	return new(container)
}

func main() {
	_ = MakeContainer()
	_ = MakeContainerOneLine()
	_ = MakeContainerNew()
}
```

``` go
// alloc_overhead_test.go

package main

import (
	"testing"
)

func BenchmarkMakeContainer(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_ = MakeContainer()
	}
}

func BenchmarkMakeContainerOneLine(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_ = MakeContainerOneLine()
	}
}

func BenchmarkMakeContainerNew(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_ = MakeContainerNew()
	}
}
```

## ベンチマーク結果

Go1.8.1でベンチマークを実行した結果がこちら。

``` plain
$ go test -bench . -benchmem
BenchmarkMakeContainer-4          	1000000000	         2.79 ns/op	       0 B/op	       0 allocs/op
BenchmarkMakeContainerOneLine-4   	1000000000	         2.84 ns/op	       0 B/op	       0 allocs/op
BenchmarkMakeContainerNew-4       	1000000000	         2.83 ns/op	       0 B/op	       0 allocs/op
PASS
ok  	_/Users/shogo/workspace/tmp/2017-04-13-alloc	9.345s
```

ベンチマークの結果、ほとんど速度の差はありませんでした。

しかし、「ヒープに置かれるデータの初期化」を検証したかったのに、アロケーションが0なのはおかしいですね？
どうやら最適化の結果、スタックに置かれるようになってしまったようです。


## 再検証

Go1.7から追加された[runtime.KeepAlive](https://golang.org/pkg/runtime/#KeepAlive)を使ってベンチマークを修正しました。
`runtime.KeepAlive`が呼ばれるまで確保した領域は解放されることが無いので、
データがヒープに乗ってくれるはずです(たぶん)。

``` go
// alloc_overhead_test.go

package main

import (
	"runtime"
	"testing"
)

func BenchmarkMakeContainer(b *testing.B) {
	for i := 0; i < b.N; i++ {
		runtime.KeepAlive(MakeContainer())
	}
}

func BenchmarkMakeContainerOneLine(b *testing.B) {
	for i := 0; i < b.N; i++ {
		runtime.KeepAlive(MakeContainerOneLine())
	}
}

func BenchmarkMakeContainerNew(b *testing.B) {
	for i := 0; i < b.N; i++ {
		runtime.KeepAlive(MakeContainerNew())
	}
}
```

修正版のベンチマークはこちら。

``` plain
$ go test -bench . -benchmem
BenchmarkMakeContainer-4          	50000000	        34.7 ns/op	      64 B/op	       1 allocs/op
BenchmarkMakeContainerOneLine-4   	30000000	        34.4 ns/op	      64 B/op	       1 allocs/op
BenchmarkMakeContainerNew-4       	50000000	        35.9 ns/op	      64 B/op	       1 allocs/op
PASS
ok  	_/Users/shogo/workspace/tmp/2017-04-13-alloc	4.690s
```

意図したとおりアロケーションが発生しています。
速度差もほとんどありません。


## 最適化の結果を見てみる

[Go1.7からSSAが導入された](http://shinpei.github.io/blog/2016/08/13/what-ssa-brings-to-go-17/)ことにより、
以下のようなコマンドで最適化の様子を簡単に知ることができるようになりました。

``` bash
GOSSAFUNC=MakeContainer go build alloc_overhead.go
```

この機能を使って、各関数が最終的にどのように最適化されたのかを確認してみます。

以下は`MakeContainer`の結果([ssa.html](/files/2017-04-13-go1-8-allocation/MakeContainer.html))。

``` plain
v1 = InitMem <mem>
v2 = SP <uintptr> : SP
v3 = SB <uintptr> : SB
v10 = LEAQ <*uint8> {type."".container} v3 : AX
v8 = MOVQstore <mem> v2 v10 v1
v9 = CALLstatic <mem> {runtime.newobject} [16] v8
v11 = MOVQload <*container> [8] v2 v9 : AX
v13 = VarDef <mem> {~r0} v9
v14 = MOVQstore <mem> {~r0} v2 v11 v13
```

`MakeContainerOneLine`の結果([ssa.html](/files/2017-04-13-go1-8-allocation/MakeContainerOneLine.html))。

``` plain
v1 = InitMem <mem>
v2 = SP <uintptr> : SP
v3 = SB <uintptr> : SB
v10 = LEAQ <*uint8> {type."".container} v3 : AX
v8 = MOVQstore <mem> v2 v10 v1
v9 = CALLstatic <mem> {runtime.newobject} [16] v8
v11 = MOVQload <*container> [8] v2 v9 : AX
v14 = VarDef <mem> {~r0} v9
v15 = MOVQstore <mem> {~r0} v2 v11 v14
```

`MakeContainerNew`の結果([ssa.html](/files/2017-04-13-go1-8-allocation/MakeContainerNew.html))。

``` plain
v1 = InitMem <mem>
v2 = SP <uintptr> : SP
v3 = SB <uintptr> : SB
v10 = LEAQ <*uint8> {type."".container} v3 : AX
v8 = MOVQstore <mem> v2 v10 v1
v9 = CALLstatic <mem> {runtime.newobject} [16] v8
v11 = MOVQload <*container> [8] v2 v9 : AX
v12 = VarDef <mem> {~r0} v9
v13 = MOVQstore <mem> {~r0} v2 v11 v12
```

変数名の割り当てが異なるだけで実質同じ内容ですね。


## まとめ

- Go1.8.1の最適化強い
- Go1.8.1では`new(Type)`と`&Type{}`の差はない(少なくとも性能面では)
