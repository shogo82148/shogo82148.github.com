---
layout: post
title: "AWS Lambda の Arm64 対応試してみた"
slug: arm64-in-aws-lambda
date: 2021-10-01 21:36:00 +0900
comments: true
categories: [aws]
---

AWS Lambda の ARM サポートが発表されましたね。

- [Achieve up to 34% better price/performance with AWS Lambda Functions powered by AWS Graviton2 processor](https://aws.amazon.com/jp/about-aws/whats-new/2021/09/better-price-performance-aws-lambda-functions-aws-graviton2-processor/)

というわけで早速触ってみました。

## 祝日 API で試してみる

[先日公開した祝日API](https://shogo82148.github.io/blog/2021/09/04/holidays-api-is-released/) で試してみました。

- https://github.com/shogo82148/holidays-jp/pull/22

変更は実質2行です。簡単ですね！

```diff
diff --git a/holidays-api/Makefile b/holidays-api/Makefile
index a39a3fa..0908902 100644
--- a/holidays-api/Makefile
+++ b/holidays-api/Makefile
@@ -1,6 +1,6 @@
 .PHONY: build-HolidaysFunction
 build-HolidaysFunction:
-	GOOS=linux GOARCH=amd64 go build -o $(ARTIFACTS_DIR)/bootstrap -tags lambda.norpc ./cmd/bootstrap
+	GOOS=linux GOARCH=arm64 go build -o $(ARTIFACTS_DIR)/bootstrap -tags lambda.norpc ./cmd/bootstrap
 
 .PHONY: test
 test:
diff --git a/template.yaml b/template.yaml
index 73fe7bb..06db749 100644
--- a/template.yaml
+++ b/template.yaml
@@ -16,6 +16,7 @@ Resources:
       CodeUri: holidays-api/
       Handler: holidays-api
       Runtime: provided.al2
+      Architectures: [ arm64 ]
       Events:
         CatchAll:
           Type: HttpApi
```

APIを叩いてみましたが、問題なく動いているようですね。

```
% curl https://holidays-jp.shogo82148.com/2021/10/ | jq .
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100    15  100    15    0     0     90      0 --:--:-- --:--:-- --:--:--    90
{
  "holidays": []
}
```

・・・今年の10月は祝日がないだと・・・？

## AWS SAM でのやり方

**2021-10-02 9:38 追記**

今朝確認したらドキュメントに追加されてました。

- https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-resource-function.html#sam-function-architectures

> Architectures
>
> The instruction set architecture for the function.
>
> For more information about this property, see Lambda instruction set architectures in the AWS Lambda Developer Guide.
>
> Valid values: One of x86_64 or arm64
>
> Type: List
>
> Required: No
>
> Default: x86_64
>
> AWS CloudFormation compatibility: This property is passed directly to the Architectures property of an AWS::Lambda::Function resource.

なお日本語版はまだない。

**追記ここまで**

2021-10-01 21:37 現在、最新の AWS SAM CLI で ARM が追加されています。

- [Release 1.33.0 - AWS Lambda ARM Support](https://github.com/aws/aws-sam-cli/releases/tag/v1.33.0)

> aws-sam-cli-bot released this 17 hours ago

リリースから 17 時間とできたてホヤホヤなので、今の所 CPUアーキテクチャーの指定方法は Undocumented でした・・・。

- [AWS::Serverless::Function - AWS Serverless Application Model](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-resource-function.html)

困ったので、 AWS Lambda の API ドキュメントを見ると、それっぽい項目がすでに追加されていますね。

- [CreateFunction - AWS Lambda API](https://docs.aws.amazon.com/lambda/latest/dg/API_CreateFunction.html#SSS-CreateFunction-request-Architectures)

> Architectures
>
> The instruction set architecture that the function supports. Enter a string array with one of the valid values. The default value is x86_64.
>
> Type: Array of strings
>
> Array Members: Fixed number of 1 item.
>
> Valid Values: x86_64 | arm64
>
> Required: No

AWS SAM の基盤となっている CloudFormation のテンプレートは、ほとんど API のリクエスト形式を流用しているので、ドキュメント通り `Architectures` に "Array of strings" を渡せば行けるんじゃ？とやってみたら行けました！

```diff
diff --git a/template.yaml b/template.yaml
index 73fe7bb..06db749 100644
--- a/template.yaml
+++ b/template.yaml
@@ -16,6 +16,7 @@ Resources:
       CodeUri: holidays-api/
       Handler: holidays-api
       Runtime: provided.al2
+      Architectures: [ arm64 ]
       Events:
         CatchAll:
           Type: HttpApi
```

スクリプト言語だとソースコードに変更がなく面白みに欠けるので、Go のバイナリをデプロイしてみました。
`GOARCH=arm64` を指定して ARM64 のバイナリにクロスコンパイルします。

```diff
diff --git a/holidays-api/Makefile b/holidays-api/Makefile
index a39a3fa..0908902 100644
--- a/holidays-api/Makefile
+++ b/holidays-api/Makefile
@@ -1,6 +1,6 @@
 .PHONY: build-HolidaysFunction
 build-HolidaysFunction:
-	GOOS=linux GOARCH=amd64 go build -o $(ARTIFACTS_DIR)/bootstrap -tags lambda.norpc ./cmd/bootstrap
+	GOOS=linux GOARCH=arm64 go build -o $(ARTIFACTS_DIR)/bootstrap -tags lambda.norpc ./cmd/bootstrap
 
 .PHONY: test
 test:
```

## まとめ

祝日を返して

## 参考

- [Achieve up to 34% better price/performance with AWS Lambda Functions powered by AWS Graviton2 processor](https://aws.amazon.com/jp/about-aws/whats-new/2021/09/better-price-performance-aws-lambda-functions-aws-graviton2-processor/)
- [Release 1.33.0 - AWS Lambda ARM Support](https://github.com/aws/aws-sam-cli/releases/tag/v1.33.0)
- [AWS::Serverless::Function - AWS Serverless Application Model](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-resource-function.html)
- [CreateFunction - AWS Lambda API](https://docs.aws.amazon.com/lambda/latest/dg/API_CreateFunction.html#SSS-CreateFunction-request-Architectures)
