---
layout: post
title: "actions-setup-mysqlとactions-setup-redisがApple M1上で動くようになりました"
slug: 2024-02-04-actions-setup-mysql-and-actions-setup-redis-now-work-on-macos14
date: 2024-02-04 12:35:00 +0900
comments: true
categories: [github, github-actions, mysql, redis]
---

GitHub Actions に　Apple Silicon がやってきました！

- [GitHub Actions: Introducing the new M1 macOS runner available to open source!](https://github.blog/changelog/2024-01-30-github-actions-introducing-the-new-m1-macos-runner-available-to-open-source/)
- [GitHub Actions: macOS 14 (Sonoma) is now available](https://github.blog/changelog/2024-01-30-github-actions-macos-14-sonoma-is-now-available/)

先日Perlをビルドして遊んでみました。

- [actions-setup-perlがApple M1上で動くようになりました](https://shogo82148.github.io/blog/2024/02/01/2024-02-01-actions-setup-perl-now-works-on-macos14/)

今回はMySQLとRedisをビルドしてみたお話です。

- [shogo82148/actions-setup-mysql](https://github.com/shogo82148/actions-setup-mysql)
- [shogo82148/actions-setup-redis](https://github.com/shogo82148/actions-setup-redis)

## actions-setup-mysql v1.31.0, actions-setup-redis  リリースのお知らせ

[actions-setup-mysql v1.31.0](https://github.com/shogo82148/actions-setup-mysql/releases/tag/v1.31.0), [actions-setup-redis v1.33.0](https://github.com/shogo82148/actions-setup-redis/releases/tag/v1.33.0) から M1 macOS に対応しています。
`runs-on:` キーに `macos-14` を指定すると M1 を利用できます。

```yaml
jobs:
  build:
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4
      - name: Set up MySQL
        uses: shogo82148/actions-setup-mysql@v1.31.0
```

## M1による高速化

今日現在（2024-02-04）のMySQL最新安定版リリースは 8.0.36 です。
MySQL 8.0.36 のビルドにx64では 49m 45s かかりました。
M1 macOSでビルドしたところ 23m 16s で完了しました。
**53.2%の高速化** です。

## 修正点

x64と同じ手順でビルドしたところ、いくつかのバージョンでは素直にビルドが通りませんでした。
そのようなバージョンにはいくつかパッチを当てました。
Perl は素直にビルドが通ってすごいですね。まあ、だいたい [Devel::PatchPerl](https://metacpan.org/pod/Devel::PatchPerl) のおかげ。

### Xcodeに付属するclangを使ってMySQLをビルドするように修正

x86上ではbrewで新しいClangをインストールしてビルドに使っていました。
MySQL 8.0にC++20の新しい構文が使用されており、Xcode に付属するClangは古すぎてビルドできなかったためです。

しかし `macos-14` ではリンクに失敗してしまいました。
エラーメッセージでググったところ以下のIssueがヒットしました。

- [Pyenv Failing to install Python 3.12 on OSX Sonoma (MB Air M2): "ld: archive member '/' not a mach-o file" #2862](https://github.com/pyenv/pyenv/issues/2862)

「Xcodeに付属するClangを使用せよ」とのこと。
`macos-14` の Clang は十分に新しいので、この方法で解決しました。

### MariaDBにPCRE2を同梱しました

[shogo82148/actions-setup-mysql](https://github.com/shogo82148/actions-setup-mysql) では MariaDB も提供しているので、
MariaDBのビルドも必要です。
今までと同じ手順で `macos-14` 向けのビルドをしたところ、 `pcre2posix.h` が見つからずにエラーになってしまいました。

```
   /Users/runner/work/_temp/mariadb-10.5.23/client/mysqltest.cc:49:10: fatal error: 'pcre2posix.h' file not found
  #include "pcre2posix.h" /* pcreposix regex library */
           ^~~~~~~~~~~~~~
  1 error generated.
```

[PCRE2](https://github.com/PCRE2Project/pcre2)のファイルっぽいので、PCRE2をインストールして解決しました。

### 古いRedis　がmacos-14でビルドできない

古いRedisが `macos-14` でビルドできない問題に遭遇しました。
最新版のRedisでは修正されているので、バックポートして修正しました。

- [Fix compile on macOS 13 #12611](https://github.com/redis/redis/pull/12611)

## まとめ

[shogo82148/actions-setup-mysql](https://github.com/shogo82148/actions-setup-mysql) と [shogo82148/actions-setup-redis](https://github.com/shogo82148/actions-setup-redis) が　Apple Silicon 上で動くようになりました。
かなりの高速化が期待できるので、ぜひお試しください。

## 参考

- [shogo82148/actions-setup-mysql](https://github.com/shogo82148/actions-setup-mysql)
- [shogo82148/actions-setup-redis](https://github.com/shogo82148/actions-setup-redis)
- [shogo82148/actions-setup-mysql: introduce M1 Mac #1018](https://github.com/shogo82148/actions-setup-mysql/pull/1018)
- [shogo82148/actions-setup-redis: introduce Apple Silicon M1 #893](https://github.com/shogo82148/actions-setup-redis/pull/893)
- [GitHub Actions: Introducing the new M1 macOS runner available to open source!](https://github.blog/changelog/2024-01-30-github-actions-introducing-the-new-m1-macos-runner-available-to-open-source/)
- [GitHub Actions: macOS 14 (Sonoma) is now available](https://github.blog/changelog/2024-01-30-github-actions-macos-14-sonoma-is-now-available/)
- [actions-setup-perlがApple M1上で動くようになりました](https://shogo82148.github.io/blog/2024/02/01/2024-02-01-actions-setup-perl-now-works-on-macos14/)
