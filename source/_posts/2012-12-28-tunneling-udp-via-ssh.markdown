---
layout: post
title: "UDPのパケットをSSHを通してトンネルする"
date: 2012-12-28 16:38
comments: true
categories: [UDP, SSH]
---

SSHには標準でTCPのトンネリング機能は付いているのですが，
UDPはトンネリングしてくれません．
なんとかできないものかと試行錯誤してみました．

<!-- More -->

## TCP をトンネル

TCPのトンネリングの復習から．
以下のコマンドでクライアントの8080番ポートを，リモートの80番ポートに転送することができます．

```bash
ssh -L 8080:localhost:80 remote
```

SOCKS proxyとして動作させることも出来ます．
ブラウザのプロキシとして設定すれば，リモートのサーバがすべての通信を中継してくれます．

```bash
ssh -D 8080 remote
```

## UDP をトンネル

NetCatを使うと TCP/UDP の通信内容と標準入出力をつなげることが出来るらしいです．
これを使って，クライアント側で UDP サーバを立て，その通信内容をSSH経由でリモートの UDP クライアントに送ってあげます．
最後にリモートからクライアント側へのパケットを名前付きパイプで転送してあげればトンネル完成です．

```bash
mkfifo tunnel
nc -ul 8080 < tunnel | ssh remote nc -u localhost 8080 > tunnel
```


## Mosh をトンネル

なんでこんなことをしようと思ったかというと，[Mosh][]をファイヤーウォール越しに使いたかったから．
[Mosh][]はUDPで通信しているので，SSHしか通らない環境では使えません．
そこでUDPをSSHでトンネリングしてできないかとやって見ました．
セッションの確立にSSHも使っているので，以下のようにして Mosh用のUDPトンネルと SSH用のTCPトンネルを作ります．

```bash
mkfifo tunnel
nc -ul 60000 < tunnel | ssh -L 10000:localhost:22 remote nc -u localhost 60000 > tunnel &
mosh -p 60000 --ssh="ssh -p 10000" localhost
```

外部からのSSH通信が遅かったので，[Mosh][]のローカルエコーでなんとかならないかと挑戦してみました．
実際の効果は未確認．またあとで試してみます．

[Mosh]: http://mosh.mit.edu/
