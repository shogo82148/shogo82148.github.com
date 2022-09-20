---
layout: post
title: "AWS SDK v2 for Goが壊れた、Googleお前もか"
slug: 2022-09-20-aws-sdk-v2-and-googleapi-break-my-code
date: 2022-09-20 10:40:00 +0900
comments: true
categories: [ aws, go, golang, gcp ]
---

何もしていないのに壊れました。（ライブラリのアップデートはした）

## AWS SDK v2 for Goが壊れた

該当のプルリクエストはこちら:

- [ Bump github.com/aws/aws-sdk-go-v2/service/ssm from 1.27.13 to 1.28.0 in /lambda/metadata-updater shogo82148/private-rpm-repo#87](https://github.com/shogo82148/private-rpm-repo/pull/87)

`true` を `*bool` 型に変換できないと怒られてしまいました。

```
./main.go:305:19: cannot use true (untyped bool constant) as *bool value in struct literal
```

どうやらAWS SDK v2のこのコミットの影響でビルドが通らなくなったようです: [aws/aws-sdk-go-v2@a13b7a4](https://github.com/aws/aws-sdk-go-v2/commit/a13b7a41c97b08941717ca0bd16388d52618c1a9#diff-24d0fec0e2431250a13e5e8a8ac54cbbfc7d8bb55677c10795955b6d07c30edc)

```diff
diff --git a/service/ssm/api_op_GetParameter.go b/service/ssm/api_op_GetParameter.go
index c7617dcfd0e..f58354b6528 100644
--- a/service/ssm/api_op_GetParameter.go
+++ b/service/ssm/api_op_GetParameter.go
@@ -39,7 +39,7 @@ type GetParameterInput struct {
 
 	// Return decrypted values for secure string parameters. This flag is ignored for
 	// String and StringList parameter types.
-	WithDecryption bool
+	WithDecryption *bool
 
 	noSmithyDocumentSerde
 }
```

なんでこんなひどいことするの 😭

公開している構造体の `bool` を `*bool` に変えたら、そりゃ壊れます。
これだからAWS SDK v2は・・・。

修正自体は簡単で `true` と書いていたところを `aws.Bool(true)` に変えるだけです。

## Google APIも壊れた

別件で[google.golang.org/api](https://pkg.go.dev/google.golang.org/api)を[v0.93.0](https://pkg.go.dev/google.golang.org/api@v0.93.0)から[v0.96.0](https://pkg.go.dev/google.golang.org/api@v0.96.0)
にあげたところ、こちらも見事に壊れました。

```
# cloud.google.com/go/storage
Error: ../../../../go/pkg/mod/cloud.google.com/go/storage@v1.22.1/bucket.go:1504:30: cannot use r.Condition.AgeInDays (variable of type int64) as type *int64 in struct literal
Error: ../../../../go/pkg/mod/cloud.google.com/go/storage@v1.22.1/bucket.go:1592:30: cannot use rr.Condition.Age (variable of type *int64) as type int64 in struct literal
```

Google... お前もか。

- [fix(storage): *int64 instead of int64 for Age cond googleapis/google-api-go-client#1598](https://github.com/googleapis/google-api-go-client/pull/1598)

```diff
From 5d5097861f632634915858d88a0cb8c9c4fe4b05 Mon Sep 17 00:00:00 2001
From: Frank Natividad <franknatividad@google.com>
Date: Wed, 22 Jun 2022 12:44:00 -0700
Subject: [PATCH] fix(storage): *int64 instead of int64 for Age cond

---
 google-api-go-generator/gen.go | 1 +
 storage/v1/storage-gen.go      | 2 +-
 2 files changed, 2 insertions(+), 1 deletion(-)

diff --git a/google-api-go-generator/gen.go b/google-api-go-generator/gen.go
index 3dc26090268..4e26623dcb1 100644
--- a/google-api-go-generator/gen.go
+++ b/google-api-go-generator/gen.go
@@ -1011,6 +1011,7 @@ var pointerFields = []fieldName{
 	{api: "sqladmin:v1beta4", schema: "Settings", field: "StorageAutoResize"},
 	{api: "sqladmin:v1", schema: "Settings", field: "StorageAutoResize"},
 	{api: "storage:v1", schema: "BucketLifecycleRuleCondition", field: "IsLive"},
+	{api: "storage:v1", schema: "BucketLifecycleRuleCondition", field: "Age"},
 	{api: "storage:v1beta2", schema: "BucketLifecycleRuleCondition", field: "IsLive"},
 	{api: "tasks:v1", schema: "Task", field: "Completed"},
 	{api: "youtube:v3", schema: "ChannelSectionSnippet", field: "Position"},
diff --git a/storage/v1/storage-gen.go b/storage/v1/storage-gen.go
index 0b01f8557c3..37930cd5e16 100644
--- a/storage/v1/storage-gen.go
+++ b/storage/v1/storage-gen.go
@@ -822,7 +822,7 @@ func (s *BucketLifecycleRuleAction) MarshalJSON() ([]byte, error) {
 type BucketLifecycleRuleCondition struct {
 	// Age: Age of an object (in days). This condition is satisfied when an
 	// object reaches the specified age.
-	Age int64 `json:"age,omitempty"`
+	Age *int64 `json:"age,omitempty"`
 
 	// CreatedBefore: A date in RFC 3339 format with only the date part (for
 	// instance, "2013-01-15"). This condition is satisfied when an object
```

こちらは [cloud.google.com/go/storage@v1.23.0](https://github.com/googleapis/google-cloud-go/releases/tag/storage%2Fv1.23.0) で修正されたようです。

- [fix(storage): allow for Age int64* type and int64 type googleapis/google-cloud-go#6230](https://github.com/googleapis/google-cloud-go/pull/6230)

## まとめ

いずれも[dependabot](https://docs.github.com/en/code-security/dependabot)の作成したプルリクエストで気が付きました。
壊れないような安定したライブラリを使う＆自分のライブラリでは互換性を壊さないようにするのがベターですが、残念ながら、まれによく壊れます。
こういう修正がまとめてどかっとくると心が折れるので、dependabotのようなツールを使って、定期的に依存パッケージを更新するようにしておくと安心ですね。

> [@furusax](https://twitter.com/furusax/)「Why do you do sonna hidoi koto ?」
