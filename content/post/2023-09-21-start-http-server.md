---
layout: post
title: "ぼくのかんがえたさいきょうのGo HTTPサーバー起動方法"
slug: 2023-09-21-start-http-server
date: 2023-09-21 21:09:00 +0900
comments: true
categories: [go, golang]
---

これまで何度か HTTP Server の Graceful Shutdown について記事を書きました。

- [Go 言語で Graceful Restart をする](https://shogo82148.github.io/blog/2015/05/03/golang-graceful-restart/)
- [Go 言語で Graceful Restart をするときに取りこぼしを少なくする](https://shogo82148.github.io/blog/2015/11/23/golang-graceful-restart-2nd/)
- [Go1.8 の Graceful Shutdown と go-gracedown の対応](https://shogo82148.github.io/blog/2017/01/21/golang-1-dot-8-graceful-shutdown/)

最終的に Go 1.8 で `Server.Shutdown` が導入され、この件は解決を見ました。
しかし、最近「あれ？本当に正しく `Server.Shutdown` 使えている？」と疑問に思い、少し考えてみました。
というか ↑ の記事もまだ考慮が足りない気がする。

## ぼくのかんがえたさいきょうの Go HTTP サーバー起動方法

最初に結論。

```go
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	// シグナルを待ち受ける
	chSignal := make(chan os.Signal, 1)
	signal.Notify(chSignal, syscall.SIGINT, syscall.SIGTERM)
	defer signal.Stop(chSignal)

	// 起動したいサーバーを準備
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "from pid %d.\n", os.Getpid())
	})
	s := &http.Server{
		Addr:    ":8080",
		Handler: mux,
	}
	http.Handle("/", h)

	// 別 goroutine で Serve する
	chServe := make(chan error, 1)
	go func() {
		defer close(chServe)
		chServe <- s.ListenAndServe()
	}()

	select {
	case err := <-chServe:
		// ListenAndServe はたまに失敗する
		// 失敗したら死んでほしい
		log.Fatal(err)
	case <-chSignal:
	}

	signal.Stop(chSignal)

	// Graceful Shutdown 開始
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := s.Shutdown(ctx); err != nil {
		log.Fatal(err)
	}

	// HTTPサーバーが終了するのを待つ
	//
	s.Close()
	<-chServe
}
```
