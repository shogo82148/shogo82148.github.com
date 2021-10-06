---
layout: post
title: "AWS Lambda Perl Runtime の Arm64 互換レイヤーを公開しました"
slug: aws-lambda-perl-runtime-on-arm64
date: 2021-10-06 09:06:00 +0900
comments: true
categories: [aws, perl]
---

[AWS Lambda の Arm64 対応試してみた](https://shogo82148.github.io/blog/2021/10/01/arm64-in-aws-lambda/) の続き。

- [Achieve up to 34% better price/performance with AWS Lambda Functions powered by AWS Graviton2 processor](https://aws.amazon.com/jp/about-aws/whats-new/2021/09/better-price-performance-aws-lambda-functions-aws-graviton2-processor/)

前回は クロスコンパイルが簡単な Go で試してみました。
でもやっぱり・・・皆さん **Perl** を動かしたいですよね？

というわけでご用意しました。

## ARN 一覧

### ランタイム本体

ランタイム本体のビルド済みレイヤーです。使い方は過去記事をどうぞ。

- [AWS LambdaでCGIを蘇らせる](https://shogo82148.github.io/blog/2018/12/16/run-cgi-in-aws-lambda/)

- `arn:aws:lambda:ap-northeast-1:445285296882:layer:perl-5-32-runtime-al2-arm64:1`
- `arn:aws:lambda:ap-south-1:445285296882:layer:perl-5-32-runtime-al2-arm64:1`
- `arn:aws:lambda:ap-southeast-1:445285296882:layer:perl-5-32-runtime-al2-arm64:1`
- `arn:aws:lambda:ap-southeast-2:445285296882:layer:perl-5-32-runtime-al2-arm64:1`
- `arn:aws:lambda:eu-central-1:445285296882:layer:perl-5-32-runtime-al2-arm64:1`
- `arn:aws:lambda:eu-west-1:445285296882:layer:perl-5-32-runtime-al2-arm64:1`
- `arn:aws:lambda:eu-west-2:445285296882:layer:perl-5-32-runtime-al2-arm64:1`
- `arn:aws:lambda:us-east-1:445285296882:layer:perl-5-32-runtime-al2-arm64:1`
- `arn:aws:lambda:us-east-2:445285296882:layer:perl-5-32-runtime-al2-arm64:1`
- `arn:aws:lambda:us-west-2:445285296882:layer:perl-5-32-runtime-al2-arm64:1`

### Paws

AWS SDK for Perl のビルド済みレイヤーです。ランタイム本体と合わせてご使用ください。

- [AWS SDK for Perl Lambda Layerを公開しました](https://shogo82148.github.io/blog/2019/07/16/aws-lambda-paws-layer/)

- `arn:aws:lambda:ap-northeast-1:445285296882:layer:perl-5-34-paws-al2-arm64:1`
- `arn:aws:lambda:ap-south-1:445285296882:layer:perl-5-34-paws-al2-arm64:1`
- `arn:aws:lambda:ap-southeast-1:445285296882:layer:perl-5-34-paws-al2-arm64:1`
- `arn:aws:lambda:ap-southeast-2:445285296882:layer:perl-5-34-paws-al2-arm64:1`
- `arn:aws:lambda:eu-central-1:445285296882:layer:perl-5-34-paws-al2-arm64:1`
- `arn:aws:lambda:eu-west-1:445285296882:layer:perl-5-34-paws-al2-arm64:1`
- `arn:aws:lambda:eu-west-2:445285296882:layer:perl-5-34-paws-al2-arm64:1`
- `arn:aws:lambda:us-east-1:445285296882:layer:perl-5-34-paws-al2-arm64:1`
- `arn:aws:lambda:us-east-2:445285296882:layer:perl-5-34-paws-al2-arm64:1`
- `arn:aws:lambda:us-west-2:445285296882:layer:perl-5-34-paws-al2-arm64:1`

## x86\_64 レイヤー

レイヤーの名前にCPUアーキテクチャーが入るようになったので、
わかりやすいよう x86\_64 のレイヤー名も変更しました。
もちろん今までのレイヤー名でも同じものが利用可能です。

### ランタイム本体

- `arn:aws:lambda:af-south-1:445285296882:layer:perl-5-34-runtime-al2-x86_64:1`
- `arn:aws:lambda:ap-east-1:445285296882:layer:perl-5-34-runtime-al2-x86_64:1`
- `arn:aws:lambda:ap-northeast-1:445285296882:layer:perl-5-34-runtime-al2-x86_64:2`
- `arn:aws:lambda:ap-northeast-2:445285296882:layer:perl-5-34-runtime-al2-x86_64:1`
- `arn:aws:lambda:ap-northeast-3:445285296882:layer:perl-5-34-runtime-al2-x86_64:1`
- `arn:aws:lambda:ap-south-1:445285296882:layer:perl-5-34-runtime-al2-x86_64:2`
- `arn:aws:lambda:ap-southeast-1:445285296882:layer:perl-5-34-runtime-al2-x86_64:2`
- `arn:aws:lambda:ap-southeast-2:445285296882:layer:perl-5-34-runtime-al2-x86_64:2`
- `arn:aws:lambda:ca-central-1:445285296882:layer:perl-5-34-runtime-al2-x86_64:1`
- `arn:aws:lambda:eu-central-1:445285296882:layer:perl-5-34-runtime-al2-x86_64:2`
- `arn:aws:lambda:eu-south-1:445285296882:layer:perl-5-34-runtime-al2-x86_64:1`
- `arn:aws:lambda:eu-west-1:445285296882:layer:perl-5-34-runtime-al2-x86_64:2`
- `arn:aws:lambda:eu-west-2:445285296882:layer:perl-5-34-runtime-al2-x86_64:2`
- `arn:aws:lambda:eu-west-3:445285296882:layer:perl-5-34-runtime-al2-x86_64:1`
- `arn:aws:lambda:me-south-1:445285296882:layer:perl-5-34-runtime-al2-x86_64:1`
- `arn:aws:lambda:sa-east-1:445285296882:layer:perl-5-34-runtime-al2-x86_64:1`
- `arn:aws:lambda:us-east-1:445285296882:layer:perl-5-34-runtime-al2-x86_64:2`
- `arn:aws:lambda:us-east-2:445285296882:layer:perl-5-34-runtime-al2-x86_64:2`
- `arn:aws:lambda:us-west-1:445285296882:layer:perl-5-34-runtime-al2-x86_64:1`
- `arn:aws:lambda:us-west-2:445285296882:layer:perl-5-34-runtime-al2-x86_64:2`

ちなみにレイヤーバージョン 1 と 2 が混在しているのは、CloudFormation のテンプレートパラメーターを利用しようとして失敗したためです。

1. レイヤー管理をしている CloudFormation テンプレートに `Architectures: [ x86_64 ]` を追加する
2. Arm64未対応のリージョンでは「`Architectures` なんて属性知らないよ！」と言われる。もちろん Arm64 対応リージョンでは作成に成功する
3. 仕方がないので `Architectures: [ x86_64 ]` を削除して再生成
4. Arm64 対応済みリージョンでは `Architectures` の有無が異なるのでバージョン2に上がる。未対応リージョンでは新規作成になるのでバージョン1が作成される

未対応リージョンでは、さすがに `Architectures: [ arm64 ]` は通らないだろうけど、 `Architectures: [ x86_64 ]` は通ると思ったんだ・・・。
互換アーキテクチャーが明示されているか否かの違いだけで、中身は同じものです。

### Paws

- `arn:aws:lambda:af-south-1:445285296882:layer:perl-5-34-paws-al2-x86_64:1`
- `arn:aws:lambda:ap-east-1:445285296882:layer:perl-5-34-paws-al2-x86_64:1`
- `arn:aws:lambda:ap-northeast-1:445285296882:layer:perl-5-34-paws-al2-x86_64:2`
- `arn:aws:lambda:ap-northeast-2:445285296882:layer:perl-5-34-paws-al2-x86_64:1`
- `arn:aws:lambda:ap-northeast-3:445285296882:layer:perl-5-34-paws-al2-x86_64:1`
- `arn:aws:lambda:ap-south-1:445285296882:layer:perl-5-34-paws-al2-x86_64:2`
- `arn:aws:lambda:ap-southeast-1:445285296882:layer:perl-5-34-paws-al2-x86_64:2`
- `arn:aws:lambda:ap-southeast-2:445285296882:layer:perl-5-34-paws-al2-x86_64:2`
- `arn:aws:lambda:ca-central-1:445285296882:layer:perl-5-34-paws-al2-x86_64:1`
- `arn:aws:lambda:eu-central-1:445285296882:layer:perl-5-34-paws-al2-x86_64:2`
- `arn:aws:lambda:eu-south-1:445285296882:layer:perl-5-34-paws-al2-x86_64:1`
- `arn:aws:lambda:eu-west-1:445285296882:layer:perl-5-34-paws-al2-x86_64:2`
- `arn:aws:lambda:eu-west-2:445285296882:layer:perl-5-34-paws-al2-x86_64:2`
- `arn:aws:lambda:eu-west-3:445285296882:layer:perl-5-34-paws-al2-x86_64:1`
- `arn:aws:lambda:me-south-1:445285296882:layer:perl-5-34-paws-al2-x86_64:1`
- `arn:aws:lambda:sa-east-1:445285296882:layer:perl-5-34-paws-al2-x86_64:1`
- `arn:aws:lambda:us-east-1:445285296882:layer:perl-5-34-paws-al2-x86_64:2`
- `arn:aws:lambda:us-east-2:445285296882:layer:perl-5-34-paws-al2-x86_64:2`
- `arn:aws:lambda:us-west-1:445285296882:layer:perl-5-34-paws-al2-x86_64:1`
- `arn:aws:lambda:us-west-2:445285296882:layer:perl-5-34-paws-al2-x86_64:2`

## 参考

- [AWS::Lambda 0.0.30](https://metacpan.org/release/SHOGO/AWS-Lambda-0.0.30/view/lib/AWS/Lambda.pm)
- [Achieve up to 34% better price/performance with AWS Lambda Functions powered by AWS Graviton2 processor](https://aws.amazon.com/jp/about-aws/whats-new/2021/09/better-price-performance-aws-lambda-functions-aws-graviton2-processor/)
- [Release 1.33.0 - AWS Lambda ARM Support](https://github.com/aws/aws-sam-cli/releases/tag/v1.33.0)
- [AWS::Serverless::Function - AWS Serverless Application Model](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-resource-function.html)
- [CreateFunction - AWS Lambda API](https://docs.aws.amazon.com/lambda/latest/dg/API_CreateFunction.html#SSS-CreateFunction-request-Architectures)
- [AWS Lambda の Arm64 対応試してみた](https://shogo82148.github.io/blog/2021/10/01/arm64-in-aws-lambda/)
- [AWS LambdaでCGIを蘇らせる](https://shogo82148.github.io/blog/2018/12/16/run-cgi-in-aws-lambda/)
- [AWS SDK for Perl Lambda Layerを公開しました](https://shogo82148.github.io/blog/2019/07/16/aws-lambda-paws-layer/)
