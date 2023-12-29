---
layout: post
title: "go-retry v1.2.0 リリースのお知らせ、ジェネリクスがやってきた"
slug: 2023-12-29-go-retry-meets-generics
date: 2023-12-29 22:04:00 +0900
comments: true
categories: [go, golang]
---

[shogo82148/go-retry](https://github.com/shogo82148/go-retry) は指数的バックオフを行ってくれるライブラリです。

- [Goで指数的バックオフをやってくれるgo-retryを書いた](https://shogo82148.github.io/blog/2019/07/22/go-retry/)

[v1.2.0](https://github.com/shogo82148/go-retry/releases/tag/v1.2.0) でジェネリクスを導入した新しいインターフェイスを追加しました。

## 新インターフェイス

[Goで指数的バックオフをやってくれるgo-retryを書いた](https://shogo82148.github.io/blog/2019/07/22/go-retry/)の最後のまとめで、僕らのやりたいことを全部詰め込んだこんなコードを書きました。

```go
func DoSomethingWithRetry(ctx context.Context) (Result, error) {
    var res Result
    var err error
    policy.Do(ctx, func() error {
        ctx, cancel := context.WithTimeout(ctx, time.Second)
        defer cancel()
        res, err = DoSomething(ctx)
        return err
    })
    return res, err
}
```

これが以下のようにちょっとシンプルになります。

```go
func DoSomethingWithRetry(ctx context.Context) (Result, error) {
    return retry.DoValue(ctx, policy, func() (Result, error) {
        ctx, cancel := context.WithTimeout(ctx, time.Second)
        defer cancel()
        res, err = DoSomething(ctx)
        return err
    })
}
```

## math/randの実装変更に合わせた最適化

[math/randパッケージ](https://pkg.go.dev/math/rand) には `Int`, `Intn` などトップレベルに関数があります。
Go 1.19以前は、math/randパッケージ全体でロックを獲得していたため、「複数goroutineから呼ぶことはできるけどあんまり早くない」状態でした。
そのため go-retry では、自前で `rand.Rand` 構造体を初期化して使っていました。

Go 1.20以降この状況が改善し、トップレベル関数はスレッドローカルな乱数生成器を使うようになりました。
これにより、複数goroutineから呼んだときの性能が改善しています。
トップレベル関数が十分使える性能になったので、go-retryもトップレベル関数を呼ぶ実装に変更しました。

## math/rand/v2 使ってみた

Go 1.22 から新規追加になった（なる予定の）math/rand/v2 パッケージを使ってみました。

v1では以下のようにキャストが必要がたくさん必要だった箇所が、

- https://github.com/shogo82148/go-retry/blob/3b50794f8f8014694f62f11b6e998e0f1a0002dd/rand.go#L11-L21

```go
func (p *Policy) randomJitter() time.Duration {
	jitter := int64(p.Jitter)
	if jitter == 0 {
		return 0
	}

	if jitter < 0 {
		return -time.Duration(rand.Int63n(-jitter))
	}
	return time.Duration(rand.Int63n(jitter))
}
```

`rand.N` を使うことでスッキリしました。

- https://github.com/shogo82148/go-retry/blob/3b50794f8f8014694f62f11b6e998e0f1a0002dd/rand_v2.go#L11-L21

```go
func (p *Policy) randomJitter() time.Duration {
	jitter := p.Jitter
	if jitter == 0 {
		return 0
	}

	if jitter < 0 {
		return -rand.N(-jitter)
	}
	return rand.N(jitter)
}
```

##　　まとめ

- 以下のような書き方ができるようになりました。

```go
func DoSomethingWithRetry(ctx context.Context) (Result, error) {
    return retry.DoValue(ctx, policy, func() (Result, error) {
        ctx, cancel := context.WithTimeout(ctx, time.Second)
        defer cancel()
        res, err = DoSomething(ctx)
        return err
    })
}
```

- 乱数生成の性能が上がっています。いくら失敗しても安心（？）

## 参考

- [shogo82148/go-retry](https://github.com/shogo82148/go-retry)
- [Goで指数的バックオフをやってくれるgo-retryを書いた](https://shogo82148.github.io/blog/2019/07/22/go-retry/)
- [Go 1.20 Release Notes](https://tip.golang.org/doc/go1.20#minor_library_changes)
