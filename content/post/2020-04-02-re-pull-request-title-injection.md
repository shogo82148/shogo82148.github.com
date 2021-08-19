---
layout: post
title: "RE: Pull Request Title Injection とその対策"
slug: re-pull-request-title-injection
date: 2020-04-02 06:37:00 +0900
comments: true
categories: [github]
---

[@furusax](https://twitter.com/furusax) が書いてくれた GitHub Action からの Slack 通知機能について以下のようにコメントしたところ、
対策案を考えてくれました。

> そういえばこれって Pull Request Title Injection できないですかね？ まあ、タイトル書くの社員なのでいいんですが。

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">対策してみました <a href="https://twitter.com/hashtag/%E3%81%AF%E3%81%A6%E3%81%AA%E3%83%96%E3%83%AD%E3%82%B0?src=hash&amp;ref_src=twsrc%5Etfw">#はてなブログ</a><br>Pull Request Title Injection とその対策 - なまえは まだ ない<a href="https://t.co/hIkMykFUr8">https://t.co/hIkMykFUr8</a></p>&mdash; ふるさっくす (@furusax) <a href="https://twitter.com/furusax/status/1244973005484118023?ref_src=twsrc%5Etfw">March 31, 2020</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

- [Pull Request Title Injection とその対策](https://furusax0621.hatenablog.com/entry/2020/03/31/220042)

なるほど、こう来ましたか。しかし、まだまだ甘いですね・・・。

## 2021-08-19 追記

[ドッグさん](https://twitter.com/Linda_pp) が便利なツールを作ってくれました。

- [rhysd/actionlint](https://github.com/rhysd/actionlint)
- [actionlint v1.4 → v1.6 で実装した新機能の紹介](https://rhysd.hatenablog.com/entry/2021/08/11/221044)

GitHub Actions のワークフローファイルの静的チェッカーです。
チェック項目にこの記事で紹介したような脆弱性検知も含まれているのでおすすめです！

## Pull Request Title Injection について

まずはこの記事に出てくる「Pull Request Title Injection」についておさらいです。
以下のような Slack への通知を行う GitHub Actions があります。
`github.event.pull_request.title` はプルリクエストを送った本人が自由に設定できるので、
ここにうまいこと細工をすれば Slack への投稿内容を自由に改変できてしまうのでは？という問いかけでした。

```yaml
jobs:
  notify:
    name: Slack Notification
    runs-on: ubuntu-latest
    steps:
      - name: "Send Notification"
        run: |
          jq -n '{
            attachments: [{
              pretext: "Swagger が更新されたよ！",
              color: "good",
              title: "${{ github.event.pull_request.title }}",
              title_link: "${{ github.event.pull_request.html_url }}"
            }]
          }' | curl -H 'Content-Type: application/json' -d @- ${{ secrets.SLACK_WEBHOOK }}
```

より正確には **「Pull Request Title を用いた Injection 攻撃」** と呼ぶべきでしょうか。

例えば、

> Test Pull Request Title Injection", footer: ":male-police-officer: Injection!! :male-police-officer:

のようなプルリクエストを送ると、以下のように展開され実行されてしまいます。
タイトルだけ設定したいのにフッターまで書き換わってしまいました。
もっと工夫をすれば通知内容を任意に設定したり、任意のコマンド実行することもできるでしょう。

```yaml
jobs:
  notify:
    name: Slack Notification
    runs-on: ubuntu-latest
    steps:
      - name: "Send Notification"
        run: |
          jq -n '{
            attachments: [{
              pretext: "Swagger が更新されたよ！",
              color: "good",
              title: "Test Pull Request Title Injection", footer: ":male-police-officer: Injection!! :male-police-officer:",
              title_link: "https://example.com/"
            }]
          }' | curl -H 'Content-Type: application/json' -d @- http://example.com/
```

Injection 攻撃とはいったものの、これ自体の危険度はあまり高くありません。
なぜなら `secrets.SLACK_WEBHOOK` にアクセスできる権限を持っている人は、
このワークフロー自体を書き換えることができる権限も持っているので、
ワークフローを書き換えたほうが手っ取り早いからです。

とはいえ、通常の Injection 攻撃と同様の構造をしているので、頭の体操にはぴったりですね。
ちょっと対策を考えてみましょう。

## toJSON 関数を用いた対策の問題点

Injection 対策の基本はサニタイズです。
プルリクエストのタイトルをサニタイズして、単なる文字列として扱われるようにしましょう。

[Pull Request Title Injection とその対策](https://furusax0621.hatenablog.com/entry/2020/03/31/220042)では、
`toJSON` を用いて以下のように書き換えています。

```yaml
jobs:
  notify:
    name: Slack Notification
    runs-on: ubuntu-latest
    steps:
      - name: "Send Notification"
        run: |
          jq -n '{
            attachments: [{
              pretext: "Swagger が更新されたよ！",
              color: "good",
              title: ${{ toJSON(github.event.pull_request.title) }},
              title_link: "${{ github.event.pull_request.html_url }}"
            }]
          }' | curl -H 'Content-Type: application/json' -d @- ${{ secrets.SLACK_WEBHOOK }}
```

ここにさっきのプルリクエストタイトルを入れてみましょう。

```yaml
jobs:
  notify:
    name: Slack Notification
    runs-on: ubuntu-latest
    steps:
      - name: "Send Notification"
        run: |
          jq -n '{
            attachments: [{
              pretext: "Swagger が更新されたよ！",
              color: "good",
              title: "Test Pull Request Title Injection\", footer: \":male-police-officer: Injection!! :male-police-officer:",
              title_link: "https://example.com/"
            }]
          }' | curl -H 'Content-Type: application/json' -d @- http://example.com/
```

ダブルクオーテーションがエスケープされて `jq` の文字列として解釈されるようになりました。
これならプルリクエストのタイトルが正しく title に設定されます。

---

しかし、ここに重要な見落としがありますね。
プルリクエストのタイトルは `jq` の式としてだけでなく、 **bash のコマンドの一部としても解釈** されるということを見落としています。

例えば以下のプルリクエストタイトルはどうでしょう？

> Test Pull Request Title Injection'",footer:"':male-police-officer: Injection!! :male-police-officer:

```yaml
jobs:
  notify:
    name: Slack Notification
    runs-on: ubuntu-latest
    steps:
      - name: "Send Notification"
        run: |
          jq -n '{
            attachments: [{
              pretext: "Swagger が更新されたよ！",
              color: "good",
              title: "Test Pull Request Title Injection'\",footer:\"':male-police-officer: Injection!! :male-police-officer:",
              title_link: "https://example.com/"
            }]
          }' | curl -H 'Content-Type: application/json' -d @- http://example.com/
```

ちょっと分かりづらいですが、 `\"` は `bash` によってエスケープが解除されてしまい、 Injection が成功してしまいます。
これではだめですね・・・。

## もうちょっとちゃんとした対策

間に `bash` が登場するとややこしいので、ワークフローから `jq` へ直接プルリクエストタイトルを渡す方法を考えましょう。

### 環境変数を使う

jq 1.6 から `env` を使って環境変数に直接アクセスできるようになりました。
これを使うと以下のようにシンプルに書けます。

```yaml
jobs:
  notify:
    name: Slack Notification
    runs-on: ubuntu-latest
    steps:
      - name: "Send Notification"
        run: |
          jq -n '{
            attachments: [{
              pretext: "Swagger が更新されたよ！",
              color: "good",
              title: env.TITLE,
              title_link: env.LINK
            }]
          }' | curl -H 'Content-Type: application/json' -d @- ${{ secrets.SLACK_WEBHOOK }}
        env:
          TITLE: ${{ github.event.pull_request.title }}
          LINK: ${{ github.event.pull_request.html_url }}
```

・・・と思ったんですが、 GitHub Actions にインストールされている jq は 1.5・・・
`env` は未実装です。

ちょっと冗長になりますが、 `--arg` オプションを使って同様のことができます。

```yaml
jobs:
  notify:
    name: Slack Notification
    runs-on: ubuntu-latest
    steps:
      - name: "Send Notification"
        run: |
          jq -n --arg title "$TITLE" --arg link "$LINK" '{
            attachments: [{
              pretext: "Swagger が更新されたよ！",
              color: "good",
              title: $title,
              title_link: $link
            }]
          }' | curl -H 'Content-Type: application/json' -d @- ${{ secrets.SLACK_WEBHOOK }}
        env:
          TITLE: ${{ github.event.pull_request.title }}
          LINK: ${{ github.event.pull_request.html_url }}
```

(早くデフォルト jq1.6 にならないかな)

### webhook payload を使う方法

次は JSON のまま扱う方法。

GitHub Action を実行するサーバー上には、ワークフローを起動したイベントに関する情報が入った JSON ファイルが置かれています。
場所は `GITHUB_EVENT_PATH` 環境変数に設定されているので、簡単にアクセスできます。
JSON の加工は `jq` の得意分野ですね。

```yaml
jobs:
  notify:
    name: Slack Notification
    runs-on: ubuntu-latest
    steps:
      - name: "Send Notification"
        run: |
          cat "$GITHUB_EVENT_PATH" | jq '{
            attachments: [{
              pretext: "Swagger が更新されたよ！",
              color: "good",
              title: .pull_request.title,
              title_link: .pull_request.html_url
            }]
          }' | curl -H 'Content-Type: application/json' -d @- ${{ secrets.SLACK_WEBHOOK }}
```

## まとめ

やはり頼れるのは jq と curl

## 参考

- [jq 1.6 Manual](https://stedolan.github.io/jq/manual/v1.6/)
- [Pull Request Title Injection とその対策](https://furusax0621.hatenablog.com/entry/2020/03/31/220042)
- [Using environment variables](https://help.github.com/en/actions/configuring-and-managing-workflows/using-environment-variables)
