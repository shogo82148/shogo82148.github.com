---
layout: post
title: "動的ライブラリの検索パスに、実行バイナリからの相対パスを入れたい"
slug: 2022-05-27-configure-rpath-via-ldflags
date: 2022-05-27 22:30:00 +0900
comments: true
categories: []
---

C や C++ で普通にコンパイルしたバイナリを実行すると、
`/lib` や `/usr/lib` といったディレクトリから動的ライブラリを検索して来ます。
この検索パスは `LD_LIBRARY_PATH` 環境変数や `/etc/ld.so.conf` 設定ファイルで設定可能です。

しかし、これらの方法ではすべての実行コマンドの設定が上書きされてしまいます。
「自分がコンパイルしたバイナリ」のみ、検索パスをいじりたい。
できれば実行バイナリの相対パスを指定したい。

そんな場面に遭遇したので、備忘録として残しておきます。

## 背景

以前 Redis をインストールしてセットアップする GitHub Action [actions-setup-redis](https://github.com/marketplace/actions/actions-setup-redis) を公開しました。
「Redis くらい Docker でシュッとたちあがるやろ」という話もありますが、
Workflow の中で `redis-cli` を使いたい場合や、 macOS で実行したい場合 Docker は使えません。
これを解決するために、[actions-setup-redis](https://github.com/marketplace/actions/actions-setup-redis) では
プラットフォームに合わせてビルド済みのバイナリをダウンロードする、という手法をとっています。

Redis は v6.2.0 から OpenSSL を使った SSL/TLS 通信をサポートしています。
せっかくなので SSL/TLS 通信したいですよね (というか[そういう要望がきた](https://github.com/shogo82148/actions-setup-redis/issues/375))。
そうすると当然 Redis と OpenSSL のリンクが必要です。

別のプロジェクトですが、過去に [リンクしていた OpenSSL が OS イメージから削除される](https://github.com/shogo82148/actions-setup-perl/issues/523) という経験をしていたので、
**Redis に OpenSSL をバンドルして配布することにしました**。

バンドルした OpenSSL と プリインストールされている OpenSSL のバージョンがあっている保証はありません
(そもそもそういう場合に備えてバンドルしてる)。
グローバルな設定を書き換えてしまっては、既存の OpenSSL に依存しているコマンドが壊れてしまいます。
でも `redis-cli` を使うときだけはバンドルした OpenSSL を動的ロードしたい。

そんなわけで **「自分がコンパイルしたバイナリ」のみ、動的ライブラリの検索パスをいじりたい** ということをしたくなったわけです。

## `RPATH` で検索パスをバイナリに埋め込む

やはり「バンドルした動的ライブラリを使いたい」という要望はあるようで、
ちゃんとその仕組が用意されていました。
リンカ (`ld`) に `-rpath directory` というオプションを渡してやります。
すると、バイナリに `directory` のパスが埋め込まれ、実行時に動的ライブラリを `directory` から探してくれます。

多くの場合、リンカを直接呼び出すのではなく、 `gcc` を経由してリンクすることでしょう。
その場合は `-Wl,linker-options` でリンカに渡すオプションを指定できます。
例えば `/opt/awesome/lib` を検索パスとして埋め込む場合はこうです。

```bash
gcc -Wl,-rpath,/opt/awesome/lib main.c
```

## `$ORIGIN` を使って相対パスを指定する

先の例では絶対パスを埋め込みました。
`$ORIGIN` というキーワードを使うと、実行バイナリからの相対パスを指定できます。

```bash
gcc -Wl,-rpath,'$ORIGIN/../lib' main.c
```

`$ORIGIN/../lib` をシングルクォーテーションでくくっているのがポイントです。
単に `$ORIGIN` と書いてしまうと、シェルに環境変数展開としてみなされてしまい、
`/../lib` が埋め込まれるという悲しい事故が起こります (たいてい `ORIGIN` なんていう環境変数は定義していないので)。
シングルクォーテーションでくくることで、`$ORIGIN` という文字列自体を埋め込むことができます。

## `LDFLAGS`　環境変数

伝統的な Makefile を使ったビルドシステムでは、 `LDFLAGS` 環境変数で、リンカにわたすオプションをカスタマイズできます。
`/opt/awesome/lib` を検索パスに埋め込むには、事前に以下のように設定しておけば OK です。

```bash
export LDFLAGS=-Wl,-rpath,/opt/awesome/lib
```

さて、面倒なのがここからですよ・・・。

`$ORIGIN/../lib` を埋め込むにはこうです。

```bash
export LDFLAGS=-Wl,-rpath,'\$$ORIGIN/../lib'
```

最終的に得たいのは `$ORIGIN/../lib` なのに、
`'\$$ORIGIN/../lib'` となんだかたくさん記号が増えています。
なぜこんなことになるのか、簡単な Makefile で試してみましょう。

```makefile
all:
	echo $(LDFLAGS)
```

`LDFLAGS` 環境変数を設定して `make` してみます。

```bash
$ export LDFLAGS=-Wl,-rpath,'\$$ORIGIN/../lib'
$ echo $LDFLAGS
-Wl,-rpath,\$$ORIGIN/../lib
$ make
echo -Wl,-rpath,\$ORIGIN/../lib
-Wl,-rpath,$ORIGIN/../lib
```

何が起こっているかというと、

- `export LDFLAGS=-Wl,-rpath,'\$$ORIGIN/../lib'`
- → bash → `-Wl,-rpath,\$$ORIGIN/../lib` (環境変数の設定時に bash が変数展開)
- → make → `-Wl,-rpath,\$ORIGIN/../lib` (make が変数展開して、 bash に渡す)
- → bash → `-Wl,-rpath,$ORIGIN/../lib` (bash が変数展開)

という感じで `LDFLAGS` は bash と make によって何度も変数展開が行われます。
そのため `$` のエスケープを何重も行わなければならないのです。

## まとめ

- 動的ライブラリをバンドルしたい場合に、 `-rpath` というオプションを使うと、バイナリに検索パスを埋め込めます。
- `$ORIGIN` で実行バイナリからの相対パスも指定できるよ。
- `LDFLAGS` 環境変数で指定しようとすると、そこは魔境だった。

```bash
export LDFLAGS=-Wl,-rpath,'\$$ORIGIN/../lib'
```

## 参考

- [actions-setup-redis](https://github.com/marketplace/actions/actions-setup-redis)
- [Add support for building redis with TLS support #375](https://github.com/shogo82148/actions-setup-redis/issues/375)
- [Post setup failing on Github #555](https://github.com/shogo82148/actions-setup-redis/issues/555)
- [Cannot load Net::SSLeay on macOS #523](https://github.com/shogo82148/actions-setup-perl/issues/523)
- [バイナリの RPATH の状態を確認する](https://qiita.com/koara-local/items/2c26e249e02994230324)
- [ld.so のヘルプ・マニュアル](http://www.linux-cmd.com/ld.so.html)
- [$ORIGIN の紹介](https://docs.oracle.com/cd/E19455-01/806-2734/appendixc-20/index.html)
