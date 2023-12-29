---
layout: post
title: "AWS::LambdaがCanada West (Calgary) Regionで利用可能になりました"
slug: 2023-12-29-p5-aws-lambda-is-available-on-ca-east-1
date: 2023-12-29 16:38:00 +0900
comments: true
categories: [perl]
---

この記事は、[Perl Advent Calendar 2023](https://qiita.com/advent-calendar/2023/perl) 25日目の記事（代打）です。
24日目は[@shogo842148](https://twitter.com/shogo82148)で「[PerlにClass構文がやってきた](https://shogo82148.github.io/blog/2023/12/29/2023-12-29-perl-class/)」でした。

-----

AWSでカナダ（カルガリー）リージョンが利用可能になりました！

- [The AWS Canada West (Calgary) Region is now available](https://aws.amazon.com/jp/blogs/aws/the-aws-canada-west-calgary-region-is-now-available/)

それに合わせて p5-aws-lambda のビルド済みレイヤーも公開しました！

- Perl本体: `arn:aws:lambda:ca-central-1:445285296882:layer:perl-5-38-runtime-al2023-x86_64:3`
- Paws: `arn:aws:lambda:ca-central-1:445285296882:layer:perl-5-38-paws-al2023-x86_64:4`

## 参考

- [The AWS Canada West (Calgary) Region is now available](https://aws.amazon.com/jp/blogs/aws/the-aws-canada-west-calgary-region-is-now-available/)
- [shogo82148/p5-aws-lambda](https://github.com/shogo82148/p5-aws-lambda)
- [AWS::Lambda](https://metacpan.org/pod/AWS::Lambda)
