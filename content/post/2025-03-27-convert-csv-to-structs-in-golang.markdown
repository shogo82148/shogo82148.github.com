---
layout: post
title: "CSVをGoの構造体にマッピングする"
slug: convert-csv-to-structs-in-golang
date: 2025-03-27 18:41:00 +0900
comments: true
categories: [go, golang]
---

[shogo82148/go-header-csv](https://github.com/shogo82148/go-header-csv)のv0.1.0をリリースしました。

- [shogo82148/go-header-csv](https://github.com/shogo82148/go-header-csv)

このライブラリについてブログで紹介していなかったので、[shogo82148/go-header-csv](https://github.com/shogo82148/go-header-csv) の簡単な紹介と、v0.1.0での変更点についてお知らせします。

## go-header-csvの紹介

令和の世になってもCSVを扱いたいという要望はなくなることはありません。
とくに一行目がフィールド名になっているCSVを扱うことが多いです。
具体的には以下のようなイメージです。

```csv
name,text
Ed,Knock knock.
Sam,Who's there?
Ed,Go fmt.
Sam,Go fmt who?
Ed,Go fmt yourself!
```

これを以下のような構造体に変換したい。

```go
[]struct {
  Name string
  Text string
}{
  {
    Name: "Ed",
    Text: "Knock knock.",
  },
  {
    Name: "Sam",
    Text: "Who's there?",
  },
  {
    Name: "Ed",
    Text: "Go fmt.",
  },
  {
    Name: "Sam",
    Text: "Go fmt who?",
  },
  {
    Name: "Ed",
    Text: "Go fmt yourself!",
  },
}
```

Go言語にも[CSVを扱う標準パッケージ](https://pkg.go.dev/encoding/csv)はありますが、サポートしているのは `[][]string` への変換のみです。
一行目を特別扱いしてくれる機能はありません。

と、言うわけで作ったのが [shogo82148/go-header-csv](https://github.com/shogo82148/go-header-csv) です。
以下のようなコードで、CSVを構造体にマッピングしてくれます。

```go
func ExampleDecoder_DecodeAll() {
	in := `name,text
Ed,Knock knock.
Sam,Who's there?
Ed,Go fmt.
Sam,Go fmt who?
Ed,Go fmt yourself!
`
	out := []struct {
		Name string `csv:"name"`
		Text string `csv:"text"`
	}{}

	buf := bytes.NewBufferString(in)
	dec := headercsv.NewDecoder(buf)
	dec.DecodeAll(&out)

	for _, v := range out {
		fmt.Printf("%3s: %s\n", v.Name, v.Text)
	}
	// Output:
	//  Ed: Knock knock.
	// Sam: Who's there?
	//  Ed: Go fmt.
	// Sam: Go fmt who?
	//  Ed: Go fmt yourself!
}
```

## v0.1.0 での変更点

v0.0.2 までは、以下のようにパースに失敗するデータを読み込ませると、`strconv.ParseInt: parsing "NaN": invalid syntax` とだけ表示され、問題のある箇所まではわかりませんでした。

```go
package main

import (
	"strings"

	headercsv "github.com/shogo82148/go-header-csv"
)

type A struct {
	A int `csv:"a"`
}

func main() {
	in := `a
1
2
NaN
`
	var a []A
	dec := headercsv.NewDecoder(strings.NewReader(in))
	if err := dec.DecodeAll(&a); err != nil {
		panic(err)
	}
}
```

v0.1.0 からは以下のようにエラーのおきた行数、カラム、フィールド名をレポートしてくれます。

```plain
% go run main.go
panic: headercsv: decode error on line 4, column 1, field "a": strconv.ParseInt: parsing "NaN": invalid syntax

goroutine 1 [running]:
main.main()
	/Users/shogoichinose/tmp/2025-03-27-csv/main.go:22 +0x18c
exit status 2
```

## まとめ

CSVをGoの構造体に変換するライブラリを書きました。
最新バージョンで解析エラーのあった位置を報告するようになったので、より使いやすくなりました。

> こんにちは、ウサギの私！\
> CSVの森にジャンプして、\
> 構造体の花を見つけたよ。\
> エラーもキラリ光る、\
> 行・列・フィールドでお祝いだ！ 🐰✨\
> 新しい風がそよいでいるよ。\
> みんなにハッピーな一日を！
>
> by [CodeRabbit](https://www.coderabbit.ai/)

## 参考

- [shogo82148/go-header-csv](https://github.com/shogo82148/go-header-csv)
- [encoding/csv](https://pkg.go.dev/encoding/csv)
