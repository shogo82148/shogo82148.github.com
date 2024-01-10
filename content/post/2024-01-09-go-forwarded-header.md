---
layout: post
title: "GoでForwarded Headerのパーサーを作った"
slug: 2024-01-09-go-forwarded-header
date: 2024-01-09 22:28:00 +0900
comments: true
categories: [go, golang]
---

ちょっとした用事で [RFC 7239: Forwarded HTTP Extension.](https://www.rfc-editor.org/info/rfc7239) の解析をしたくなったので、解析ライブラリを書いてみました。

- [shogo82148/forwarded-header](https://github.com/shogo82148/forwarded-header)

## 背景

## 使い方

解析は [Parse](https://pkg.go.dev/github.com/shogo82148/fowarded-header#Parse)関数を呼び出すだけです。

```go
package main

import (
	"fmt"
	"net/http"
	"os"

	forwardedheader "github.com/shogo82148/forwarded-header"
)

func main() {
	header := make(http.Header)
	header.Set("Forwarded", "by=203.0.113.43;for=192.0.2.60;proto=http")

	// parse the Forwarded Header
	parsed, err := forwardedheader.Parse(header.Values("Forwarded"))
	if err != nil {
		panic(err)
	}
	for _, f := range parsed {
		fmt.Println(f)
	}
	// Output:
	// by=203.0.113.43;for=192.0.2.60;proto=http
}```
