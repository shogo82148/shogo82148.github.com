---
layout: post
title: "Slack Incoming Webhook を GitHub Actions Secrets へ突っ込むのに疲れた俺達は"
slug: 2023-10-01-github-actions-notify-slack
date: 2023-10-01 00:05:00 +0900
comments: true
categories: [github, github-actions, slack]
---

GitHub ActionsからSlackへ通知したいとき、一番お手軽なのはSlack Incoming Webhookです。
直接curlで叩いてもいいですし、マーケットプレイスにも通知用のアクションがたくさんあります。

しかし、Incoming Webhookは一般公開してはいけないシークレットです。
迂闊にレポジトリにコミットしてはいけません。
GitHub Actions Secrets へ突っ込む等して、適切に管理する必要があります。
一個や二個ならまだしも、いくつもレポジトリがあると管理が大変です。

そういうわけで、OIDCを使ってSlackへの通知を行うアクションを書きました。

- [actions-notify-slack](https://github.com/shogo82148/actions-notify-slack)

## 使い方

1. [gha-notify.shogo82148.com](https://gha-notify.shogo82148.com/) へアクセスします。
2. 「Add to Slack」をクリックして、アプリをSlackにインストールします。
3. @actions-notify-slack というボットが追加されるので、こいつを通知を流したいチャンネルに招待します。
4. 投稿先のチャンネルで `/gha-notify allow ORG/REPO` スラッシュコマンドを実行します。これにより `ORG/REPO` からの投稿が許可されます。
5. ワークフローにアクションを追加して完成！　

```yaml
- uses: shogo82148/actions-notify-slack@v0
  with:
    team-id: T3G1HAY66 # 自分のチームIDに置き換え
    channel-id: C3GMGG162 # 自分のチャンネルIDに置き換え
    payload: '{"text": "hello world"}'
```

## 仕組み

早い話が、過去 GitHub や AWS 向けに作ったアクションを Slack 向けに焼き直したものです。

- [actions-github-app-tokenの紹介](https://shogo82148.github.io/blog/2023/09/26/2023-09-26-actions-github-app-token/)
- [AWS_SECRET_ACCESS_KEY を GitHub Actions secrets へ突っ込むのに疲れた俺達は](https://shogo82148.github.io/blog/2021/03/24/actions-aws-assume-role/)

GitHub Actions は直接 Slack とやり取りするかわりに、中継サーバーにリクエストを投げます。
中継サーバーは、OIDC ID Tokenを検証し、Slackへの投稿権限をチェックします。
権限を確認できたら、ボットユーザーとして投稿する、という流れです。

## セキュリティーへの考慮

### 短命トークンの使用

Slack Incoming Webhook の有効期限は無期限です。
明示的に無効化しない限りいつまででも使えます。
万が一流出してしまった場合、期限がないので影響が大きいです。

一方 [actions-notify-slack](https://github.com/shogo82148/actions-notify-slack) でやり取りするトークンには、
ほとんどのトークンに有効期限が設定されています。
GitHubの ID Token は 10 分で有効期限が切れますし、Slackへのアクセストークンは12時間で有効期限が切れます。
GitHub Actions の利用者が扱うトークンは短命なので、万が一流出してしまっても影響は小さくすみます。

### Slack App の Client Secret

唯一 Slack App の Client Secret には有効期限がありません。
でも安心してください。僕がしっかり管理・・・しま・・・す。

GitHub Actionsの利用者はセキュリティーのプロではありません。
全員が全員シークレットを正しく扱えるとは限りません。
それよりは、キチンと管理できる誰かにお任せしたほうが安全だろう、という考えです。
（僕がキチンと管理できるのか？という問題はおいておく）

### 第三者のサーバーを経由する問題

中継サーバーへ通知メッセージを送信する仕組み上、僕が通知内容を見ようと思えば、通信をフックして見ることができます。
もちろんそんなことはしませんが、信用するかはあなた次第です。
中継サーバーの実装も公開しているので、第三者のサーバーを経由することが気になる人は、自前でサーバーを立ててください。

## まとめ

OIDCを使ってSlackへの通知を行うアクションを書きました。

- [actions-notify-slack](https://github.com/shogo82148/actions-notify-slack)

Slack App をインストールするだけで、Slackへの通知が簡単に行なえます。

-----

そろそろ利用規約でも書いたほうがいいのでは？という気もしてきた。

## 参考

- [actions-notify-slack](https://github.com/shogo82148/actions-notify-slack)
- [actions-github-app-tokenの紹介](https://shogo82148.github.io/blog/2023/09/26/2023-09-26-actions-github-app-token/)
- [AWS_SECRET_ACCESS_KEY を GitHub Actions secrets へ突っ込むのに疲れた俺達は](https://shogo82148.github.io/blog/2021/03/24/actions-aws-assume-role/)
