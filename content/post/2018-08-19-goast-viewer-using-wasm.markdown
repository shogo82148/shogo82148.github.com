---
layout: post
title: "GoAst ViewerをWebAssemblyへビルドしてみた"
slug: goast-viewer-using-wasm
date: 2018-08-19 07:29:00 +0900
comments: true
categories: [go, golang, wasm]
---

もうすぐリリースのGo1.11ではWebAssemblyのサポートが予定されています。
(2018/08/19現在の最新版はGo1.11rc1)

- [Go言語がWebAssemblyをサポートへ。GOARCHは「wasm」、GOOSは「js」に](https://www.publickey1.jp/blog/18/gowebassemblygoarchwasmgoosjs.html)

正式リリース前に少し遊んでみようということで、[@yuroyoro](https://twitter.com/yuroyoro)さんの[GoAst Viewer](http://goast.yuroyoro.net/)をWebAssemblyへビルドしてみました。

- [GoAst Viewer WebAssembly Version](https://shogo82148.github.io/goast-viewer/)
- [shogo82148/goast-viewer](https://github.com/shogo82148/goast-viewer)

## JavaScriptの連携方法

コードをASTに変換し、JSONとしてエンコードする部分([ast.go](https://github.com/shogo82148/goast-viewer/blob/master/ast.go))に関しては、一切変更しなくても動きました。素晴らしい。

ただし、さすがにブラウザ上でHTTPサーバーは動かない(そういえば試してないけど、動かないよね？？)ので、JavaScriptとの連携部分を実装してあげる必要があります。
[syscall/js](https://tip.golang.org/pkg/syscall/js/)パッケージはまだ実験段階というステータスで機能が限られているので、
連携には少し工夫が必要です。

### JavaScriptからGoの関数を呼ぶ

JavaScriptからGoの関数を呼ぶには `window` にコールバック関数として必要な関数を登録します。

```go
// GoASTParse 関数を定義(Go言語)
js.Global().Set("GoASTParse", js.NewCallback(func(args []js.Value) {
    source := args[0].String()
    // ...ASTへの変換処理...
}))
```


### 戻り値をGoからJavaScriptへ返す

`js.NewCallback` なのですが、もともとは `addEventListener` にわたすコールバック関数なので、
関数の戻り値を受けわたす方法がありません。
回避方法はいろいろあるでしょうが、今回はコールバック関数の引数にコールバック関数指定してもらうことにしました。

```go
// GoASTParse 関数を定義(Go言語)
js.Global().Set("GoASTParse", js.NewCallback(func(args []js.Value) {
    source := args[0].String()
    // ...ASTへの変換処理...
    args[1].Invoke(string(body))
}))
```

```javascript
// GoASTParseを呼び出す(JavaScript)
GoASTParse("package main; func main() {}", function(body) {
    // ASTの表示処理
})
```

## まとめ

Goのバイナリ全般に言えることですが、WASMになってもやっぱりサイズが大きい(3.5M)。
今後のパフォーマンス向上に期待です。

GoよりAngulerJSの方が難しかったʕ　 ﾟ皿ﾟ ʔ


## 参考

- [Go言語がWebAssemblyをサポートへ。GOARCHは「wasm」、GOOSは「js」に](https://www.publickey1.jp/blog/18/gowebassemblygoarchwasmgoosjs.html)
- [ʕ　 ﾟ皿ﾟ ʔ GolangのASTを可視化するツールを作った](https://yuroyoro.hatenablog.com/entry/2014/06/30/220356)
- [yuroyoro/goast-viewer](https://github.com/yuroyoro/goast-viewer)
- [サクッと Go → WebAssembly を試す](https://qiita.com/cia_rana/items/bbb4112b480636ab9d87)
- [Some notes about the upcoming WebAssembly support in Go](https://blog.owulveryck.info/2018/06/08/some-notes-about-the-upcoming-webassembly-support-in-go.html)
- [Package js](https://tip.golang.org/pkg/syscall/js/)
