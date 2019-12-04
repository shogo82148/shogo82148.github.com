---
layout: post
title: "GitHub Goveralls Action を公開しました"
slug: actions-goveralls
date: 2019-12-05 00:00:00 +0900
comments: true
categories: [go, github]
---

この記事は[フラーAdvent Calendar 2019](https://adventar.org/calendars/4155)の5日目の記事です。
4日目はふるふる先生の「[GoでJSONを良い感じに使おうと思ってハマった話](https://furusax0621.hatenablog.com/entry/2019/12/04/000000)」でした。

-----

さて、首を長くして待っていた GitHub Actions がついにGAになりましたね。
([日本語版ヘルプ](https://github.co.jp/features/actions)だとまだbetaになってますが)

さっそくActionを自作してちょっと前に公開してたんですが、この機会に紹介しようと思います。

- [actions-goveralls - Actions GitHub Marketplace](https://github.com/marketplace/actions/actions-goveralls)
- [shogo82148/actions-goveralls](https://github.com/shogo82148/actions-goveralls)


## 使い方

[coveralls.io](https://coveralls.io/) はコードカバレッジの可視化サービスです。
実は公式でGitHub Actionsを提供しており、[Coveralls GitHub Action](https://github.com/marketplace/actions/coveralls-github-action) を使うと
「JavaScriptのプロジェクトであれば」簡単にカバレッジを送信することができます。

しかし、Goが出力するカバレッジはJavaScriptと形式が違うので、そのままは使えません。
他のCIでは[mattn/goveralls](https://github.com/mattn/goveralls)にお世話になっていたので、
これを GitHub Actions として簡単に使えるようにしました。
最小限の設定はこれだけです。

```yaml
# ここらへんにテストとかの設定ば別途描く

# coveralls.io に送信
- uses: shogo82148/actions-goveralls@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    path-to-profile: profile.cov
```

簡単ですね。

## マトリックスビルド

され、後発なだけあって GitHub Actions では他のCIの便利な機能を簡単に使えます。
その中でも最も便利(偏見)なのがマトリックスビルドです。
例えば以下のように設定するだけで、Linux, macOS, Windows で同じテストを実行できます。

```yaml
strategy:
  fail-fast: false
  matrix:
    os:
      - ubuntu-latest
      - macos-latest
      - windows-latest
runs-on: ${{ matrix.os }}
```

・・・と、ここまではいいんですが、カバレッジをとって coveralls に送ると残念なことになります。
(例:<https://coveralls.io/builds/27037772>)

![ビルド一覧](/images/2019-12-05-build.png)
![ジョブ一覧](/images/2019-12-05-job.png)

どれかがLinuxでどれかがmacOSで残った最後がWindowsの実行結果なのですが、
ジョブの名前が一緒なので区別が付きません。

## parallel build webhook

coveralls にはこの問題を解決してくれる[parallel build webhook](https://docs.coveralls.io/parallel-build-webhook)というものがあります。
travis-ci だと coveralls側がいい感じにフックを挟んで処理してくれるんですが、GitHub Actions では自前でやらないといけません。
全部自前でやるのは面倒なので、actions-goveralls には補助する機能をいれてあります。

```yaml
on: [push, pull_request]
jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        os:
          - ubuntu-latest
          - macos-latest
          - windows-latest
    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/setup-go@v1
        with:
          go-version: "1"
      - uses: actions/checkout@v1
      - run: go test -v -coverprofile=profile.cov .

      - name: coveralls にカバレッジを送る
        uses: shogo82148/actions-goveralls@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          path-to-profile: profile.cov
          parallel: true
          job-number: ${{ strategy.job-index }}

  # parallel build webhook を叩く
  finish:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: shogo82148/actions-goveralls@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          parallel-finished: true
```

大事なのはここ。ジョブが複数あることを伝えるのと、ジョブ番号を含めること。

```yaml
parallel: true
job-number: ${{ strategy.job-index }}
```

すべてのジョブが終わったら `finish` ジョブが走って結果を集計してくれます。
結果はこちら <https://coveralls.io/builds/27089216>

![ビルド一覧](/images/2019-12-05-parallel-build.png)

![ジョブ一覧](/images/2019-12-05-parallel-jobs.png)

ジョブ名の末尾に0,1,2と数字が入るので、GitHub Actions のログと突き合わせればパラメーターを特定できます。
(多分ジョブ一覧に並んでいる順番で採番されている気がするけど、保証されているのかは知らない)

## GitHub Action の実装

現在のところ自作できる GitHub Action は Docker か JavaScript(TypeScript)の二択です。
DockerはLinuxでしか動かないので、クロスプラットフォームで動くものを作るには JavaScript を使う必要があります。
ところが [mattn/goveralls](https://github.com/mattn/goveralls) の実装言語はGoです。

https://github.com/shogo82148/actions-goveralls/tree/v1.0.0/bin

## まとめ

簡単にGoのカバレッジを可視化できる actions-goveralls の紹介でした。

- [actions-goveralls - Actions GitHub Marketplace](https://github.com/marketplace/actions/actions-goveralls)

もちろん他のCIサービスでも同じことはできるんですが、レポジトリと統合されているだけあって GitHub Actions だとすごく楽です。
この機会にカバレッジをとってみて、コードの品質を上げてみましょう。

-----

[フラーAdvent Calendar 2019](https://adventar.org/calendars/4155) 6日目の担当は [@shogo82148](https://twitter.com/shogo82148) さんで「TDB」です。
