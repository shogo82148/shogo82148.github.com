---
layout: post
title: "AWSジャカルタリージョンでPerlランタイムが利用可能になりました"
slug: aws-lambda-is-available-in-ap-southeast-3
date: 2021-12-16 20:19:00 +0900
comments: true
categories: [aws, perl]
---

[Perl Advent Calendar 2021](https://qiita.com/advent-calendar/2021/perl) の途中ですが、ここで臨時ニュースです。

-----

AWSジャカルタリージョン(`ap-southeast-3`) が利用可能になったので、
それに併せて [AWS::Lambda Perl support for AWS Lambda Custom Runtime](https://metacpan.org/pod/AWS::Lambda) も公開しました。

- [SHOGO/AWS-Lambda-0.0.34/Changes](https://metacpan.org/release/SHOGO/AWS-Lambda-0.0.34/changes)

以下のランタイムが利用可能です。

- `arn:aws:lambda:ap-southeast-3:445285296882:layer:perl-5-34-runtime-al2-x86_64:1`
- `arn:aws:lambda:ap-southeast-3:445285296882:layer:perl-5-32-runtime-al2-x86_64:1`

[Paws](https://metacpan.org/pod/Paws) はこちら。

- `arn:aws:lambda:ap-southeast-3:445285296882:layer:perl-5-34-paws-al2-x86_64:1`
- `arn:aws:lambda:ap-southeast-3:445285296882:layer:perl-5-32-paws-al2-x86_64:1`

Arm64 アーキテクチャについては未対応のようなので、AWS側の対応が終わり次第追って追加します。

-----

以上、臨時ニュースでした。

引き続き [Perl Advent Calendar 2021](https://qiita.com/advent-calendar/2021/perl) をお楽しみください。
まだカレンダーに若干の空きがあります。ブログ記事の投稿も大歓迎です！

## 参考

- [Now Open – AWS Asia Pacific (Jakarta) Region](https://aws.amazon.com/jp/blogs/aws/now-open-aws-asia-pacific-jakarta-region/)
- [AWS::Lambda](https://metacpan.org/pod/AWS::Lambda) 
