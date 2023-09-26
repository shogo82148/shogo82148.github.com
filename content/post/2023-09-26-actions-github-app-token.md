---
layout: post
title: "actions-github-app-tokenの紹介"
slug: 2023-09-26-actions-github-app-token
date: 2023-09-26 23:30:00 +0900
comments: true
categories: [github, github-actions]
---

GitHub App Tokenを発行するための
[actions-github-app-token](https://github.com/shogo82148/actions-github-app-token)
という GitHub アクションを書きました。

実験的なアクションだったので、マーケットには公開していませんでした。
最近になって「安定して動作しているし、マーケットに公開するか！」という気持ちになったので、
改めてご紹介です。

## 背景

GitHub Actionsのワークフローから、GitHub APIを叩きたいこと、よくありますよね？

### GITHUB_TOKEN

そんなとき第一候補に挙がるのは `secrets.GITHUB_TOKEN` です。

- [Automatic token authentication](https://docs.github.com/en/actions/security-guides/automatic-token-authentication)

特段複雑な設定をせずとも使えるのでお手軽です。
しかし、 `secrets.GITHUB_TOKEN` には大きな制限があります。
それは「他のGitHub Actions Workflowを起動できない」ということ。
これは無限ループで大量のジョブが投入されるのを防ぐための制限です。
理由もはっきりしていて妥当な制限だとは思うのですが、
必要なワークフローが起動しなくて困ることがときどきあります。

### PAT (Personal Access Token) (Classic)

「他のGitHub Actions Workflowを起動できない」制限を回避する簡単な方法は、
Personal Access Token を使うことです。
このトークンにはこの制限はありません。

ただし、トークンを発行したユーザーの権限でAPIを叩くので、権限の範囲が広すぎる、という問題があります。
実行できるアクションは制限できるのですが、レポジトリの範囲までは調整できません。

また、トークンは「ユーザー」に紐づきます。
個人のレポジトリならまだいいんですが、Organization管理のレポジトリ困ることがあります。
一番のあるあるは「トークンを発行したユーザーがOrganizationを抜けるとワークフローが止まる」ですかね。
属人化が進み、健全とは言い難い状態です。

### fine-grained personal access tokens

「権限の範囲が広すぎる」問題を解決するのが
fine-grained personal access tokens です。
レポジトリ単位でアクセス権を設定できます。

しかし、権限の広さは解決しますが、「トークンがユーザーに紐づいていることの弊害」は解消しません。

また、fine-grained personal access tokensは有効期限の設定が必須です。
管理するレポジトリの数が多いと、トークン更新行脚をする必要があります。

### GitHub Apps

ここで本命、 [GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/about-creating-github-apps) の出番です。

権限の範囲は細かく設定ができますし、GitHub AppsはOrganizationと紐づくので属人化の心配もありません。
発行されるキーは無期限です。

## actions-github-app-token

GitHub Actions から GitHub Apps を簡単に使えるようにしたのが [actions-github-app-token](https://github.com/shogo82148/actions-github-app-token) です。

### GitHub Apps をインストールする

自分のユーザーもしくはOrganizationに GitHub Apps をインストールします。

- [shogo82148-slim](https://github.com/apps/shogo82148-slim)

### ワークフローにアクションを追加する

最小限のワークフローは以下のようになります。

```yaml
jobs:
  job:
    runs-on: ubuntu-latest
    # use GitHub Actions OIDC Token
    permissions:
      id-token: write
      contents: read

    steps:
      - id: generate
        uses: shogo82148/actions-github-app-token@v1
      - run: |
          gh issue create --title "Do something using GITHUB_TOKEN"
        env:
          GH_TOKEN: ${{ steps.generate.outputs.token }}
```

ポイントは `id-token` へのアクセス許可を与えている点ですね。
トークン発行が完了すれば `${{ steps.generate.outputs.token }}` で参照できます。

## 仕組み

仕組みは「[AWS_SECRET_ACCESS_KEY を GitHub Actions secrets へ突っ込むのに疲れた俺達は ](https://shogo82148.github.io/blog/2021/03/24/actions-aws-assume-role/)」と大体一緒です。

![actions-github-app-tokenの仕組み](/images/2023-09-26-actions-github-app-token.svg)

1. アクションが実行されると API Gateway へ AWS のクレデンシャルのリクエストを投げます。 このとき認証用にOIDC id tokenを一緒に送ります
2. GitHub Apps用の秘密鍵で署名を作成します。
3. GitHub に JWT 付きのリクエストを送ります。
4. 有効期限の設定された、一時トークンが返却されます。

## セキュリティへの考慮

GitHub Apps用の秘密鍵をAWSに置いているのがポイントです。
秘密鍵は有効期限は長く、厳重に管理する必要があります。
AWSであれば安心です。

## まとめ

GitHub App Tokenを発行するための
[actions-github-app-token](https://github.com/shogo82148/actions-github-app-token)
という GitHub アクションを書きました。

みんな使ってね。

## 参考

- [actions-github-app-token](https://github.com/shogo82148/actions-github-app-token)
- [Automatic token authentication](https://docs.github.com/en/actions/security-guides/automatic-token-authentication)
- [Managing your personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [About creating GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/about-creating-github-apps)
