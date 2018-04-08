---
layout: post
title: "map[string]Hoge or map[string]*Hoge ?"
slug: should-i-use-a-pointer-in-go
date: 2015-02-22T02:14:00+09:00
comments: true
categories: [go, golang]
---

Go言語でポインタを使うべきか使わないべきか問題。
「ケース・バイ・ケースなので、状況に応じて使い分けましょう！」という結論が出るのは目に見えているので、
具体例について検証してみた結果を書いておきます。

<!-- More -->

## 背景

他の人のコードレビューを見ていたら、
レビュアーが「コピーをしないで済むのでstructの受け渡しにはポインタ使ったほうがいいと思います！」とコメントしていて、
そうなのか？と思ったのですがあんまり自信がなかったので検証してみました。
コメントがついていたのは以下のようなコード。


``` go
package hoge

import (
	"strconv"
)

type Hoge struct {
	A int
	B int
	C int
}

func NewHogeMapStruct() map[string]Hoge {
	m := make(map[string]Hoge)
	for i := 0; i < 10000; i++ {
		m[strconv.Itoa(i)] = Hoge{i, i, i}
	}
	return m
}
```

ポイントは以下の点です。

- 受け渡すstructはintが3つ程度の小さなもの
- mapに入れて返す


## benchmarkを使って検証する

ポインタを使わない版と使う版を両方作ってベンチマークをとってみます。

``` go
package hoge

import (
	"strconv"
)

type Hoge struct {
	A int
	B int
	C int
}

// ポインタ使わない版
func NewHogeMapStruct() map[string]Hoge {
	m := make(map[string]Hoge)
	for i := 0; i < 10000; i++ {
		m[strconv.Itoa(i)] = Hoge{i, i, i}
	}
	return m
}

// ポインタ使う版
func NewHogeMapPointer() map[string]*Hoge {
	m := make(map[string]*Hoge)
	for i := 0; i < 10000; i++ {
		m[strconv.Itoa(i)] = &Hoge{i, i, i}
	}
	return m
}
```

ベンチマークはこれらの関数をただ呼び出すだけのシンプルなもの。

``` go
package hoge

import (
	"strconv"
	"testing"
)

func BenchmarkStruct(b *testing.B) {
	for i := 0; i < b.N; i++ {
		NewHogeMapStruct()
	}
}

func BenchmarkPointer(b *testing.B) {
	for i := 0; i < b.N; i++ {
		NewHogeMapPointer()
	}
}
```

`go test -benchmem -bench .` すると以下のような結果が得られました。

``` plain
PASS
BenchmarkStruct	     500	   3238732 ns/op	 1662087 B/op	   10615 allocs/op
BenchmarkPointer     500	   3485712 ns/op	 1372074 B/op	   20593 allocs/op
ok  	github.com/shogo82148/pointer-test	4.067s
```

ポインタを使わないほうが若干速いですね。
メモリのアロケーション回数はポインタ使う版の半分です。

ポインタ使わない版は速度・メモリアロケーション回数は減ったものの、
必要なバイト数は増えています。
おそらく、これから値が入る予定のメモリ領域を予め確保しており、
その分のメモリを多めに食っているのでしょう。
ポインタ使う版では構造体の中身を入れる分は必要になったときにnewするので、
使用するメモリは最小限で済みます。

## アセンブリを見てみてみる

go tool を使うとアセンブリが見れるらしい。
`go tool 6g -S hoge.go` を実行してアセンブリも眺めてみます。

