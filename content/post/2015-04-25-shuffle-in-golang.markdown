---
layout: post
title: "Go言語でshuffleする話"
date: 2015-04-25T18:07:00+09:00
comments: true
categories: [golang]
---

[Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle)を使ってシャッフルライブラリ作ってみました。

- https://github.com/shogo82148/go-shuffle

標準ライブラリのsortと似たような感じで使えます。
デフォルトでintとfloat64とstringのシャッフルに対応していて、
他の型をシャッフルしたい場合はインターフェースを実装してね、って感じです。
実装が簡単なので、インターフェース定義する手間とシャッフルのアルゴリズム自前で書く手間ほとんど一緒ではという気もするけど、
まあライブラリ作成の練習ってことで。

で、ここからが本題。
Fisher-Yates shuffleの名前は以前から知ってたけど、
この前某プロジェクトで以下のようなshuffleの実装を発見。

``` go
package main

import "math/rand"

func shuffle(a []int) {
	for i := range a {
		j := rand.Intn(i + 1)
		a[i], a[j] = a[j], a[i]
	}
}
```

Fisher-Yates shuffleと似ているけど、なにかが違う。
ちゃんとシャッフルされているのか気になったので検証してみました。

<!-- More -->

## 検証

n個の数列をシャッフルすることを考えます。
シャッフルの後i番目の要素がj番目に移動する確率を {% m %}P_n(i, j){% em %} と定義します(golangのコードにあわせて0-originで考えます)。

完全にランダムにシャッフルされていれば、
元の数列のどの要素も0からn-1の範囲に一様分布するはずです。
つまり、以下の式がなりたてば「シャッフルされている」と言えそうです。

{% math %}
P_n(i, j) = \frac{1}{n}　　　(i, j = 0, \dots, n - 1)
{% endmath %}

### n=1の場合
n=1の場合は、必ず0番目と0番目の入れ替え(つまり順番変わらない)になります。
上で定義した確率を計算すると{% m %}P_1(0, 0) = 1/1{% em %}となるので、シャッフルされていると言えます。

### n=k+1の場合

ループがk回周ったあと0...k-1の要素はシャッフルされていると仮定して、
最後のn=k+1回目のループが周ったあと正しくシャッフルされているかを検証します。
全てのi, jの組み合わせについて考えるのは大変なので、いくつか場合分け。

i=n-1の場合。
n-1番目の要素と交換されるのは、0...n-1番目の中からランダムに一つなので、以下のことはすぐに分かりますね。

{% math %}
P_n(n-1, j) = \frac{1}{n}　　　(j = 0, \dots, n - 1)
{% endmath %}

i,j < n-1 の場合。
n回目のループでi番目の要素がj番目に来る確率＝i番目の要素がn-1回のループでj番目に来る確率×最後のループでj番目が入れ替え対象にならない確率なので、
以下のようになります。

{% math %}
P_n(i, j) = P_{n-1}(i,j) \times \frac{n-1}{n} = \frac{1}{n-1} \times \frac{n-1}{n} = \frac{1}{n}
{% endmath %}

i<n-1, j=n-1の場合。
n回目のループでi番目の要素がj番目に来る確率＝i番目の要素がn-1回のループでj番目に来る確率×最後のループでj番目が入れ替え対象になる確率です。

{% math %}
P_n(i, n-1) = \sum_{j=0}^{n-2}P_{n-1}(i,j)\times\frac{1}{n} = \frac{1}{n}
{% endmath %}

これで全ての場合について

{% math %}
P_n(i, j) = \frac{1}{n}　　　(i, j = 0, \dots, n - 1)
{% endmath %}

が成り立ち、シャッフルされているということがわかりました。
数学的帰納法により、1以上の全ての自然数についてシャッフルが行われることになります。



## ループの中でaの値を書き換えるていることについて
`for i := range a`でイテレーションしている最中に
元のコレクションを書き換える操作をしているのが気になって逆アセンブルしてみた。

