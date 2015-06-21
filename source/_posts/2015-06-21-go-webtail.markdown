---
layout: post
title: "go-webtailってのを書いた"
date: 2015-06-21 23:28
comments: true
categories: [go]
---

Rubyで書かれた[webtail](https://github.com/r7kamura/webtail)のGo移植を書いてみました。

- [go-webtail](https://github.com/shogo82148/go-webtail)

<!-- More -->

オリジナルのwebtailはRubyなので、Rubyistではない僕が使おうとするとまずRubyの実行環境からそろえないといけなくてつらい。
ワンバイナリでダウンロードするだけで使えるやつが欲しいなあと常々思っていたのでGolangです。
htmlやjavasctiptの部分もバイナリに含まれているので、インストールも簡単です。

引数無しで実行すると8080ポートで待ち受けて、標準入力から読み込んだ結果をWebsocketで読めるようにしてくれます。

``` bash
go get github.com/shogo82148/go-webtail/cmd/webtail # インストール
echo hogehoge | webtail
```

ファイルもtailできます。

``` bash
webtail hoge.log fuga.log
```

それぞれ、`http://localhost:8080/hoge.log`と`http://localhost:8080/fuga.log`で見れるようになります。


# mirageと一緒につかう

[mirage](https://github.com/acidlemon/mirage)は待ち受けポートを複数設定できます。
(SEE ALSO [Dockerで非エンジニアでも開発環境を上げ下げできる、mirageというツールを作りました](http://tech.kayac.com/archive/mirage_for_docker.html))
その一つをwebtailに割り当てて以下のようにDockerfileに書いておけば、非(サーバサイド)エンジニアでも開発環境のログが見れるようになります。
(見れても理解できるのか？って疑問もあるけど、まあ、全く見れないよりは・・・)

```
ADD webtail /
CMD ./docker_run.sh 2>&1 | /webtail --prefix webtail

# ブラウザで見れる代わりにdocker logsで見れなくなるのでこっちのほうがいいかも
CMD ./docker_run.sh 2>&1 | tee hoge.log | /webtail --prefix webtail
```

残念ながらwebsocket対応はしていないので、[websoket対応にしたmirage](https://github.com/shogo82148/mirage/tree/feature/websocket)が必要です。
`httputil.NewSingleHostReverseProxy`互換の[rproxy](github.com/methane/rproxy)ってのを使ったら簡単にwebsocket対応ができて素晴らしいですね。
(mirage自身に手を加える必要があるなら、mirageにこういう機能をつけるべきだったのでは説はある)
