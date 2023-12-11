---
layout: post
title: "Amazon Linux 2023ベースのAWS Lambda Perl Runtimeを公開しました"
slug: 2023-12-05-al2023-based-perl-runtime-is-available
date: 2023-12-05 21:00:00 +0900
comments: true
categories: [perl, aws, aws-lambda]
---

この記事は、[Perl Advent Calendar 2023](https://qiita.com/advent-calendar/2023/perl) 5日目の記事です。
4日目は[@doikoji](https://qiita.com/doikoji)で「[ChatGPTとperl：古のCGIスクリプトを現代的な環境に合わせて再生させようとした話](https://qiita.com/doikoji/items/ee4be53cb3fa95dcc649)」でした。

-----

AWS LambdaにAmazon Linux 2023ベースのカスタムランタイムが追加されました。
これはつまり・・・

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">Perlを…ビルドせねば…<a href="https://t.co/akYtrs3qXM">https://t.co/akYtrs3qXM</a></p>&mdash; f96fd3a0-bdb9-4f10-b69f-8f765c1d341c ICHINOSEShogo (@shogo82148) <a href="https://twitter.com/shogo82148/status/1722934945352700050?ref_src=twsrc%5Etfw">November 10, 2023</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script> 

ということでPerlをビルドしました。

- [AWS::Lambda v0.4.1](https://metacpan.org/release/SHOGO/AWS-Lambda-0.4.0/view/lib/AWS/Lambda.pm)

使い方はPerl Hackers Hubをどうぞ。

- [Perl Hackers Hub 第75回 AWS Lambda入門 サーバレスでもPerlを活用しよう！（1）](https://gihyo.jp/dev/serial/01/perl-hackers-hub/007501?summary)
- [Perl Hackers Hub 第75回 AWS Lambda入門 サーバレスでもPerlを活用しよう！（2）](https://gihyo.jp/dev/serial/01/perl-hackers-hub/007501?summary)

## ビルド済み公開 Perl Runtime Layer

いつも通りビルド済みのレイヤーを公開しています。

- x86_64 architecture
    - `arn:aws:lambda:af-south-1:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:ap-east-1:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:ap-northeast-1:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:ap-northeast-2:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:ap-northeast-3:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:ap-south-1:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:ap-south-2:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:ap-southeast-1:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:ap-southeast-2:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:ap-southeast-3:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:ap-southeast-4:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:ca-central-1:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:eu-central-1:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:eu-central-2:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:eu-north-1:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:eu-south-1:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:eu-south-2:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:eu-west-1:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:eu-west-2:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:eu-west-3:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:il-central-1:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:me-central-1:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:me-south-1:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:sa-east-1:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:us-east-1:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:us-east-2:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:us-west-1:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
    - `arn:aws:lambda:us-west-2:445285296882:layer:perl-5-38-runtime-al2023-x86_64:2`
- arm64 architecture
    - `arn:aws:lambda:af-south-1:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:ap-east-1:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:ap-northeast-1:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:ap-northeast-2:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:ap-northeast-3:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:ap-south-1:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:ap-south-2:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:ap-southeast-1:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:ap-southeast-2:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:ap-southeast-3:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:ap-southeast-4:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:ca-central-1:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:eu-central-1:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:eu-central-2:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:eu-north-1:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:eu-south-1:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:eu-south-2:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:eu-west-1:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:eu-west-2:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:eu-west-3:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:il-central-1:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:me-central-1:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:me-south-1:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:sa-east-1:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:us-east-1:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:us-east-2:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:us-west-1:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`
    - `arn:aws:lambda:us-west-2:445285296882:layer:perl-5-38-runtime-al2023-arm64:2`

## ビルド済み公開 Paws Layer

- x86_64 architecture
    - `arn:aws:lambda:af-south-1:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:ap-east-1:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:ap-northeast-1:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:ap-northeast-2:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:ap-northeast-3:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:ap-south-1:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:ap-south-2:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:ap-southeast-1:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:ap-southeast-2:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:ap-southeast-3:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:ap-southeast-4:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:ca-central-1:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:eu-central-1:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:eu-central-2:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:eu-north-1:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:eu-south-1:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:eu-south-2:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:eu-west-1:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:eu-west-2:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:eu-west-3:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:il-central-1:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:me-central-1:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:me-south-1:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:sa-east-1:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:us-east-1:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:us-east-2:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:us-west-1:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
    - `arn:aws:lambda:us-west-2:445285296882:layer:perl-5-38-runtime-paws-x86_64:3`
- arm64 architecture
    - `arn:aws:lambda:af-south-1:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:ap-east-1:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:ap-northeast-1:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:ap-northeast-2:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:ap-northeast-3:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:ap-south-1:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:ap-south-2:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:ap-southeast-1:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:ap-southeast-2:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:ap-southeast-3:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:ap-southeast-4:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:ca-central-1:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:eu-central-1:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:eu-central-2:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:eu-north-1:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:eu-south-1:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:eu-south-2:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:eu-west-1:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:eu-west-2:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:eu-west-3:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:il-central-1:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:me-central-1:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:me-south-1:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:sa-east-1:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:us-east-1:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:us-east-2:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:us-west-1:445285296882:layer:perl-5-38-runtime-paws-arm64:1`
    - `arn:aws:lambda:us-west-2:445285296882:layer:perl-5-38-runtime-paws-arm64:1`

## al2023の注意点

詳細は公式のアナウンスを確認してほしいのですが、al2023ランタイムを使うに当たっていくつか注意点があります。

- [Introducing the Amazon Linux 2023 runtime for AWS Lambda](https://aws.amazon.com/jp/blogs/compute/introducing-the-amazon-linux-2023-runtime-for-aws-lambda/)

まずはパッケージ管理が `microdnf` で行われていること。
通常のAmazon Linux 2023 では、パッケージ管理は `yum` から後継の `dnf` に切り替わりました。
AWS Runtimeではさらに容量を削減するために `dnf` の軽量版である `microdnf` を利用しているそうです。
これによりPythonへの依存がなくなり、軽量になったとのこと。
その分 `dnf` コマンドの機能がいくつか機能が削減されています。

あとはtzdataが未インストールなこと（同僚がGoのデプロイでハマっていた）。
日時を扱うようなプログラムを書く場合は注意してください。

-----

明日6日目は[id:papix](https://profile.hatena.ne.jp/papix/)で「[MySQLのDATETIMEをとにかく素早くPerlのDateTimeオブジェクトにしたい](https://papix.hatenablog.com/entry/2023/12/07/010810)」です。
お楽しみに！

## 参考

- [[アップデート]AWS LambdaにAmazon Linux 2023ベースのカスタムランタイムが追加されました](https://dev.classmethod.jp/articles/relase-provided-amazon-linux-2023-on-lambda/)
- [AWS Lambda adds support for Amazon Linux 2023](https://aws.amazon.com/jp/about-aws/whats-new/2023/11/aws-lambda-amazon-linux-2023/)
- [Introducing the Amazon Linux 2023 runtime for AWS Lambda](https://aws.amazon.com/jp/blogs/compute/introducing-the-amazon-linux-2023-runtime-for-aws-lambda/)
