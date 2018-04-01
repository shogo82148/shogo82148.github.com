---
layout: post
title: "Go言語のchanはいったいいくつ付けられるのか試してみた"
date: 2017-03-17 21:10:25 +0900
comments: true
categories: [go, golang]
---

pecoに入った修正をみて、果たして`chan`はいくつまで付けられるのか気になったので、
雑に試してみました。
先に断っておきますが、全く有用ではないですよ。

<!-- More -->

## 背景

pecoに入った修正はこちら(一部抜粋)。

- [Make Resume a blocking operation #411](https://github.com/peco/peco/pull/411)

``` diff
diff --git a/interface.go b/interface.go
index 3d4472f..fff446c 100644
--- a/interface.go
+++ b/interface.go
@@ -162,8 +162,8 @@ type Screen interface {
 // Termbox just hands out the processing to the termbox library
 type Termbox struct {
 	mutex     sync.Mutex
-	resumeCh  chan (struct{})
-	suspendCh chan (struct{})
+	resumeCh  chan chan struct{}
+	suspendCh chan struct{}
 }
 
 // View handles the drawing/updating the screen
diff --git a/screen.go b/screen.go
index edbce87..f6dd71e 100644
--- a/screen.go
+++ b/screen.go
@@ -21,7 +21,7 @@ func (t *Termbox) Init() error {
 func NewTermbox() *Termbox {
 	return &Termbox{
 		suspendCh: make(chan struct{}),
-		resumeCh:  make(chan struct{}),
+		resumeCh:  make(chan chan struct{}),
 	}
 }
```

channelを使ってchannelをやり取りすることができるので、
`chan struct{}`をやり取りする`chan chan struct{}`という型が使えます。
同じ要領で、channelをやり取りするchannelをやり取りするchannelをやり取り...するchannelが
無限に作れるはずです(少なくとも構文上は)。
ということで、実際にやってみました。


## 実験

雑なPerlスクリプトを準備して、大量の`chan`を付けたGoのコードを自動生成します。

``` perl
print <<EOF;
package main

import (
    "fmt"
)

type Foo @{['chan ' x 4096]} struct{}

func main() {
    fmt.Printf("Hello, %#v\\n", make(Foo))
}
EOF
```

`chan`の個数を変えて何度かビルドを繰り返します。

``` bash
time go build -o main main.go
```

## 結果

chanの個数とビルドにかかった時間をまとめてみました。

<table>
    <tr><th>chanの個数</th><th>ビルド時間</th></tr>
    <tr><td>1</td><td>0.236s</td></tr>
    <tr><td>2</td><td>0.240s</td></tr>
    <tr><td>4</td><td>0.226s</td></tr>
    <tr><td>8</td><td>0.234s</td></tr>
    <tr><td>16</td><td>0.240s</td></tr>
    <tr><td>32</td><td>0.250s</td></tr>
    <tr><td>64</td><td>0.281s</td></tr>
    <tr><td>128</td><td>0.258s</td></tr>
    <tr><td>256</td><td>0.360s</td></tr>
    <tr><td>512</td><td>0.775s</td></tr>
    <tr><td>1024</td><td>3.228s</td></tr>
    <tr><td>2048</td><td>18.605s</td></tr>
    <tr><td>4096</td><td>1m53.614s</td></tr>
    <tr><td>8192</td><td>13m46.018s(ビルド失敗したので参考記録)</td></tr>
</table>

8192個付けたら以下のようなエラーを吐いてビルドが失敗してしまったので、
8192個の時の記録は参考記録です。

``` plain
# command-line-arguments
too much data in section SDWARFINFO (over 2000000000 bytes)
```

何かビルドの設定をいじればもっと行けるかもしれませんが、
デフォルトの設定では4096から8192の間に限界があるようです。
4096個`chan`を付けたときのソースコードは20KB程度なのにバイナリサイズは524MBまで膨らんでいました。

256個当たりからビルド時間に影響が出ているので、
ビルド時間を考える256個以下に抑えるのがよさそうです。
それ以上だと {% m %}O(n^{2.6}){% em %} 程度のオーダーでビルド時間が延びます。
とはいえ、256個も`chan`を付いたコードを人間が読めるとは思えないので、
2個が限度でしょうね・・・。
3個以上必要になるケースは余りないと思います。


## 型定義を再帰的にして無限chanを実現する

そもそも、`chan`を大量に並べなくとも、
型定義を再帰的に行えば無限の`chan`を付けたときと同等のことができます。
例えば以下のコードで"Goroutine 1"と"Goroutine 2"を交互に表示することが可能です。

``` go
package main

import (
	"fmt"
)

type Foo chan Foo

func main() {
	ch := make(Foo)
	go func() {
		ch := ch
		for {
			done := <-ch
			fmt.Println("Goroutine 2")
			done <- ch
		}
	}()
	
	for i := 0; i < 100; i++ {
		fmt.Println("Goroutine 1")
		done := make(Foo)
		ch <- done
		ch = <-done
	}
	fmt.Println("Hello, playground")
}
```

channelでのやり取りが複雑になるので実用性があるかは不明ですが・・・。
例えば先程の例だと、普通にループを書いたほうが圧倒的にシンプルです。

``` go
package main

import (
	"fmt"
)

func main() {
	for i := 0; i < 100; i++ {
		fmt.Println("Goroutine 1")
		fmt.Println("Goroutine 2")
	}
	fmt.Println("Hello, playground")
}
```

無限`chan`が必要になる多くのケースは、このような書き換えができるような気がします。
(そもそも必要になったことがない)


## まとめ

- `chan`の個数の上限は4096から8192の間のどこか
- 256個あたりからビルド時間に影響が出始める
  - プログラムを読む人の精神力に多大な影響を与えるので、実際は2個までに留めるべきだと思う
- 再帰的に型を定義することで、無限に`chan`を付けた時と同等のことが可能

`chan`を大量に付けたいケースには今までに僕自身は遭遇したことがないです。
有用な例を見つけた人は教えてください。
