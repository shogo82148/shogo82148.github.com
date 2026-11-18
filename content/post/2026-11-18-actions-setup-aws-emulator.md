---
layout: post
title: "AWS EmulatorのセットアップをするGitHub Actionを書いた"
slug: actions-setup-aws-emulator
date: 2026-11-18 21:25:00 +0900
comments: true
categories: [aws, github, github-actions]
---

## 背景・目的

11月11日に[AWS Emulator](https://github.com/aws/aws-emulator)が公開されました。
AWSの環境を手元で再現できるツールです。

- [AWS Emulator を使用してローカルで AWS に対してアプリケーションをテストする](https://aws.amazon.com/jp/blogs/news/test-your-applications-against-aws-locally-with-aws-emulator/)

手元でテストができるようになったら、GitHub Actionsでテストしたくなりますよね。
しかし、実際にGitHub ActionsにAWS Emulatorを導入するのは意外と面倒です。

- .debファイルのダウンロード
- 署名の検証
- AWS Emulatorの起動
- AWS Emulatorがリクエストを受け付けられるようになるまで待機
- 接続用の環境変数の設定

やることが多い。

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">毎回この分量書くのつらいから、公式からGitHub Action提供されないかな

https://t.co/W5drYuDYU9</p>&mdash; f96fd3a0-bdb9-4f10-b69f-8f765c1d341c ICHINOSEShogo (@shogo82148) <a href="https://x.com/shogo82148/status/2121956878871838840?ref_src=twsrc%5Etfw">November 15, 2026</a></blockquote>
<script async src="https://platform.x.com/widgets.js" charset="utf-8"></script>

公式から提供される気配をまったく感じないので作っちゃいました。

- [shogo82148/actions-setup-aws-emulator](https://github.com/shogo82148/actions-setup-aws-emulator/)

## 使い方

GitHub Action を呼び出すだけです。

```yaml
on:
  push:

steps:
  - uses: shogo82148/actions-setup-aws-emulator@v0
  - run: aws sts get-caller-identity
```

テレメトリーはデフォルトで有効になっています。気になる人は明示的にオフにしてください。

```yaml
on:
  push:

steps:
  - uses: shogo82148/actions-setup-aws-emulator@v0
    with:
      telemetry: "off"
  - run: aws sts get-caller-identity
```

実際に使用する際は、CIが予期せず壊れないよう、バージョンを固定するのが望ましいでしょう。

```yaml
on:
  push:

steps:
  - uses: shogo82148/actions-setup-aws-emulator@v0
    with:
      aws-emulator-version: "1.0.508" # 2026-11-18 21:56 現在最新のバージョンを使用
      telemetry: "off"
  - run: aws sts get-caller-identity
```

## 余談

[GitHub Actionsのマーケットプレイス](https://github.com/marketplace?type=actions)に「Setup AWS Emulator」の名前で出そうと思ったら、もうすでに取られていた・・・。

- [Setup AWS Emulator](https://github.com/marketplace/actions/setup-aws-emulator)

みんな考えることは一緒。
なんか代わりのいい名前募集してます。

## まとめ

[AWS Emulator](https://github.com/aws/aws-emulator)をGitHub Actionsで使用するために、
セットアップをしてくれるGitHub Actionを書きました。

- [shogo82148/actions-setup-aws-emulator](https://github.com/shogo82148/actions-setup-aws-emulator/)

ぜひご利用ください。

## 参考

- [AWS Emulator](https://github.com/aws/aws-emulator)
- [AWS Emulator を使用してローカルで AWS に対してアプリケーションをテストする](https://aws.amazon.com/jp/blogs/news/test-your-applications-against-aws-locally-with-aws-emulator/)
- [shogo82148/actions-setup-aws-emulator](https://github.com/shogo82148/actions-setup-aws-emulator/)
