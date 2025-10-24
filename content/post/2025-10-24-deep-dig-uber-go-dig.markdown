---
layout: post
title: "uber-go/dig を深堀りしてみる"
slug: deep-dig-uber-go-dig
date: 2025-10-24 19:17:00 +0900
comments: true
categories: [go, golang]
---

## 背景・目的

弊社では依存性注入（DI）に [google/wire] を使用しています。
しかし、一部 Gopher 界隈で話題となったように 2025年8月25日 [google/wire] はアーカイブされてしまいました！

- [google/wire がアーカイブされたけどどうすればいいの？](https://zenn.dev/motch/articles/google-wire-alternative)

しばらく静観してきたのですが、そうも言ってられなくなったので移行先を考えることにしました。
軽く調べた感じでは [uber-go/dig] が依存関係も少なく、導入も楽そうです。
しかし [google/wire] でできたことが [uber-go/dig] に移行した途端できなくなっては困ります。

## 検証

そこで、弊社が [google/wire] で使っている機能が [uber-go/dig] でも実現できるのか、調査してみました。

### 依存関係の事前チェック

個人的に一番欲しいのが依存関係の事前チェックです。

たとえばプロバイダーの不足はよくあるミスだと思います。
[google/wire] は事前にコード生成を行うため、このようなミスに気が付きやすいです。
しかし [uber-go/dig] では実行時までエラーに気がつけません。

```go
package main

import (
  "github.com/k0kubun/pp"
  "go.uber.org/dig"
)

type foo struct {
}

func main() {
  c := dig.New()

  // foo のプロバイダーが登録されていない！！！

  if err := c.Invoke(func(foo *foo) {
    pp.Println(foo)
  }); err != nil {
    panic(err)
    // panic: missing dependencies for function "main".main.func1: missing type: *main.foo
  }
}
```

せめてプロバイダーの不足のような単純ミスはテスト時にわかると嬉しいです。
しかしプロバイダーのコードは実行環境に依存しがちで、テストが書きにくいです。
（たとえば、AWSクライアントの初期化とか。EC2/ECS上ではうまく動くけど、ローカル環境を用意するのは意外と面倒）

```go
package main

import (
  "errors"

  "github.com/k0kubun/pp"
  "go.uber.org/dig"
)

type foo struct {
}

func main() {
  c := dig.New()

  if err := c.Provide(func() (*foo, error) {
    // 深遠な理由により、ローカル環境では実行に失敗する
    return nil, errors.New("you can't create foo in your local machine!")
  }); err != nil {
    panic(err)
  }

  if err := c.Invoke(func(foo *foo) {
    pp.Println(foo)
  }); err != nil {
    panic(err)
    // panic: could not build arguments for function "main".main.func2: failed to build *main.foo: received non-nil error from function "main".main.func1: you can't create foo in your local machine!
  }
}
```

そんなときに使えるのが [DryRunオプション](https://pkg.go.dev/go.uber.org/dig#DryRun) です。
Dry Run を有効化すると Provide や Invoke に渡した関数が実行されなくなります。
型チェックは行われるので、プロバイダーの不足のような単純ミスはチェックしてくれます。

```go
package main

import (
  "errors"

  "github.com/k0kubun/pp"
  "go.uber.org/dig"
)

type foo struct {
}

func main() {
  // Dry Run を有効化する
  c := dig.New(dig.DryRun(true))

  if err := c.Provide(func() (*foo, error) {
    return nil, errors.New("you can't create foo in your local machine!")
  }); err != nil {
    panic(err)
  }

  if err := c.Invoke(func(foo *foo) {
    pp.Println(foo)
  }); err != nil {
    panic(err)
  }
}
```

以下のようにテスト時だけ Dry Run が実行されるようにすると良いでしょう。

```go
-- foo.go --
package foo

import (
  "errors"

  "github.com/k0kubun/pp"
  "go.uber.org/dig"
)

type foo struct {
}

func Invoke() error {
  return invoke(false)
}

func invoke(dryRun bool) error {
  c := dig.New(dig.DryRun(dryRun))

  if err := c.Provide(func() (*foo, error) {
    return nil, errors.New("you can't create foo in your local machine!")
  }); err != nil {
    return err
  }

  return c.Invoke(func(foo *foo) {
    pp.Println(foo)
  })
}

-- foo_test.go --
package foo

import "testing"

func TestInvoke(t *testing.T) {
  if err := invoke(true); err != nil {
    t.Fatalf("expected no error, but got: %v", err)
  }
}
```

### Struct Providers

依存関係が膨大になってくると、依存関係を構造体定義で書きたくなることがあるでしょう。
[google/wire] では [Struct Providers](https://github.com/google/wire/blob/main/docs/guide.md#struct-providers) を使いますが、
[uber-go/dig] では同等の機能が [Parameter Objects](https://pkg.go.dev/go.uber.org/dig#hdr-Parameter_Objects) で実現できます。

```go
package main

import (
  "github.com/k0kubun/pp"
  "go.uber.org/dig"
)

type bar struct{}
type baz struct{}

type fooParameters struct {
  dig.In // dig.In を埋め込むことでパラメータオブジェクトとして扱う

  Bar *bar
  Baz *baz
  // ... たくさんの依存関係が並ぶ
}

type foo struct {
  params fooParameters
}

func main() {
  c := dig.New()

  if err := c.Provide(func() *bar {
    return &bar{}
  }); err != nil {
    panic(err)
  }

  if err := c.Provide(func() *baz {
    return &baz{}
  }); err != nil {
    panic(err)
  }

  if err := c.Provide(func(params fooParameters) *foo {
    // fooParameters 型の引数を受け取ることで、bar と baz の両方を受け取れる
    return &foo{params: params}
  }); err != nil {
    panic(err)
  }

  if err := c.Invoke(func(foo *foo) {
    pp.Println(foo)
    // &main.foo{
    //   params: main.fooParameters{
    //     In: dig.In{
    //       _: dig.digSentinel{},
    //     },
    //     Bar: &main.bar{},
    //     Baz: &main.baz{...},
    //   },
    // }
  }); err != nil {
    panic(err)
  }
}
```

### Binding Interfaces

[google/wire] の [Binding Interfaces](https://github.com/google/wire/blob/main/docs/guide.md#binding-interfaces) と相当の機能を [uber-go/dig] で使うには [As関数](https://pkg.go.dev/go.uber.org/dig#As) を使用します。

```go
package main

import (
  "github.com/k0kubun/pp"
  "go.uber.org/dig"
)

type fooImplementation struct {
}

func (f *fooImplementation) Foo() {}

type Foo interface {
  Foo()
}

func NewFoo() (*fooImplementation, error) {
  return &fooImplementation{}, nil
}

func main() {
  c := dig.New()

  if err := c.Provide(NewFoo, dig.As(new(Foo))); err != nil {
    panic(err)
  }

  if err := c.Invoke(func(foo Foo) {
    pp.Println(foo)
  }); err != nil {
    panic(err)
  }
}
```

## まとめ

[uber-go/dig] を使って「依存関係の事前チェック」「Struct Providers」「Binding Interfaces」を実現する方法を調査しました。
導入に際して一番のネックだと思っていた「依存関係の事前チェック」が解消できそうなので、
DIライブラリーの第一候補になるかなーと思っています。

> ウサギはスキップして、新しい知識を発見 🐰✨ \
> dig と wire の物語を書きて、 \
> Go の依存性注入の道を照らす ⚡ \
> ポストの森でみんなを導く 📚🌿
>
> by [CodeRabbit](https://www.coderabbit.ai/)

## 参考

- [google/wire がアーカイブされたけどどうすればいいの？]
- [uber-go/dig]
- [google/wire]
- [Wire User Guide](https://github.com/google/wire/blob/main/docs/guide.md)

[google/wire がアーカイブされたけどどうすればいいの？]: https://zenn.dev/motch/articles/google-wire-alternative
[uber-go/dig]: https://github.com/uber-go/dig
[google/wire]: https://github.com/google/wire
