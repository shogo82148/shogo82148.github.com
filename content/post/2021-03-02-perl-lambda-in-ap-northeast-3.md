---
layout: post
title: "AWS Lambda Perl Runtime Layer in 大阪リージョン を公開しました"
slug: perl-lambda-in-ap-northeast-3
date: 2021-03-02 14:50:00 +0900
comments: true
categories: [perl, aws]
---

AWS 大阪リージョンが一般利用可能になりました！

- [AWS Asia Pacific (Osaka) Region Now Open to All, with Three AZs and More Services](https://aws.amazon.com/jp/blogs/aws/aws-asia-pacific-osaka-region-now-open-to-all-with-three-azs-more-services/)
- [[AWS] 日本 2 番目となる大阪リージョン ap-northeast-3 が利用可能になりました](https://dev.classmethod.jp/articles/aws-osaka-region-ga/)
- [［速報］「AWS 大阪リージョン」正式オープン。大阪ローカルリージョンを拡張し 3 つのアベイラビリティゾーンから構成、事前申し込みなど不要に](https://www.publickey1.jp/blog/21/aws3.html)

というわけで、 AWS Lambda Perl Runtime [AWS::Lambda](https://metacpan.org/pod/AWS::Lambda) in **Osaka** を公開しました。

- ランタイム本体: `arn:aws:lambda:ap-northeast-3:445285296882:layer:perl-5-32-runtime-al2:1`
- AWS SDK for Perl: `arn:aws:lambda:ap-northeast-3:445285296882:layer:perl-5-32-paws-al2:1`
- Zip Archive: https://shogo82148-lambda-perl-runtime-ap-northeast-3.s3.amazonaws.com/perl-5-32-runtime-al2.zip
- Zip Archive: https://shogo82148-lambda-perl-runtime-ap-northeast-3.s3.amazonaws.com/perl-5-32-paws-al2.zip

大阪の Perl Monger の皆さん、ぜひご利用ください。
