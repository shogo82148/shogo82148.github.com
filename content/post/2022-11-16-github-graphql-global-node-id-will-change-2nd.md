---
layout: post
title: "GitHub GraphQL のノードIDフォーマットが変わるらしい (続報)"
slug: 2022-10-19-perl-webdb-vol131
date: 2022-11-16 17:17:00 +0900
comments: true
categories: [ github ]
---

以前 [GitHub GraphQL のノードIDフォーマットが変わるらしい](https://shogo82148.github.io/blog/2021/11/29/github-graphql-global-node-id-will-change/) に書いたように、
将来ノードIDフォーマットが変わるらしいらしいです。
これについて、旧式のノードIDを使用した場合に警告がでるようになった、とアナウンスがありました。

- [GraphQL Legacy Global ID Deprecation Message](https://github.blog/changelog/2022-11-10-graphql-legacy-global-id-deprecation-message/)

というわけで、どんな警告文がでるのか試してみました。

## 実際の挙動

試しに僕の名前を取得するクエリを実行してみると、以下のような警告文がでました。

```
$ gh api graphql -f query='query {
  node(id: "MDQ6VXNlcjExNTczNDQ=") {
    ... on User {
      id
      name
      login
    }
  }
}'
{
  "data": {
    "node": {
      "id": "MDQ6VXNlcjExNTczNDQ=",
      "name": "ICHINOSE Shogo",
      "login": "shogo82148"
    }
  },
  "extensions": {
    "warnings": [
      {
        "type": "DEPRECATION",
        "message": "The id MDQ6VXNlcjExNTczNDQ= is deprecated. Update your cache to use the next_global_id from the data payload.",
        "data": {
          "next_global_id": "U_kgDOABGo4A"
        },
        "link": "https://docs.github.com"
      }
    ]
  }
}
```

「ID `MDQ6VXNlcjExNTczNDQ=` は非推奨になりました。 `data` ペイロードに含まれる `next_global_id` でキャッシュを更新してください。」と
親切に新しいIDも教えてくれます。
（しかし、ドキュメントへのリンク・・・大雑把過ぎない？）

## 移行スケージュール

今回のアップデートでは移行スケージュールへの明言はありませんでした。
さきほどの実行結果からわかる通り、古いオブジェクトに対しては相変わらず古いIDが返ってくるので、まだマイグレート期間のようです。

> マイグレート: 既存のオブジェクトについて新旧どちらのフォーマットでもリクエストが可能になります。 レスポンスに含まれるIDに関しては、HTTPヘッダーを使って新旧を切り替えることが可能です。およそ3ヶ月で完了の予定です。

↑約一年前の記事なんですがね・・・「およそ3ヶ月で完了の予定です」とは・・・
まあそう簡単に移行が進むわけない、ってことですね。

今回のアップデートも何割のユーザーが気がつくのか。
レスポンスの結果を読むのは大抵ニンゲンではないので、効果うすいような気もします。

## まとめ

GitHub GraphQLのノードIDの形式が変わります。
ちゃんと移行しましょうね。

・・・そういえば、僕がこの件について調べたのは [Terraform Providerが発端だった](https://github.com/integrations/terraform-provider-github/issues/991) んだけど、あれどうなった？

## 参考

- [GraphQL Legacy Global ID Deprecation Message](https://github.blog/changelog/2022-11-10-graphql-legacy-global-id-deprecation-message/)
- [New global ID format coming to GraphQL](https://github.blog/2021-02-10-new-global-id-format-coming-to-graphql/)
- [GraphQL global ID migration update](https://github.blog/2021-11-16-graphql-global-id-migration-update/)
- [Migrating GraphQL global node IDs](https://docs.github.com/en/graphql/guides/migrating-graphql-global-node-ids)
- [GitHub GraphQL のノードIDフォーマットが変わるらしい](https://shogo82148.github.io/blog/2021/11/29/github-graphql-global-node-id-will-change/)
- [GraphQL global ID migration #991](https://github.com/integrations/terraform-provider-github/issues/991)
