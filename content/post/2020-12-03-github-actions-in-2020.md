---
layout: post
title: "2020年に書いた GitHub Action + α"
slug: github-actions-in-2020
date: 2020-12-03 00:00:00 +0900
comments: true
categories: [github, mysql]
---

この記事は[フラーAdvent Calendar 2020](https://adventar.org/calendars/5034)の3日目の記事です。
2日目は[id:gibachan03](https://gibachansblog.hatenablog.jp/about) さんで「[Androidアプリエンジニアになって気づいたiOSとの違い](https://gibachansblog.hatenablog.jp/entry/2020/12/02/000000)」でした。

-----

さて、公開当初色々して遊んだ GitHub Actions ですが、今年も引き続き遊んでました。
いくつか新しい Action を作ったものの、このブログでは紹介していなかったので、2020年作ったものを紹介したいと思います。

## actions-upload-release-asset

- [Yet Another Upload Release Asset Action](https://github.com/marketplace/actions/yet-another-upload-release-asset-action)

一言で表すのならば、 Yet Another [actions/upload-release-asset](https://github.com/actions/upload-release-asset) GitHub Action です。
GitHub の Releases にファイルをアップロードする Action です。
このアクションは GitHub 公式という安心感はあるのですが、一度のステップで1個のファイルしかアップロードできません。

ソースファイル本体と、ビルド済みバイナリと・・・と色々アップロードしたいものがあったので、新しく作りました。
[actions-upload-release-asset](https://github.com/shogo82148/actions-upload-release-asset) は [@actions/glob](https://github.com/actions/toolkit/tree/master/packages/glob) の Glob Pattern に対応しているので、一つのステップで複数のファイルをアップロードすることができます。

例えば、カレントディレクトリにあるテキストファイルを全てアップロードする例は以下のようになります。

```yaml
on:
  release:
    types:
      - created

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      # steps for building assets
      - run: echo "REPLACE ME!" > assets.txt

      - uses: shogo82148/actions-upload-release-asset@v1
        with:
          upload_url: ${{ github.event.release.upload_url }}
          asset_path: "*.txt"
```

## actions-setup-mysql

- [actions-setup-mysql](https://github.com/marketplace/actions/actions-setup-mysql)

MySQLをインストールしてくれる Action です。
GitHubが提供している Linux イメージに MySQL はインストールされているのですが、MySQL 8.0 と MySQL 5.7 の二種類しかありません。
(ref. [ubuntu-20.04](https://github.com/actions/virtual-environments/blob/a94b661b02f7673d50c18e2326aa6b9d66b3ffe4/images/linux/Ubuntu2004-README.md), ref. [ubuntu-18.04](https://github.com/actions/virtual-environments/blob/a94b661b02f7673d50c18e2326aa6b9d66b3ffe4/images/linux/Ubuntu1804-README.md))

まあ、 Linux に関しては Docker で落としてくればいい話なんですが、問題になるのは macOS と Windows。
そもそもインストールされてないし、Dockerも使えない。
仕方がないからソースから自前でコンパイルするか・・・とバイナリをビルドして、ビルド済みのバイナリをダウンロードできるようにしたものが [actions-setup-mysql](https://github.com/marketplace/actions/actions-setup-mysql) です。

以下のようにバージョンを指定するだけで、ダウンロードして起動してくれます。便利！

```yaml
steps:
- uses: actions/checkout@v2
- uses: shogo82148/actions-setup-mysql@v1
  with:
    mysql-version: '8.0'
- run: mysql -uroot -h127.0.0.1 -e 'SELECT version()'
```

MariaDBもいけます。

```yaml
steps:
- uses: actions/checkout@v2
- uses: shogo82148/actions-setup-mysql@v1
  with:
    mysql-version: '10.5'
    distribution: 'mariadb'
- run: mysql -uroot -h127.0.0.1 -e 'SELECT version()'
```

対応しているバージョンは

- MySQL
  - 8.0
  - 5.7
  - 5.6
- MariaDB
  - 10.5
  - 10.4
  - 10.3

これより古いバージョンは macOS や Windows で素直にビルドできないので諦めました。
欲しい人はプルリクエストを投げてください。

## おまけ

厳密には今年じゃないけどブログでは紹介してないやつ ＆ 最近のアップデート内容です。

### actions-setup-redis

- [actions-setup-redis](https://github.com/marketplace/actions/actions-setup-redis)

[actions-setup-mysql](https://github.com/marketplace/actions/actions-setup-mysql) の Redis版ですね。
Redisのダウンロードと起動をやってくれます。

```yaml
steps:
- uses: actions/checkout@v2
- uses: shogo82148/actions-setup-redis@v1
  with:
    redis-version: '6.x'
- run: redis-cli ping
```

### actions-setup-perl

- [Setup Perl environment](https://github.com/marketplace/actions/setup-perl-environment)

「[Setup Perl GitHub Action を公開しました](https://shogo82148.github.io/blog/2019/09/18/actions-setup-perl/)」で紹介した
perlをインストールしてくれる Action です。

今年リリースされた v5.32.0 はもちろん、公開当時は未対応だった v5.22 以前の Windows ビルドにも対応しました。
GNUMakefile が存在しないので、dmakeやnmake用のMakefileを参考に再構築するという地道な努力([shogo82148/perl-win32-gnumakefiles](https://github.com/shogo82148/perl-win32-gnumakefiles)) によって実現しました。長い道のりだった・・・。


## まとめ

actions-setup-mysql, actions-setup-redis, actions-setup-perl のバイナリは AWS S3 においてあるんですが、
最近使用料が去年の倍くらいになった気がします 🤔
「S3の使用料なんて大したことないだろ！」と高をくくってました。ネットワークのアウトって意外と高いんですね・・・

そういうわけで皆様のお気持ちを心からお待ち申し上げています。

- [https://github.com/sponsors/shogo82148](https://github.com/sponsors/shogo82148)

-----

[フラーAdvent Calendar 2020](https://adventar.org/calendars/5034) 4日目の担当は [@furusax](https://twitter.com/furusax) さんで「頑張ってなにかかく」です。
