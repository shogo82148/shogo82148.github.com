---
layout: post
title: "AWS::Lambdaがマネージドインスタンスに対応しました"
slug: aws-lambda-supports-managed-instances
date: 2025-12-16 21:11:00 +0900
comments: true
categories: [perl]
---

この記事は、[Perl Advent Calendar 2025](https://qiita.com/advent-calendar/2025/perl) 16日目の記事です。 15日目は[@mackee_w](https://x.com/mackee_w)で「[YAPC::Fukuoka 2025非公式リジェクトコンを開催しました](https://mackee.hatenablog.com/entry/yapcfukuoka2025-rejectcon)」でした。

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

-----

明日17日は[@ijookid](https://x.com/ijookid)さんで『perlが「オワコン」扱いされるに至った本当の理由とは？』です。

> 🐰 新記事跳ねて、ランタイム道しるべ、\
> Perl と Lambda、手を取り進む、\
> ドキュメントの畦（あぜ）に一輪咲き、\
> 読む者よ知恵を拾い行け、\
> 軽やかに、未来へぴょん。
>
> by [CodeRabbit](https://www.coderabbit.ai/)

## 参考

- [AWS::Lambda](https://metacpan.org/pod/AWS::Lambda)
- [AWS Lambda マネージドインスタンスのご紹介：サーバーレスの簡単さと EC2 の柔軟性](https://aws.amazon.com/jp/blogs/news/introducing-aws-lambda-managed-instances-serverless-simplicity-with-ec2-flexibility/)
- [Add support for AWS_LAMBDA_MAX_CONCURRENCY aws/aws-lambda-go#600](https://github.com/aws/aws-lambda-go/pull/600)
- [Add support for AWS_LAMBDA_MAX_CONCURRENCY shogo82148/p5-aws-lambda#204](https://github.com/shogo82148/p5-aws-lambda/pull/204)
