---
layout: post
title: "AWS Lambda Perl Runtime で AWS X-Ray を使えるようになりました"
slug: aws-xray-with-perl-lambda-runtime
date: 2019-08-21 19:53:00 +0900
comments: true
categories: [perl, lambda]
---

[AWS Lambda](https://aws.amazon.com/jp/lambda/) 上で Perl を動かす [AWS::Lambda](https://metacpan.org/release/AWS-Lambda) で、
AWSの分散アプリケーションの分析サービスである [AWS X-Ray](https://aws.amazon.com/jp/xray/) をサポートしました！

AWS X-Ray って何？ Perl からどう使うの？ という人は [@fujiwara](https://twitter.com/fujiwara) さんの記事とYAPC::Tokyo 2019での発表スライドをどうぞ。

- [第56回　AWS X-Rayによる分散トレーシング―マイクロサービスのボトルネック，障害箇所の特定（1）](http://gihyo.jp/dev/serial/01/perl-hackers-hub/005601)
- [第56回　AWS X-Rayによる分散トレーシング―マイクロサービスのボトルネック，障害箇所の特定（2）](http://gihyo.jp/dev/serial/01/perl-hackers-hub/005602)
- [第56回　AWS X-Rayによる分散トレーシング―マイクロサービスのボトルネック，障害箇所の特定（3）](http://gihyo.jp/dev/serial/01/perl-hackers-hub/005603)

<iframe id="talk_frame_487289" src="//speakerdeck.com/player/274e528925974baebbc6e374a5f90c86" width="710" height="399" style="border:0; padding:0; margin:0; background:transparent;" frameborder="0" allowtransparency="true" allowfullscreen="allowfullscreen" mozallowfullscreen="true" webkitallowfullscreen="true"></iframe>


## 使ってみる

Perl Runtime だけでなくX-Ray SDK 側でも対応が必要だったので、[プルリクエストを送って](https://github.com/fujiwara/AWS-XRay/pull/10)取り込んでもらいました。
このプルリクエストがマージされた最新の [AWS::XRay](https://metacpan.org/pod/AWS::XRay) を Perl Runtime Layer にプリインストールしたので、あなたのアプリケーションですぐに使えます。

例えばこんな感じのコードを書いて、

```perl
use utf8;
use warnings;
use strict;
use AWS::XRay qw/ capture /;

sub handle {
    my ($payload, $context) = @_;
    capture "myApp" => sub {
        capture "hogehoge" => sub {
            sleep 1;
        };
        capture "fugafura" => sub {
            my $segment = shift;
            $segment->{metadata} = $payload;
        };
    };
    return +{"hello" => "lambda"};
}

1;
```

Layer に X-Rayに対応した最新の Perl Runtime `arn:aws:lambda:ap-northeast-1:445285296882:layer:perl-5-30-runtime:3` を追加、
マネージドコンソールの「Debugging and error handling」セクションにある「Enable AWS X-Ray」を有効化し、実行してみます。

![トレース結果](/images/2019-08-21-aws-xray-with-perl-lambda-runtime.png)

どこに時間がかかっているか一目瞭然ですね！

## まとめ

[AWS::Lambda](https://metacpan.org/release/AWS-Lambda) と [AWS::XRay](https://metacpan.org/pod/AWS::XRay) を使って、
Perl で書いたコードを AWS Lambda 上で動かし、さらに分散トレーシングができるようになりました。
以前紹介した [AWS SDK for Perl Lambda Layer](https://shogo82148.github.io/blog/2019/07/16/aws-lambda-paws-layer/) と合わせて、
ぜひ Perl を活用してみてください。


## 参考文献

- [第56回　AWS X-Rayによる分散トレーシング―マイクロサービスのボトルネック，障害箇所の特定（1）](http://gihyo.jp/dev/serial/01/perl-hackers-hub/005601)
- [第56回　AWS X-Rayによる分散トレーシング―マイクロサービスのボトルネック，障害箇所の特定（2）](http://gihyo.jp/dev/serial/01/perl-hackers-hub/005602)
- [第56回　AWS X-Rayによる分散トレーシング―マイクロサービスのボトルネック，障害箇所の特定（3）](http://gihyo.jp/dev/serial/01/perl-hackers-hub/005603)

<iframe id="talk_frame_487289" src="//speakerdeck.com/player/274e528925974baebbc6e374a5f90c86" width="710" height="399" style="border:0; padding:0; margin:0; background:transparent;" frameborder="0" allowtransparency="true" allowfullscreen="allowfullscreen" mozallowfullscreen="true" webkitallowfullscreen="true"></iframe>

## 関連記事

- [AWS LambdaでCGIを蘇らせる](https://shogo82148.github.io/blog/2018/12/16/run-cgi-in-aws-lambda/)
- [AWS SDK for Perl Lambda Layerを公開しました](https://shogo82148.github.io/blog/2019/07/16/aws-lambda-paws-layer/)
