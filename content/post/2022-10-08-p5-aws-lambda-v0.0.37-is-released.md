---
layout: post
title: "AWS::Lambda v0.0.37リリースのお知らせ"
slug: 2022-10-08-p5-aws-lambda-v0.0.37-is-released
date: 2022-10-08 23:10:00 +0900
comments: true
categories: [ aws, perl, aws-lambda ]
---

[AWS::Lambda v0.0.37](https://metacpan.org/release/SHOGO/AWS-Lambda-0.0.37/view/lib/AWS/Lambda.pm) をリリースしました。

## 12のリージョンでARM64互換レイヤーを公開

新たに12のリージョンでAWS LambdaのARM64(AWS Graviton2)対応が発表されました。

- [AWS Lambda Functions powered by AWS Graviton2 now available in 12 additional regions](https://aws.amazon.com/about-aws/whats-new/2022/10/aws-lambda-functions-graviton2-12-regions/)

今回公開されたのは、以下の12のリージョンです。

- アフリカ (ケープタウン) `af-south-1`
- アジアパシフィック (ソウル) `ap-northeast-2`
- アジアパシフィック (ジャカルタ) `ap-southeast-3`
- アジアパシフィック (香港) `ap-east-1`
- アジアパシフィック (大阪) `ap-northeast-3`
- カナダ(中部) `ca-central-1`
- ヨーロッパ (パリ) `eu-west-3`
- ヨーロッパ (ストックホルム) `eu-north-1`
- ヨーロッパ (ミラノ) `eu-south-1`
- 中東 (バーレーン) `me-south-1`
- 南米 (サンパウロ) `sa-east-1`
- 米国西部(北カリフォルニア) `us-west-1`

以下の10のリージョンは2021年9月から利用可能だったので、約1年遅れの登場です。
([AWS Graviton2 プロセッサを利用する AWS Lambda 関数を使用して最大 34% 優れた料金/パフォーマンスを実現](https://aws.amazon.com/jp/about-aws/whats-new/2021/09/better-price-performance-aws-lambda-functions-aws-graviton2-processor/))

- 米国東部 (オハイオ) `us-east-2`
- 米国東部(バージニア北部) `us-east-1`
- 米国西部 (オレゴン) `us-west-2`
- アジアパシフィック (ムンバイ) `ap-south-1`
- アジアパシフィック (シンガポール) `ap-southeast-1`
- アジアパシフィック (シドニー) `ap-southeast-2`
- アジアパシフィック (東京) `ap-northeast-1`
- 欧州(フランクフルト) `eu-central-1`
- ヨーロッパ (アイルランド) `eu-west-1`
- ヨーロッパ (ロンドン) `eu-west-2`

これを受け、「[AWS Lambda Perl Runtime の Arm64 互換レイヤーを公開しました ](https://shogo82148.github.io/blog/2021/10/06/aws-lambda-perl-runtime-on-arm64/)」
で公開したARM64互換レイヤーも、ARM64対応のリージョンで公開しました。
利用可能なARNは以下の通りです。

- `arn:aws:lambda:af-south-1:445285296882:layer:perl-5-36-runtime-al2-arm64:1`
- `arn:aws:lambda:ap-east-1:445285296882:layer:perl-5-36-runtime-al2-arm64:1`
- `arn:aws:lambda:ap-northeast-1:445285296882:layer:perl-5-36-runtime-al2-arm64:1`
- `arn:aws:lambda:ap-northeast-2:445285296882:layer:perl-5-36-runtime-al2-arm64:1`
- `arn:aws:lambda:ap-northeast-3:445285296882:layer:perl-5-36-runtime-al2-arm64:1`
- `arn:aws:lambda:ap-south-1:445285296882:layer:perl-5-36-runtime-al2-arm64:1`
- `arn:aws:lambda:ap-southeast-1:445285296882:layer:perl-5-36-runtime-al2-arm64:1`
- `arn:aws:lambda:ap-southeast-2:445285296882:layer:perl-5-36-runtime-al2-arm64:1`
- `arn:aws:lambda:ap-southeast-3:445285296882:layer:perl-5-36-runtime-al2-arm64:1`
- `arn:aws:lambda:ca-central-1:445285296882:layer:perl-5-36-runtime-al2-arm64:1`
- `arn:aws:lambda:eu-central-1:445285296882:layer:perl-5-36-runtime-al2-arm64:1`
- `arn:aws:lambda:eu-north-1:445285296882:layer:perl-5-36-runtime-al2-arm64:1`
- `arn:aws:lambda:eu-south-1:445285296882:layer:perl-5-36-runtime-al2-arm64:1`
- `arn:aws:lambda:eu-west-1:445285296882:layer:perl-5-36-runtime-al2-arm64:1`
- `arn:aws:lambda:eu-west-2:445285296882:layer:perl-5-36-runtime-al2-arm64:1`
- `arn:aws:lambda:eu-west-3:445285296882:layer:perl-5-36-runtime-al2-arm64:1`
- `arn:aws:lambda:me-south-1:445285296882:layer:perl-5-36-runtime-al2-arm64:1`
- `arn:aws:lambda:sa-east-1:445285296882:layer:perl-5-36-runtime-al2-arm64:1`
- `arn:aws:lambda:us-east-1:445285296882:layer:perl-5-36-runtime-al2-arm64:1`
- `arn:aws:lambda:us-east-2:445285296882:layer:perl-5-36-runtime-al2-arm64:1`
- `arn:aws:lambda:us-west-1:445285296882:layer:perl-5-36-runtime-al2-arm64:1`
- `arn:aws:lambda:us-west-2:445285296882:layer:perl-5-36-runtime-al2-arm64:1`

アジアパシフィック (大阪) に来てくれたのは嬉しいですね！

## 中東 (アラブ首長国連邦) リージョンでx86-64互換レイヤーを公開

完全に見逃していたのですが、今年の8月に中東 (アラブ首長国連邦) `me-central-1` リージョンが公開されました。
マネージメントコンソールをポチポチやっていたら、リージョンの有効化を求められたので気が付きました。

- [Now Open–AWS Region in the United Arab Emirates (UAE)](https://aws.amazon.com/blogs/aws/now-open-aws-region-in-the-united-arab-emirates-uae/)

そういわけで、中東 (アラブ首長国連邦) `me-central-1` でもPerl Runtimeを公開しました。
ARM64対応はまだみたいなので、x86-64のみのサポートです。

- `arn:aws:lambda:me-central-1:445285296882:layer:perl-5-36-runtime-al2-x86_64:1`

## 参考

- [Now Open–AWS Region in the United Arab Emirates (UAE)](https://aws.amazon.com/blogs/aws/now-open-aws-region-in-the-united-arab-emirates-uae/)
- [AWS Lambda Functions powered by AWS Graviton2 now available in 12 additional regions](https://aws.amazon.com/about-aws/whats-new/2022/10/aws-lambda-functions-graviton2-12-regions/)
- [AWS Graviton2 プロセッサを利用する AWS Lambda 関数を使用して最大 34% 優れた料金/パフォーマンスを実現](https://aws.amazon.com/jp/about-aws/whats-new/2021/09/better-price-performance-aws-lambda-functions-aws-graviton2-processor/)
- [AWS LambdaでCGIを蘇らせる](https://shogo82148.github.io/blog/2018/12/16/run-cgi-in-aws-lambda/)
- [AWS Lambda Perl Runtime の Arm64 互換レイヤーを公開しました ](https://shogo82148.github.io/blog/2021/10/06/aws-lambda-perl-runtime-on-arm64/)
