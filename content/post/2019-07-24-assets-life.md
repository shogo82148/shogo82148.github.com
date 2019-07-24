---
layout: post
title: "Goのバイナリに静的ファイルを埋め込むツール assets-life を書いた"
slug: assets-life
date: 2019-07-22 07:33:00 +0900
comments: true
categories: [go, golang]
---

日本語の Go コミュニティだと go-bindata ([なんか乗っ取り騒動とか色々あって](https://github.com/jteeuwen/go-bindata/issues/5)メンテナンスされてない), go-assets (最近メンテナンス滞りがち) が有名(要出典)なやつです。
これらのライブラリに関してたくさん日本語記事が書かれて、今もたくさん検索に引っかかるのですが、残念ながら最近はメンテナンスが滞っています。

最近は [statik](https://github.com/rakyll/statik) の名前もよく見るようになりました。
その他は [Resource Embedding - Awesome Go](https://awesome-go.com/#resource-embedding) からどうぞ。

で、まあ、今回も完全に車輪の再発明なんですが、他の実装には色々と思うところがあり書いてみました。

- [shogo82148/assets-life](https://github.com/shogo82148/assets-life)

## USAGE

なにはともあれ、まずは `go get` してきます。

```
$ go get github.com/shogo82148/assets-life
```

`assets-life` というコマンドがインストールされるので、
バイナリに組み込みたいディレクトリと出力先を指定します。

```
$ assets-life /path/to/your/project/public public
```

出力先のディレクトリは Go のパッケージとしてインポートできるようになってます。
`Root` という変数のなかにファイルが埋め込まれており、`http.FileSystem` インターフェースを介してアクセスできます。

```go
import (
    "net/http"
    "example.com/your/project/public"
)

func main() {
    http.Handle("/", http.FileServer(public.Root))
    http.ListenAndServe(":8080", nil)
}
```

## 特長

### コードの再生成にコマンドのインストールが不要

これが一番の特長です。
バイナリにファイルを埋め込む都合上、静的ファイルを修正した場合にコードの再生成が必要です。
`assets-life` は `go:generate` ディレクティブを埋め込んだコードを出力するので、コードの再生成は `go generate` でできます。

```
# /path/to/your/project/public に修正を加える

# コードの再生を行う
$ go generate example.com/your/project/public
```

面白いのは、このとき **「`assets-life` コマンドは必要ない」** ということです。
`assets-life` はコード生成時に **自分自身のソースコードをパッケージに埋め込みます** 。
`go:generate` ディレクティブには、埋め込んだ `assets-life` のソースコードを `go run` で実行するよう定義してあります。
別途コマンドをインストールする必要はありません。

```go
// 生成されたコードの一部

package public

//go:generate go run assets-life.go ../path/to/your/project/public . public

// 以下略
```

これのおかげで、 `go generate` を実行して `assets-life: command not found` となる悲劇や、
実行する人によって微妙にバージョンが違っていて `git diff` がたいへんなことになる悲劇から開放されます。

-----

`assets-life` は [あなたの知らない超絶技巧プログラミングの世界](https://www.amazon.co.jp/dp/4774176435) ではおなじみ
[クワイン](https://ja.wikipedia.org/wiki/%E3%82%AF%E3%83%AF%E3%82%A4%E3%83%B3_(%E3%83%97%E3%83%AD%E3%82%B0%E3%83%A9%E3%83%9F%E3%83%B3%E3%82%B0)) として実装されています。
クワインとして実装すること自体は [PerlでもGoでも実行できるQuine書いた](https://shogo82148.github.io/blog/2016/04/06/ployglot-quine-of-golang-and-perl/) で一度やっているので難しくはなかったのですが、
文字列リテラルとして埋め込んだ `go:generate` ディレクティブや build constraint が誤って Go に検出されてしまい、
それを回避するために難読化する必要があって少しハマりました。


### ファイルの更新日時をあえて返さない

`http.FileSystem` インターフェースはファイルの更新日時を取得できるようになっていますが、
`assets-life` は更新日時に `time.Time` の Zero Value を返します。

このように実装してある理由は、 `go generate` を実行する環境によらず同じコードが生成されて欲しい、というのがひとつ。
それに加えて、HTTPクライアントに余計なキャッシュをしてほしくないという理由でこのようにしてあります。

Go の [`http.FileServer`](https://golang.org/pkg/net/http/#FileServer) は
ファイルの更新日時が設定されていると `Last-Modified` ヘッダーをつけてレスポンスを返します。
`Last-Modified` ヘッダーを見つけたHTTPクライアントは、`Date` ヘッダーの情報と合わせて最終更新日時からの経過時間を計算します。
そして他に妥当な判断材料がない場合は **その10%をキャッシュの寿命として設定します** 。
具体例をあげると以下のようなヘッダーが返ってきた場合

```
Date: Wed, 24 Jul 2019 08:08:47 GMT
Last-Modified: Sat, 01 Jan 2000 00:00:00 GMT
```

ファイルの最終更新日時から約19年経っているので、キャッシュの寿命として約1.9年が設定されます。
この間クライアントはキャッシュを利用するので、 **ファイルに更新あったとしても最悪1.9年の間は更新が反映されません・・・！**
このことを知ったときは「そんなことするクライアントいるの？」と疑問だったのですが、
このキャッシュアルゴリズムはRFCやMDNにも記述があり、実際そのような挙動をするクライアントがあるようです。

- [RFC 7234 4.2.2. Calculating Heuristic Freshness](https://tools.ietf.org/html/rfc7234#section-4.2.2)
- [鮮度 - HTTP キャッシュ MDN web docs](https://developer.mozilla.org/ja/docs/Web/HTTP/Caching#Freshness)
- [Date, Last-ModifiedヘッダがありCache-Controlが不適切な場合OkHttpが思いもよらないCacheをするので注意](http://fushiroyama.hatenablog.com/entry/2017/11/28/164104)

変なヒューリスティックでキャッシュの有効期限を決められると困るので、`assets-life` では `Last-Modified` を削除しています。
しかし、これでキャッシュしなくなるという保証はどこにもないので、HTTPでのファイル配信に使うときはキャッシュ関連のヘッダーを設定しましょう。


### ファイル検索にバイナリサーチを使用

他の実装はファイルの管理に `map` を使っているものが多いですが、 `assets-life` はすべてスライスに入れています。
ファイルを開くときは、コード生成の時点でソートしておいて、バイナリサーチです。
Nをファイルの数としたとき `map` の検索コストは O(1)、バイナリサーチの検索コストは O(log N) です。

一見 `map` のほうが速そうですが、定数倍のオーバーヘッドがあるので、N が小さいときはバイナリサーチのほうが速くなります。
雑に測定した感じだと1000個くらいまではバイナリサーチのほうが速そうです(要出典)。
また、ファイルへの参照をスライスのインデックスで表せるので、 `Readdir` もまだまだ高速化できそうです。
ちょっと詳しくベンチマークを取りながらチューニングしていきたいと思います。


### ファイルの中身は未圧縮・stringで保持

`assets-life` はzipやzlibでの圧縮には対応していません。
圧縮はバイナリサイズと実行時の展開コストのトレードオフになるわけですが、`assets-life` は実行時のコスト最小化に寄せてあります。
Goのランタイムだけで数MBあるので、これを大きく超えるようなファイルを扱わない限り、バイナリサイズへの影響はほとんどありません。
そんあ用途はそうそう無いだろうという勝手な思い込みにより、このような実装になっています。


## まとめ

go-bindata, go-assets, statik の類似品を作りました。
便利だなと思った人はぜひ使ってみてください。

そうでもないな、と思った人も **「最終更新日時からの経過時間の10%を、キャッシュの寿命に設定する」** HTTPクライアントが存在するっていうことだけは覚えて帰ってね。
