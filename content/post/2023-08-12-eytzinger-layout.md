---
layout: post
title: "Eytzinger LayoutをGoで試してみた"
slug: 2023-08-12-eytzinger-layout
date: 2023-08-12 18:10:00 +0900
comments: true
categories: [go, golang]
---

2021年のスライド資料だけど、たまたま𝕏に流れているを見かけました。

<iframe class="speakerdeck-iframe" style="border: 0px; background: rgba(0, 0, 0, 0.1) padding-box; margin: 0px; padding: 0px; border-radius: 6px; box-shadow: rgba(0, 0, 0, 0.2) 0px 5px 40px; width: 100%; height: auto; aspect-ratio: 560 / 314;" frameborder="0" src="https://speakerdeck.com/player/5baa265604154e4c9bdbefb0ab58cdbb" title="Binary search with modern processors" allowfullscreen="true" data-ratio="1.78343949044586"></iframe>

このスライドでEytzinger Layoutという配列をはじめて知ったのでメモ。

## Eytzinger Layout

16世紀のオーストリアの貴族[Michaël Eytzinger]が考案したことから、この名前がついたそうです。
もともとはヨーロッパの王様の家系図に番号をつけるための方法です。
ある人物の番号が$`k`$のとき、父親に$`2k`$、母親に$`2k+1`$と番号をつけます。
このルールを使うと家系図に登場するすべての人物にユニークな番号をふることができます。

この番号付けのルールをバイナリツリーに応用すると、ツリー構造をポインターを使わずに表現できます。
[二分ヒープ]を配列で表現するときの実装としてよく登場するのを目にします。
こういう名前がついているのは知らなかった。

## バイナリサーチとEytzinger Layoutの関係

イマドキのCPUは非常に高速で、CPUの動作速度と比べてメモリーへの読み書きすら遅い、というレベルです。
この速度差を解消すべく、イマドキCPUはコア上にキャッシュと持っています。
読み書きの頻度の多いメモリー領域をキャッシュ上に保存することで、高速な動作を保っています。

さて、バイナリサーチはソート済みの配列から$`\log n`$オーダーで要素を検索する方法です。
しかし、通常のバイナリサーチはメモリーのアクセスパターンが複雑なため、CPUのキャッシュと非常に相性が悪いです。

そこでEytzinger Layoutの出番です。
Eytzinger Layoutを利用するとよくアクセスされる要素が隣接するようになります。
これによりCPUキャッシュのヒット率をあげようという作戦です。
冒頭のスライドや、以下の記事で詳しく説明されています（図があるとわかりやすいけど、面倒で力尽きた）。

- [Eytzinger Binary Search]
- [キャッシュフレンドリーな二分探索 ー データ構造を再考する]
- [Cache-friendly binary search]

## 実装

Goで実装してみました。

- [shogo82148/go-eytzinger]

ソート済みの配列からEytzinger Layoutへの変換は、再帰を使うと簡単に実装できます。
（参考: [Eytzinger Binary Search]）

```go
// https://github.com/shogo82148/go-eytzinger/blob/cd9c2f8a9657333f29a6b645cb2587322295ef3a/eytzinger.go#L8-L34

// Eytzinger rearranges the elements of a slice into a cache friendly binary tree
// as known as [Eytzinger Layout].
// The slice must be sorted in increasing order.
//
// [Eytzinger Layout]: https://en.wikipedia.org/wiki/Binary_tree#Arrays
func Eytzinger[S ~[]E, E any](a S) S {
    b := make(S, len(a))
    ctx := &eytzingerContext[S, E]{a: a, b: b}
    ctx.eytzinger(0, 0)
    return b
}


type eytzingerContext[S ~[]E, E any] struct {
    a S // input slice
    b S // output slice
}


// based on https://algorithmica.org/en/eytzinger
func (ctx *eytzingerContext[S, E]) eytzinger(i, k int) int {
    if k < len(ctx.a) {
        i = ctx.eytzinger(i, 2*k+1)
        ctx.b[k] = ctx.a[i]
        i++
        i = ctx.eytzinger(i, 2*k+2)
    }
    return i
}
```

