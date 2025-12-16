---
layout: post
title: "AWS::Lambadaがマネージドインスタンスに対応しました"
slug: aws-lambda-supports-managed-instances
date: 2025-12-16 21:11:00 +0900
comments: true
categories: [perl]
---

## 背景

2025 年 11 月 30 日、AWS Lambda マネージドインスタンスが発表されました。

- [AWS Lambda マネージドインスタンスのご紹介：サーバーレスの簡単さと EC2 の柔軟性](https://aws.amazon.com/jp/blogs/news/introducing-aws-lambda-managed-instances-serverless-simplicity-with-ec2-flexibility/)

AWS Lambda 関数をEC2上で実行できるようにするサービスです。
楽しそうですね。[AWS::Lambda](https://metacpan.org/pod/AWS::Lambda)でもサポートしてみました。

## 実装

現時点でのドキュメントには残念ながらカスタムランタイムのサポートはありません。

- [Lambda Managed Instances runtimes](https://docs.aws.amazon.com/lambda/latest/dg/lambda-managed-instances-runtimes.html)

ただし、カスタムランタイムのサポート予定はあるみたい？Goのランタイムでは対応が進んでます。

- [Add support for AWS_LAMBDA_MAX_CONCURRENCY aws/aws-lambda-go#600](https://github.com/aws/aws-lambda-go/pull/600)

これを参考に実装を進めました。

- [Add support for AWS_LAMBDA_MAX_CONCURRENCY shogo82148/p5-aws-lambda#204](https://github.com/shogo82148/p5-aws-lambda/pull/204)

## Perlランタイムの並行制御

DefaultのAWS Lambda実行環境では、ひとつ実行環境に対して一度にひとつのタスクが割り当てられます。
それに対して、マネージドインスタンスではひとつの実行環境に一度に複数のタスクが割り当てられ、各タスクは並行処理されます。ランタイムによってタスクの並行処理のやり方が異なるため、注意が必要です。

[AWS::Lambda](https://metacpan.org/pod/AWS::Lambda)の場合はプロセスによってタスクの並行処理を行います。

## まとめ

[AWS::Lambda](https://metacpan.org/pod/AWS::Lambda) でAWS Lambda マネージドインスタンスのサポートを行いました。
ぜひ試してみてください！

## 参考

- [AWS::Lambda](https://metacpan.org/pod/AWS::Lambda)
- [AWS Lambda マネージドインスタンスのご紹介：サーバーレスの簡単さと EC2 の柔軟性](https://aws.amazon.com/jp/blogs/news/introducing-aws-lambda-managed-instances-serverless-simplicity-with-ec2-flexibility/)
- [Add support for AWS_LAMBDA_MAX_CONCURRENCY aws/aws-lambda-go#600](https://github.com/aws/aws-lambda-go/pull/600)
- [Add support for AWS_LAMBDA_MAX_CONCURRENCY shogo82148/p5-aws-lambda#204](https://github.com/shogo82148/p5-aws-lambda/pull/204)
