---
layout: post
title: "actions/checkout@v4の襲撃を受けた件"
slug: 2023-09-08-actions-checkout-v4
date: 2023-09-08 20:22:00 +0900
comments: true
categories: [github, github-actions]
---

先日 [actions/checkout@v4](https://github.com/actions/checkout/releases/tag/v4.0.0) がリリースされましたね。

- [actions/checkout@v4](https://github.com/actions/checkout/releases/tag/v4.0.0)

まあ、何が言いたいかというと、「メジャーバージョンアップ多すぎじゃない？？？」という話。

## actions/checkout@v4の襲撃

新規に作成したレポジトリには基本的に[dependabot](https://docs.github.com/en/code-security/dependabot)をセットアップしています。
まあそんな状況下で [actions/checkout@v4](https://github.com/actions/checkout/releases/tag/v4.0.0) なんてリリースされたら、こうなるわけですよ。

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">actions/checkout のアップデートつらい <a href="https://t.co/4bNeCFsE4Y">pic.twitter.com/4bNeCFsE4Y</a></p>&mdash; f96fd3a0-bdb9-4f10-b69f-8f765c1d341c ICHINOSEShogo (@shogo82148) <a href="https://twitter.com/shogo82148/status/1698939885368021223?ref_src=twsrc%5Etfw">September 5, 2023</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

よほど単純なワークフローでない限り、 actions/checkout は必須のアクションです。
GitHub Actions でCIを組んでいるレポジトリはもれなく使っています。
[@shogo82148](https://github.com/shogo82148/)以下にあるレポジトリだけで、129個のプルリクエストが来ました。
心を無にしてマージボタンを押しまくりました。
他のorgにも参加しているので、実際に対応したプルリクエストはもっと多いです。

## Node.js 16 のEOLが近い

背景には Node.js 16 が9月11日にEOLになるという話があります。
actions/checkout@v3 は Node.js 16 で動くので、当然サポート対象外になります。
そこで新しいバージョンが必要なわけです。

actions/checkout@v4 は Node.js 20 で動くようになりました。
GitHub Actions はセフルホストできるので、まだ Node.js 20 が動かない環境も残っています。
そのような環境でオプトインできるよう、メジャーバージョンアップにしたのだと思います。

## Node.js 18 がスキップされた話

ちなみに Node.js 16 と Node.js 20 の間には Node.js 18 が存在するわけですが、
Node.js 18 はスキップされました。
（Node.js 17 と Node.js 19 は開発版なのでもともと対象外）

- [GitHub Actionsのランナーのnodeが16 -> 20アップデートされる予定と最新のOctokit.jsがnode16サポートを切った件の調査](https://zenn.dev/kesin11/scraps/dc5a761fa5992e)

おそらくこれは意図的なものです。
Node.js 12 からアップデートするときも Node.js 14 はスキップされました。
このときの変更を取り込むプルリクエストの中で、以下のようなやり取りがあります。

- https://github.com/actions/runner/pull/1439#issuecomment-984012281

> > Why skip 14 entirely?? Shouldn’t actions support every LTS version of node?
>
> We're intentionally conservative about the Node versions that we bundle in the runner application - and that you can subsequently author actions in - because this is something that we need to support even after Node.js leaves LTS. (We still support actions written as containers from the original Actions v1 before they were GA'd, before we moved to a JavaScript runtime model.) By skipping LTS lines, we're able to keep the support matrix smaller.
>
> Our hosted runner virtual machines, of course, have all the various versions of Node.js installed (or can download them on-demand).
>
> Are you trying to author an action and need Node.js 14 support explicitly, and neither Node.js 12 nor Node.js 16 will work?

Runnerには複数バージョンの Node.js をバンドルする必要があるため、容量削減のため意図的にバージョンをスキップしたとのことです。
Node.js 18をスキップしたのも同じ理由でしょう。

とはいえ、Node.js 16 はEOLが早まったこともあり、かなりギリギリの対応です。
通常のライフサイクルならまだ余裕はあったのですが、
Node.js 16 に同梱しているOpenSSL 1.1.1のEOLに合わせて、サポート期間が短くなったためですね。

## 他のアクションのメジャーバージョンアップも控えている

さて問題は actions/checkout だけではない、ということです。
setup-xxx 系のアクションの Node.js 20 対応が控えています。

- actions/setup-python: [feat: bump to use node20 runtime, actions/checkout to v4 #727](https://github.com/actions/setup-python/pull/727)
- actions/cache: [feat: bump to use node20 runtime, actions/checkout to v4 #1231](https://github.com/actions/cache/pull/1231)
- actions/setup-node: [feat: bump to use node20 runtime, actions/checkout to v4 #846](https://github.com/actions/setup-node/pull/846)
- actions/setup-go: [feat: upgrade to use node 20 runtime and bump checkout action to v4 #421](https://github.com/actions/setup-go/pull/421)
- actions/setup-dotnet: [feat: bump to use node20 runtime, actions/checkout to v4 #458](https://github.com/actions/setup-dotnet/pull/458)
- actions/setup-java: [feat: bump to use node20 runtime, actions/checkout to v4 #533](https://github.com/actions/setup-java/pull/533)
- actions/upload-artifact: [feat: bump to use node20 runtime, actions/checkout to v4 #434](https://github.com/actions/upload-artifact/pull/434)
- actions/download-artifact: [feat: bump to use node20 runtime, actions/checkout to v4 #227](https://github.com/actions/download-artifact/pull/227)

(Go以外はプルリクエスト上げているの全部同じ人だな・・・？)

2023-09-08現在まだマージされていませんが、この変更がリリースされるときはメジャーバージョンアップするのでしょう。
また dependabot の襲撃がやってくる・・・・。

## まとめ

使用頻度の高いアクションのメジャーバージョンアップはつらい。

## 参考

- [actions/checkout@v4](https://github.com/actions/checkout/releases/tag/v4.0.0)
- [dependabot](https://docs.github.com/en/code-security/dependabot)
- [GitHub Actionsのランナーのnodeが16 -> 20アップデートされる予定と最新のOctokit.jsがnode16サポートを切った件の調査](https://zenn.dev/kesin11/scraps/dc5a761fa5992e)
- [Update default runtime to node20 #1436](https://github.com/actions/checkout/pull/1436)
