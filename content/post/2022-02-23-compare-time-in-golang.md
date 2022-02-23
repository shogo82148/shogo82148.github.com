---
layout: post
title: "Goの日時比較が覚えられない件"
slug: 2022-02-23-compare-time-in-golang
date: 2022-02-23 22:49:00 +0900
comments: true
categories: [go, golang]
---

`time.Time` 型の比較は比較演算子が使えず、
[Time.Before](https://pkg.go.dev/time#Time.Before)
と [Time.After](https://pkg.go.dev/time#Time.After)
を使う必要があります。
日本の Gopher あるあるだと思うんですが、これって覚えられないですよね・・・。
英語のネイティブスピーカーだと楽勝なんでしょうか。

よくわからなくって毎回ググっているので、対応表にまとめました。

## 対応表

| 大小関係 |     | Go での記述    |
| -------- | --- | -------------- |
| `t == u` | ⇔   | `t.Equal(u)`   |
| `t > u`  | ⇔   | `t.After(u)`   |
| `t < u`  | ⇔   | `t.Before(u)`  |
| `t >= u` | ⇔   | `!t.Before(u)` |
| `t <= u` | ⇔   | `!t.After(u)`  |

以上

## 確認コード

日時の比較をわかりやすくする Bad Know-How として `Time.UnixNano` を使うという手があります。
Unix Timestamp は整数なのでおなじみの比較演算子を使えます。

ただし厳密には Monotonic Clocks があるので、結果がことなる場合があることに注意が必要です
(SEE ALSO: [Go1.9 から使える Monotonic Clocks を試してみた](https://shogo82148.github.io/blog/2017/06/26/go19-monotonic-clock/))。
あとは `Time.UnixNano` の戻り値は 1678 年から 2262 年の間でしか保証されないというのもありますね。
2262 年問題が発生するけど、みんな気にしないんだろうか・・・まあ気にしたところで、そのとき作者は死んでるわけですが。
とはいえ 2038 年問題を埋め込んでしまった人たちも同じことを考えていたはず。
今どき新規コードで 2038 年を埋め込むのはいただけないですが、どれだけの未来を想定すれば十分なんだろう？

ちょっと話がそれました。
こういうコーナーケースがあるので Bad Know-How なんですが、わかってさえいれば簡易チェックには使えます。
表を作ったものの不安でしょうがないので、`Time.UnixNano` を使って検証コードを書いてみました。

- https://go.dev/play/p/MnjLbKG-iph

何も出力されなければ問題なし。ﾖｼ!

```golang
package main

import (
	"log"
	"time"
)

func main() {
	test(func(t, u time.Time) bool {
		return t.UnixNano() == u.UnixNano()
	}, func(t, u time.Time) bool {
		return t.Equal(u)
	})

test(func(t, u time.Time) bool {
		return t.UnixNano() > u.UnixNano()
	}, func(t, u time.Time) bool {
		return t.After(u)
	})

	test(func(t, u time.Time) bool {
		return t.UnixNano() < u.UnixNano()
	}, func(t, u time.Time) bool {
		return t.Before(u)
	})

	test(func(t, u time.Time) bool {
		return t.UnixNano() >= u.UnixNano()
	}, func(t, u time.Time) bool {
		return !t.Before(u)
	})

	test(func(t, u time.Time) bool {
		return t.UnixNano() <= u.UnixNano()
	}, func(t, u time.Time) bool {
		return !t.After(u)
	})
}

func test(f, g func(t, u time.Time) bool) {
	a := time.Now()
	b := a.Add(1)
	c := a.Add(-1)
	if f(a, a) != g(a, a) {
		log.Println(a, a)
	}
	if f(a, b) != g(a, b) {
		log.Println(a, b)
	}
	if f(a, c) != g(a, c) {
		log.Println(a, c)
	}
}
```

## 参考

- [time package](https://pkg.go.dev/time)
- [Go1.9 から使える Monotonic Clocks を試してみた](https://shogo82148.github.io/blog/2017/06/26/go19-monotonic-clock/)
- [time.Time の比較が覚えれん！](https://text.baldanders.info/golang/order-by-time/)
- [go の日時比較 time パケージで「以上」「以下」はどうやって比較するの？](https://qiita.com/yamasaki-masahide/items/ce4414e8bb3868a878ce)
