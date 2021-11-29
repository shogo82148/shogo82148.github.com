---
layout: post
title: "GitHub GraphQL のノードIDフォーマットが変わるらしい"
slug: github-graphql-global-node-id-will-change
date: 2021-11-29 23:08:00 +0900
comments: true
categories: [github]
---

弊社では [Terraform GitHub Provider](https://registry.terraform.io/providers/integrations/github/latest/docs) を使って
GitHub のレポジトリ管理・権限管理などを行っているのですが、
プロバイダーが `repository_id` を認識してくれない問題に遭遇しました。
原因を探ってみると GitHub GraphQL API に **かなり大きな変更が入ること** を知ったので、メモとして残しておきます。

## グローバルノードID

GraphQL API から扱えるすべてのオブジェクト (レポジトリ、ユーザー、etc) にはIDが振ってあります。

- [Using global node IDs](https://docs.github.com/en/graphql/guides/using-global-node-ids)

例えば僕 ([@shogo82148](https://github.com/shogo82148)) のノードIDは `MDQ6VXNlcjExNTczNDQ=` です。

```
$ curl https://api.github.com/users/shogo82148 | jq .node_id
"MDQ6VXNlcjExNTczNDQ="
```

このノードIDを使って GraphQL のクエリを書くことが出来ます。

```
$ gh api graphql -f query='query {
  node(id: "MDQ6VXNlcjExNTczNDQ=") {
    ... on User {
      name
      login
    }
  }
}'
{
  "data": {
    "node": {
      "name": "Ichinose Shogo",
      "login": "shogo82148"
    }
  }
}
```

ノードIDにはオブジェクトの種類の情報 (`MDQ6VXNlcjExNTczNDQ=` の例では「ユーザー」) も含まれているので、
GitHub が管理している全オブジェクトの中から一意に目的のノードを特定することが出来ます。

## フォーマット変更

いろんなニュースに埋もれて全く気がついていなかったのですが、 2021-02-10 にこのノードIDのフォーマット変更のお知らせがありました。

- [New global ID format coming to GraphQL](https://github.blog/2021-02-10-new-global-id-format-coming-to-graphql/)

例えば、先に上げた僕のユーザーのノードIDは以下のように変更になります。

- Before: `MDQ6VXNlcjExNTczNDQ=`
- After: `U_kgDOABGo4A`

なんだか短くコンパクトになりましたね。

### GitHub プロバイダーの不具合の原因

さて、移行前の `MDQ6VXNlcjExNTczNDQ=` というノードIDですが、
「`=` によるパディング」「現れるのは英数字のみ」という特徴から、感のいい人はピンと来るのでは無いでしょうか？
そう、このフォーマットは **Base64** ですね。

気がついてしまったらデコードしたくなるのが人間の性というものです。やってみましょう。

```
$ echo MDQ6VXNlcjExNTczNDQ= | base64 -d
04:User1157344
```

なんだかそれっぽい文字列になりました。
レポジトリのノードID(e.g. `MDEwOlJlcG9zaXRvcnkzMDgyNDI5`) をデコードすると `010:Repository3082429` となったので、
最初の `04` は `:` のあとに続くノードタイプの字数(`User`: 4文字, `Repository`: 10文字) でしょう。
`:` のあとの `User` はノードの種類、その後の数字は内部的なユーザーIDだと思います。
実際この数字は User Rest API の `id` フィールドに対応します。

```
$ curl https://api.github.com/users/shogo82148 | jq .id
1157344
```

-----

同じ要領で移行後のノードID `U_kgDOABGo4A` をデコードしてみましょう。

```
$ echo U_kgDOABGo4A | base64 -d
S�
   ��
```

はい、うまくいきませんね。
GitHub プロバイダーの不具合の原因はこれです。
**ノードIDを Base64 としてデコードしていたため、新IDのデコードに失敗してしまい認識できなかったのです**。

そもそも「ノードIDはBase64エンコードされている」とはドキュメントのどこにも書いてないので、
Base64っぽいなあ〜と思ってもそれを前提としてコードを書くのは良くないですね。

### 移行スケジュール

移行のスケジュールについては[公式の案内](https://github.blog/2021-02-10-new-global-id-format-coming-to-graphql/#how-will-this-be-rolled-out)を参照してもらいたいのですが、
概ね以下のようなステップで新フォーマットに移行します。

1. 新フォーマットの導入: この期間中に作成された新規オブジェクトのみ新フォーマットのIDが割り振られます。既存のオブジェクトに変更はありません。およそ3ヶ月で完了の予定です。
2. マイグレート: 既存のオブジェクトについて新旧どちらのフォーマットでもリクエストが可能になります。
レスポンスに含まれるIDに関しては、HTTPヘッダーを使って新旧を切り替えることが可能です。およそ3ヶ月で完了の予定です。
3. 旧フォーマットの廃止 レスポンスに含まれるIDがすべて新フォーマットに切り替わります。およそ3ヶ月で完了の予定です。

具体的に何月に行うのか明記はされていないですが、
新規レポジトリにも新フォーマットのノードIDが割り振られるようになったので、
今はちょうどフェーズ1が終わる前後の時期なのでしょう。

### 新方式への移行

フェーズ2の期間中はリクエストの `X-Github-Next-Global-ID` ヘッダーを使って、新旧のIDフォーマットを切り替えることができます。

- [GraphQL global ID migration update](https://github.blog/2021-11-16-graphql-global-id-migration-update/)

`X-Github-Next-Global-ID: 1` を指定すると旧フォーマットのノードIDが割り振られたオブジェクトについても、
新フォーマットに変換されたIDが返ってきます。
例えば僕の新フォーマットのノードIDは 2021-11-30 現在以下のようにして取得可能です。

```
$ curl -H "X-Github-Next-Global-ID: 1" https://api.github.com/users/shogo82148 | jq .node_id
"U_kgDOABGo4A"
```

もちろんこの新フォーマットのノードIDは GraphQL のクエリとして使うことができます。

```
gh api graphql -f query='query {
  node(id: "U_kgDOABGo4A") {
    ... on User {
      name
      login
    }
  }
}'
{
  "data": {
    "node": {
      "name": "Ichinose Shogo",
      "login": "shogo82148"
    }
  }
}
```

ノードIDをデーターベースなどに保存しているGitHubユーザーは、この期間中に頑張って新IDフォーマットに移行しましょう。

### GitHub プロバイダーの場合

`tfstate` に思いっきりノードIDが記載されている気がするんですが、どう対応すれば良いんですかね？
誰か詳しい人教えて・・・。

## 新フォーマットの詳細

> [Do I need to do anything?](https://github.blog/2021-11-16-graphql-global-id-migration-update/#do-i-need-to-do-anything)
> We suggest you migrate your service to treat these IDs as opaque strings.
> We guarantee the IDs will be unique, therefore you can rely on them directly as references.
>
> (筆者訳) これらのIDはただの無意味な文字列としてサービスを移行することをおすすめします。
> GitHubがIDの一意性を保証するので、これらを直接参照として用いることができます。

言いたいことはわかる。わかるけど `U_kgDOABGo4A` の意味気になりません？
レポジトリのノードIDが `R_kgDOAC8IvQ` となるので、先頭の `U_`, `R_` はノードの種類でしょう。

残りの `kgDOABGo4A` は何でしょう？
旧フォーマットが Base64 だったので、きっとこれも Base64 だと予想してデコードしてみます。
長さが4の倍数ではないのでパディングを追加してデコードしてみましょう。

```
$ echo kgDOABGo4A== | base64 -d
����
```

どうやら結果はASCII文字列ではないようですね。
どんなバイナリになっているのでしょう。

```
$ echo kgDOABGo4A== | base64 -d | hexdump
0000000 92 00 ce 00 11 a8 e0
0000007
```

ちょっとずつ見えてきました。最後の4バイト `00 11 a8 e0` はユーザーID 1157344 を16進数にしたものです。

```
$ printf "%x\n" 1157344
11a8e0
```

全体で7バイトなので4バイト固定の数値というわけではなさそうです。
おそらく `ce` が 4バイト整数を表しているのでしょう。

ここまでくればきっと分かる人にはわかる。これは [MessagePack](https://msgpack.org/ja.html) です。
以下のJSONをメッセージに変換したものが `92 00 ce 00 11 a8 e0` です。

```json
[0, 1157344]
```

## まとめ

- **GitHub GraphQL のノードIDの形式が変わります**。
  - IDというのはずっと変わらないものだと思っていた時期が僕にもありました。
  - ノードIDをデーターベースに保存している場合はマイグレーションが必要です。頑張ってください。
  - Terraform GitHub Provider もなんか移行作業が必要が気がするんですが、やり方が全くわからない。誰か助けて。
- **Base64っぽいからと片っ端からデコードするのはやめましょう**

## 参考

- [Terraform GitHub Provider](https://registry.terraform.io/providers/integrations/github/latest/docs)
- [Branch protection rule failed to be created with new format Github repository node_id #908](https://github.com/integrations/terraform-provider-github/issues/908)
- [Properly handle the new style of Node IDs in the GitHub GraphQL API #914](https://github.com/integrations/terraform-provider-github/pull/914)
- [Using global node IDs](https://docs.github.com/en/graphql/guides/using-global-node-ids)
- [GraphQL global ID migration update](https://github.blog/2021-11-16-graphql-global-id-migration-update/)
- [New global ID format coming to GraphQL](https://github.blog/2021-02-10-new-global-id-format-coming-to-graphql/)
