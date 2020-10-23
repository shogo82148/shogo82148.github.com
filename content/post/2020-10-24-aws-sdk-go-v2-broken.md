---
layout: post
title: "AWS SDK for Go v2 の今後が不安な件について"
slug: aws-sdk-go-v2-broken
date: 2020-10-24 01:06:00 +0900
comments: true
categories: [github]
---

なんだか今日はもうコードを書く気がしないので、最近思っていることをつらつらと・・・

タイトルの通り、最近 [AWS SDK for Go v2](https://github.com/aws/aws-sdk-go-v2) の行く末がちょっと気になっています。
あんまり話題になっているのを観測できていないので、少し現状を書いてみます。


## 背景

最近あったビッグイベントが [v0.25.0](https://github.com/aws/aws-sdk-go-v2/releases/tag/v0.25.0) のリリースです。

- [Client Updates in the Preview Version of the AWS SDK for Go V2](https://aws.amazon.com/jp/blogs/developer/client-updates-in-the-preview-version-of-the-aws-sdk-for-go-v2/)

パッケージの構成が見直され、APIの呼び出し方法も変わりました。
まあ、プレビュー版なのでよくあること・・・なんですが、ちょっと変更点が多すぎて追いきれない。

## v0.25.0 移行で入った変更の数々

ちょっと一例を見てみましょう。

### 設定の読み込み

Before: `v0.25.0` より前は `external` パッケージを使って設定を読み込んでいました。

```go
import (
  "github.com/aws/aws-sdk-go-v2/aws/external"
)

func loadConfig() (aws.Config, error) {
  return external.LoadDefaultAWSConfig()
}
```

After: これが `config` パッケージに変更になりました。

```go
import (
  "github.com/aws/aws-sdk-go-v2/config"
)

func loadConfig() (aws.Config, error) {
  return config.LoadDefaultConfig()
}
```

### API の呼び出し

Before: Requestオブジェクトを作って、そのSendメソッドを呼ぶ形式でした。

```go
s3svc := s3.New(cfg)
res, err := s3svc.GetObjectRequest(&s3.GetObjectInput{
  Bucket: aws.String(bucket),
  Key:    aws.String(key),
}).Send(ctx)
```

After: 現行の AWS SDK for Go v1 と近い形になりました。
v1 から `context.Context` を受け取らないインターフェースが削除された形です。

```go
s3svc := s3.NewFromConfig(cfg)
res, err := s3svc.GetObject(ctx, &s3.GetObjectInput{
  Bucket: aws.String(bucket),
  Key:    aws.String(key),
})
```

### 構造体・定数のパッケージ移動

Before: APIにわたす定数などは、例えば S3 なら `s3` パッケージの中にありました。

```go
_, err = svc.PutObjectRequest(&s3.PutObjectInput{
  Body:   strings.NewReader("content"),
  Bucket: aws.String("example-bucket"),
  Key:    aws.String(key),
  ACL:    s3.ObjectCannedACLPublicRead,
}).Send(ctx)
```

After: 新たに `s3/types` パッケージが導入されて、こちらを参照するようになりました。

```go
_, err = svc.PutObject(ctx, &s3.PutObjectInput{
  Body:   strings.NewReader("content"),
  Bucket: aws.String("example-bucket"),
  Key:    aws.String(key),
  ACL:    types.ObjectCannedACLPublicRead,
})
```

### 基本型のラッパー関数の名称変更

Before: Goの基本型には「未設定」という状態がないので、AWS SDK ではすべてをポインタとして扱います。
文字列型の場合、ポインタ型への変換は `aws.String`, ポインタ型からの変換は `awd.StringValue` を使います。
他の基本型についても同様の関数が用意されています。

```go
var foobar *string = aws.String("foobar")
var s string = aws.StringValue(foobar)
```

After: `aws.StringValue` が `aws.ToString` に変更になりました。
他の型についても同様です。

```go
var foobar *string = aws.String("foobar")
var s string = aws.ToString(foobar)
```

### s3manager のパッケージ名変更

一時は削除されてしまった `s3manager` ですが、 `feature/s3/manager` として復活しました。

### Paginator等の削除

これは完全にデグレだと思うんですが、今まであった機能の一部が削除されています。
絶賛開催中で徐々に実装されつつはあるので、そのうち揃うのでしょう・・・たぶん。

### マルチモジュール構成になった

`s3/go.mod`, `ec2/go.mod`, etc. が追加され、サービス毎にバージョン管理できるようになりました。


## 所感

### 開発チームから発表について

さて、変更点を軽くまとめてみましたが、これって本来開発チームがドキュメントにまとめるべきですよね・・・？
v0.25.0 リリースのお知らせは速度の改善を全面に押し出すような内容になっており、具体的な変更点の説明はわずかです。

- [Client Updates in the Preview Version of the AWS SDK for Go V2](https://aws.amazon.com/jp/blogs/developer/client-updates-in-the-preview-version-of-the-aws-sdk-for-go-v2/)

まあ、それが一番の売りなので、それはそれで良いんですが、変更点をもうちょっと丁寧に説明するページを別途用意して欲しかった。
CHANGELOGには上記ブログ記事へのリンクのみで、具体的な変更点は全くわかりません。
godocの内容も悲惨で、 v0.25.0 の変更点が全く反映されておらず、役に立ちませんでした。

- [0.26.0 broke all the things #820](https://github.com/aws/aws-sdk-go-v2/issues/820)

声を上げる人が現れたので、改善傾向にはありますが、ちょっと開発体制大丈夫なのか不安になります。

### 個人的に改悪されたとおもうところ

`types` パッケージの導入。これ自体はいいのですが、全サービス `types` という名称がついています。
複数のAWSサービスを使おうとしたとき、単純に `import` すると名前が重複してしまいます。
もちろん別名をつければ回避できることですが、いちいち別名をつけて回るのはライブラリのユーザーとしては不便です。

`aws.ToString` の導入経緯もよくわかっていません。確かに短くなってタイプしやすくなりました。
でも、それは互換性を破壊するほどの利点なのか？と疑問に思ってます。

### 個人的に改良されたとおもうところ

APIの呼び出し方が v1 と似たような感じになったので、移行が楽になりそうですね。
個人的には、この変更だけで十分恩恵を受けられるので満足です。(むしろ他はいらないんじゃないかと・・・)

マルチモジュール構成になったことで、必要なサービスだけ更新できるようになったのも良い点だと思ってます。
ただ、あまりマルチモジュールのライブラリを使ったことがないので、ちゃんと管理できるのか少し不安もあります。


## まとめ？

- 現状v1こまってないのでv2へ移行するメリットをあまり感じられない
- 今後v2に徐々に移行する流れなのかと思って試しては見たものの、今回の破壊的変更でちょっと心が折れそう
  - ここまでの破壊的変更は入らないと言っているけど・・・今回の件で不信感がある

そういうわけで、v2で書いたけど今回の件で壊れてしまったコードを、最新バージョンまで追従させるかすごく迷ってます。
気になる点があればフィードバック送ればいいじゃんという話もありますが、すごく疲れそうなのでv1を使い続けようかな・・・。

AWSを使っている Gopher の皆さん、どう思ってます？

## 参考

- [aws/aws-sdk-go-v2](https://github.com/aws/aws-sdk-go-v2)
- [AWS SDK for Go 2.0 Developer Preview](https://aws.amazon.com/jp/blogs/developer/aws-sdk-for-go-2-0-developer-preview/)
- [Client Updates in the Preview Version of the AWS SDK for Go V2](https://aws.amazon.com/jp/blogs/developer/client-updates-in-the-preview-version-of-the-aws-sdk-for-go-v2/)
- [0.26.0 broke all the things #820](https://github.com/aws/aws-sdk-go-v2/issues/820)
