---
layout: post
title: "actions-setup-redisがBuild Provenanceの検証を行うようになりました"
slug: actions-setup-redis-verifies-build-provenance
date: 2025-04-06 22:34:00 +0900
comments: true
categories: [github, github-actions]
---

[shogo82148/actions-setup-redis](https://github.com/shogo82148/actions-setup-redis) はRedisのバイナリーをGitHub Releasesからダウンロードしています。
このバイナリーを[GitHub Artifact Attestations](https://github.blog/changelog/2024-06-25-artifact-attestations-is-generally-available/)で署名して、
ダウンロード時に検証するようにしました。

## 背景

今年3月に発生したGitHub Actionsのサプライチェーン攻撃を受けての対応です。

- [[Security Advisory] Supply Chain Attack on reviewdog GitHub Actions during a specific time period #2079](https://github.com/reviewdog/reviewdog/issues/2079)
- [New GitHub Action supply chain attack: reviewdog/action-setup](https://www.wiz.io/blog/new-github-action-supply-chain-attack-reviewdog-action-setup)
- [GitHub Actions Supply Chain Attack: A Targeted Attack on Coinbase Expanded to the Widespread tj-actions/changed-files Incident: Threat Assessment (Updated 4/2)](https://unit42.paloaltonetworks.com/github-actions-supply-chain-attack/)
- [tj-actions のインシデントレポートを読んだ](https://zenn.dev/shunsuke_suzuki/articles/tj-actions-incident-2025)

個人的には[reviewdog/action-setup](https://github.com/reviewdog/action-setup)をよく利用しているので、びっくりしました。
（[インシデントレポートに自分のコミット](https://github.com/reviewdog/action-setup/commit/3f401fe)載ってるし）
さいわい侵害を受けたのが日本時間深夜ということもあり、被害を受けたレポジトリーは見つかりませんでした。

しかし、こういった攻撃が身近に迫っていることを、改めて感じた事件でした。
自分自身もいくつかGitHub Actionsを公開しているので、他人事ではありません。
少しでも安全に利用できるよう、何等かの対応をすることにしました。

## 対応

### GitHub Actionsのピン留め

今回の侵害事件においてもっとも効果的なのはGitHub ActionsのSHA1ハッシュによりピン留めです。
他の方もたくさんブログを書いてくれているので、そちらをどうぞ。

- [GitHub Actionsの侵害・サプライチェーンリスクを軽減:pinactを使ってアクションをバージョンではなくハッシュ値で指定](https://dev.classmethod.jp/articles/hardening-github-actions-with-pinact-commit-sha-semver/)
- [GitHub Actionsの外部Actionのバージョンをhash指定にし、可読性を維持しつつバージョンを上げる](https://developer.hatenastaff.com/entry/2025/03/17/200642)
- [GitHub Actionsの外部ActionでVersionTagを使ってるものを一括でCommitHashにしたい。](https://techblog.kayac.com/2025-actionspin)

[shogo82148/actions-setup-redis](https://github.com/shogo82148/actions-setup-redis) でも同様の対応を行いました。

### Redisバイナリーの署名

しかし [shogo82148/actions-setup-redis](https://github.com/shogo82148/actions-setup-redis) においてはピン留めだけでは不十分です。
GitHub Releasesからファイルをダウンロードしているので、このファイルが改竄される危険性が残っています。

そこでこのバイナリーに対して[actions/attest-build-provenance](https://github.com/actions/attest-build-provenance/)で署名をするようにしました。

- 例: <https://github.com/shogo82148/actions-setup-redis/attestations/6057503>

### Redisバイナリーの署名検証

アクションを使用する際に署名を検証します。
検証には[sigstore/sigstore-js](https://github.com/sigstore/sigstore-js)を利用しました。
ただし、検証に必要な証明書を取ってきたり、証明書の拡張領域を読むのが面倒だったりしたので、その部分をまとめた簡単なラッパーを作成しました（GitHub公式で似たようなの出してくれないかな）。

- [shogo82148/attestation-verify-js](https://github.com/shogo82148/attestation-verify-js)

これでバイナリーが第三者に書き換えられるリスクを低減します。

## まとめ

3月のGitHub Actionsのインシデントを受け、公開しているGitHub Actionsのセキュリティー強化に乗り出しました。
ひとまず [shogo82148/actions-setup-redis](https://github.com/shogo82148/actions-setup-redis) では以下のような対応を行いました。

- GitHub Actionsのピン留め
- Redisバイナリーの署名
- Redisバイナリーの署名検証

他のGitHub Actionsも安心して使えるよう工夫をしていきたいなと思ってます。

> こんにちは、私はウサギです🐇\
> 新たな署名が息吹を運ぶよ\
> Redisのバイナリが安全に輝く\
> SHA1の守りと証明が舞い上がる\
> 未来への跳躍、コードに希望を込めて\
> 小さな私が見守る安心の軌跡だ！
>
> by [CodeRabbit](https://www.coderabbit.ai/)

## 参考

- [shogo82148/actions-setup-redis](https://github.com/shogo82148/actions-setup-redis)
- [GitHub Artifact Attestations を試してみた](https://shogo82148.github.io/blog/2024/06/30/2024-06-30-try-artifact-attestations/)
- [Artifact Attestations is generally available](https://github.blog/changelog/2024-06-25-artifact-attestations-is-generally-available/)
- [New GitHub Action supply chain attack: reviewdog/action-setup](https://www.wiz.io/blog/new-github-action-supply-chain-attack-reviewdog-action-setup)
- [GitHub Actions Supply Chain Attack: A Targeted Attack on Coinbase Expanded to the Widespread tj-actions/changed-files Incident: Threat Assessment (Updated 4/2)](https://unit42.paloaltonetworks.com/github-actions-supply-chain-attack/)
- [tj-actions のインシデントレポートを読んだ](https://zenn.dev/shunsuke_suzuki/articles/tj-actions-incident-2025)
- [GitHub Actionsの侵害・サプライチェーンリスクを軽減:pinactを使ってアクションをバージョンではなくハッシュ値で指定](https://dev.classmethod.jp/articles/hardening-github-actions-with-pinact-commit-sha-semver/)
- [GitHub Actionsの外部Actionのバージョンをhash指定にし、可読性を維持しつつバージョンを上げる](https://developer.hatenastaff.com/entry/2025/03/17/200642)
- [GitHub Actionsの外部ActionでVersionTagを使ってるものを一括でCommitHashにしたい。](https://techblog.kayac.com/2025-actionspin)
- [actions/attest-build-provenance](https://github.com/actions/attest-build-provenance/)
- [sigstore/sigstore-js](https://github.com/sigstore/sigstore-js)
- [shogo82148/attestation-verify-js](https://github.com/shogo82148/attestation-verify-js)
