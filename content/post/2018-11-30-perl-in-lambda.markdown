---
layout: post
title: "PerlをAWS Lambdaで動かす"
slug: perl-in-lambda
date: 2018-11-30 17:44:00 +0900
comments: true
categories: [perl, aws, lambda]
---

AWS Lambda で Custom Runtime が発表されました！

- [新機能 – AWS Lambda :あらゆるプログラム言語への対応と一般的なコンポーネントの共有](https://aws.amazon.com/jp/blogs/news/new-for-aws-lambda-use-any-programming-language-and-share-common-components/)
- [New for AWS Lambda – Use Any Programming Language and Share Common Components](https://aws.amazon.com/jp/blogs/aws/new-for-aws-lambda-use-any-programming-language-and-share-common-components/)
- [AWS Lambda Now Supports Custom Runtimes, and Enables Sharing Common Code Between Functions](https://aws.amazon.com/jp/about-aws/whats-new/2018/11/aws-lambda-now-supports-custom-runtimes-and-layers/)

Custom Runtime により好きなプログラミング言語でLambda関数を書くことができ、
いくつかの言語についてはAWSおよびパートナーから bootstrap が提供されます。

[提供される言語にCOBOLが入って話題になっています](http://www.itmedia.co.jp/news/articles/1811/30/news102.html)が、
当然ながら(？)Perlはありません。

Custom Runtimeは shell script でも書ける簡単なものなので、Perlでも書いてみました。

## Perl in AWS Lambda

以下のスクリプトを `bootstrap` という名前で保存します。

```perl
#!/usr/bin/env perl
use utf8;
use warnings;
use strict;
use lib "$ENV{LAMBDA_TASK_ROOT}/local/lib/perl5";
use Furl;
use JSON;
 
my $furl = Furl->new;
my ($handler, $function) = split /\./, $ENV{_HANDLER}, 2;
require "$ENV{LAMBDA_TASK_ROOT}/$handler.pl";
my $func = \&$function;

while(1) {
    my $res = $furl->get("http://$ENV{AWS_LAMBDA_RUNTIME_API}/2018-06-01/runtime/invocation/next");
    die $res->status_line unless $res->is_success;
    my $req_id = $res->header("Lambda-Runtime-Aws-Request-Id");
    my $event = decode_json($res->content);
    my $result = $func->($event);
    $furl->post(
        "http://$ENV{AWS_LAMBDA_RUNTIME_API}/2018-06-01/runtime/invocation/$req_id/response",
        [],
        encode_json($result),
    );
}

1;
```

`handler.pl` に Lambda 関数の本体を書きます。
とりあえず、エコーしてみます。

```perl
use utf8;
use warnings;
use strict;

sub function {
    my $event = shift;
    return $event;
}

1;
```

FurlとJSONに依存しているので、これらのパッケージをzipファイルに同梱します。
`cpanfile` に以下のような依存関係を定義

```perl
requires 'Furl';
requires 'JSON';
```

パッケージのビルドスクリプト(`install.sh`)を用意します。

```bash
#!/bin/sh
yum install -y perl-App-cpanminus gcc
cpanm -l local --notest --installdeps .
```

XSのビルドに困らないよう[lambci/docker-lambda](https://github.com/lambci/docker-lambda)を使用して、依存パッケージをビルド。
まとめてzipファイルに圧縮します。

```bash
docker run --rm -v "$PWD":/var/task lambci/lambda-base ./install.sh
zip -r ../dist.zip
```

ランタイムに「独自のランタイムを使用する」、ハンドラに `handler.function` を指定して、テスト実行！


## まとめ

すでに AWS Lambda Custom Runtime芸人 が大量に湧いていた。

- [AWS Lambda Custom Runtime芸人 Advent Calendar 2018](https://qiita.com/advent-calendar/2018/lambda-custom-runtimes)

追記:

<blockquote class="twitter-tweet" data-lang="ja"><p lang="ja" dir="ltr">Perlを久々に見ました <a href="https://t.co/V7uMytci7D">pic.twitter.com/V7uMytci7D</a></p>&mdash; ひさいち (@hisaichi5518) <a href="https://twitter.com/hisaichi5518/status/1068432981591617537?ref_src=twsrc%5Etfw">2018年11月30日</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

追記その2:

moznion先生が AWS Lambda Layer 書いてくれました。

- [aws-lambda-perl5-layer 書いた](https://moznion.hatenadiary.com/entry/2018/12/01/113644)

## 参考

- [AWS Lambda の新機能でサーバーレス・シェルスクリプト！ カスタムランタイムのチュートリアルを動かしてみた #reinvent](https://dev.classmethod.jp/cloud/aws/tutorial-lambda-custom-runtime-with-shellscript/)
- [Custom AWS Lambda Runtimes](https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/runtimes-custom.html)
- [Tutorial – Publishing a Custom Runtime](https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/runtimes-walkthrough.html)
