---
layout: post
title: "Perl Runtime for AWS Lambda の Docker コンテナ対応を公開しました"
slug: perl-runtime-supports-docker-format
date: 2021-01-02 00:00:00 +0900
comments: true
categories: [perl]
---

いつかやろうと思っていた [AWS::Lambda](https://metacpan.org/pod/AWS::Lambda)の Docker コンテナ対応、
年を越してしまったけど、ようやく手を付けました。

- [AWS Lambda の新機能 – コンテナイメージのサポート](https://aws.amazon.com/jp/blogs/news/new-for-aws-lambda-container-image-support/)

## 使い方

以下の `handler.pl` を Docker コンテナとして AWS Lambda デプロイする例です。

```perl
use utf8;
use warnings;
use strict;

sub handle {
    my $payload = shift;
    return +{"hello" => "lambda"};
}

1;
```

### ビルド済みイメージを使う

Amazon Linux 2 ベースの Perl Runtime 入りイメージを[Docker Hub で公開しています](https://hub.docker.com/r/shogo82148/p5-aws-lambda)。
これをベースにデプロイしたいファイルを追加し、`CMD` に実行したい関数名を指定するだけ。
簡単ですね。

```dockerfile
FROM shogo82148/p5-aws-lambda:base-5.32-paws.al2
COPY handler.pl /var/task/
CMD [ "handler.handle" ]
```

[Docker Hub からのダウンロードに Rate Limit が適用される](https://docs.docker.com/docker-hub/download-rate-limit/)ようになったので、
同じイメージを [Amazon ECR Public Gallery でも公開しました](https://gallery.ecr.aws/w2s0h5h2/p5-aws-lambda)。
こちらを利用することも可能です。

```dockerfile
FROM public.ecr.aws/w2s0h5h2/p5-aws-lambda:base-5.32-paws.al2
COPY handler.pl /var/task/
CMD [ "handler.handle" ]
```

このベースイメージには AWS Lambda Runtime Interface Emulator がインストールされているので、
ビルドすればローカルで動かすこともできます。

```
$ docker run -p 9000:8080 hello-perl:latest
$ curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" -d '{}'
```

これをそのまま ECR にアップロードすれば・・・

```
$ aws ecr create-repository --repository-name hello-perl --image-scanning-configuration scanOnPush=true
$ docker tag hello-perl:latest 123412341234.dkr.ecr.sa-east-1.amazonaws.com/hello-perl:latest
$ aws ecr get-login-password | docker login --username AWS --password-stdin 123412341234.dkr.ecr.sa-east-1.amazonaws.com
$ docker push 123412341234.dkr.ecr.sa-east-1.amazonaws.com/hello-perl:latest
```

AWS Lambda 関数としてデプロイできます。

```
$ aws --region "$REGION" --profile "$PROFILE" lambda create-function \
    --function-name "hello-perl" \
    --code ImageUri=123412341234.dkr.ecr.sa-east-1.amazonaws.com/hello-perl:latest \
    --handler "handler.handle" \
    --runtime provided.al2 \
    --role arn:aws:iam::xxxxxxxxxxxx:role/service-role/lambda-custom-runtime-perl-role
```

### 全部自前でビルドする

Docker コンテナ対応によって、Amazon Linux 以外の Linux を使用可能になりました。
例として[Perl の Docker Official Images](https://hub.docker.com/_/perl)を使ってみましょう。

```dockerfile
FROM perl:5.32-slim-buster
RUN mkdir -p /var/task \
    && apt-get update \
    && apt-get install -y --no-install-recommends gcc libc6-dev \
    && cpanm --notest AWS::Lambda \
    && apt-get purge -y --auto-remove gcc libc6-dev \
    && rm -fr /var/cache/apt/* /var/lib/apt/lists/* \
    && rm -fr ./cpanm /root/.cpanm /tmp/*
COPY handler.pl /var/task/
WORKDIR /var/task
ENTRYPOINT [ "/usr/local/bin/perl", "-MAWS::Lambda::Bootstrap", "-e", "bootstrap(@ARGV)" ]
CMD [ "handler.handle" ]
```

AWS::Lambda の依存に XS を利用したモジュールが含まれているので、gcc をインストールが必要です。
その分長くなってしまいましたが、[App::cpanminus](https://metacpan.org/pod/App::cpanminus)で AWS::Lambda をインストールしているだけです。

エントリーポイントでは [AWS::Lambda::Bootstrap](https://metacpan.org/pod/AWS::Lambda::Bootstrap) を読み込んで、
`bootstrap` 関数を呼び出せば OK です。

```dockerfile
ENTRYPOINT [ "/usr/local/bin/perl", "-MAWS::Lambda::Bootstrap", "-e", "bootstrap(@ARGV)" ]
```

ちょっとハマったのは `/usr/local/bin/perl` のように絶対パスを指定する必要があること。
どうやら環境変数の PATH は読んでくれないみたい(？)

あとは ECR にアップロードすれば AWS Lambda 関数としてデプロイできます。

## 実装

AWS Lambda との連携 API は今までのカスタムランタイムと一緒なので、AWS::Lambda の実装自体はほとんどいじらずに済みました。
イメージの作成と実行が簡単になるよう、ちょっと調整したくらいです。

- AWS Lambda Runtime Interface Emulator が `Lambda-Runtime-Invoked-Function-Arn` ヘッダーを返してくれない
  - 必須にしていたのをオプションに変えて対応
- `ENTRYPOINT` から直接モジュールを呼べるよう `bootstrap` をエクスポートするようにした

## ECR Public

今回始めて Amazon ECR Public Gallery にイメージを公開してみました。
今までの [lambci/docker-lambda](https://github.com/lambci/docker-lambda) ベースのイメージも公開しているので、合わせてご利用ください。
オフィシャルな Docker イメージが提供されるようになったとはいえ、XS を使ったモジュールに依存していて gcc が必要になるケースは結構多いと思います。
そういった場合は、開発ツールがインストールされたイメージを使うのが便利でしょう。

レポジトリの作成には [CloudFormation の AWS::ECR::PublicRepository リソース](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-ecr-publicrepository.html)を利用しました。
ここにちょっとハマって、何も考えずに東京リージョンでデプロイしたら、 "Template format error: Unrecognized resource types: \[AWS::ECR::PublicRepository\]"
と怒られてしまいました。
最終的にはバージニア北部(us-east-1) でデプロイすることで解決しました。

ざっとドキュメントを見た感じリージョンの指定はなかったのと、マネージドコンソールではリージョンの切り替えが必要ないので、ちょっと手こずりました。
`docker login` のコマンドを注意深く見ていなかったら気が付かないままだったでしょう・・・。

```
aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws/w2s0h5h2
```

## まとめ

Perl Runtime for AWS Lambda で Docker コンテナを簡単にデプロイできるようになりました。
一番嬉しいのは Zip ファイルだと 50MB、レイヤー機能を含めても 250MB までのサイズしかデプロイできなかったのが、 10GB まで拡張されたことだと思います。
ぜひ遊んでみてください。

## 参考

- [p5-aws-lambda - Amazon ECR Public Gallery](https://gallery.ecr.aws/w2s0h5h2/p5-aws-lambda)
- [p5-aws-lambda - Docker Hub](https://hub.docker.com/r/shogo82148/p5-aws-lambda)
- [shogo82148/p5-aws-lambda](https://github.com/shogo82148/p5-aws-lambda)
- [AWS::Lambda - metacpan](https://metacpan.org/pod/AWS::Lambda)
- [AWS Lambda の新機能 – コンテナイメージのサポート](https://aws.amazon.com/jp/blogs/news/new-for-aws-lambda-container-image-support/)
- [AWS Lambda runtime API](https://docs.aws.amazon.com/lambda/latest/dg/runtimes-api.html)
- [AWS Lambda Runtime Interface Emulator](https://github.com/aws/aws-lambda-runtime-interface-emulator)
- [AWS Lambda base images for custom runtimes - Amazon ECR Public Gallery](https://gallery.ecr.aws/lambda/provided)
- [AWS Lambda base images for custom runtimes - Docker Hub](https://gallery.ecr.aws/lambda/provided)
- [AWS::ECR::PublicRepository - AWS CloudFormation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-ecr-publicrepository.html)
- [Download rate limit - docker docs](https://docs.docker.com/docker-hub/download-rate-limit/)
