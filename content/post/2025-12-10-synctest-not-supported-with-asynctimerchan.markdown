---
layout: post
title: "Goのsynctestを使おうとしたらsynctest.Run not supported with asynctimerchanと怒られたときの対処法"
slug: synctest-not-supported-with-asynctimerchan
date: 2025-12-10 20:28:00 +0900
comments: true
categories: [go, golang]
---

## TL;DR

- Go 1.25 から正式サポートされた[testing/synctest](https://pkg.go.dev/testing/synctest)パッケージを使ってみた
- 「synctest.Run not supported with asynctimerchan」というメッセージとともにpanicした
- `go mod edit -go=1.23` を実行すれば解決

## 背景

[shogo82148/go-retry](https://github.com/shogo82148/go-retry) は指数的バックオフをよしなになってくれるライブラリーです。

- [shogo82148/go-retry](https://github.com/shogo82148/go-retry)
- [Goで指数的バックオフをやってくれるgo-retryを書いた](https://shogo82148.github.io/blog/2019/07/22/go-retry/)
- [go-retry v1.2.0 リリースのお知らせ、ジェネリクスがやってきた](https://shogo82148.github.io/blog/2023/12/29/2023-12-29-go-retry-meets-generics/)
- [go-retry v2 リリースのお知らせ](https://shogo82148.github.io/blog/2024/06/25/2024-06-25-go-retry-v2/)

は待ち時間を調整するテストを書くために、「実際にSleepをして経過時間を取得する」という方法を採用しています。

```go
// テストのイメージ
func Test(t *testing.T) {
  var policy = retry.Policy{
    MinDelay: 100 * time.Millisecond,
    MaxDelay: time.Second,
    MaxCount: 3,
  }

  // 実際にSleepをして経過時間を取得する
  start := time.Now()
  _ = policy.Do(t.Context(), func() error {
    return errors.New("some error")
  })
  d := time.Since(start)

  if d < 300*time.Millisecond {
    t.Errorf("want at least 300ms, got %s", d)
  }
}
```

このテストは実際に300ミリ秒Sleepしてしまうので、テストに必ず300ミリ秒かかってしまいます。
また実際のSleep時間はランタイムの状態によって変化してしまうため、
「300ミリ秒ちょうどSleepする」ことをテストしたいのに、実際にそのようなテストを書くことは難しいです。

## testing/synctest を使ってみた

そんな問題を一気に解決してくれるのが、Go 1.25 から正式サポートされた [testing/synctest](https://pkg.go.dev/testing/synctest) です。
やり方は簡単。`synctest.Test(t, func(t *testing.T) { /* ... */ })` で囲ってあげるだけです。

```go
func Test(t *testing.T) {
  synctest.Test(t, func(t *testing.T) {
    var policy = retry.Policy{
      MinDelay: 100 * time.Millisecond,
      MaxDelay: time.Second,
      MaxCount: 3,
    }

    start := time.Now()
    _ = policy.Do(t.Context(), func() error {
      return errors.New("some error")
    })
    d := time.Since(start)

    // 300msちょうどSleepすることをテストできる！！
    if d != 300*time.Millisecond {
      t.Errorf("want 300ms, got %s", d)
    }
  })
}
```

と思っていた時期が僕にもありました。

```plain
=== RUN   Test
--- FAIL: Test (0.00s)
panic: synctest.Run not supported with asynctimerchan!=0 [recovered, repanicked]
```

なんと `synctest.Run` はサポートされていないと怒られてしまいました。

## Go 1.23 で入ったタイマーの変更

`asynctimerchan` というのは Go 1.23 で入ったタイマーの挙動変更をコントロールするためのフラグです。

- [Go Wiki: Go 1.23 Timer Channel Changes](https://go.dev/wiki/Go123Timer)
- [【Go】もう迷わないtime.Timerの正しい使い方（Go1.22以前と1.23以降まとめ）](https://zenn.dev/schottman13/articles/a67a86cb8a32bd)

詳しい変更内容はリンク先に譲りますが、`asynctimerchan=1` になっていると Go 1.22 以前の挙動に巻き戻してくれます。

そこで go.mod を確認してみると・・・

```plain
// go.mod
module github.com/shogo82148/go-retry/v2
 
go 1.18 // こいつが悪さをしていた
```

go ディレクティブが 1.18 になっているので、Goのランタイムは Go 1.18 の挙動をなるべく再現しようとします。
その結果 `asynctimerchan=1` になってしまったのです。

## 解決方法

修正は簡単で、`go mod edit -go=1.23` を実行して `go.mod` の go ディレクティブを書き換えれば解決します。

```diff
 module github.com/shogo82148/go-retry/v2
 
-go 1.18
+go 1.23
```

ただしタイマーの挙動が Go 1.23 以降のものになるので、そこだけ注意が必要です。

## まとめ

[testing/synctest](https://pkg.go.dev/testing/synctest) を使うには Go 1.22 との互換性を切る必要があります。
ただしタイマーの挙動が変わってしまうので注意しましょう。

> 🐰 新しきポストが加わり、喜びあふれ、\
> Go言語の迷宮も解き明かす道筋、\
> synctest、asynctimer、謎は晴れて、\
> 開発者の手助け、ウサギのちから！\
> ✨
> by [CodeRabbit](https://www.coderabbit.ai/)


## 参考

- [shogo82148/go-retry](https://github.com/shogo82148/go-retry)
- [Goで指数的バックオフをやってくれるgo-retryを書いた](https://shogo82148.github.io/blog/2019/07/22/go-retry/)
- [go-retry v1.2.0 リリースのお知らせ、ジェネリクスがやってきた](https://shogo82148.github.io/blog/2023/12/29/2023-12-29-go-retry-meets-generics/)
- [go-retry v2 リリースのお知らせ](https://shogo82148.github.io/blog/2024/06/25/2024-06-25-go-retry-v2/)
- [testing/synctest](https://pkg.go.dev/testing/synctest)
- [shogo82148/go-retry#43](https://github.com/shogo82148/go-retry/pull/43)
- [Go Wiki: Go 1.23 Timer Channel Changes](https://go.dev/wiki/Go123Timer)
- [【Go】もう迷わないtime.Timerの正しい使い方（Go1.22以前と1.23以降まとめ）](https://zenn.dev/schottman13/articles/a67a86cb8a32bd)