``` plain
--- prog list "NewHogeMapStruct" ---
0000 (hoge.go:13) TEXT    NewHogeMapStruct+0(SB),$72-8
0001 (hoge.go:13) FUNCDATA $0,gcargs·0+0(SB)
0002 (hoge.go:13) FUNCDATA $1,gclocals·0+0(SB)
0003 (hoge.go:13) TYPE    ~anon0+0(FP){map[string]"".Hoge},$8
0004 (hoge.go:13) TYPE    m+-8(SP){map[string]"".Hoge},$8
0005 (hoge.go:13) TYPE    i+-16(SP){int},$8
0006 (hoge.go:14) MOVQ    $type.map[string]"".Hoge+0(SB),(SP)
0007 (hoge.go:14) MOVQ    $0,8(SP)
0008 (hoge.go:14) PCDATA  $0,$24
0009 (hoge.go:14) CALL    ,runtime.makemap+0(SB)
0010 (hoge.go:14) PCDATA  $0,$-1
0011 (hoge.go:14) MOVQ    16(SP),BX
0012 (hoge.go:14) MOVQ    BX,m+-8(SP)
0013 (hoge.go:15) MOVQ    $0,AX
0014 (hoge.go:15) JMP     ,16
0015 (hoge.go:15) INCQ    ,AX
0016 (hoge.go:15) CMPQ    AX,$10000
0017 (hoge.go:15) JGE     $0,40
0018 (hoge.go:16) MOVQ    AX,i+-16(SP)
0019 (hoge.go:16) MOVQ    AX,(SP)
0020 (hoge.go:16) CALL    ,strconv.Itoa+0(SB)
0021 (hoge.go:16) MOVQ    i+-16(SP),DX
0022 (hoge.go:16) MOVQ    8(SP),SI
0023 (hoge.go:16) MOVQ    16(SP),BP
0024 (hoge.go:16) MOVQ    statictmp_0002+0(SB),BX
0025 (hoge.go:16) MOVQ    statictmp_0002+8(SB),BX
0026 (hoge.go:16) MOVQ    statictmp_0002+16(SB),BX
0027 (hoge.go:16) MOVQ    $type.map[string]"".Hoge+0(SB),(SP)
0028 (hoge.go:16) MOVQ    m+-8(SP),BX
0029 (hoge.go:16) MOVQ    BX,8(SP)
0030 (hoge.go:16) MOVQ    SI,16(SP)
0031 (hoge.go:16) MOVQ    BP,24(SP)
0032 (hoge.go:16) MOVQ    DX,32(SP)
0033 (hoge.go:16) MOVQ    DX,40(SP)
0034 (hoge.go:16) MOVQ    DX,48(SP)
0035 (hoge.go:16) PCDATA  $0,$56
0036 (hoge.go:16) CALL    ,runtime.mapassign1+0(SB)
0037 (hoge.go:16) MOVQ    i+-16(SP),AX
0038 (hoge.go:16) PCDATA  $0,$-1
0039 (hoge.go:15) JMP     ,15
0040 (hoge.go:18) MOVQ    m+-8(SP),BX
0041 (hoge.go:18) MOVQ    BX,~anon0+0(FP)
0042 (hoge.go:18) RET     ,
```