検索の実装例です。　
実装の参考にした記事では、GCCの組み込み関数である`__builtin_ffs`を使用しています。
Goに直接これに対応する関数はありませんが、標準ライブラリの`math/bits.TrailingZeros`を使用すると簡単に移植できます。

```go
// https://github.com/shogo82148/go-eytzinger/blob/cd9c2f8a9657333f29a6b645cb2587322295ef3a/eytzinger.go#L55-L71

// Search searches for target in a Eytzinger Layout slice.
func Search[S ~[]E, E cmp.Ordered](x S, target E) (int, bool) {
    k := 1
    for k <= len(x) {
        if cmp.Less(x[k-1], target) {
            k = 2*k + 1
        } else {
            k = 2 * k
        }
    }
    k >>= bits.TrailingZeros(^uint(k)) + 1
    if k == 0 {
        return len(x), false
    }
    k--
    return k, k < len(x) && (x[k] == target || isNaN(target) && isNaN(x[k]))
}
```

## ベンチマーク

MacBook Pro 2021(CPU Apple M1 Pro, Memory 32GB)でベンチマークを取ってみました。

### 検索

`[]int`から[毎回ランダムな整数を検索するベンチマーク](https://github.com/shogo82148/go-eytzinger/blob/cd9c2f8a9657333f29a6b645cb2587322295ef3a/benchmark_test.go#L33-L45)を書きました。
以下に実行結果をしめします。

![検索時間](/images/2023-08-12-eytzinger-layout-1.svg)

`eytzinger.Search`がEytzinger Layoutに並べ替えてから検索した結果、`slice.BinarySearch`は[slices.BinarySearch]）（先週リリースされた[Go 1.21.0](https://go.dev/doc/devel/release#go1.21.0)の新機能です！）の結果です。
縦軸は検索1回あたりの処理時間、横軸は要素数の対数を取ったものです。Apple M1 Proで`int`は8バイトなので、横軸の数字を$`n`$とすると、検索対象の配列は$8\times2^n$バイトの大きさを持っています。
「オーバーヘッド」はランダムな整数を生成する時間のにかかった時間です。

8MB（グラフだと20のあたり）の前後でグラフの傾きが大きく変わっていることが読み取れます。
Apple M1 ProのL2 cacheが12MBらしいので、L2キャッシュにヒットしなくなったのでしょう。
知識として知っていても、実際に確認できるとなんだかおもしろいですね。

### Eytzinger Layout並べ替え

Eytzinger Layoutに並べ替えるのにかかった時間についてもベンチマークを取ってみました。

![Eytzinger Layout並べ替え](/images/2023-08-12-eytzinger-layout-2.svg)

両対数グラフで直線状になったので、$`O(n)`$のオーダーっぽいです。
代入の回数は各要素につき1回なので、納得の結果ですね。

## unisegへの応用

いやーちょうどバイナリサーチが遅くて困っていてですね。こういう情報ほしかったんです。
そういうわけで高速化できるか試してみました。

[rivo/uniseg]は文字列を[書記素クラスター](https://hydrocul.github.io/wiki/blog/2015/1025-unicode-grapheme-clusters.html)に分割するライブラリです。
書記素クラスターへの分割アルゴリズムは[Unicode Standard Annex #14]で定義されています。
[Unicode Standard Annex #14]では、**Unicodeに収録されているすべての文字について**
「この文字のあとでは分割してはいけないよ」「この文字のあとでは分割してもいいよ」というような属性を付与しています（あくまでもイメージで実際にはもっと複雑）。
この属性の検索にバイナリサーチを利用しているのですが、検索コストが無視できません。
実際にベンチマークを取ってみると実行時間の50%をバイナリサーチに使っていることがわかりました
（[pprofで解析した結果](https://github.com/shogo82148/uniseg/pull/22#issuecomment-1648046809)）。

Eytzinger Layoutに並べ替えたら早くなるのでは？
と考え、[実際にEytzinger Layoutに並べ替えてみました](https://github.com/shogo82148/uniseg/pull/27)。

```
goos: darwin
goarch: arm64
pkg: github.com/shogo82148/uniseg
                           │  .old.txt   │              .new.txt               │
                           │   sec/op    │   sec/op     vs base                │
GraphemesClass-10            8.553µ ± 0%   8.233µ ± 0%   -3.74% (p=0.000 n=10)
GraphemesFunctionBytes-10    3.059µ ± 1%   2.621µ ± 0%  -14.32% (p=0.000 n=10)
GraphemesFunctionString-10   3.039µ ± 0%   2.621µ ± 0%  -13.74% (p=0.000 n=10)
LineFunctionBytes-10         2.817µ ± 0%   2.908µ ± 0%   +3.21% (p=0.000 n=10)
LineFunctionString-10        2.844µ ± 0%   2.903µ ± 0%   +2.09% (p=0.000 n=10)
SentenceFunctionBytes-10     2.038µ ± 0%   1.701µ ± 0%  -16.56% (p=0.000 n=10)
SentenceFunctionString-10    2.057µ ± 0%   1.704µ ± 0%  -17.19% (p=0.000 n=10)
StepBytes-10                 8.209µ ± 0%   7.651µ ± 0%   -6.79% (p=0.000 n=10)
StepString-10                8.149µ ± 1%   7.640µ ± 0%   -6.25% (p=0.000 n=10)
WordFunctionBytes-10         1.876µ ± 0%   1.762µ ± 0%   -6.05% (p=0.000 n=10)
WordFunctionString-10        1.876µ ± 0%   1.749µ ± 0%   -6.77% (p=0.000 n=10)
geomean                      3.366µ        3.094µ        -8.07%
```

なんだか遅くなっている項目もあるけど、全体としては早くなっているのでﾖｼ!
（ちゃんとした考察は誰かに任せた・・・）

[rivo/uniseg]へ取り込んでもらうかは考え中・・・
まだプルリクエスト出してないけど、「コードが複雑になってわかりにくい」と言われそう。

## まとめ

- GoでEytzinger Layoutを使ったバイナリサーチを試してみました
    - 今回試した範囲では、12MBを超えるようなデーターでとくに効果がある
- [rivo/uniseg]に適用してベンチマークを取ってみました
    - 速くなりそう！
- 標準ライブラリ最高！
    - って書いておかないといけない気がした
    - [slices.BinarySearch]最高！

## 参考

- [遅い二分探索はみんな嫌だよね]
- [Eytzinger Binary Search]
- [slices.BinarySearch]
- [キャッシュフレンドリーな二分探索 ー データ構造を再考する]
- [Cache-friendly binary search]
- [shogo82148/go-eytzinger]
- [rivo/uniseg]
- [Unicode Standard Annex #14]

[遅い二分探索はみんな嫌だよね]: https://speakerdeck.com/kampersanda/binary-search-with-modern-processors
[Eytzinger Binary Search]: https://algorithmica.org/en/eytzinger
[slices.BinarySearch]: https://pkg.go.dev/slices#BinarySearch
[キャッシュフレンドリーな二分探索 ー データ構造を再考する]: https://postd.cc/cache-friendly-binary-search/
[Cache-friendly binary search]: http://bannalia.blogspot.com/2015/06/cache-friendly-binary-search.html
[Michaël Eytzinger]: https://en.wikipedia.org/wiki/Micha%C3%ABl_Eytzinger
[二分ヒープ]: https://ja.wikipedia.org/wiki/%E4%BA%8C%E5%88%86%E3%83%92%E3%83%BC%E3%83%97
[shogo82148/go-eytzinger]: https://github.com/shogo82148/go-eytzinger
[rivo/uniseg]: https://github.com/rivo/uniseg
[Unicode Standard Annex #14]: https://unicode.org/reports/tr14/
