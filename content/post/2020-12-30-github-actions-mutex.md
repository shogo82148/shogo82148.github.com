---
layout: post
title: "排他制御を行う GitHub Action を作った"
slug: github-actions-mutex
date: 2020-12-30 00:00:00 +0900
comments: true
categories: [github]
---

弊社では GitHub のレポジトリ管理に [Terraform GitHub provider](https://github.com/terraform-providers/terraform-provider-github) を使用しています。
いちいち手元で `terraform plan` や `terraform apply` を叩くのは面倒なので、
GitHub Actions を利用することを考えました。
tf ファイルと現実のリソースとの不整合を避けるために、 これらのコマンドは排他的に実行する必要があります。
例えば `terraform apply` を実行している最中に `terraform plan` を実行することはできません。

ここで問題になってくるのが GitHub Actions のジョブ並列数です。
2020-12-30 現在、GitHub Actions は同時に 20 並列まで実行可能ですが、逆に並列数を制限できないという贅沢な悩みがあります。
一応 Matrix Build の並列数を制限するオプションはありますが、
ワークフローをまたいだ並列数の制限はできません。

これを解決するために作ったのが [actions-mutex](https://github.com/marketplace/actions/actions-mutex) です。

- [shogo82148/actions-mutex](https://github.com/shogo82148/actions-mutex)
- [actions-mutex Marketplace](https://github.com/marketplace/actions/actions-mutex)

## 使い方

ただワークフローから `uses` を使って呼び出すだけ。
面倒なアクセスキーの設定等は必要ありません。簡単ですね。

```yaml
on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: shogo82148/actions-mutex@v1
      - run: ": 排他的に実行する必要のあるタスク"
```

## 仕組み

actions-mutex と同様のことを実現する Action として [GitHub Action Locks](https://github.com/abatilo/github-action-locks) があります。
これの使用も考えたのですが、GitHub Action Locks はバックエンドに AWS DynamoDB を使用しています。
DynamoDB のテーブルを作成した上で AWS IAM を適切に設定する必要があり、セットアップが面倒です (まあ単に DynamoDB 食わず嫌いしているだけ、というのもあります)。

もうちょっとお手軽に実現できないか、と考えてできたのが actions-mutex です。

排他制御を実現するには「現在ジョブが実行されているか」を保存するために、何らかのデータストアが必要です。
しかも「ジョブの実行状況を取得する処理」と「ジョブが実行中であることを書き込む処理」をアトミックに実行できる必要があります。
これらの処理ができて、GitHub Actions からお手軽にアクセスできるデータストア・・・
そう、 **Git** ですね！

管理しているソースコードに不整合が起きないよう、Git にはロックを獲る仕組みが組み込まれています。
これを利用して actions-mutex では「現在ジョブが実行されているか」を「特定の名前のブランチが存在するか」で表すことにしました。

そうすると「ジョブが実行中であることを書き込む処理」は「テキトーなコミットを作成して、特定の名前のブランチに PUSH する処理」
に置き換えることができます。

```
$ echo "$RANDOM" > lock.txt
$ git add lock.txt
$ git commit -m 'テキトーなコミット'
$ git push origin HEAD:actions-mutex-lock/lock
To https://github.com/shogo82148/actions-mutex
 * [new branch]      HEAD -> actions-mutex-lock/lock
```

すでにブランチが存在していれば、 Git がこの処理を reject してくれます。
レポジトリの整合性を保つために、Git は「ブランチの存在確認」と「ブランチの作成」をアトミックに実行します。
この性質により「ジョブの実行状況を取得する処理」と「ジョブが実行中であることを書き込む処理」がアトミックに実行されると
保証できるわけです。

```
$ echo "$RANDOM" > lock.txt
$ git add lock.txt
$ git commit -m 'テキトーなコミット'
$ git push origin HEAD:actions-mutex-lock/lock
To https://github.com/shogo82148/actions-mutex
 ! [rejected]        HEAD -> actions-mutex-lock/lock (fetch first)
error: failed to push some refs to 'https://github.com/shogo82148/actions-mutex'
hint: Updates were rejected because the remote contains work that you do
hint: not have locally. This is usually caused by another repository pushing
hint: to the same ref. You may want to first integrate the remote changes
hint: (e.g., 'git pull ...') before pushing again.
hint: See the 'Note about fast-forwards' in 'git push --help' for details.
```

一番面倒なところは Git がやってくれるので、あとは
リモートレポジトリへの書き込み権限を設定するのと、
テキトーな間隔でポーリングする処理を追加するだけです。

## 制限

リモートレポジトリに新しいブランチを作成する都合上、リモートレポジトリへの書き込み権限が必要です。
他人からのプルリクエストをトリガーにした場合、
GitHub Actions で自動的に払い出される GitHub Token に書き込み権限が付与されないので、
実行に失敗します。

DynamoDB をバックエンドにしている [GitHub Action Locks](https://github.com/abatilo/github-action-locks) も
AWS のアクセスキーを Secrets から読む必要があるので、
他人からプルリクエストをトリガーにした場合に動きません。

サードパーティの Actions ではここらへんが限界なので、
公式サポートを期待したいところです。

## 応用

ロックの獲得に使用する GitHub Token とレポジトリは、オプションで上書き可能です。
自分で発行した GitHub Token と、ロック専用のレポジトリを用意すれば、レポジトリをまたいだ排他制御も可能です。

```yaml
on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: shogo82148/actions-mutex@v1
        with:
          token: ${{ secrets.PERSONAL_GITHUB_TOKEN }}
          repository: shogo82148/shogo82148
      - run: ": レポジトリ間で排他制御が必要なタスク"
```

## まとめ

Git レポジトリをバックエンドに使用して、 ワークフローをまたいで並列数を制限する GitHub Action を作りました。

- [shogo82148/actions-mutex](https://github.com/shogo82148/actions-mutex)
- [actions-mutex Marketplace](https://github.com/marketplace/actions/actions-mutex)

Terraform の話はどこ行ったかって？

・・・来年から本気出す。