``` plain
--- prog list "NewHogeMapPointer" ---
0043 (hoge.go:21) TEXT    NewHogeMapPointer+0(SB),$72-8
0044 (hoge.go:21) FUNCDATA $0,gcargs·1+0(SB)
0045 (hoge.go:21) FUNCDATA $1,gclocals·1+0(SB)
0046 (hoge.go:21) TYPE    ~anon0+0(FP){map[string]*"".Hoge},$8
0047 (hoge.go:21) TYPE    m+-24(SP){map[string]*"".Hoge},$8
0048 (hoge.go:21) TYPE    i+-32(SP){int},$8
0049 (hoge.go:21) TYPE    autotmp_0003+-16(SP){string},$16
0050 (hoge.go:22) MOVQ    $type.map[string]*"".Hoge+0(SB),(SP)
0051 (hoge.go:22) MOVQ    $0,8(SP)
0052 (hoge.go:22) PCDATA  $0,$24
0053 (hoge.go:22) CALL    ,runtime.makemap+0(SB)
0054 (hoge.go:22) PCDATA  $0,$-1
0055 (hoge.go:22) MOVQ    16(SP),BX
0056 (hoge.go:22) MOVQ    BX,m+-24(SP)
0057 (hoge.go:23) MOVQ    $0,AX
0058 (hoge.go:23) JMP     ,60
0059 (hoge.go:23) INCQ    ,AX
0060 (hoge.go:23) CMPQ    AX,$10000
0061 (hoge.go:23) JGE     $0,94
0062 (hoge.go:24) MOVQ    AX,i+-32(SP)
0063 (hoge.go:24) MOVQ    AX,(SP)
0064 (hoge.go:24) CALL    ,strconv.Itoa+0(SB)
0065 (hoge.go:24) MOVQ    8(SP),BX
0066 (hoge.go:24) MOVQ    BX,autotmp_0003+-16(SP)
0067 (hoge.go:24) MOVQ    16(SP),BX
0068 (hoge.go:24) MOVQ    BX,autotmp_0003+-8(SP)
0069 (hoge.go:24) MOVQ    $type."".Hoge+0(SB),(SP)
0070 (hoge.go:24) PCDATA  $0,$16
0071 (hoge.go:24) CALL    ,runtime.new+0(SB)
0072 (hoge.go:24) MOVQ    i+-32(SP),CX
0073 (hoge.go:24) PCDATA  $0,$-1
0074 (hoge.go:24) MOVQ    8(SP),AX
0075 (hoge.go:24) NOP     ,
0076 (hoge.go:24) MOVQ    CX,(AX)
0077 (hoge.go:24) NOP     ,
0078 (hoge.go:24) MOVQ    CX,8(AX)
0079 (hoge.go:24) NOP     ,
0080 (hoge.go:24) MOVQ    CX,16(AX)
0081 (hoge.go:24) MOVQ    $type.map[string]*"".Hoge+0(SB),(SP)
0082 (hoge.go:24) MOVQ    m+-24(SP),BX
0083 (hoge.go:24) MOVQ    BX,8(SP)
0084 (hoge.go:24) MOVQ    autotmp_0003+-16(SP),BX
0085 (hoge.go:24) MOVQ    BX,16(SP)
0086 (hoge.go:24) MOVQ    autotmp_0003+-8(SP),BX
0087 (hoge.go:24) MOVQ    BX,24(SP)
0088 (hoge.go:24) MOVQ    AX,32(SP)
0089 (hoge.go:24) PCDATA  $0,$40
0090 (hoge.go:24) CALL    ,runtime.mapassign1+0(SB)
0091 (hoge.go:24) MOVQ    i+-32(SP),AX
0092 (hoge.go:24) PCDATA  $0,$-1
0093 (hoge.go:23) JMP     ,59
0094 (hoge.go:26) MOVQ    m+-24(SP),BX
0095 (hoge.go:26) MOVQ    BX,~anon0+0(FP)
0096 (hoge.go:26) RET     ,
```

メモリアロケーションが起きているのはおそらく `runtime.new` と `strconv.Itoa` を呼び出している部分でしょう。
ポインタ使う版では両方とも呼び出していますが、ポインタ使わない版では`strconv.Itoa`の呼び出しだけです。
ポインタ使う版ではmapのkeyとvalueのメモリ領域をそれぞれ確保が必要なのに対して、
ポインタ使わない版ではvalueのためのメモリ領域を`new(map[string]Hoge)`の時点で一括確保するので、
メモリアロケーションが少なくて済むということですね。

## 結論

今回の場合構造体のサイズが小さいく、コピーのコスト<アロケーションのコストであったため、
速度的にはポインタを使わない方が有利でした。
しかし、`map`は値の入っていない要素分を予め確保するので、
メモリ使用量的にはポインタを使う方が有利でした。
結局は速度とメモリ使用量のトレードオフということです。

実際のコードでは、キーの個数は60個程度で呼び出される頻度もそんなに多くなく、
速度もメモリも十分に足りるので、正直どっちでも良かった気がします。
ポインタを使わないほうがタイプ数がちょっと減ってコード書くときに少し嬉しいくらいですかね。


## 結論の結論

ケース・バイ・ケースなので、状況に応じて使い分けましょう！
