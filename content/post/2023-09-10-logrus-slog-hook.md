---
layout: post
title: "log/slogにログを転送する logrus hook を書いた"
slug: 2023-09-10-logrus-slog-hook
date: 2023-09-10 23:39:00 +0900
comments: true
categories: [go, golang]
---

長らく構造化ログの仕組みが標準ライブラリになかったGoですが、
Go 1.21がリリースされて晴れて [log/slog] が使えるようになりました。
弊社では[logrus]を使っているので、[log/slog]を連携するためのフックを書きました。

- []()

## 背景

弊社では[logrus]をメインに使っています。
特段困ったこともなく **素晴らしいライブラリだと思います！！！**（大事）
強いて問題点を上げるとすれば、メンテナンスモードに入ってしまってあまり開発が活発でない、ということでしょうか。
重大なバグがあれば別ですが、新規機能の追加等は行わない方針のようです。

一方 [log/slog] は公式ライブラリなので、[log/slog]の仕様を前提としたエコシステムが、今後発展してくでしょう。

[logrus]を使いながら[log/slog]のいいとこ取りとする方法はないか？と考えた結果作ったのが [shogo82148/logrus-slog-hook] です。

## SYNOPSIS

`sloghook.New` で作成したフックを差し込むだけです。
[logrus]に流したログが[log/slog]の設定で流れてきます。

```go
package main

import (
	"io"
	"log/slog"
	"os"

	sloghook "github.com/shogo82148/logrus-slog-hook"
	"github.com/sirupsen/logrus"
)

func main() {
	h := slog.NewTextHandler(os.Stderr, nil)
	logrus.AddHook(sloghook.New(h))

	// logrus も logrus-slog-hook もSTDERRに書き込むので、同じログが二回表示されてしまう。
	// logrus側を止めて防止。
	logrus.SetFormatter(sloghook.NewFormatter())
	logrus.SetOutput(io.Discard)

	logrus.WithFields(logrus.Fields{
		"name": "joe",
		"age":  42,
	}).Error("Hello world!")

	// Output:
	// time=2023-09-10T23:32:41.229+09:00 level=ERROR msg="Hello world!" age=42 name=joe
}
```

## 注意点

[logrus]はエラーレベルが `Trace`, `Debug`, `Info`, `Warn`, `Error`, `Panic`, `Fatal` と7段階ありますが、
[log/slog]には `Debug`, `Info`, `Warn`, `Error` しかありません。
しかし実は整数をレベルを設定できるので、適当に割り当てました。

- logrus: slog
- `trace`: `DEBUG-1`
- `debug`: `DEBUG`
- `info`: `INFO`
- `warn`: `WARN`
- `error`: `ERROR`
- `panic`: `ERROR+1`
- `fatal`: `ERROR+2`

ログに出力されるエラーレベルもこれになるので、ログを監視するようなツールを導入していると修正が必要がかもしれません。

## まとめ

[log/slog]を連携する[logrus]のフックを書きました。
[log/slog]の便利機能を取り込んだり、[log/slog]への移行に使用できると思うので、
ぜひ利用してください。

[log/slog]: https://pkg.go.dev/log/slog
[logrus]: https://github.com/sirupsen/logrus
[shogo82148/logrus-slog-hook]: https://github.com/shogo82148/logrus-slog-hook
