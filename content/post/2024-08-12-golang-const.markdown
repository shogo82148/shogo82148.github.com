---
layout: post
title: "Go言語の定数演算の精度が限界突破していた件"
slug: golang-const
date: 2024-08-12 18:39:00 +0900
comments: true
categories: [go, golang]
---

元ネタ:

<blockquote class="twitter-tweet" data-lang="ja"><p lang="ja" dir="ltr">[JavaScriptの問題]<br>var a = 0.3 - 0.2;<br>var b = 0.2 - 0.1;<br>var c = a==b;<br><br>cの中身はどれ？</p>&mdash; RAO(らお)@けもケP-31 (@RIORAO) <a href="https://twitter.com/RIORAO/status/922871767147749376?ref_src=twsrc%5Etfw">2017年10月24日</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

<blockquote class="twitter-tweet" data-lang="ja"><p lang="ja" dir="ltr">正確な実数計算をやらされるJavaScriptくん <a href="https://twitter.com/hashtag/%E6%93%AC%E7%AB%9C%E6%88%AF%E7%94%BB?src=hash&amp;ref_src=twsrc%5Etfw">#擬竜戯画</a> <a href="https://t.co/ipE56C2YbV">pic.twitter.com/ipE56C2YbV</a></p>&mdash; RAO(らお)@けもケP-31 (@RIORAO) <a href="https://twitter.com/RIORAO/status/923599110262874112?ref_src=twsrc%5Etfw">2017年10月26日</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

この件に関して、以下のような記事を書きました。

