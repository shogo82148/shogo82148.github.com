---
layout: post
title: "AWS::LambdaがResponse Streamingに対応しました"
slug: 2023-08-09-p5-aws-lambda-supports-response-streaming
date: 2023-08-09 21:30:00 +0900
comments: true
categories: [aws, aws-lambda, perl]
---

[AWS::Lambda]が[Response Streaming](https://aws.amazon.com/jp/blogs/news/introducing-aws-lambda-response-streaming/)に対応しました。

## Response Streaming

2023年4月に発表されたAWS Lambdaの新機能です。

- [AWS Lambda レスポンスストリーミングの紹介]
- [Introducing AWS Lambda response streaming]

従来のLambda関数は処理がすべて完了したあとでないと結果を返すことができませんでした。
Response Streamingを利用すると、処理の途中であっても段階的に処理結果を返すことができます。

## 使い方

### 通常のLambda関数のなかで使う

CODEリファレンスを返すことでResponse Streamingを使うことができます。

```perl
sub handle {
    my ($payload, $context) = @_;
    return sub {
        # とりあえずヘッダーだけ返す
        my $responder = shift;
        my $writer = $responder->('application/json');

        # ...なんか長い処理...

        # 最終的な結果を返す
        $writer->write('{"foo": "bar"}');
        $writer->close;
    };
}
```

もちろん処理の途中で`$writer->write`を複数回呼んで、途中結果を返すことも可能です。

### Function URLsと一緒に使う

[AWS::Lambda::PSGI]を使えばFunction URLsを一緒に使うこともできます。
[PSGI]の[Delayed Response and Streaming Body](https://metacpan.org/pod/PSGI)方式に対応しています。

```perl
sub app {
    return sub {
        # とりあえずヘッダーだけ返す
        my $responder = shift;
        my $writer = $responder->([200, ['Content-Type' => 'application/json']]);

        # ...なんか長い処理...

        # 最終的な結果を返す
        $writer->write('{"foo": "bar"}');
        $writer->close;
    };
}
```

Function URLsの設定項目に「呼び出しモード（Invoke Mode）」が追加されました。
`RESPONSE_STREAM`を設定することでResponse Streamingが利用可能になるのですが、
2023-08-09現在、この設定をLambda関数から読み取る方法は提供されていません。
呼び出しモードによってレスポンスの形式がことなるため、環境変数を使って[AWS::Lambda::PSGI]に呼び出しモードを伝える必要があります。

以下は[SAM（Serverless Application Model）](https://aws.amazon.com/jp/serverless/sam/)のテンプレート例です。

```yaml
ExampleApi:
    Type: AWS::Serverless::Function
    Properties:
        FunctionUrlConfig:
            AuthType: NONE
            InvokeMode: RESPONSE_STREAM
        Environment:
            Variables:
                PERL5_LAMBDA_PSGI_INVOKE_MODE: RESPONSE_STREAM
        # (snip)
```

Response Streamingを使うとレスポンスサイズの制限が緩和されるという利点もあります。
通常6MBの上限がありますが、これが20MBまでになります。

## 余談: AWS Lambda Web Adapter

実装している途中で[Using response streaming with AWS Lambda Web Adapter to optimize performance](https://aws.amazon.com/jp/blogs/compute/using-response-streaming-with-aws-lambda-web-adapter-to-optimize-performance/)
という記事を見つけて、なんとも言えない気持ちになりました。
通常のHTTP APIをLambda Runtime APIに変換するアダプターです。
このアダプターも最近になってResponse Streamingに対応したらしいですね。

まあ、いくらアダプターが高性能でも、アダプターを挟むことによるオーバーヘッドは避けられないでしょうから、
Lambda Runtime APIと直接通信する[AWS::Lambda]に分があるはず・・・（要出典）。

## まとめ

[AWS::Lambda]が[Response Streaming](https://aws.amazon.com/jp/blogs/news/introducing-aws-lambda-response-streaming/)に対応しました。
処理の途中であっても段階的に処理結果を返すことができ、レスポンスサイズの上限も6MBから20MBに緩和されます。

ぜひお試しください。

## 参考

- [AWS Lambda レスポンスストリーミングの紹介]
- [Introducing AWS Lambda response streaming]
- [PSGI]
- [AWS::Lambda]
- [Configuring a Lambda function to stream responses]

[AWS::Lambda]: https://metacpan.org/release/SHOGO/AWS-Lambda-0.2.0/view/lib/AWS/Lambda.pm
[AWS::Lambda::PSGI]: https://metacpan.org/release/SHOGO/AWS-Lambda-0.2.0/view/lib/AWS/Lambda/PSGI.pm
[Configuring a Lambda function to stream responses]: https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html
[AWS Lambda レスポンスストリーミングの紹介]: https://aws.amazon.com/jp/blogs/news/introducing-aws-lambda-response-streaming/
[Introducing AWS Lambda response streaming]: https://aws.amazon.com/blogs/compute/introducing-aws-lambda-response-streaming/
[PSGI]: https://metacpan.org/pod/PSGI