``` plain
--- prog list "shuffle" ---
0000 (/Users/shogo/shuffle.go:5) TEXT    shuffle+0(SB),$40-24
0001 (/Users/shogo/shuffle.go:5) FUNCDATA $0,gcargs·0+0(SB)
0002 (/Users/shogo/shuffle.go:5) FUNCDATA $1,gclocals·0+0(SB)
0003 (/Users/shogo/shuffle.go:5) TYPE    a+0(FP){[]int},$24
0004 (/Users/shogo/shuffle.go:5) TYPE    i+-16(SP){int},$8
0005 (/Users/shogo/shuffle.go:5) TYPE    autotmp_0001+-24(SP){int},$8
0006 (/Users/shogo/shuffle.go:5) TYPE    autotmp_0002+-8(SP){int},$8
0007 (/Users/shogo/shuffle.go:5) TYPE    autotmp_0003+0(SP){int},$8
0008 (/Users/shogo/shuffle.go:6) MOVQ    a+8(FP),BX
0009 (/Users/shogo/shuffle.go:6) MOVQ    $0,DI
0010 (/Users/shogo/shuffle.go:6) MOVQ    BX,autotmp_0002+-8(SP)
0011 (/Users/shogo/shuffle.go:6) JMP     ,13
0012 (/Users/shogo/shuffle.go:6) INCQ    ,DI
0013 (/Users/shogo/shuffle.go:6) MOVQ    autotmp_0002+-8(SP),BP
0014 (/Users/shogo/shuffle.go:6) CMPQ    DI,BP
0015 (/Users/shogo/shuffle.go:6) JGE     $0,60
0016 (/Users/shogo/shuffle.go:6) MOVQ    DI,autotmp_0001+-24(SP)
0017 (/Users/shogo/shuffle.go:7) MOVQ    DI,BX
0018 (/Users/shogo/shuffle.go:7) MOVQ    DI,i+-16(SP)
0019 (/Users/shogo/shuffle.go:7) INCQ    ,BX
0020 (/Users/shogo/shuffle.go:7) MOVQ    BX,(SP)
0021 (/Users/shogo/shuffle.go:7) CALL    ,rand.Intn+0(SB)
0022 (/Users/shogo/shuffle.go:7) MOVQ    i+-16(SP),R9
0023 (/Users/shogo/shuffle.go:7) MOVQ    autotmp_0001+-24(SP),DI
0024 (/Users/shogo/shuffle.go:7) MOVQ    a+8(FP),DX
0025 (/Users/shogo/shuffle.go:7) MOVQ    a+0(FP),AX
0026 (/Users/shogo/shuffle.go:7) MOVQ    8(SP),CX
0027 (/Users/shogo/shuffle.go:8) MOVQ    AX,BX
0028 (/Users/shogo/shuffle.go:8) MOVQ    R9,BP
0029 (/Users/shogo/shuffle.go:8) CMPQ    R9,DX
0030 (/Users/shogo/shuffle.go:8) JCS     $1,33
0031 (/Users/shogo/shuffle.go:8) CALL    ,runtime.panicindex+0(SB)
0032 (/Users/shogo/shuffle.go:8) UNDEF   ,
0033 (/Users/shogo/shuffle.go:8) LEAQ    (BX)(BP*8),BX
0034 (/Users/shogo/shuffle.go:8) MOVQ    (BX),SI
0035 (/Users/shogo/shuffle.go:8) MOVQ    AX,BX
0036 (/Users/shogo/shuffle.go:8) MOVQ    R9,BP
0037 (/Users/shogo/shuffle.go:8) CMPQ    R9,DX
0038 (/Users/shogo/shuffle.go:8) JCS     $1,41
0039 (/Users/shogo/shuffle.go:8) CALL    ,runtime.panicindex+0(SB)
0040 (/Users/shogo/shuffle.go:8) UNDEF   ,
0041 (/Users/shogo/shuffle.go:8) LEAQ    (BX)(BP*8),BX
0042 (/Users/shogo/shuffle.go:8) MOVQ    AX,BP
0043 (/Users/shogo/shuffle.go:8) MOVQ    CX,R8
0044 (/Users/shogo/shuffle.go:8) CMPQ    CX,DX
0045 (/Users/shogo/shuffle.go:8) JCS     $1,48
0046 (/Users/shogo/shuffle.go:8) CALL    ,runtime.panicindex+0(SB)
0047 (/Users/shogo/shuffle.go:8) UNDEF   ,
0048 (/Users/shogo/shuffle.go:8) LEAQ    (BP)(R8*8),BP
0049 (/Users/shogo/shuffle.go:8) MOVQ    (BP),R8
0050 (/Users/shogo/shuffle.go:8) MOVQ    R8,(BX)
0051 (/Users/shogo/shuffle.go:8) MOVQ    AX,BX
0052 (/Users/shogo/shuffle.go:8) MOVQ    CX,BP
0053 (/Users/shogo/shuffle.go:8) CMPQ    CX,DX
0054 (/Users/shogo/shuffle.go:8) JCS     $1,57
0055 (/Users/shogo/shuffle.go:8) CALL    ,runtime.panicindex+0(SB)
0056 (/Users/shogo/shuffle.go:8) UNDEF   ,
0057 (/Users/shogo/shuffle.go:8) LEAQ    (BX)(BP*8),BX
0058 (/Users/shogo/shuffle.go:8) MOVQ    SI,(BX)
0059 (/Users/shogo/shuffle.go:6) JMP     ,12
0060 (/Users/shogo/shuffle.go:10) RET     ,
```

アセンブル読めてないけど、ループの最初で`len(a)`を`autotmp_0002+-8(SP)`に保存しているっぽいのを感じる。
自動的に`size := len(a) for i := 0; i < size; i++ {` みたいな処理に書き換えているみたい。
