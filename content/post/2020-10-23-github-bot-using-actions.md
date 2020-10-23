---
layout: post
title: "GitHub Actions を使って簡単なボットを作る"
slug: github-bot-using-actions
date: 2020-10-23 22:03:00 +0900
comments: true
categories: [github]
---

リリース当初は `git push` など GitHub 上のイベントしかトリガーにできなかった [GitHub Actions](https://github.com/features/actions)ですが、
[workflow_dispatch イベント](https://docs.github.com/en/free-pro-team@latest/actions/reference/events-that-trigger-workflows#workflow_dispatch) の登場により手動実行ができるようになりました。

社内でもこの機能を利用してワークフローの手動実行をしていたのですが、人間とは欲深いもので「毎回ワークフローを選択してポチポチするのだるい」という声があがってきました。
そういうわけで、Pull Request のコメントをトリガーにしてワークフローを実行する簡単なボットを作ってみました。


## 要件

`workflow_dispatch` と `issue_comment` をトリガーにしたワークフローを作ればいいだけの気もしますが、
以下のような理由からワークフローからワークフローを呼び出す形にしました。

- `workflow_dispatch` を使った既存のワークフローがあるので、それを流用したい
  - トリガーとなったイベントに応じて、ペイロードの形式が異なるので、地味に処理が大変
  - `issue_comment` は全部のコメントに反応するので、ログが埋もれてしまう
- コメントを投稿した Pull Request のHEADでワークフローを実行して欲しい
  - `issue_comment` はイベントの発生元として、デフォルトブランチのHEADが渡ってきます
  - イベントのペイロードには、プルリクエストへのリンクが入っているだけで、HEADの情報はわからない


## 実装

[jfurudo1](https://github.com/jfurudo1) がサードパーティのアクションを使ってゴニョゴニョやっていたものの、
あんまりうまく行ってなさそうだったので、bash script でエイヤッと書き直しました。

「`build`」 とコメントすると、`.github/workflows/build.yml` のワークフローを実行するサンプルです。

```yaml
name: comment hook

on:
  issue_comment:
    types: [created]

jobs:
  distribute:
    runs-on: ubuntu-latest
    steps:
      - name: dispatch workflow
        run: |
          # イベントに関する詳細情報を取ってくる
          PAYLOAD=$(cat "$GITHUB_EVENT_PATH")
          NUMBER=$(echo "$PAYLOAD" | jq -c '.issue.number')

          # Issue と Pull Request のコメントが混ざってくるので、Issueは無視する
          if [[ "$(echo "$PAYLOAD" | jq -c '.issue.pull_request')" = "null" ]]; then
            echo "It's not pull request. Skip it."
            exit 0
          fi

          # 前述の通り $PAYLOAD にはプルリクエストの詳細が入っていないので、GitHub CLIを使って詳細を取得
          PULL_REQUEST=$(gh api "repos/$GITHUB_REPOSITORY/pulls/$NUMBER")

          # jq でコメントの内容を取り出し、正規表現マッチ
          if [[ "$(echo "$PAYLOAD" | jq -c '.comment.body | test("build"; "i")')" = "true" ]]; then
            # レスポンスを返してあげる
            gh api "repos/$GITHUB_REPOSITORY/issues/$NUMBER/comments" -F "body=ビルドを実行します :rocket:"

            # ワークフロー呼び出し
            # Pull Request の .head.ref を渡してあげているのがポイント
            gh api "repos/$GITHUB_REPOSITORY/actions/workflows/build.yml/dispatches" -F "ref=$( echo "$PULL_REQUEST" | jq -r '.head.ref')"
          fi
        env:
          # 標準で渡ってくる secrets.GITHUB_TOKEN は他のワークフローを呼び出せないので、
          # コメント専用にトークンを発行する
          GITHUB_TOKEN: ${{ secrets.USERS_GITHUB_TOKEN }}
```

[GitHub CLI がGAになり](https://github.blog/2020-09-17-github-cli-1-0-is-now-available/) 程なくして GitHub Actions にも Pre Install されるようになったのでこれを使っています。
残念ながらIssueへの書き込み等は対応しておらず `gh api` を使ってほぼ生のAPIを叩くことになりますが、認証ヘッダーを環境変数から読み取ってくれる分 `curl` で頑張るよりは少し楽になりました。

- [gh api - Make an authenticated GitHub API request](https://cli.github.com/manual/gh_api)

ちなみに `gh api "repos/:owner/:repo"` のようにレポジトリ名を表すプレースホルダーが使えるのですが、上のワークフローでは使っていません。
代わりに `GITHUB_REPOSITORY` 環境変数を使っています。
なぜかというとレポジトリをクローンせずにYAMLファイルの中で完結しているので、GitHub CLI がレポジトリを特定できないんですね。
プレースホルダーを使ったほうが短くかけるし、手元でのデバッグもやりやすいので、使えると良かったんですけどね。


## まとめ

やはり頼れるのは jq と curl。あとついでに [GitHub CLI](https://cli.github.com/)

## 参考

- [jq 1.6 Manual](https://stedolan.github.io/jq/manual/v1.6/)
- [Using environment variables](https://help.github.com/en/actions/configuring-and-managing-workflows/using-environment-variables)
- [RE: Pull Request Title Injection とその対策](https://shogo82148.github.io/blog/2020/04/02/re-pull-request-title-injection/)
- [GitHub CLI](https://cli.github.com/)
- [gh api - Make an authenticated GitHub API request](https://cli.github.com/manual/gh_api)
- [GitHub CLI 1.0 is now available](https://github.blog/2020-09-17-github-cli-1-0-is-now-available/)
