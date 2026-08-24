---
layout: post
title: "GoのWebSocketライブラリーを書いた"
slug: new-golang-websocket-library
date: 2026-08-24 21:29:00 +0900
comments: true
categories: [go, golang, websocket]
---

## 背景・目的

WebSocketのハンドシェイクがどのように行われているのか、お勉強のためにGo言語でWebSocketのライブラリーを実装しました。

- [shogo82148/websocket](https://github.com/shogo82148/websocket)

お勉強なのでコア部分の実装はなるべくAIは使わずに [RFC 6455: The WebSocket Protocol](https://www.rfc-editor.org/info/rfc6455/) を読んで頑張って実装しました。
ただし、テストコードをGitHub Copilot氏に描いてもらったり、CodeRabbitのレビューを受けたり、AI活用するところは活用してます。

また実装面では [coder/websocket](https://github.com/coder/websocket) を大いに参考にさせていただきました。

## 使い方

APIは [coder/websocket](https://github.com/coder/websocket) と合わせてあります。

### サーバー

以下は接続すると「Hello WebSocket!」というメッセージを送り返してくれるサーバーの実装例です。

```go
package main

import (
  "context"
	"log"
	"net/http"
  "time"

	"github.com/shogo82148/websocket"
)

func main() {
  http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
    // 内部で Hijack 呼び出して、HTTP 通信から WebSocket に切り替える。
    conn, err := websocket.Accept(w, r, nil)
    if err != nil {
      return
    }
    defer conn.CloseNow()

    // タイムアウト時間を設定
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    // 「Hello WebSocket!」を送信
    if err := conn.Write(ctx, websocket.MessageText, []byte("Hello WebSocket!")); err != nil {
      log.Println(err)
      return
    }

    // クローズハンドシェイクを開始
    if err := conn.Close(websocket.StatusNormalClosure, ""); err != nil {
      log.Println(err)
      return
    }
  })
  http.ListenAndServe(":8080", nil)
}
```

### クライアント

さきほどのサーバーに接続するクライアントの実装です。

```go
package main

import (
  "context"
  "log"

  "github.com/shogo82148/websocket"
)

func main() {
  // WebSocket接続を開始
  ctx := context.Background()
  conn, _, err := websocket.Dial(ctx, "ws://localhost:8080/", nil)
  if err != nil {
    log.Fatal(err)
  }
  defer conn.CloseNow()

  // メッセージを読み込む
  _, data, err := conn.Read(ctx)
  if err != nil {
    log.Fatal(err)
  }
  log.Printf("Received: %s", data)

  // クローズハンドシェイクを開始
  if err := conn.Close(websocket.StatusNormalClosure, ""); err != nil {
    log.Println(err)
    return
  }
}
```

## 特徴

以下のような点を工夫して実装しました。

### Contextサポートの強化

「[ぼくのかんがえたさいきょうのcontext対応版go-mysql-driverをマージしてもらった](https://shogo82148.github.io/blog/2017/06/16/mysql-driver-and-context/)」で採用した watcher goroutine/executor goroutine方式を実装しています。
Contextがキャンセルされた場合の挙動が分かりやすくなっていると思います。

### UTF-8のバリデーションサポート

`MessageText` タイプのメッセージは UTF-8 でエンコードされている必要がある（MUST）とRFC 6455に記載があります。
[shogo82148/websocket](https://github.com/shogo82148/websocket) ではこれに遵守するために、
ライブラリーのユーザーが読み書きしたデータがValidなUTF-8かを自動的にバリデーションします。

## まとめ

お勉強のためにGo言語製のWebSocketライブラリーを実装しました。

- [shogo82148/websocket](https://github.com/shogo82148/websocket)

ひととおりの機能は実装したので、プロダクション環境でも使えるのではと思ってます。
ぜひご利用ください。

## 参考

- [shogo82148/websocket](https://github.com/shogo82148/websocket)
- [coder/websocket](https://github.com/coder/websocket)
- [RFC 6455: The WebSocket Protocol](https://www.rfc-editor.org/info/rfc6455/)
- [RFC 7692: Compression Extensions for WebSocket](https://www.rfc-editor.org/info/rfc7692/)
- [ぼくのかんがえたさいきょうのcontext対応版go-mysql-driverをマージしてもらった](https://shogo82148.github.io/blog/2017/06/16/mysql-driver-and-context/)