- [Go言語の浮動小数点数のお話](https://shogo82148.github.io/blog/2017/10/28/golang-floating-point-number/)

この記事のなかで「Goの定数は512bitの精度で計算されている」「有限精度のため、数学的な答えとは一致するとは限らない」というお話をしました。
しかし某電柱様から「記事中のコードを最新のGoで実行すると、記事の内容とは異なった結果が得られる」という情報を得ました。

## 問題のコード

動作が異なると報告があったのは以下のコードです。

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

数学的には `0.3 - 0.2 = 0.2 - 0.1 = 0` なので、`true` と `0.000000e+00` が表示されるはずです。
しかし、「[Go言語の浮動小数点数のお話](https://shogo82148.github.io/blog/2017/10/28/golang-floating-point-number/)」を書いた当時は以下のような結果が得られました
（たぶん当時の最新バージョンの Go 1.9.2だと思う。正確なバージョンを記録していないとは不覚・・・）。

```plain
false
9.322926e-156
```

ところが最新のGo(Go 1.23rc2)では次のような結果となります。

```plain
true
0.000000e+00
```

数学的には正しい結果ですが、バージョンによって挙動が違うというのは妙な話です。

## 挙動が変わった原因を調べる

いったいいつから挙動が変わっていたのでしょう？気になりますね。

### いろんなGoのバージョンを試してみる

手当たりしだいにいろんなGoのバージョンで試してみました。その結果、Go 1.17 から現在の挙動になったことがわかりました。

```plain
% docker run -v "$PWD:/go" golang:1.16 go run main.go
false
9.322926e-156
% docker run -v "$PWD:/go" golang:1.17 go run main.go
true
0.000000e+00
```

### git-bisectしてみる

では具体的にどのような変更が加えられたのでしょう？
ひとつひとつコミットを調べていくのは大変です。そこで登場するのが `git-bisect` 先生です。

まずは、Go 1.17 以降で実行すると Exit Code 1 で終了、Go 1.16 以前で実行すると Exit Code 0 で終了するよう、コードを修正します。

```go
package main

import (
	"fmt"
	"os"
)

func main() {
	const a = 0.3 - 0.2
	const b = 0.2 - 0.1
	var c = a == b
	fmt.Println(c)
	fmt.Printf("%e\n", float64(a-b))
	if c {
		os.Exit(1)
	}
}
```

Goをソースコードからビルドし、さきほどのコードを実行するスクリプトを組みます。

```bash
#!/usr/bin/env bash

set -uexo pipefail

# build Go
cd src
./make.bash || true

cd ../.bisect
../bin/go run main.go
```

Goをソースコードからビルドする環境を整えましょう。
GoはGo言語で書かれているので、Goの実行環境を用意すればよいはずです。

ところが何も考えずに最新版の Go 1.23rc2 で Go 1.16, Go 1.17 をビルドしたところ失敗してしまいました。

```plain
Building Go cmd/dist using /usr/local/go. (go1.23rc2 darwin/arm64)
Building Go toolchain1 using /usr/local/go.
Building Go bootstrap cmd/go (go_bootstrap) using Go toolchain1.
Building Go toolchain2 using go_bootstrap and Go toolchain1.
Building Go toolchain3 using go_bootstrap and Go toolchain2.
Building packages and commands for darwin/arm64.
# time/tzdata
/Users/shogo/src/github.com/golang/go/src/time/tzdata/zzipdata.go:5:7: zipdata redeclared in this block
	/Users/shogo/src/github.com/golang/go/src/time/tzdata/zipdata.go:7089:2: previous declaration
go tool dist: FAILED: /Users/shogo/src/github.com/golang/go/pkg/tool/darwin_arm64/go_bootstrap install -gcflags=all= -ldflags=all= std cmd: exit status 2
```

そこでブートストラップに必要な最低バージョン（Go 1.4）を利用することにしました。
ここまでの作業は ARM64 版 macOSでやってきたのですが、困ったことに Go 1.4 リリース当時は ARM64 版 macOS なんて存在しません。
存在しない環境の実行バイナリが手に入るわけもなく・・・。
しかし今は便利なもので Docker Desktop を使えば、x64 Linux の実行環境が手に入ります。

```plain
% docker run --rm -it -v "$PWD:/go" golang:1.4 bash
WARNING: The requested image's platform (linux/amd64) does not match the detected host platform (linux/arm64/v8) and no specific platform was requested
```

ここまで準備を整えれば、あとは `git-bisect` 先生が全部自動でやってくれます。

```plain
# git bisect start go1.17 go1.16   # go1.16 から go1.17 の間に変更があったことがわかっているので、そのバージョンのタグを指定する
# git bisect run .bisect/bisect.sh # 変更が起こったバージョンを特定する
```

### 問題のコミットを特定する

結果、以下のコミットで現在の挙動になったことが判明しました。

- [[dev.regabi] cmd/compile: enable rational constant arithmetic](https://github.com/golang/go/commit/6a4739ccc5198449d58d2e90a040c4fb908b3cb0)

「有理数の定数演算を有効化する」という内容で、どうやら [big.Rat](https://pkg.go.dev/math/big#Rat) を利用して演算するよう変更されたようです。
これはつまり、有理数の範囲であれば **実質無限の精度で計算できる** わけです。
こんな改善が入っていたとは知らなかった！

というわけで、途中で分数が入ってくるような計算であっても、数学的な演算と同じ結果が得られます。

```go
package main

import (
	"fmt"
)

func main() {
	const a = 1 / 3.0
	const b = 0.1 / 0.3
	var c = a == b
	fmt.Println(c)
	fmt.Printf("%e\n", float64(a-b))
	// Output:
	// true
	// 0.000000e+00
}
```

## Goの仕様を確認する

とはいえ、この挙動に過度に依存してしまうのは禁物です。
Goの言語仕様では「浮動小数点数の定数は最低256bitの精度を持つ」とだけ定義されています。

- [Constants - The Go Programming Language Specification](https://go.dev/ref/spec#Constants)

> Represent floating-point constants, including the parts of a complex constant, with a mantissa of at least 256 bits and a signed binary exponent of at least 16 bits.

また、最終的に `float64` や `float32` に変換されると、丸めが発生することにも注意が必要です。

## まとめ

「[Go言語の浮動小数点数のお話](https://shogo82148.github.io/blog/2017/10/28/golang-floating-point-number/)」の記事の中で、
「Goの定数は512bitの精度で計算されている」と紹介しましたが、Go 1.17 以降この制限はなくなりました。
有理数の範囲であれば正確な数値を得ることができます。

ただし、この挙動は**Goの言語仕様で定義されていません**。過度に依存しないよう気をつけましょう。

あと、こういう検証記事を書くときには、使用したツールのバージョンを書くのを忘れずに！ ＠過去の自分。
追試するときに困ります！
今回の検証では以下の環境で検証を行いました。

- Go 1.23rc2
- Docker version 24.0.6, build ed223bc
- git version 2.1.4
- MacBook Pro 2021, Apple M1 Pro

## 参考

- [git bisect で問題箇所を特定する](https://qiita.com/usamik26/items/cce867b3b139ea5568a6)
- [golang コンパイラのブートストラップ](https://zenn.dev/mtmatma/articles/bea380d94cad4c)
- [[dev.regabi] cmd/compile: enable rational constant arithmetic](https://github.com/golang/go/commit/6a4739ccc5198449d58d2e90a040c4fb908b3cb0)
- [286215: [dev.regabi] cmd/compile: enable rational constant arithmetic](https://go-review.googlesource.com/c/go/+/286215)
- [big.Rat](https://pkg.go.dev/math/big#Rat)
- [Constants - The Go Programming Language Specification](https://go.dev/ref/spec#Constants)
