---
layout: post
title: "AWS App Runner に Perl をデプロイしてみた"
slug: perl-on-aws-app-runner
date: 2021-06-06 06:41:00 +0900
comments: true
categories: [perl, aws]
---

先月 [AWS App Runner](https://aws.amazon.com/jp/apprunner/) という新サービスがリリースされました。

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">📣 新サービス <a href="https://twitter.com/hashtag/AWSAppRunner?src=hash&amp;ref_src=twsrc%5Etfw">#AWSAppRunner</a> のローンチです！🚀<br><br>＼数クリックでソースコードやコンテナイメージをデプロイ！／<br><br>AWS Fargate より高い抽象度、あるいは AWS Lambda のようなスレッドではなくプロセスそのものを実行したかった方にぜひお試しいただきたいサービスです！1/n<a href="https://t.co/LPFNOP7CBT">https://t.co/LPFNOP7CBT</a></p>&mdash; Tori Hara (@toricls) <a href="https://twitter.com/toricls/status/1394795120013103106?ref_src=twsrc%5Etfw">May 18, 2021</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

既にたくさんのデプロイしてみた系の記事が公開されていますが、流石に(残念ながら？) Perl をデプロイしている人はいないですよね？
と言うわけで、ネタがかぶらないよう Perl でやってみましょう。

ソースコードは [shogo82148/perl-on-aws-app-runner](https://github.com/shogo82148/perl-on-aws-app-runner) においてあります。

## PSGI アプリを用意する

[Wikipedia の PSGI のページ](https://ja.wikipedia.org/wiki/PSGI)に書いてあった例をそのまま使います。

```perl
# app.psgi
my $app = sub {
    return [200, ['Content-Type' => 'text/plain'], ["hello, world\n"]];
}
```

## Dockerfile を用意する

PSGI アプリを起動するのに [Plack](https://metacpan.org/pod/Plack) を使用するので、
cpanfile に Plack への依存を書いておきます。

```perl
# cpanfile
requires 'Plack';
```

Perl の公式イメージをベースに、依存モジュールをインストールして[plackup](https://metacpan.org/pod/distribution/Plack/script/plackup)するだけの
簡単な Dockerfile を書きます。

```dockerfile
# Dockerfile
FROM perl:5.34.0

WORKDIR /usr/src/myapp
COPY cpanfile .
RUN cpanm --notest --installdeps .
COPY app.psgi .

CMD [ "plackup", "app.psgi" ]
```

さて、一応ちゃんと動作するか手元で確認しておきましょう。
デフォルトで 5000 番ポートで立ち上がるので、ポートバインディングの設定をして、起動してみます。

```console
$ docker build -t perl-test .
$ docker run -p 5000:5000 perl-test
HTTP::Server::PSGI: Accepting connections at http://0:5000/
```

"http://localhost:5000" にアクセスすると "hello, world" と表示されるはずです。

## ECR に Push する

[マネージメントコンソールで Amazon ECR を開いて](https://console.aws.amazon.com/ecr/home) 新規レポジトリを作成、イメージをプッシュします。
レポジトリを作成するとプッシュの手順が表示されるので、それにしたがいましょう。

```console
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.ap-northeast-1.amazonaws.com
$ docker build -t perl-test .
docker tag perl-test:latest 123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/perl-test:latest
docker push 123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/perl-test:latest
```

## AWS App Runner でサービスを作成する

[マネージメントコンソールで AWS App Runner を開いて](https://console.aws.amazon.com/apprunner/home) 新しいサービスを作成します。
特に Container image URI に先程作成したイメージを指定するのと、ポート番号が 5000 番なことに注意しましょう。

- Source
  - **Repository type**: Container registry
  - **Provider**: Amazon ECR
  - **Container image URI**: `123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/perl-test:latest`
- Deployment settings
  - **Deployment trigger**: Automatic
  - **ECR access role**: Create new service role (or "Use existing service role" if you have already created it)
- Service settings:
  - **Service name**: perl-test
  - **Virtual CPU & memory**: 1vCPU & 2GB
  - **Port**: 5000

5 分ほど待っていると `https://xxxxxxxx.ap-northeast-1.awsapprunner.com/` のような URL が利用可能になります。

## まとめ

特にハマることもなく簡単にできました。
Docker イメージさえ作ってしまえば、何回かポチポチするだけで公開できるので楽ちんですね。

唯一の問題は App Runner 自体は永続化層を持たないと言うことでしょうか・・・。
個人的には RDS for MySQL を使いたいところですが、VPC の設定をいじって直接接続できないので一工夫必要です。
AWS の中の人的には「DynamoDB を使え」ということなんでしょう。

## 参考

- [AWS App Runner](https://aws.amazon.com/jp/apprunner/)
- [新機能 – AWS App Runner: スケーラブルで安全なウェブアプリケーションをコードから数分で作成](https://aws.amazon.com/jp/blogs/news/app-runner-from-code-to-scalable-secure-web-apps/)
- [AWS App Runner のご紹介](https://aws.amazon.com/jp/blogs/news/introducing-aws-app-runner/)
- [新サービス AWS App Runner がローンチされたので試してみた](https://dev.classmethod.jp/articles/release-aws-app-runner/)
- [PSGI - Wikipedia](https://ja.wikipedia.org/wiki/PSGI)
