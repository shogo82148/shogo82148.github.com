---
layout: post
title: "shogo82148/actions-setup-mysqlのMySQLビルドスクリプト群を別レポジトリーに移行した"
slug: split-actions-setup-mysql
date: 2025-10-26 21:12:00 +0900
comments: true
categories: [github, github-actions, mysql]
---

## TL;DR

[shogo82148/actions-setup-mysql] には「GitHub Actionsのコード」と「MySQLをビルドするためのスクリプト群」が一緒に入っていたのですが、
このたび「MySQLをビルドするためのスクリプト群」を以下のレポジトリーに移行することにしました。

- [shogo82148/build-mysql]

ユーザー側での対応は不要です。

## 背景・目的

[shogo82148/actions-setup-mysql] のビルド済みMySQLバイナリー置き場には紆余曲折ありました。
以下のブログ記事はPerlのものですが、MySQLも同じような道筋を辿っています。

- [Setup Perl GitHub Action を公開しました](https://shogo82148.github.io/blog/2019/09/18/actions-setup-perl/)
- [Setup Perl Environment Action のストレージを Azure Blob Storage に移行しました](https://shogo82148.github.io/blog/2021/02/03/setup-perl-uses-azure-blob-storage/)

紆余曲折あり最終的には GitHub Releases に保存することにしました。
GitHubネイティブの機能で安心感があるのと、なんたって無料なのが魅力的ですね。

[v1.45.0](https://github.com/shogo82148/actions-setup-mysql/releases/tag/v1.45.0) をリリースしたら、
v1.45.0の関連アセットに必要なバイナリーを全部突っ込む、という作戦で運用を続けてきました。
しかし、この方法では以下のような問題がありました。

- リリースのたびにすべてのプラットフォームのビルドをし直さなければならない
- ひとつのリリースに含める事のできるアセットの上限 1000 が見えてきた

というわけで、「MySQLをビルドするためのスクリプト群」を別レポジトリーに移行し、
[shogo82148/actions-setup-mysql] 自体のリリースサイクルとは別に管理するようにしました。

## 移行作業

### shogo82148/build-mysql のセットアップ

「MySQLをビルドするための秘伝のスクリプト群」はすでに手元にあるので、スクリプト群をコピーするたけです。
完成したバイナリーは [gh] コマンドでアップロードします。

同じMySQLバージョンの再ビルドを行いたい（たとえば、将来リリースされるであろうubuntu-26.04版ビルドの追加とか）ケースも考えて、リリース名に `mysql-8.4.6-20251026153058` のようにリリースした日付を入れておきます。
これは、[変更不可リリース](https://docs.github.com/ja/code-security/supply-chain-security/understanding-your-software-supply-chain/immutable-releases)を有効化しており、過去のリリースを直接書き換えることができないためです。

### shogo82148/actions-setup-mysql のダウンロードURL書き換え

毎回 [shogo82148/build-mysql] のリリースを検索するのも大変なので、
[shogo82148/build-mysql] の全リリースを `gh api --paginate --slurp '/repos/shogo82148/build-mysql/releases?per_page=100'` コマンドで取得し、整形したものをソースコードに埋め込んでいます。

```json
[
  {
    "arch": "arm64",
    "distribution": "mysql",
    "os": "darwin",
    "sha256": "874d49f26f0bcb1cdd186bf768d863cb1da227091609e5873e25255f19e46753",
    "url": "https://github.com/shogo82148/build-mysql/releases/download/mysql-9.5.0-20251026034039/mysql-9.5.0-darwin-arm64.tar.zstd",
    "version": "9.5.0"
  },
  {
    "arch": "x64",
    "distribution": "mysql",
    "os": "darwin",
    "sha256": "fe1432366afdd57c8b821234342baacb699162a4cc405ba44ca4ded258c5ec83",
    "url": "https://github.com/shogo82148/build-mysql/releases/download/mysql-9.5.0-20251026034039/mysql-9.5.0-darwin-x64.tar.zstd",
    "version": "9.5.0"
  },
  {
    "arch": "arm64",
    "distribution": "mysql",
    "os": "ubuntu-22.04",
    "sha256": "49389ac102c43e336dbc3624a9429f0abb8bc7538853e843614013c2e63e8953",
    "url": "https://github.com/shogo82148/build-mysql/releases/download/mysql-9.5.0-20251026034039/mysql-9.5.0-ubuntu-22.04-arm64.tar.zstd",
    "version": "9.5.0"
  },
  // ... (後略)
]
```

GitHub Action が動作する環境や指定されたバージョンをもとに、このJSONファイルを検索し、ダウンロードURLを取得します。

## まとめ

[shogo82148/actions-setup-mysql] に含まれていた「MySQLをビルドするためのスクリプト群」を以下のレポジトリーに移行しました。

- [shogo82148/build-mysql]

新しいMySQL, MariaDB のバージョンが公開されたときに、スムーズに対応できるようになりました。

## 参考

- [shogo82148/build-mysql]
- [shogo82148/actions-setup-mysql]
- [shogo82148/actions-setup-redis]
- [shogo82148/actions-setup-perl]
- [Setup Perl GitHub Action を公開しました](https://shogo82148.github.io/blog/2019/09/18/actions-setup-perl/)
- [Setup Perl Environment Action のストレージを Azure Blob Storage に移行しました](https://shogo82148.github.io/blog/2021/02/03/setup-perl-uses-azure-blob-storage/)
- [変更不可リリース](https://docs.github.com/ja/code-security/supply-chain-security/understanding-your-software-supply-chain/immutable-releases)

[shogo82148/build-mysql]: https://github.com/shogo82148/build-mysql
[shogo82148/actions-setup-mysql]: https://github.com/shogo82148/actions-setup-mysql
[shogo82148/actions-setup-redis]: https://github.com/shogo82148/actions-setup-redis
[shogo82148/actions-setup-perl]: https://github.com/shogo82148/actions-setup-perl
[gh]: https://cli.github.com/
