---
layout: post
title: "AWS SDK for Go v2にnot found ResolveEndpointV2と起こられたときの解決策"
slug: 2024-01-11-not-found-resolve-endpoint-v2
date: 2024-01-11 15:05:00 +0900
comments: true
categories: [go, golang, aws]
---

AWS SDK for Go v2を使っているプロジェクトで、以下のようなエラーが発生しました。

```json
{"time":"2024-01-09T06:45:00.239872","level":"fatal","message":"not found, ResolveEndpointV2"}
```

## 解決策

[github.com/aws/aws-sdk-go-v2](https://github.com/aws/aws-sdk-go-v2) 名前空間の下にあるモジュールをすべて最新版にアップデートしましょう。

```shell
go get -u "github.com/aws/aws-sdk-go-v2/..."
```

## 原因

[AWS SDK for Go v2 v1.23.0 (2023-11-15)](https://github.com/aws/aws-sdk-go-v2/releases/tag/release-2023-11-15) で入った以下の変更が原因です。

> **Feature: BREAKING CHANGE**: V2 endpoint resolution middleware has changed steps from Serialize to Finalize. Middleware that indexes off of this field will need to be updated accordingly.
>
> **特徴: 重大な変更**: V2エンドポイント解決ミドルウェアは、SerializeからFinalizeへのステップが変更されました。このフィールドをベースにインデックスを付けるミドルウェアは、それに応じて更新する必要があります。（ChatGPTによる和訳）

なんでこんなひどいことするの 😭（1年3か月ぶり、2回目）

前回壊れたとき（参考：[AWS SDK v2 for Goが壊れた、Googleお前もか](https://shogo82148.github.io/blog/2022/09/20/2022-09-20-aws-sdk-v2-and-googleapi-break-my-code/)）はコンパイルエラーで気がつけたのですが、今回のエラーは実行してみないとわかりません。
マイナーアップデートで入れるのはやめてくれ・・・。

## 参考

- [Release (2023-11-15)](https://github.com/aws/aws-sdk-go-v2/releases/tag/release-2023-11-15)
- [[SOLUTION IN THREAD] "not found, ResolveEndpointV2" service modules released on or after 11/15/23 are incompatible against previous runtimes (and vice versa) #2370](https://github.com/aws/aws-sdk-go-v2/issues/2370)
- [SOLUTIONが書かれたコメント](https://github.com/aws/aws-sdk-go-v2/issues/2370#issuecomment-1814903382)
- [AWS SDK v2 for Goが壊れた、Googleお前もか](https://shogo82148.github.io/blog/2022/09/20/2022-09-20-aws-sdk-v2-and-googleapi-break-my-code/)
