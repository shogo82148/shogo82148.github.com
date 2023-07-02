---
layout: post
title: "dependabotの更新グループ化機能を使ってAWS SDK for Go v2をアップデートする"
slug: 2023-07-02-update-aws-sdk-v2-with-grouped-version-updates-for-dependabot
date: 2023-07-02 11:45:00 +0900
comments: true
categories: [github]
---

dependabot の更新グループ化（Grouped version updates）機能がパブリックベータになりました。

- [Grouped version updates for Dependabot public beta](https://github.blog/changelog/2023-06-30-grouped-version-updates-for-dependabot-public-beta/)

[AWS SDK for Go v2](https://github.com/aws/aws-sdk-go-v2)の更新設定をしてみたのでメモ。

## 設定内容

グループ化したい依存を`groups`に設定します。
[AWS SDK for Go v2](https://github.com/aws/aws-sdk-go-v2)関連のバージョンアップを、`aws-sdk`という名前でプルリクエストを出すよう設定しました。

```yaml
updates:
  - package-ecosystem: gomod
    directory: "/"
    schedule:
      interval: daily
    groups:
      # AWS SDK for Go v2 関連のバージョンアップをまとめる
      aws-sdk:
        patterns:
          - github.com/aws/aws-sdk-go-v2 # `*` が空文字にマッチするのかよく分からなかったので・・・
          - github.com/aws/aws-sdk-go-v2/*
```

## AWS SDK for Go v2 アップデートの困りごと

AWS ではたくさんのサービスが公開されているので、毎日のようにサービスのアップデートが入り、
それに合わせて AWS SDK の更新が入ります。
dependabot のような自動アップデートの仕組みを入れておくと、本当に毎日のようにプルリクエストが来るのでとても大変です。
しかし、実際使う AWS のサービスなんて、全体に比べればほんの一部です。
ほとんどが自分の使っているサービスとは無関係な更新で、dependabot が送ってくるプルリクエストのほとんどはムダなものです。

AWS SDK for Go は v2 からマルチモジュール構成になり、サービス毎に `go.mod` が設定されるようになりました。
これにより、依存しているサービスを `go.mod` に明記できるので、
実際に依存しているサービスをもとに AWS SDK のアップデートを行えるようになりました。

問題はサービス間にも依存関係があり、毎回複数のモジュールを更新するハメになること！
たとえば「[feature/s3/manager](https://pkg.go.dev/github.com/aws/aws-sdk-go-v2/feature/s3/manager) を使って S3 にファイルをアップロードしたい」といった機能を実装する場合、
以下のモジュールが必要です。

- [github.com/aws/aws-sdk-go-v2/feature/s3/manager](https://pkg.go.dev/github.com/aws/aws-sdk-go-v2/feature/s3/manager)
- [github.com/aws/aws-sdk-go-v2/service/s3](https://github.com/aws/aws-sdk-go-v2/service/s3)
- [github.com/aws/aws-sdk-go-v2/config](https://github.com/aws/aws-sdk-go-v2/config)
- [github.com/aws/aws-sdk-go-v2](https://github.com/aws/aws-sdk-go-v2)

dependabot は各モジュール 1 つずつプルリクエストを作りので、最大で 4 つのプルリクエストが押し寄せてきます。
しかも一個マージすると、十中八九他のプルリクエストとコンフリクト →dependabot の rebase を待つ → テストが通るのを待つ、というフローが発生します。
まあ自分はただ待ってるだけなんですが・・・rebase 前のテストの結果は結局捨てるので、CI の時間もったいないですよね。

そういうわけで、AWS SDK for Go v2 関連のプルリクエストが 1 つにまとまってくれると、見るべきプルリクエストの個数が減ってうれしいわけです。

## まとめ

[AWS SDK for Go v2](https://github.com/aws/aws-sdk-go-v2)関連のバージョンアップを、`aws-sdk`という名前でプルリクエストを出すよう設定しました。
まだアップデート来てないので本当に動くのかよくわかってないですが・・・動くといいな。

---

グループ化機能、[renovate](https://github.com/renovatebot/renovate) では昔からある機能なので、さっさと移行しておけばよかった説はある。
でも設定ファイル書くの大変そうだな・・・（ref. [はてなで使用している Renovate の設定プリセットを公開しました](https://developer.hatenastaff.com/entry/2020/06/19/113030)）と食わず嫌いをしている状態。
結局 dependabot でも設定ファイルの調整は必要で、どうしようか、と迷っている感じです。

## 参考

- [Grouped version updates for Dependabot public beta](https://github.blog/changelog/2023-06-30-grouped-version-updates-for-dependabot-public-beta/)
- [AWS SDK for Go v2](https://github.com/aws/aws-sdk-go-v2)
- [renovate](https://github.com/renovatebot/renovate)
- [はてなで使用している Renovate の設定プリセットを公開しました](https://developer.hatenastaff.com/entry/2020/06/19/113030)
