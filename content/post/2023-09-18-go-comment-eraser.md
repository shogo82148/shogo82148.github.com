---
layout: post
title: "Goのコメント全部消す"
slug: 2023-09-18-go-comment-eraser
date: 2023-09-18 22:38:00 +0900
comments: true
categories: [go, golang]
---

深遠な理由で、ソースコードからコメントをすべて抹消したくなったことはありませんか？

そんなときに使えるツールを作りました。

- [shogo82148/go-comment-eraser](https://github.com/shogo82148/go-comment-eraser)

Go製コマンドなので、 `go install` でインストール。

```console
go install github.com/shogo82148/go-comment-eraser@latest
```

ソースコードのおいてあるディレクトリを指定すると、
そのディレクトリ以下の `*.go` からすべてコメントを削除します。

```console
go-comment-eraser ソースコードのあるディレクトリ
```

実際に [shogo82148/go-comment-eraser](https://github.com/shogo82148/go-comment-eraser) 自身のソースコードで試した結果がこちら。

```diff
diff --git a/main.go b/main.go
index 5087d08..913debc 100644
--- a/main.go
+++ b/main.go
@@ -65,22 +65,18 @@ func eraseComment(src string) error {
 	return nil
 }

-// parseFile parses the Go source code file and returns the Go source
-// that is modified to erase all comments.
 func parseFile(src string) ([]byte, error) {
-	// Parse the Go source code file
+
 	fset := token.NewFileSet()
 	node, err := parser.ParseFile(fset, src, nil, parser.ParseComments)
 	if err != nil {
 		return nil, err
 	}

-	// If the AST is generated, just copy the file
 	if ast.IsGenerated(node) {
 		return nil, errSkipErase
 	}

-	// Erase all comments from the AST
 	ast.Inspect(node, func(n ast.Node) bool {
 		switch n := n.(type) {
 		case *ast.CommentGroup:
@@ -109,7 +105,6 @@ func parseFile(src string) ([]byte, error) {
 	}
 	node.Comments = list

-	// Print the modified Go source code
 	var buf bytes.Buffer
 	if err := format.Node(&buf, fset, node); err != nil {
 		return nil, err
```

## 改良点

もともとは会社の同僚のアイディアです。そこからいくつか改良を加えました。

- `//go:` ではじまるコメントは残す
  - コメントは全部消すと言ったな。あれは嘘だ。
  - `//go:generate` や `//go:embed` などが削除されると、ビルドができなくなって困るからです。
- 自動生成ファイルには手を付けない
  - `// Code generated foo bar DO NOT EDIT.` というコメントがついたファイルはそのまま残します。
  - Go 1.21 から [ast.IsGenerated](https://pkg.go.dev/go/ast#IsGenerated) で簡単に判別できるようになりました。

## 参考

- [shogo82148/go-comment-eraser](https://github.com/shogo82148/go-comment-eraser)
- [Go1.21のgo/ast、go/buildあたりのマイナーチェンジ ](https://future-architect.github.io/articles/20230801a/)
- [ast.IsGenerated](https://pkg.go.dev/go/ast#IsGenerated)
