---
layout: post
title: "Go言語でコンパイル時フィボナッチ数列計算"
date: 2017-02-19 09:06:05 +0900
comments: true
categories: 
---

[整数の公式でフィボナッチ数列を求める](http://postd.cc/fibonacci/)という記事を読んで、
「これコンパイル時ならGoでも簡単に計算できるのでは？」と思いやってみたメモ。

<!-- More -->

## 背景

みんな大好きフィボナッチ数列(要出典)。
漸化式で定義されているため、再帰やループを使って書くことが多いと思いますが、
閉じた式で書くことが知られています。
ただし、この一般式には無理数の演算が入るので、コンピュータで厳密に扱うことはできません。
ところが、さきほど紹介した記事で紹介された方法を使うと、整数の演算のみで実現できるそうです。

原理などはネタ元の記事を参照してもらうとして、
Python3では以下のように書けるらしいです。

``` python
def fib(n):
    return (4 << n*(3+n)) // ((4 << 2*n) - (2 << n) - 1) & ((2 << n) - 1)
```

ある程度大きなフィボナッチ数を求める場合、
計算途中の値が非常に大きくなるため、多倍長整数が必要となります。
Python3は多倍長整数に組み込みで対応していますが、
Goでは[math/bigパッケージ](https://golang.org/pkg/math/big/)を利用する必要があります。

なんか面倒だなGolangと思っていたのですが、
[Better C - Go言語と整数 #golang](http://qiita.com/sonatard/items/464a9d45c689386edfe1)を読んで、
「Goの定数には型がない(場合がある)」「任意の精度で計算してくれる」ということを知り、
「つまりコンパイル時に定数として計算すれば楽にいけるのでは！！」と考えたわけです。

## 結果

ちょっと複雑な式ですが、個々の演算自体はPython3もGoも変わらないので、
翻訳は簡単ですね。

``` go
package main

import "fmt"

const Fib0 = 1 // 0だけはうまくいかない

const (
	_    = (4 << (iota * (3 + iota))) / ((4 << (2 * iota)) - (2 << iota) - 1) & ((2 << iota) - 1)
	Fib1
	Fib2
	Fib3
	Fib4
	Fib5
	Fib6
	Fib7
	Fib8
	Fib9
	Fib10
	Fib11
	Fib12
	Fib13
	Fib14
	Fib15
	Fib16
	Fib17
	Fib18
	Fib19
	Fib20
	Fib21
)

func main() {
	fibs := []int{
		Fib0,
		Fib1,
		Fib2,
		Fib3,
		Fib4,
		Fib5,
		Fib6,
		Fib7,
		Fib8,
		Fib9,
		Fib10,
		Fib11,
		Fib12,
		Fib13,
		Fib14,
		Fib15,
		Fib16,
		Fib17,
		Fib18,
		Fib19,
		Fib20,
		Fib21,
	}
	for i, fib := range fibs {
		fmt.Println(i, fib)
	}
}
```

実行結果です。

``` plain
$ go run fibconst.go
0 1
1 1
2 2
3 3
4 5
5 8
6 13
7 21
8 34
9 55
10 89
11 144
12 233
13 377
14 610
15 987
16 1597
17 2584
18 4181
19 6765
20 10946
21 17711
```

`Fibxxx`をたくさん書くのはつらかったので、ソースコードはPerlで自動生成しました。

``` perl
print <<EOF;
package main

import "fmt"

const Fib0 = 1

const (
    _    = (4 << (iota * (3 + iota))) / ((4 << (2 * iota)) - (2 << iota) - 1) & ((2 << iota) - 1)
EOF

print "    Fib$_\n" for 1..21;

print <<EOF;
)

func main() {
    fibs := []int{
        Fib0,
EOF

print "        Fib$_,\n" for 1..21;

print <<EOF
    }
    for i, fib := range fibs {
        fmt.Println(i, fib)
    }
}
EOF
```

21までしかないのは、
22以降を求めようとしたらコンパイルが通らなかったためです。

``` plain
$ go run fibconst.go
# command-line-arguments
./fibconst.go:29: shift count too large: 550
```

どうやら512bitまでしか扱えないらしい。
任意精度扱えるって書いてあったのに！！！

- [mpint.go](https://github.com/golang/go/blob/go1.8/src/cmd/compile/internal/gc/mpint.go#L211)
- [mpfloat.go](https://github.com/golang/go/blob/go1.8/src/cmd/compile/internal/gc/mpfloat.go#L18)

おとなしく多倍長整数が組込の言語でやれっている話ではありますが、
なんとなくやってみたかったんです。


## 参考

- [整数の公式でフィボナッチ数列を求める](http://postd.cc/fibonacci/)
  - Source: [An integer formula for Fibonacci numbers](http://paulhankin.github.io/Fibonacci/)
- [Better C - Go言語と整数 #golang](http://qiita.com/sonatard/items/464a9d45c689386edfe1)

ネタ元にある「母関数」という概念は、数学ガールを読んで知りました。

<iframe style="width:120px;height:240px;" marginwidth="0" marginheight="0" scrolling="no" frameborder="0" src="//rcm-fe.amazon-adsystem.com/e/cm?lt1=_blank&bc1=000000&IS2=1&bg1=FFFFFF&fc1=000000&lc1=0000FF&t=shogo82148-22&o=9&p=8&l=as4&m=amazon&f=ifr&ref=as_ss_li_til&asins=4797341378&linkId=be2c6011ca1a5f15d96c370e494b0f95"></iframe>

フィボナッチ数列に触れている部分はWebでも公開されているので、そちらもどうぞ([ミルカさんとフィボナッチ数列](http://www.hyuki.com/story/genfunc.html))
