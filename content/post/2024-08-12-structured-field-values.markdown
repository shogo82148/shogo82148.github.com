---
layout: post
title: "Structured Field Values のパーサーを書いた"
slug: structured-field-values
date: 2024-08-12 18:39:00 +0900
comments: true
categories: [go, golang, typescript, javascript]
---

GoとTypeScriptで [Structured Field Values](https://www.rfc-editor.org/rfc/rfc8941.html) のパーサーを書きました。

- [github.com/shogo82148/go-sfv](https://github.com/shogo82148/go-sfv): Go版実装
- [github.com/shogo82148/sfvjs](https://github.com/shogo82148/sfvjs): TypeScript版実装

## 背景

そもそも Structured Field Values (SFV) とはなにか、なぜ登場したのか、という背景はこちらの記事をどうぞ。

- [Structured Field Values による Header Field の構造化](https://blog.jxck.io/entries/2021-01-31/structured-field-values.html)

HTTP APIを開発していると、アプリケーション独自のHTTPフィールドを定義することがあります。
そういうときに、標準にしたがっておいたほうが何かと楽だろう、ということでSFVを採用しました。

しかしいい感じのSFVのパーサーがなかなか見つからなかったので、自作することにした、というわけです。

## Go実装

Go のモジュールとして公開されているので、いつものように `go get` してきましょう。

```plain
go get github.com/shogo82148/go-sfv
```

### GoでSFVをパースする

[DecodeItem](https://pkg.go.dev/github.com/shogo82148/go-sfv#DecodeItem)、[DecodeList](https://pkg.go.dev/github.com/shogo82148/go-sfv#DecodeList)、
[DecodeDictionary](https://pkg.go.dev/github.com/shogo82148/go-sfv#DecodeDictionary) を使います。

[net/http.Header.Values](https://pkg.go.dev/net/http#Header.Values)の戻り値を直接受け取れるよう、
各関数は `[]string` を受け取るようにしました。

```go
package main

import (
	"fmt"
	"net/http"

	"github.com/shogo82148/go-sfv"
)

func main() {
	h := make(http.Header)
	h.Add("Example", `2; foourl="https://foo.example.com/"`)

	item, err := sfv.DecodeItem(h.Values("Example"))
	if err != nil {
		panic(err)
	}
	fmt.Println(item.Value)
	fmt.Println(item.Parameters.Get("foourl"))
	// Output:
	// 2
	// https://foo.example.com/
}
```

`item.Value` は `interface{}` 型で返ってくるので、必要に応じて型アサーションを行います。

```go
switch val := item.Value.(type) {
case int64:             // Integers
case float64:           // Decimals
case string:            // Strings
case sfv.Token:         // Tokens
case bool:              // Booleans
case time.Time:         // Dates
case sfv.DisplayString: // Display Strings
}
```

### GoでSFVをエンコードする

[EncodeItem](https://pkg.go.dev/github.com/shogo82148/go-sfv#EncodeItem)、[EncodeList](https://pkg.go.dev/github.com/shogo82148/go-sfv#EncodeList)、
[EncodeDictionary](https://pkg.go.dev/github.com/shogo82148/go-sfv#EncodeDictionary)を使用します。

```go
package main

import (
	"fmt"

	"github.com/shogo82148/go-sfv"
)

func main() {
	item := sfv.Item{
		Value: 2,
		Parameters: sfv.Parameters{
			{
				Key:   "foourl",
				Value: "https://foo.example.com/",
			},
		},
	}

	fmt.Println(sfv.EncodeItem(item))
	// Output:
	// 2;foourl="https://foo.example.com/" <nil>
}
```

## TypeScript実装

NodeとDenoに対応しています。

npmからインストールする場合は、

```plain
npm install --save @shogo82148/sfv
```

jsrからインストールする場合は、

```plain
deno add @shogo82148/sfv
```

です。

### TypeScriptでSFVをパースする

[decodeItem](https://jsr.io/@shogo82148/sfv/doc/~/decodeItem)、[decodeList](https://jsr.io/@shogo82148/sfv/doc/~/decodeList)、
[decodeDictionary](https://jsr.io/@shogo82148/sfv/doc/~/decodeDictionary) を使います。

```typescript
import { decodeItem } from "@shogo82148/sfv";

const item = decodeItem('2; foourl="https://foo.example.com/"')
console.log(item.value); // Integer { value: 2 }
console.log(item.parameters.get("foourl")); // https://foo.example.com/
```

`instanceof` や `typeof` を使って型を判断します。

```typescript
const value = item.value;
if (value instanceof Integer) {
  // Integers
}
if (value instanceof Decimal) {
  // Decimals
}
if (typeof value === "string") {
  // Strings
}
if (value instanceof Token) {
  // Tokens
}
if (value instanceof Uint8Array) {
  // Binary Sequences
}
if (typeof value === "boolean") {
  // Booleans
}
if (value instanceof Date) {
  // Dates
}
if (value instanceof DisplayString) {
  // Display Strings
}
```

### TypeScriptでSFVをエンコードする

[encodeItem](https://jsr.io/@shogo82148/sfv/doc/~/encodeItem)、[encodeList](https://jsr.io/@shogo82148/sfv/doc/~/encodeList)、
[encodeDictionary](https://jsr.io/@shogo82148/sfv/doc/~/encodeDictionary) を使用します。

```typescript
import { encodeItem, Integer, Item, Parameters } from "@shogo82148/sfv";

const item = new Item(
  new Integer(2),
  new Parameters([["foourl", "https://foo.example.com/"]])
);

console.log(encodeItem(item)); // 2;foourl="https://foo.example.com/"
```

### Integer と Decimal について

TypeScript版で特徴的なのは `Integer` 型と `Decimal` 型の存在です。
TypeScript自体には「整数」を表す型はなく、すべて `number` 型で表されます。
でもそこはしっかり区別して欲しい、ということで `Integer` 型と `Decimal` 型を独自に定義しました。

`Integer` 型と `Decimal` 型は `valueOf` メソッドで元の値を取り出せます。
`Decimal` 型は引数にたとえ整数が渡されたとしても、小数としてシリアライズします。

```typescript
const i = new Integer(42);
console.log(i.valueOf()); // 42
console.log(encodeItem(new Item(i))); // 42

const d = new Decimal(42);
console.log(d.valueOf()); // 42
console.log(encodeItem(new Item(d))); // 42.0
```

## まとめ

GoとTypeScriptで [Structured Field Values](https://www.rfc-editor.org/rfc/rfc8941.html) のパーサーを書きました。

- [github.com/shogo82148/go-sfv](https://github.com/shogo82148/go-sfv): Go版実装
- [github.com/shogo82148/sfvjs](https://github.com/shogo82148/sfvjs): TypeScript版実装

ぜひ利用してみてください。フィードバックをお待ちしてます。

## 参考

- [RFC 8941 Structured Field Values for HTTP](https://www.rfc-editor.org/rfc/rfc8941.html)
- [Structured Field Values による Header Field の構造化](https://blog.jxck.io/entries/2021-01-31/structured-field-values.html)
- [github.com/shogo82148/go-sfv](https://github.com/shogo82148/go-sfv)
- [github.com/shogo82148/go-sfv - godoc](https://pkg.go.dev/github.com/shogo82148/go-sfv)
- [github.com/shogo82148/sfvjs](https://github.com/shogo82148/sfvjs)
- [@shogo82148/sfv - npm](https://www.npmjs.com/package/@shogo82148/sfv)
- [@shogo82148/sfv - jsr](https://jsr.io/@shogo82148/sfv)
