---
layout: post
title: "dependabotでgithub/codeql-actionのアップデートをまとめる"
slug: grouping-codeql-action-updates
date: 2026-07-10 22:00:00 +0900
comments: true
categories: [github]
---

## 背景・目的

### `github/codeql-action` について

僕の管理しているGitHubレポジトリーの一部は[CodeQL](https://codeql.github.com/)を使って脆弱性の診断を行っています。
診断には公式の[github/codeql-action](https://github.com/github/codeql-action) Actionを使って、GitHub Actions上で実行しています。

[github/codeql-action](https://github.com/github/codeql-action)は内部で複数のアクションを提供しており、これらのアクションを組み合わせて診断を行います。

- `init` アクション
- `analyze` アクション
- `autobuild` アクション
- etc.

これらのActionsはバージョンが食い違っていると「バージョン不一致」のエラーを吐きます。たとえば `init` アクションと `analyze` アクションのバージョンが異なるとエラーを吐くので、これらのアクションは常にバージョンを一致させておく必要があります。

### dependabotの仕様変更？

今までは[github/codeql-action](https://github.com/github/codeql-action)に関連するActionをdependabotはすべて一括更新してくれました。

- [build(deps): bump github/codeql-action from 4.36.1 to 4.36.2 #507](https://github.com/shogo82148/typescript-action/pull/507)

しかし7月のはじめことから、なぜか複数のプルリクエストに分割されるようになりました。

- [build(deps): bump github/codeql-action/analyze from 4.36.2 to 4.36.3 #525](https://github.com/shogo82148/typescript-action/pull/525)
- [build(deps): bump github/codeql-action/init from 4.36.2 to 4.36.3 #526](https://github.com/shogo82148/typescript-action/pull/526)
- [build(deps): bump github/codeql-action/autobuild from 4.36.2 to 4.36.3 #527](https://github.com/shogo82148/typescript-action/pull/527)

バージョンの不一致でCIがコケるので、このままではこれらのプルリクエストは取り込めません。

## `github/codeql-action` のアップデートをまとめる

これだと困るので一括更新してくれるよう、`.dependabot.yaml` の設定を更新しました。

```yaml
version: 2
updates:
  # Maintain dependencies for GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "daily"

    # 新しく追加した部分
    groups:
      codeql-actions:
        patterns:
          - "github/codeql-action/*"
```

これで `github/codeql-action` のCIが無事通るようになります。

## まとめ

dependabotが何もしてないのに壊れたプルリクエストを送って来るようになったので、
設定をいじって対応しました。

> うさぎが跳ねて、更新をひとまとめ\
> CodeQLの枝葉も、仲よく並んで\
> CIの道を軽やかに駆ける\
> にんじん片手に、記事を祝おう\
> ぴょん、ぴょん、よい変更！
>
> by [CodeRabbit](https://www.coderabbit.ai/)

## 参考文献

- [CodeQL](https://codeql.github.com/)
- [github/codeql-action](https://github.com/github/codeql-action)
- [dependabotの更新グループ化機能を使ってAWS SDK for Go v2をアップデートする ](https://shogo82148.github.io/blog/2023/07/02/2023-07-02-update-aws-sdk-v2-with-grouped-version-updates-for-dependabot/)
