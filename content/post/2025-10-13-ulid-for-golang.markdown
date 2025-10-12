---
layout: post
title: "Go向けのULIDライブラリを作った"
slug: ulid-for-golang
date: 2025-10-13 00:50:00 +0900
comments: true
categories: [go, golang]
---

## 背景・目的

[ULID]を使っているプロジェクトを見かけました。
Go言語のULID実装は [oklog/ulid] が有名です。
見かけたプロジェクトでも [oklog/ulid] を利用していました。

しかし最新版 [oklog/ulid v2.1.1](https://github.com/oklog/ulid/tree/v2.1.1) のソースコードを読んでみると色々と気になる実装があります。

まずはデフォルトのエントロピー源が [math/rand] であること。
[math/rand] は暗号論的に安全な乱数ではありません。
過去の採番履歴から、次に採番されるIDが予測されてしまう可能性があります。

さらに疑似乱数のSeedに現在時刻（`time.Now().UnixNano()`）を使用している点。
1秒って10億ナノ秒しかないので、たとえば1秒間に約3万プロセスが一斉に起動するような大規模システムの場合、[誕生日のパラドックス] から50%の確率でSeedが衝突します。
意外と衝突確率高いと思いませんか？
Seedが衝突したということは生成される乱数列も同じなので、ULIDが衝突する確率も高くなります。

最後に、Base32に含まれていない文字が入力された場合、`Parse` 関数はエラーを報告しないという点。
この場合どのようなULIDが返却されるかは未定義です。

> Parse parses an encoded ULID, returning an error in case of failure. 
> ErrDataSize is returned if the len(ulid) is different from an encoded ULID's length. Invalid encodings produce undefined ULIDs. For a version that returns an error instead, see ParseStrict. 
> from https://pkg.go.dev/github.com/oklog/ulid/v2@v2.1.1#Parse

外部からの入力を受け付けるには心もとない挙動です。

## 実装

これらの点が気になったので、車輪の再発明ですが、自分でULIDの実装をしてみることにしました。

- [shogo82148/go-ulid](https://github.com/shogo82148/go-ulid)

デフォルトのエントロピー源を [crypto/rand] に変更しました。
これならULIDの衝突確率を最小限に抑えることができます。

`Parse` 関数は Base32に含まれていない文字が入力された場合エラーを返すようになりました。

## まとめ

[oklog/ulid] にちょっと気になる点があったので、自分でULIDの実装を作ってみました。

- [shogo82148/go-ulid](https://github.com/shogo82148/go-ulid)

より安全に使えるようになっていると思っているので、ぜひご活用ください。

## 参考

- [shogo82148/go-ulid](https://github.com/shogo82148/go-ulid)
- [ULID]
- [oklog/ulid]
- [math/rand]
- [crypto/rand]
- [誕生日のパラドックス]

[ULID]: https://github.com/ulid/spec
[oklog/ulid]: https://github.com/oklog/ulid
[math/rand]: https://pkg.go.dev/math/rand
[crypto/rand]: https://pkg.go.dev/crypto/rand
[誕生日のパラドックス]: https://ja.wikipedia.org/wiki/%E8%AA%95%E7%94%9F%E6%97%A5%E3%81%AE%E3%83%91%E3%83%A9%E3%83%89%E3%83%83%E3%82%AF%E3%82%B9
