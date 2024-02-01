---
layout: post
title: "actions-setup-perlがApple M1上で動くようになりました"
slug: 2024-02-01-actions-setup-perl-now-works-on-macos14
date: 2024-02-01 20:50:00 +0900
comments: true
categories: [github, github-actions, perl]
---

GitHub Actions に　Apple Silicon がやってきました！

- [GitHub Actions: Introducing the new M1 macOS runner available to open source!](https://github.blog/changelog/2024-01-30-github-actions-introducing-the-new-m1-macos-runner-available-to-open-source/)
- [GitHub Actions: macOS 14 (Sonoma) is now available](https://github.blog/changelog/2024-01-30-github-actions-macos-14-sonoma-is-now-available/)

新しいコンピューティング環境がでてやることといえばアレですよね。
Perlのビルド。
というわけでやっていきましょう。

## actions-setup-perl v1.28.0 リリースのお知らせ

[actions-setup-perl v1.28.0](https://github.com/shogo82148/actions-setup-perl/releases/tag/v1.28.0) から M1 macOS に対応しています。
`runs-on:` キーに `macos-14` を指定すると M1 を利用できます。

```yaml
jobs:
  build:
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4
      - name: Set up perl
        uses: shogo82148/actions-setup-perl@v1.28.0
```

## M1による高速化

今回のリリースにあたり、バージョン違いコンパイルオプション違いの **全148種類** のPerlバイナリを再ビルドしました！
Perl 5.38.2 のビルド時間で比較すると、x64では 11m 27s かかっていたビルドが、M1では 4m 6s へと大きく改善しました。
64.2%の高速化です。

## まとめ

[shogo82148/actions-setup-perl](https://github.com/shogo82148/actions-setup-perl) が　Apple Silicon 上で動くようになりました。
かなりの高速化が期待できるので、ぜひお試しください。

## 参考

- [shogo82148/actions-setup-perl](https://github.com/shogo82148/actions-setup-perl)
- [GitHub Actions: Introducing the new M1 macOS runner available to open source!](https://github.blog/changelog/2024-01-30-github-actions-introducing-the-new-m1-macos-runner-available-to-open-source/)
- [GitHub Actions: macOS 14 (Sonoma) is now available](https://github.blog/changelog/2024-01-30-github-actions-macos-14-sonoma-is-now-available/)
