---
layout: post
title: "Dependabotの設定リンター dependalint を作った"
slug: dependalint-dependabot-configure-linter
date: 2026-09-11 14:38:00 +0900
comments: true
categories: [github, github-actions]
---

## 背景・目的

[Dependabot](https://github.com/dependabot) はレポジトリーが依存しているライブラリーの更新をチェックしてくれるツールです。
GitHub の公式ツールとして提供されており、導入も `.github/dependabot.yml` を設置するだけ、と簡単なのでよく使ってます。

`.github/dependabot.yml` を設置するだけなんですが、それでも設定内容をミスってしまうのが人間というもの。
main ブランチへの `.github/dependabot.yml` のコミットで設定ファイルのバリデーションが走るのですが、そこではじめてミスに気がつくということが多々ありました。
プルリクエストの時点で気がつけるといいのですが、なぜかプルリクエストでは `.github/dependabot.yml` のバリデーションは走りません。

僕と同じ悩みを持つ人は他にもいるらしく、Issueも起票されているのですが、あまり動きはありません。

- [Make it possible to validate Dependabot config before it lands on main #4605](https://github.com/dependabot/dependabot-core/issues/4605)

今の時代AIでなんとでもなるだろと、
Codex先生に「[ドキュメント](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)を読んでリンターを実装して」とお願いしたらものの5分で作ってくれました。

- [shogo82148/dependalint](https://github.com/shogo82148/dependalint)

## 使い方

Goで実装してあるので `go install` でインストールできます。

```shell
go install github.com/shogo82148/dependalint/cmd/dependalint@latest
```

コマンドを叩くと `dependabot.yml` の内容をバリデーションしてくれます。

```shell
dependalint
```

何も出力がなければOKです。
問題があるとエラーのあった場所を教えてくれます。

たとえば以下のような問題だらけの設定ファイルを渡すと、

```yaml
# Test configuration for dependalint

version: 2
updates:
  - package-ecosystem: "unknown" # そんな名前のエコシステムは存在しない
    directory: "/not-found" # 対象となるディレクトリーが存在しない
    schedule:
      interval: "invalid" # 不正なインターバル
```

以下のような出力が得られます。

```plain
testdata/dependabot.yaml:5:24: updates[0].package-ecosystem: unsupported ecosystem "unknown"
testdata/dependabot.yaml:6:16: updates[0].directory: directory does not exist
testdata/dependabot.yaml:8:17: updates[0].schedule.interval: must be one of cron, daily, monthly, quarterly, semiannually, weekly, yearly
```

## GitHub Action

CIに簡単に組み込めるよう GitHub Action も用意しました。

- [shogo82148/actions-dependalint](https://github.com/shogo82148/actions-dependalint)

`.github/workflows/dependalint.yml` に以下のワークフローを追加するだけで使えます。

```yaml
# .github/workflows/dependalint.yml

name: reviewdog
on:
  push:
    paths:
      - .github/dependabot.yml
      - .github/workflows/dependalint.yml
  pull_request:
    paths:
      - .github/dependabot.yml
      - .github/workflows/dependalint.yml

  dependalint:
    name: runner / dependalint
    runs-on: ubuntu-slim
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: shogo82148/actions-dependalint@v0
        with:
          reporter: github-check
```

## 余談

`dependabot.yml` ではDependabotが何時に更新チェックするかを指定できます。
たとえば「毎朝9時」のような設定が可能です。
どんな記法が使えるかドキュメントを見てみましょう。

> Supported values: Valid cron expression in cron syntax or natural expression.
>
> <https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#cronjob>

cron expression は知ってるが・・・**natural expression???**

そう、自然言語で指定ができるのです！
「毎朝9時」なら `every day at 9am` みたいな感じで指定できます。

裏では [floraison/fugit](https://github.com/floraison/fugit) というライブラリーを使っているらしく、他にも以下のような記法が使えます（Codex先生調べ）。

- 定型スケジュール: `@daily`, `@weekly`, `@monthly`, `@yearly`, `@midnight`, `@noon`
- 毎月末: `0 0 L * *`, `0 0 last * *`
- 月末7日前から月末: `0 0 -7-L * *`
- 第1月曜日: `0 5 * * mon#1`
- 最終金曜日: `0 7 * * fri#L`, `0 7 * * fri#-1`
- 隔週日曜日: `0 9 * * sun%2`
- 隔週日曜日（オフセット）: `0 9 * * sun%2+1`
- 毎日12時台のランダムな分: `~ 12 * * *`
- 毎日5時: `every day at five`
- 毎週水曜日17時: `every wed at 5 pm`
- 月・火曜日17時: `every tuesday and monday at 5pm`

（もちろん実際に `dependabot.yml` に指定してみて裏は取った。）
仕事で使っているレポジトリーだと、第1月曜日（`0 5 * * mon#1`）とか最終金曜日（`0 7 * * fri#L`）とかの指定は便利かもしれないですね。

undocumentedな挙動なので拒否しようかとも思いましたが、[拡張cron記法をすでに使っている人もいる](https://github.com/dependabot/dependabot-core/issues/12246)そうだしサポートすることにしました。
おかげでバリデーションのための正規表現がすごいことになったけど、AIと一緒ならへっちゃらです。たぶん。

## まとめ

Dependabotの設定ファイルのリンターを作りました。

- [shogo82148/dependalint](https://github.com/shogo82148/dependalint)
- [shogo82148/actions-dependalint](https://github.com/shogo82148/actions-dependalint)

`dependabot.yml` の設定ミスでお悩みの方はぜひご利用ください。

## 参考

- [Dependabot](https://github.com/dependabot)
- [Make it possible to validate Dependabot config before it lands on main #4605](https://github.com/dependabot/dependabot-core/issues/4605)
- [Support bi-weekly intervals in cron interval expressions #12246](https://github.com/dependabot/dependabot-core/issues/12246)
- [Dependabot options reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)
- [shogo82148/dependalint](https://github.com/shogo82148/dependalint)
- [shogo82148/actions-dependalint](https://github.com/shogo82148/actions-dependalint)
- [floraison/fugit](https://github.com/floraison/fugit)
