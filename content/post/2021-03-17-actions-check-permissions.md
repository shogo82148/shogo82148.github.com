---
layout: post
title: "Dependabot が起動する GitHub Actions Workflow から write 権限が無くなった件"
slug: actions-check-permissions
date: 2021-03-17 19:14:00 +0900
comments: true
categories: [github]
---

[Dependabot](https://dependabot.com/) から送られてくるプルリクエストのテストが最近良くコケるようになったなあと思ったら、
3 月 1 日から GitHub Actions Workflow 内の `GITHUB_TOKEN` のパーミッションが変更になったそうです。

- [GitHub Actions: Workflows triggered by Dependabot PRs will run with read-only permissions](https://github.blog/changelog/2021-02-19-github-actions-workflows-triggered-by-dependabot-prs-will-run-with-read-only-permissions/)

更新されたパッケージに secrets を盗み見るような危険なコードが含まれているかもしれません。
そのようなコードでも安全に実行できるよう read-only のパーミッションで実行されるようになりました。

その結果以下のようなワークフローが失敗するようになってしまいました。

- プルリクエストにラベルをつけるような、レポジトリに対して write パーミッションが必要なワークフロー
- 外部サービスとのインテグレーションテストをやっていて、連携のためにシークレットを読む必要があるワークフロー

## 対応

[pull_request_target](https://docs.github.com/en/actions/reference/events-that-trigger-workflows#pull_request_target) トリガーを使うと、
フォークされたレポジトリからのプルリクエストも、Dependabot からのプルリクエストも、 write 権限がついた状態で実行されます。
プルリクエストにラベルをつけるようなワークフローはこれで十分です。

問題はインテグレーションテストのためのワークフローです。
シークレットへのアクセスをともなうので、内容を確認してからインテグレーションテストを実行する必要があります。
これに関しては Dependabot によってトリガーされたワークフローを re-run したら write パーミッションで走り出した (2021-03-17 現在) ので、面倒だけどまあ毎回 re-run するか・・・と現状なってます。
(そもそもこれって意図した挙動なんだろうか？)

もっといい解決方法をご存じの方は教えて下さい。

## GITHUB_TOKEN のパーミッション判定の難しさ

さて、失敗するとわかっているインテグレーションテストを実行する意味はないので、 read-only パーミッションで実行されていることを早い段階で検知してワークフローを即失敗させたいですよね。

しかし、今回のこの変更により `GITHUB_TOKEN` のパーミッションが read/write なのか read-only なのか区別することが非常に難しくなりました。
今までは「フォークされたレポジトリからのプルリクエストか？」で判定できたものが、「Dependabot から送られてきたプルリクエストか？」という条件が加わり、
さらに 「Dependabot から送られてきたプルリクエストを re-run したか？」という判定の難しい条件が加わります。

また、プルリクエストに「@dependabot merge」と書き込むと Dependabot がマージまでやってくれるんですが、
このとき push イベントによってトリガーされるワークフローは read-only で実行されるようです。
さらにややこしいことに、このワークフローも re-run すると write パーミッションがついた状態で実行されます (2021-03-17 現在)。

## パーミッションを判定するアクションを書いてみた

これはもうイベントの種類からパーミッションを判定するのは不可能だ・・・ということで `GITHUB_TOKEN` を使って API を叩くことで直接的にパーミッションの判定を行うアクションを書いてみました。

- [shogo82148/actions-check-permissions](https://github.com/shogo82148/actions-check-permissions)

シークレットの読み出しチャレンジという手もありますが、それだと毎度シークレットの設定する事前準備が必要です。
そのような事前準備はなるべく少ないほうがいいなと考えこの方法をとりました。
判定にはレポジトリへの書き込みを行う必要があるのですが、下手な書き込み操作でレポジトリを壊したら意味がありません。
一番無難なのはなんだろう・・・と考えて [POST /repos/{owner}/{repo}/git/blobs](https://docs.github.com/en/rest/reference/git#create-a-blob) にしました。

```bash
curl \
  -X POST \
  -H "Accept: application/vnd.github.v3+json" -H "Authorization: Bearer $GITHUB_TOKEN" \
  "https://api.github.com/repos/shogo82148/actions-check-permissions/git/blobs" \
  -d '{"content":""}'
```

空の Blob 追加を試みます。この API の成功・失敗で `GITHUB_TOKEN` のパーミッションを判定します。
どこからも参照されないので、仮に成功してしまっても(たぶん)無害です。

このアクションを実行すると `GITHUB_TOKEN` に書き込み権限があるか否かを出力してくれます。

```yaml
name: test
on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - id: check
        uses: shogo82148/actions-check-permissions@v1

      - name: show the result
        run: |
          echo ${{ steps.check.outputs.permission }} # read or write
```

## まとめ

- Dependabot によってトリガーが起動する GitHub Actions Workflow から write 権限がなくなりました
  - プルリクエストを作ったときに実行されるワークフローが read-only 権限なります
  - ドキュメントには書いてないけどおもしろい挙動をする (2021-03-17 現在)
    - 上記ワークフローを re-run すると write パーミッションがついて実行される
    - 「@dependabot merge」でマージした場合、push イベントでトリガーされたワークフローも read-only になる
    - re-run すると write パーミッションがつく
  - 意図したものなのかは不明・・・
- `GITHUB_TOKEN` のパーミッションを判定するアクションを書いてみた
  - [shogo82148/actions-check-permissions](https://github.com/shogo82148/actions-check-permissions)

## 参考

- [GitHub Actions: Workflows triggered by Dependabot PRs will run with read-only permissions](https://github.blog/changelog/2021-02-19-github-actions-workflows-triggered-by-dependabot-prs-will-run-with-read-only-permissions/)
- [Keeping your GitHub Actions and workflows secure: Preventing pwn requests](https://securitylab.github.com/research/github-actions-preventing-pwn-requests)
- [pull_request_target - Events that trigger workflows](https://docs.github.com/en/actions/reference/events-that-trigger-workflows#pull_request_target)
- [GitHub REST API](https://docs.github.com/en/rest)
