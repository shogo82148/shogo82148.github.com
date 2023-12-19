---
layout: post
title: "PythonのitertoolsをGoに移植してみた"
slug: 2023-12-19-itertools-on-golang
date: 2023-12-19 00:57:00 +0900
comments: true
categories: [go, golang]
---

Go 1.22 に試験的に導入される予定の [range over func](https://github.com/golang/go/issues/61405) で遊んでみました。
お題はPythonの[itertools](https://docs.python.org/ja/3/library/itertools.html)の移植です。

- [shogo82148/hi](https://github.com/shogo82148/hi)

## 背景

Go 1.22 では range over func と呼ばれる機能が試験的に導入されます。

- [spec: add range over int, range over func #61405](https://github.com/golang/go/issues/61405)

range over func が導入される背景については以下の記事がわかりやすかったです。

- [Go 1.22で追加予定のrange over intと、GOEXPERIMENT入り予定のrange over funcを触ってみる](https://tech.every.tv/entry/2023/12/09/1)

大雑把にまとめると「Goにもイテレーターの標準を導入しよう」という話です。

Pythonを触っていた時期もあったので、自分はイテレーターと聞いて [itertools](https://docs.python.org/ja/3/library/itertools.html) がパッと思い浮かびました。
ということでこれを題材に遊んでみることにしました。

## 動かし方

2023-12-19現在、Go 1.22は未リリースなので、試すにはいくつか手順が必要です。

まずはGo本体。masterブランチの最新版をダウンロードしましょう。

```
go install golang.org/dl/gotip@latest
gotip download
```

[shogo82148/hi](https://github.com/shogo82148/hi) はみんなに使ってほしいので、
Go 1.21で動くようになっています。
そのため、そのままでは Go 1.22 の最新機能が使えません。`go.mod` ファイルの `go` ディレクティブを書き換える必要があります。
さらに実験的機能を使っているので、実行には `GOEXPERIMENT=rangefunc` 環境変数が必要です。

```
git clone git@github.com:shogo82148/hi.git
cd hi
gotip mod edit -go=1.22
GOEXPERIMENT=rangefunc gotip test ./...
```

以下のバージョンで動作することを確認しています。

```
go version devel go1.22-d73b4322 Thu Dec 14 22:24:40 2023 +0000 darwin/arm64
```

試験的な機能であるため、Go 1.22 や 1.23 のリリース時に動作する保証はありません。
破壊的な変更が入る可能性もあります。

## 使い方

詳しくは [README.md](https://github.com/shogo82148/hi#hi---utility-functions-for-collections) を参照。
itertools 以外にも「あると便利そうだな」と思った機能も入れてあります。

### range over func の使い方

まずは range over func の使い方から確認です。
`func(func()bool)`, `func(func(V)bool)`, `func(func(K, V)bool)` のいずれかの形式で関数を書くと、
`for ... = range ...` の形式でループを回すことができます。

例として文字列 `"a", "b", "c"` を順番に返すイテレーターを作ってみましょう。

```go
package main

import (
    "fmt"
)

func seq(yield func(string)bool) {
    if !yield("a") {
        return
    }
    if !yield("b") {
        return
    }
    if !yield("c") {
        return
    }
}

func main() {
    for s := range seq {
        fmt.Println(s)
    }

    // Output:
    // a
    // b
    // c
}
```

### SliceValues

`SliceValues` はスライスをイテレーターに変換します。

```go
package main

import (
    "fmt"

    "github.com/shogo82148/hi/it"
)

func main() {
    seq := it.SliceValues([]string{"a", "b", "c"})
    for s := range seq {
        fmt.Println(s)
    }

    // Output:
    // a
    // b
    // c
}
```

### Cycle

`Cycle` は与えられたイテレーターを保存し、保存した内容を無限に繰り返します。
たとえば以下のコードは a, b, c を永遠に出力するコードです。

```go
package main

import (
    "fmt"

    "github.com/shogo82148/hi/it"
)

func main() {
    seq = it.Cycle(it.SliceValues([]string{"a", "b", "c"}))
    for s := range seq {
        fmt.Println(s)
    }

    // Output:
    // a
    // b
    // c
    // a
    // b
    // c
    // a
    // ....
}
```

「無限の繰り返し」はmapやsliceでは不可能です。
channelを利用すれば可能ですが、注意深く扱わないと簡単に goroutine-leak してしまいます。
range over func なら無限ループも簡単に実現できて、便利そうです。

### Zip

`Zip` あたら得られた2つのイテレーターから値を順番に取り出し、ペアを作る関数です。

```go
package main

import (
    "fmt"

    "github.com/shogo82148/hi/it"
)

func main() {
    seq1 := it.SliceValues([]string{"one", "two", "three"})
    seq2 := it.SliceValues([]string{"いち", "に", "さん"})
    seq = it.Zip(seq1, seq2)
    for k, v := range seq {
        fmt.Println(k, v)
    }

    // Output:
    // one いち
    // two に
    // three さん
}
```

`Zip` 関数なかなかおもしろい関数です。

↑のプログラム中の `seq1`, `seq2` は本来関数であったことを思い出してください。
元の関数の形で書き下すと以下のようになります。

```go
package main

import (
    "fmt"

    "github.com/shogo82148/hi/it"
)

func seq1(yield func(string)bool) {
    if !yield("one") { // 1
        return
    }
    if !yield("two") { // 3
        return
    }
    if !yield("three") { // 5
        return
    }
}

func seq2(yield func(string)bool) {
    if !yield("いち") { // 2
        return
    }
    if !yield("に") { // 4
        return
    }
    if !yield("さん") { // 6
        return
    }
}

func main() {
    seq = it.Zip(seq1, seq2)
    seq(func(k, v string) {
        fmt.Println(k, v)
    })

    // Output:
    // one いち
    // two に
    // three さん
}
```

`yield` 関数の呼び出しタイミングをコメントに記述しました。
`seq1` と `seq2` の `yield` 関数が交互に呼び出されているのがわかると思います。

他の言語ではコルーチンと呼ばれているものですね。
今までのGoでもgoroutineとchannelを使って似たようなものを実現することは可能ですが、より簡単に実現できます。
この機能は、これまた Go 1.22 で実験的に導入が決まった `iter` パッケージを利用して実現しています。

- [proposal: iter: new package for iterators #61897](https://github.com/golang/go/issues/61897)

## パッケージhiの命名について

Go 1.18 が登場したころに [samber/lo](https://github.com/samber/lo) が話題になりました。
実は僕もこっそり [shogo82148/go-container](https://github.com/shogo82148/go-container) というのを書いていたんですが、
こっちはあんまり受けなかった・・・。

「名前が良くなかったんだろうな・・・loみたいに短くてloっぽい名前・・・じゃあloの反対でhiだ！」という感じで、loへの対抗心から [shogo82148/hi](https://github.com/shogo82148/hi) と命名しました。
もともと [samber/lo](https://github.com/samber/lo) っぽいユーティリティー関数の実装を進めていたのですが、
今回イテレーターの実験台として活躍してもらうことにしました。

## まとめ

GoにPythonのitertoolsっぽいものを実装してみました。

- [shogo82148/hi](https://github.com/shogo82148/hi)

Go 1.22 ではまだ実験的な導入ですが、本格導入されるのが楽しみですね。

ちなみに [shogo82148/hi](https://github.com/shogo82148/hi) はイテレーターだけではなく、スライスも扱えます。
こっちは今からでも扱えます。便利なので使ってみてね。

## 参考

- [shogo82148/hi](https://github.com/shogo82148/hi)
- [samber/lo](https://github.com/samber/lo)
- [shogo82148/go-container](https://github.com/shogo82148/go-container)
- [実用 Generics: Python の itertools を Go 2 に移植してみた](https://www.zopfco.de/entry/2020/12/01/173210)
- [itertools](https://docs.python.org/ja/3/library/itertools.html)
- [spec: add range over int, range over func #61405](https://github.com/golang/go/issues/61405)
- [proposal: iter: new package for iterators #61897](https://github.com/golang/go/issues/61897)
- [Goの1.22にGOEXPERIMENTガード下で導入されるrange over func proposalを試してみる](https://zenn.dev/ngicks/articles/go-trying-out-iter-proposal)
- [Go 1.22で追加予定のrange over intと、GOEXPERIMENT入り予定のrange over funcを触ってみる](https://tech.every.tv/entry/2023/12/09/1)
