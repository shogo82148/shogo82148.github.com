---
layout: post
title: "AWS Lambda Perl Runtime on Amazon Linux 2 を公開しました"
slug: perl-lambda-runtime-on-amazon-linux2
date: 2020-08-15 20:44:00 +0900
comments: true
categories: [aws, perl, lambda]
---

[Amazon Linux 2](https://aws.amazon.com/amazon-linux-2/) への移行が進む AWS Lambda ですが、
ついに [Custom Runtime](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html) にも Amazon Linux 2 がやってきました。

- [AWS Lambda now supports custom runtimes on Amazon Linux 2](https://aws.amazon.com/about-aws/whats-new/2020/08/aws-lambda-supports-custom-runtimes-amazon-linux-2/)

同時に [provided.al2 の Docker Image](https://github.com/lambci/docker-lambda/commit/8a91a64714c10c11e1b0f0fdd5a5afa365fb9ea0) も公開されたので、
それを利用して Amazon Linux 2 対応の [Perl Runtime Layer](https://shogo82148.github.io/blog/2018/12/16/run-cgi-in-aws-lambda/) を作成しました。

- [AWS::Lambda](https://github.com/shogo82148/p5-aws-lambda)


# ビルド済み公開 Perl Runtime Layer

リージョン毎のArn一覧はこちら

- Perl 5.32
    - `arn:aws:lambda:af-south-1:445285296882:layer:perl-5-32-runtime-al2:1`
    - `arn:aws:lambda:ap-east-1:445285296882:layer:perl-5-32-runtime-al2:1`
    - `arn:aws:lambda:ap-northeast-1:445285296882:layer:perl-5-32-runtime-al2:1`
    - `arn:aws:lambda:ap-northeast-2:445285296882:layer:perl-5-32-runtime-al2:1`
    - `arn:aws:lambda:ap-south-1:445285296882:layer:perl-5-32-runtime-al2:1`
    - `arn:aws:lambda:ap-southeast-1:445285296882:layer:perl-5-32-runtime-al2:1`
    - `arn:aws:lambda:ap-southeast-2:445285296882:layer:perl-5-32-runtime-al2:1`
    - `arn:aws:lambda:ca-central-1:445285296882:layer:perl-5-32-runtime-al2:1`
    - `arn:aws:lambda:eu-central-1:445285296882:layer:perl-5-32-runtime-al2:1`
    - `arn:aws:lambda:eu-south-1:445285296882:layer:perl-5-32-runtime-al2:1`
    - `arn:aws:lambda:eu-west-1:445285296882:layer:perl-5-32-runtime-al2:1`
    - `arn:aws:lambda:eu-west-2:445285296882:layer:perl-5-32-runtime-al2:1`
    - `arn:aws:lambda:eu-west-3:445285296882:layer:perl-5-32-runtime-al2:1`
    - `arn:aws:lambda:me-south-1:445285296882:layer:perl-5-32-runtime-al2:1`
    - `arn:aws:lambda:sa-east-1:445285296882:layer:perl-5-32-runtime-al2:1`
    - `arn:aws:lambda:us-east-1:445285296882:layer:perl-5-32-runtime-al2:1`
    - `arn:aws:lambda:us-east-2:445285296882:layer:perl-5-32-runtime-al2:1`
    - `arn:aws:lambda:us-west-1:445285296882:layer:perl-5-32-runtime-al2:1`
    - `arn:aws:lambda:us-west-2:445285296882:layer:perl-5-32-runtime-al2:1`

`--runtime provided.al2` と合わせてご利用ください。

    aws --region "$REGION" --profile "$PROFILE" lambda create-function \
        --function-name "hello-perl" \
        --zip-file "fileb://handler.zip" \
        --handler "handler.handle" \
        --runtime provided.al2 \
        --role arn:aws:iam::xxxxxxxxxxxx:role/service-role/lambda-custom-runtime-perl-role \
        --layers "arn:aws:lambda:$REGION:445285296882:layer:perl-5-32-runtime-al2:1"

# ビルド済み公開 Paws Layer

[AWS SDK for Perl Lambda Layerを公開しました](https://shogo82148.github.io/blog/2019/07/16/aws-lambda-paws-layer/) で作成した [Paws](https://metacpan.org/pod/Paws) Layer の
Amazon Linux 2 版も作成しました。
Perl自体は含まないので、Perl Runtime Layer と合わせてご利用ください。

- Perl 5.32
    - `arn:aws:lambda:af-south-1:445285296882:layer:perl-5-32-paws-al2:1`
    - `arn:aws:lambda:ap-east-1:445285296882:layer:perl-5-32-paws-al2:1`
    - `arn:aws:lambda:ap-northeast-1:445285296882:layer:perl-5-32-paws-al2:1`
    - `arn:aws:lambda:ap-northeast-2:445285296882:layer:perl-5-32-paws-al2:1`
    - `arn:aws:lambda:ap-south-1:445285296882:layer:perl-5-32-paws-al2:1`
    - `arn:aws:lambda:ap-southeast-1:445285296882:layer:perl-5-32-paws-al2:1`
    - `arn:aws:lambda:ap-southeast-2:445285296882:layer:perl-5-32-paws-al2:1`
    - `arn:aws:lambda:ca-central-1:445285296882:layer:perl-5-32-paws-al2:1`
    - `arn:aws:lambda:eu-central-1:445285296882:layer:perl-5-32-paws-al2:1`
    - `arn:aws:lambda:eu-south-1:445285296882:layer:perl-5-32-paws-al2:1`
    - `arn:aws:lambda:eu-west-1:445285296882:layer:perl-5-32-paws-al2:1`
    - `arn:aws:lambda:eu-west-2:445285296882:layer:perl-5-32-paws-al2:1`
    - `arn:aws:lambda:eu-west-3:445285296882:layer:perl-5-32-paws-al2:1`
    - `arn:aws:lambda:me-south-1:445285296882:layer:perl-5-32-paws-al2:1`
    - `arn:aws:lambda:sa-east-1:445285296882:layer:perl-5-32-paws-al2:1`
    - `arn:aws:lambda:us-east-1:445285296882:layer:perl-5-32-paws-al2:1`
    - `arn:aws:lambda:us-east-2:445285296882:layer:perl-5-32-paws-al2:1`
    - `arn:aws:lambda:us-west-1:445285296882:layer:perl-5-32-paws-al2:1`
    - `arn:aws:lambda:us-west-2:445285296882:layer:perl-5-32-paws-al2:1`


## 参考

- [AWS Lambda now supports custom runtimes on Amazon Linux 2](https://aws.amazon.com/about-aws/whats-new/2020/08/aws-lambda-supports-custom-runtimes-amazon-linux-2/)
- [AWS Lambda now supports Go on Amazon Linux 2](https://aws.amazon.com/about-aws/whats-new/2020/08/aws-lambda-supports-go-amazon-linux-2/)
    - Go にも Amazon Linux 2 サポートが来ました。これで全ランタイムが Amazon Linux 2 対応したことになります。
