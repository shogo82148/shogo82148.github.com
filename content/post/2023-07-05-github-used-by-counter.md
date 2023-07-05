---
layout: post
title: "GitHubのプロジェクトにUsed by counterを追加する"
slug: 2023-07-05-github-used-by-counter
date: 2023-07-05 23:36:00 +0900
comments: true
categories: [github]
---

GitHubのプロジェクトを見に行くと、サイドバーに「Used by（数字）」と書かれたセクションがあります。

![Used by 2.4k](/images/2023-07-05-github-used-by-counter-1.png)

これの設定方法を知ったのでメモ。

## TL;DR

1. レポジトリのナビゲーションバーから「Setting」をクリックし設定画面を開きます
2. サイドバーから「Code security and analysis」を選択します
3. 「Used by counter」という項目で、たくさん使ってもらっていそうなパッケージを選択します

![Used by counterからパッケージ選択する](/images/2023-07-05-github-used-by-counter-1.png)

## 背景

[GitHub Actions上でFuzzingを実行するアクションを書いた]で[shogo82148/actions-go-fuzz]というGitHub Actionを作りました。
このために作ったレポジトリの概要を眺めていると、いつの間にか「Used by 3」という表示が増えてました。
これ自体はおかしなことではありません。お試しで自分が過去に作ったレポジトリに[shogo82148/actions-go-fuzz]を導入したので、依存しているレポジトリは存在します。

ずっと不思議だったのは、自分の作った他のGitHub Actionにはこの表示がないこと。
たとえば「actions-setup-perl」でGitHubを検索すると、それなりに使用例が出てきます。
しかし、[shogo82148/actions-setup-perl]には（この文章を書く前の時点では）「Used by（数字）」のセクションはありませんでした。

## 原因

ただの趣味でやっているので別に利用者がいなくたって構わないんですが、
やっぱり利用者がいるとモチベーションが変わってくるじゃないですか。
そういうわけで、表示方法を探したところ公式ドキュメントにたどり着きました。

- [Changing the "Used by" package](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/exploring-the-dependencies-of-a-repository#changing-the-used-by-package)

ドキュメントによると、ひとつのレポジトリで複数のパッケージを提供していると、
このようなことが起こるそうです。

[shogo82148/actions-setup-perl]の場合、GitHubの依存解析によって「JavaScriptのパッケージ」「GitHub Actionのパッケージ」の2つが検出されました。
[shogo82148/actions-setup-perl]はTypeScriptで実装されているので「JavaScriptのパッケージ」として認識されるのは仕方のないことです。
しかし、利用者はみんなGitHub Actionとして利用するので、実際に「JavaScriptのパッケージ」として利用する人はいません。
というかそういう使い方は想定していないので、使われていないのは正しい。
利用者がいないので、「Used by（数字）」の表示がなかったんですね。

ドキュメントに記載されている通り、「Used by counter」の設定を変更すれば無事表示されます。
[shogo82148/actions-setup-perl]も「GitHub Actionのパッケージ」としてカウントされるよう設定を変更したので、
この記事を書いている時点では利用者数が表示されるようになりました。

## まとめ

- GitHubのレポジトリで利用者数が表示されるアレは「Used by counter」という名前らしい
- 設定の「Code security and analysis」から変更できるよ

個人的に「Code security and analysis」から変更できるというのは盲点でした。
「security」の文字だけ見て「セキュリティー関連の設定かー」と思っていたんですが、
なるほど「Code analysis（コード分析）」の設定も含まれているんですね。

レポジトリの設定多すぎて覚えきれないよ・・・。

## 参考

- [Changing the "Used by" package](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/exploring-the-dependencies-of-a-repository#changing-the-used-by-package)
- [GitHub Actions上でFuzzingを実行するアクションを書いた]
- [shogo82148/actions-setup-perl]

[GitHub Actions上でFuzzingを実行するアクションを書いた]: https://shogo82148.github.io/blog/2023/07/05/2023-07-05-actions-go-fuzz/
[shogo82148/actions-setup-perl]: https://github.com/shogo82148/actions-setup-perl
[shogo82148/actions-go-fuzz]: https://github.com/shogo82148/actions-go-fuzz
