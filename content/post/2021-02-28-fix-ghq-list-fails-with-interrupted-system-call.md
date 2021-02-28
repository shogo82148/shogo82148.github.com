---
layout: post
title: "ghq list が interrupted system call で死ぬ問題を直した"
slug: fix-ghq-list-fails-with-interrupted-system-call
date: 2021-02-28 23:42:00 +0900
comments: true
categories: [go, golang]
---

常用している Mac Book Pro の OS を Big Sur に上げたんだけど、
`ghq list` が以下のエラーを吐くようになってしまった。

```
$ ghq list
     error failed to filter repos while walkLocalRepositories(repo): interrupted system call
```

- [ghq list sometimes fails with interrupted system call #311](https://github.com/x-motemen/ghq/issues/311)

結論からいうと Go 1.14 から入った以下の変更が原因だったんだけど、
実際に遭遇したのは初めてだったのでメモ。

- [Go 1.14 でシステムコールが EINTR エラーを返すようになった](https://blog.lufia.org/entry/2020/02/29/162727)

## Go 1.14 でランタイムに入った変更

根本的な原因は [Go 1.14 リリースノート](https://golang.org/doc/go1.14#runtime) のこの辺の変更です。

> A consequence of the implementation of preemption is that on Unix systems, including Linux and macOS systems,
> programs built with Go 1.14 will receive more signals than programs built with earlier releases.
> This means that programs that use packages like syscall or golang.org/x/sys/unix will see more slow system calls fail with EINTR errors.

Go 1.14 で goroutine の切り替え方式が変わったことにより、
Go 1.14 でビルドされたプログラムは以前よりシグナルを受ける頻度が多くなりました。
システムコールによっては、システムコール実行中にシグナルを受け取ると **EINTR エラーで終了してしまいます。**
標準ライブラリを普通に使っている分には問題ないのですが、
syscall や golang.org/x/sys/unix を直接呼び出している場合にこれが問題になることがあります。

> Those programs will have to handle those errors in some way, most likely looping to try the system call again.

EINTR を受け取ったらシステムコールを再度呼び出すなど正しい対応をしてね、とのことです。

## 原因

エラーメッセージを元に原因を探っていくと、レポジトリの検索に使っている[saracen/walker](https://github.com/saracen/walker)にたどり着きました。
[walker_unix.go](https://github.com/saracen/walker/blob/e4a590f03e852923cdb02e2b7422fb070838b49d/walker_unix.go#L26-L29) の以下の部分です。

```go
fd, err := syscall.Open(dirname, 0, 0)
if err != nil {
    return &os.PathError{Op: "open", Path: dirname, Err: err}
}
```

```go
nbuf, err = syscall.ReadDirent(fd, buf)
if err != nil {
    return err
}
```

syscall パッケージを直接使っていますね。

厄介なのが頻度が多くなっただけで、**毎回 EINTR で落ちるわけではない**、ということ。
通常のテストでは発見できず、一分間ペンチを回してようやくここがエラーの原因だと確証が得られました。

```
$ go test -v -bench ^BenchmarkWalkerWalk -run none -benchtime 1m
goos: darwin
goarch: amd64
pkg: github.com/saracen/walker
cpu: Intel(R) Core(TM) i7-1068NG7 CPU @ 2.30GHz
BenchmarkWalkerWalk
    walker_test.go:187: open /usr/local/go/src/crypto/ed25519/internal/edwards25519: interrupted system call
--- FAIL: BenchmarkWalkerWalk-8
BenchmarkWalkerWalkAppend
    walker_test.go:200: open /usr/local/go/src/cmd/vendor/golang.org/x/tools/internal/analysisinternal: interrupted system call
--- FAIL: BenchmarkWalkerWalkAppend-8
FAIL
exit status 1
FAIL    github.com/saracen/walker       8.928s
```

## 対策

Go 1.14 のリリースノートにかかれていたとおり、 EINTR を受け取ったらリトライするようにしてあげれば OK です。
以下のような syscall のラッパーを用意することで対応しました。

- [fix "interrupted system call" error #5](https://github.com/saracen/walker/pull/5)

```go
func open(path string, mode int, perm uint32) (fd int, err error) {
	for {
		fd, err := syscall.Open(path, mode, perm)
		if err != syscall.EINTR {
			return fd, err
		}
	}
}

func readDirent(fd int, buf []byte) (n int, err error) {
	for {
		nbuf, err := syscall.ReadDirent(fd, buf)
		if err != syscall.EINTR {
			return nbuf, err
		}
	}
}
```

## ついでの yak shaving

[saracen/walker](https://github.com/saracen/walker) は [x/tools/internal/fastwalk](https://github.com/golang/tools/tree/2363391a5b2fe95c264da3c106a6ecca73490587/internal/fastwalk) をパッケージとして切り出して、独自の改良を加えたものです
(fastwalk は internal なので外部から呼び出せない)。
大まかな実装方針は一緒なので、修正の参考になるのでは？と fastwalk のコードも覗いてみたのですが、 **対応した形跡がない** 。
試しに walker と同じようにベンチマークを走らせてみたら、全く同じ問題が再現できてしまいました。

- [x/tools/internal/fastwalk: sometimes fails with "readdirent: interrupted system call" #44478](https://github.com/golang/go/issues/44478)

walker と全く同じ方法で修正できそうだったので、ついでに修正パッチを投げておきました。
(直接困っていたのは ghq のほうなので、こちらはあくまでもついで)

- [x/tools/internal/fastwalk: fixes "interrupted system call" error](https://golang.org/cl/294730)

> Heschi Kreinick
> Thanks, this generally looks reasonable. I wonder why nobody's reported it before.

ね、なんで誰も気が付かなかったんだろうね。
Go 1.14 のリリースが 2020-02-25 なので、ちょうど 1 年ほど見つからずに放置されていたことになります。

## まとめ

`ghq list` が interrupted system call とエラーを吐く問題について調査しました。
walker の修正は [saracen/walker@v0.1.2](https://github.com/saracen/walker/releases/tag/v0.1.2) で、
これを取り込んだ ghq の新しいバージョンが [x-motemen/ghq@v1.1.6](https://github.com/x-motemen/ghq/releases/tag/v1.1.6) としてリリースされています。
同じ問題でお困りの方はぜひアップデートをお試しください。

原因は [Go 1.14 で入ったランタイムの変更](https://golang.org/doc/go1.14#runtime)でした。
syscall を直接使うようなライブラリを書いている方は改めて見直してみましょう。
毎回エラーになるわけではないので、意外と気が付きにくいです。

ちなみに Catalina では問題なかったのになぜ Big Sur に上げた途端エラーを吐くようになったのかは、最後までわからないままでした。

## 参考

- [Go 1.14 でシステムコールが EINTR エラーを返すようになった](https://blog.lufia.org/entry/2020/02/29/162727)
- [Go 1.14 リリースノート](https://golang.org/doc/go1.14#runtime)
- [ghq list sometimes fails with interrupted system call #311](https://github.com/x-motemen/ghq/issues/311)
- [fix "interrupted system call" error #5](https://github.com/saracen/walker/pull/5)
- [x/tools/internal/fastwalk: sometimes fails with "readdirent: interrupted system call" #44478](https://github.com/golang/go/issues/44478)
- [x/tools/internal/fastwalk: fixes "interrupted system call" error](https://golang.org/cl/294730)
- [Go にコントリビュートするまでの手順](https://syfm.hatenablog.com/entry/2017/07/05/020535)
  - Go 本体ではないとはいえ、x/tools も Go プロジェクトの一部。パッチを送る際に参考になりました
- [Contribution Guide](https://golang.org/doc/contribute)
