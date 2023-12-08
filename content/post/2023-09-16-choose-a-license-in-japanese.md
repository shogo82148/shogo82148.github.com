---
layout: post
title: "ChooseALicense.com の日本語訳を公開しました"
slug: 2023-09-16-choose-a-license-in-japanese
date: 2023-09-16 20:29:00 +0900
comments: true
categories: [github]
---

[ChooseALicense.com](https://choosealicense.com) の日本語訳を公開しました。

- [choosealicense.shogo82148.com](https://choosealicense.shogo82148.com/)

## 背景

いつの間にか「オープンソースライセンスを適切に管理する係」になってしまい、
最近はライセンス文章とにらめっこする毎日のいっちーです。

そんな中お世話になったのが[ChooseALicense.comの付録](https://choosealicense.com/appendix/)です。
ライセンスの概要が大まかにわかります。
まあ、最終的には原文を読まないといけないわけですが、読む手がかりにはなります。

母国語が日本語の僕にとって、毎回英語読むのはきつい・・・日本語版欲しいな・・・ってことで作りました。

## ツール

今回お世話になったツールたちです。

- [GitHub Pages]
- [BudouX]

### GitHub Pages

[ChooseALicense.com] は [GitHub Pages] でホストされています。
自然と[choosealicense.shogo82148.com]のホスト先も[GitHub Pages]になりました。

[GitHub Pages]自体はこのブログでもお世話になっている機能です。
今回個人的に初挑戦だったのは、独自ドメインの割り当てでした。
[ChooseALicense.com]のコードがカスタムドメインでの提供前提で組まれており、サブディレクトリでの提供では表示が崩れてしまうからです。

とは言ってもドキュメントにしたがい、GitHub側の設定を済ませたあと、自分のドメインに`CNAME`レコードを挿入するだけでした。

- [Managing a custom domain for your GitHub Pages site](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)

お手軽なので、今後なにかに使えるかもしれないですね。

### BudouX

タイトルの「Choose an open source license」は「オープンソースライセンスを選ぼう」と翻訳しました。
が、これをそのまま表示すると、こうなります。

```
オープンソースライセンスを選ぼ
う
```

「う」の位置がなんか気に食わない・・・。
この問題の解決のため、[BudouX]を利用しました。
自動でいい感じの改行位置を決めてくれます。

```
オープンソースライセンスを
選ぼう
```

## まとめ

[ChooseALicense.com](https://choosealicense.com) の日本語訳を公開しました。

- [choosealicense.shogo82148.com](https://choosealicense.shogo82148.com/)

## 参考

- [ChooseALicense.com]
- [choosealicense.shogo82148.com]
- [オープンソースライセンスの日本語参考訳](https://licenses.opensource.jp/)
- [Managing a custom domain for your GitHub Pages site](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [GitHub Pages]
- [BudouX]

[GitHub Pages]: https://docs.github.com/en/pages
[ChooseALicense.com]: https://choosealicense.com
[BudouX]: https://github.com/google/budoux
[choosealicense.shogo82148.com]: https://choosealicense.shogo82148.com/
