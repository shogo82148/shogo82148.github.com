---
layout: post
title: "Contextに埋め込んだ値をログに出力してくれるログハンドラーを書いた"
slug: 2023-08-04-context-for-slog
date: 2023-08-04 23:22:00 +0900
comments: true
categories: [go, golang]
---

Go言語にいよいよ構造化ログ用パッケージ[log/slog]が追加される、と各所で話題になってますね。

- [Go 1.21連載始まります＆slogをどう使うべきか]

> しかし、どんなにドキュメントをみても、ロガーを出し入れする関数はありません。そういう使い方を議論する issue もありましたが　現状はハンドラーにそのまま渡しているだけです。
> よくよく考えればトレーシングIDなどは、コンテキストに格納されているはずで、ロガーにも属性として持つと2重持ちになってしまいます。**出力時だけハンドラ自身がそれを取り出して書き出せば良い**、という思想に思えます。
> そのためには**ハンドラーを自分でつくることになります**。
> (強調は筆者によるもの)

たしかにトレーシングIDを2重に持つのは効率が悪いかもしれない。
そうかもしれないけど・・・でもやっぱり毎回ハンドラーを書くのは面倒・・・もうちょっと汎用的にはならないものか・・・
と結局書いちゃいました。

- [shogo82148/ctxslog]

## 使い方

`slog`ではログ関数が`context.Context`を受け取るようになりました。
ここで渡した`context.Context`はキャンセル処理には使用されず、値の受け渡しのみに使用されます。

このことを利用して`ctxslog.WithAttrs`でコンテキストに値を埋め込むことができます。
ここで埋め込んだ値を`ctxslog.New`で作成したハンドラーが受け取って、ログに表示します。

```go
import (
  "context"
  "log/slog"
)

func main() {
  // ログに出力するためにロガーをカスタマイズ
  handler := slog.NewTextHandler(os.Stderr, nil)
  slog.SetDefault(slog.New(ctxslog.New(handler)))

  ctx := context.Background()
  // このコンテキスト内のログすべてに my_context=foo-bar を埋め込む
  ctx = ctxslog.WithAttrs(ctx, slog.String("my_context", "foo-bar"))

  slog.InfoContext(ctx, "hello", "count", 42) // ログ出力、ここで `ctx` を渡しているのがポイント
  slog.InfoContext(ctx, "world")
  // Output:
  // time=2023-08-03T18:10:20.424+09:00 level=INFO msg=hello count=42 my_context=foo-bar
  // time=2023-08-03T18:10:20.424+09:00 level=INFO msg=world my_context=foo-bar
}
```

## 実装

`slog.Handler`は4つのメソッドを持っていますが、毎回全部を実装するのは大変です。
「`context.Context`から値を取り出して親のハンドラーに渡す」という処理はよく書きそうなので、
簡単なラッパー構造体を定義しました。

```go
package ctxslog

import (
	"context"
	"log/slog"
)

var _ slog.Handler = (*wrapper)(nil)

type wrapper struct {
	handler func(ctx context.Context, parent func(ctx context.Context, record slog.Record) error, record slog.Record) error
	parent  slog.Handler
}

func (w *wrapper) Handle(ctx context.Context, record slog.Record) error {
	return w.handler(ctx, w.parent.Handle, record)
}

func (w *wrapper) Enabled(ctx context.Context, level slog.Level) bool {
	return w.parent.Enabled(ctx, level)
}

func (w *wrapper) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &wrapper{
		handler: w.handler,
		parent:  w.parent.WithAttrs(attrs),
	}
}

func (w *wrapper) WithGroup(name string) slog.Handler {
	return &wrapper{
		handler: w.handler,
		parent:  w.parent.WithGroup(name),
	}
}
```

関数をひとつ実装すればよいだけなので楽ちんですね。

あとから親の`context.Context`の値を参照できるよう、`context.Context`に値を埋め込むときは連結リストを作成します。

```go
package ctxslog

import (
	"bytes"
	"context"
	"log/slog"
	"strings"
	"time"
)

type ctxKey struct{ name string }

func (key *ctxKey) String() string {
	return key.name
}

var key = &ctxKey{"ctxslog"}

type mergedAttrs struct {
	parent *mergedAttrs
	args   []any
	attrs  []slog.Attr
}

// WithAttrs is a more efficient version of [With] that accepts only [log/slog.Attrs].
func WithAttrs(ctx context.Context, attrs ...slog.Attr) context.Context {
	if len(attrs) == 0 {
		return ctx
	}
	value := &mergedAttrs{
		parent: contextAttrs(ctx),
		attrs:  attrs,
	}
	return context.WithValue(ctx, key, value)
}

// With returns a new context with the given attributes.
// The attributes are added into the log record.
func With(ctx context.Context, args ...any) context.Context {
	if len(args) == 0 {
		return ctx
	}
	value := &mergedAttrs{
		parent: contextAttrs(ctx),
		args:   args,
	}
	return context.WithValue(ctx, key, value)
}

func contextAttrs(ctx context.Context) *mergedAttrs {
	attrs := ctx.Value(key)
	if attrs == nil {
		return nil
	}
	return attrs.(*mergedAttrs)
}
```

出力のときに連結リストをたどって、ログに新しい属性を追加します。

```go
func (attrs *mergedAttrs) addToRecord(record *slog.Record) {
	if attrs == nil {
		return
	}
	if attrs.parent != nil {
		attrs.parent.addToRecord(record)
	}
	if len(attrs.attrs) != 0 {
		record.AddAttrs(attrs.attrs...)
	}
	if len(attrs.args) != 0 {
		record.Add(attrs.args...)
	}
}

// New returns a new slog.Handler that injects the attributes from the context.
func New(parent slog.Handler) slog.Handler {
	return &wrapper{
		handler: inject,
		parent:  parent,
	}
}

func inject(ctx context.Context, parent func(ctx context.Context, record slog.Record) error, record slog.Record) error {
	attrs := contextAttrs(ctx)
	newRecord := record.Clone()
	attrs.addToRecord(&newRecord)
	return parent(ctx, newRecord)
}
```

## まとめ

`context.Context`から値を取り出してログに埋め込む、簡単なログハンドラーを書いてみました。

- [shogo82148/ctxslog]

実際のところ、自前のハンドラーを作成したほうが良い性能が得られると思います。
まあそのときは実装の参考に使ってください。

## 参考

- [log/slog]
- [Go 1.21連載始まります＆slogをどう使うべきか]

[log/slog]: https://pkg.go.dev/log/slog@go1.21rc4
[Go 1.21連載始まります＆slogをどう使うべきか]: https://future-architect.github.io/articles/20230731a/
[shogo82148/ctxslog]: https://github.com/shogo82148/ctxslog
