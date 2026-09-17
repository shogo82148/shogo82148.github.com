---
layout: post
title: "QRコード画像生成APIをリニューアル公開した"
slug: qrcode-generator-api-released
date: 2026-09-17 00:43:00 +0900
comments: true
categories: [qrcode, go, golang]
---

## 背景・目的

突然QRコードを作りたくなること、あると思います。
そんなときのために以前QRコードのジェネレーターを作ったことがありました。

- [GolangでQRコード、マイクロQRコード、rMQRコードのジェネレーターを作った](https://shogo82148.github.io/blog/2023/01/01/2023-01-01-rmqr-generator-written-in-golang/)

このとき実はひっそりとQRコード画像生成APIも作って公開していたのです。

- [shogo82148/qrcode-generator](https://github.com/shogo82148/qrcode-generator/)

しかしろくなドキュメントもなく、ただただAPIが公開されているだけだったので、利用者はまったく伸びませんでした。
APIの仕様をすっかり忘れてしまったので、自分自身でも使わない・・・。

そんなGitHubの肥やしになっているのも悲しかったので、
ドキュメントを整備してリニューアルオープンしました。
（もちろん Claude先生、 Codex 先生のお力をお借りして）

- [QR Code Generator](https://qr.shogo82148.com/)

## 使い方

なんと、[QRコード画像生成 API 仕様](https://qr.shogo82148.com/docs)に詳しい使い方が書いてあります。
仕様に沿ってURLを組み立てれば簡単にQRコードを作成できます。

![QRコードの作成例](https://qr.shogo82148.com/qr?data=https%3A%2F%2Fqr.shogo82148.com&format=svg&size=256&level=M)

QRコード、microQRコード、rMQRコードに対応しており、それぞれにその場で実行結果を確認できるプレイグラウンドもついています。

- [QRコード](https://qr.shogo82148.com/qr/playground)
- [microQRコード](https://qr.shogo82148.com/microqr/playground)
- [rMQRコード](https://qr.shogo82148.com/rmqr/playground)

これなら使い方に迷いませんね。

## 利用規約・プライバシーポリシー

今回は[利用規約](https://qr.shogo82148.com/terms)と[プライバシーポリシー](https://qr.shogo82148.com/privacy)も用意してみました。

これもイチから起こすのは大変なので Codex 先生にお願いしました。
Codex先生が人間が決めなければならない項目をまとめてくれるので、それに答えていくだけです。
法律の用語でわからないことも聞けば教えてくれるのでスムーズに進みました。

一点だけ厄介だったのが、お問い合わせ窓口の設置です。
普段利用している Gmail アドレスでいいかと単純に考えていたのですが、どうやらそうではない模様。
個人アカウントの Gmail へユーザーの個人情報を送信することは「Googleへの個人データの提供に該当」し、
「別途本人の同意等が必要」とのこと。
メーラーを使って直接メールを送ってこられると「別途本人の同意等」が得られたかわかりません。

先生と色々と相談した結果、Googleフォームに[お問い合わせフォーム]()を設置することにしました。
フォームに「説明への同意」ボタンを設けることで明確に同意が得られます。

## まとめ

QRコード画像生成APIをリニューアル公開しました。

- [QR Code Generator](https://qr.shogo82148.com/)

利用規約やプライバシーポリシーも整備して、安心して使えるようにしたので、ぜひご利用ください

それでも安心できない人のために、ソースコードも置いてあります。
自前ホストで頑張りましょう（弊社はそれでやってる）。

- [shogo82148/qrcode-generator](https://github.com/shogo82148/qrcode-generator/)

> うさぎが記事をひらきます\
> 新しいAPIを案内します\
> QRコードが跳ねます\
> リンクが道を照らします\
> 公開のお知らせです
>
> by [CodeRabbit](https://www.coderabbit.ai/)

## 参考

- [GolangでQRコード、マイクロQRコード、rMQRコードのジェネレーターを作った](https://shogo82148.github.io/blog/2023/01/01/2023-01-01-rmqr-generator-written-in-golang/)
- [shogo82148/qrcode-generator](https://github.com/shogo82148/qrcode-generator/)
- [QR Code Generator](https://qr.shogo82148.com/)
