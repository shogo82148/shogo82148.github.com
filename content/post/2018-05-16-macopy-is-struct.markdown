---
layout: post
title: "Goの構造体のコピーを防止する方法"
slug: migrate-to-hugo
date: 2018-05-16 07:29:00 +0900
comments: true
categories: [go, golang]
---

[去年仕込んだネタ](https://github.com/kuiperbelt/kuiperbelt/pull/34/files#diff-ac30af7ac3674a84335ddfddbe2d4d03R12)が見つかってしまったので、macopy構造体について一応解説。

<blockquote class="twitter-tweet" data-lang="ja"><p lang="ja" dir="ltr"><a href="https://t.co/mHq6oWY3rj">https://t.co/mHq6oWY3rj</a><br><br>macopyさん構造体だったのか・・・</p>&mdash; serinuntius (@_serinuntius) <a href="https://twitter.com/_serinuntius/status/996040976274608128?ref_src=twsrc%5Etfw">2018年5月14日</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

## 目的

深淵な理由でGoの構造体のコピーを禁止したい場合があると思います。
kuiperbeltのケースでは、[sync/atomicパッケージ](https://golang.org/pkg/sync/atomic/)を使ってフィールドを更新しているので、
フィールドへの読み書きは必ずsync/atomicパッケージを使わなければなりません。
sync/atomicパッケージを使わずに構造体をコピーするとレースコンディションが発生してしまうので、コピーを禁止する必要がありました。

```go
// https://github.com/kuiperbelt/kuiperbelt/blob/e3c1432ed798716c8e88183518f9126951c227f3/stats.go#L20-L28
type Stats struct {
	connections        int64
	totalConnections   int64
	totalMessages      int64
	connectErrors      int64
	messageErrors      int64
	closingConnections int64
	noCopy             macopy
}

// atomic.AddInt64 を使っているので、s.connections の読み取り時には必ずこのメソッドを呼んで欲しい。
func (s *Stats) Connections() int64 {
  // return s.connections ではレースコンディションになってしまう。
	return atomic.LoadInt64(&s.connections)
}

func (s *Stats) ConnectEvent() {
	atomic.AddInt64(&s.totalConnections, 1)
	atomic.AddInt64(&s.connections, 1)
}
```

## macopy構造体の使い方

そこで登場するのがmacopy構造体です(いや、もちろん別の名前でもいいんですが)。

```go
// https://github.com/kuiperbelt/kuiperbelt/blob/e3c1432ed798716c8e88183518f9126951c227f3/stats.go#L12-L18

// macopy may be embedded into structs which must not be copied
// after the first use.
// See https://github.com/golang/go/issues/8005#issuecomment-190753527
// for details.
type macopy struct{}

func (*macopy) Lock() {}
```

ここで例えば以下のようなコードを書いてしまったとします。

```go
package kuiperbelt

func hoge() {
	var noCopy macopy
	_ = noCopy
}
```

このコードを `go vet` でチェックすると、誤ってコピーしていることを指摘してくれます。

```
$ go vet
# github.com/kuiperbelt/kuiperbelt
./test.go:5: assignment copies lock value to _: kuiperbelt.macopy
```

コンパイル自体はできてしまうので完全に禁止することはできませんが、
Gopherなみなさんなら `go vet` はCIとかエディターの拡張等で自動的に実行するようにしてあるでしょうから、
これでコピーを防ぐことができるでしょう。

もちろんこの機能は構造体のフィールドに含まれている場合も指摘してくれます。

## 原理

これはもともと [sync.Mutex](https://golang.org/pkg/sync/#Mutex)構造体のコピーを防ぐための機能です。
この機能がどうやって実装されているか `go vet` のコードをあさっていくと・・・

```
// https://github.com/golang/go/blob/3868a371a85f2edbf2132d0bd5a6ed9193310dd7/src/cmd/vet/copylock.go#L240-L244

	if plock := types.NewMethodSet(types.NewPointer(typ)).Lookup(tpkg, "Lock"); plock != nil {
		if lock := types.NewMethodSet(typ).Lookup(tpkg, "Lock"); lock == nil {
			return []types.Type{typ}
		}
	}
```

`sync.Mutex`構造体のコピーをチェックしているのではなく、
`Lock` メソッドが存在している型のコピーをチェックしていることがわかります。

というわけで、`sync.Mutex`構造体にかぎらず、[`Lock`メソッドを実装](https://github.com/kuiperbelt/kuiperbelt/blob/e3c1432ed798716c8e88183518f9126951c227f3/stats.go#L16)さえしていればOKなので、自作可能というわけです。

## まとめ

必要なところにはどんどんまこぴー仕込んでいきましょう。

<blockquote class="twitter-tweet" data-lang="ja"><p lang="ja" dir="ltr">今後は「ここ、まこぴーしこんどいたほうが良いですね」という会話がGo使いの間でなされるのか</p>&mdash; 猫型🐱蓄音機 (@shinpei0213) <a href="https://twitter.com/shinpei0213/status/996392941957496832?ref_src=twsrc%5Etfw">2018年5月15日</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
