---
layout: post
title: "WEB+DB PRESS Vol.131にPerlとAWS Lambdaの記事を寄稿しました"
slug: 2022-10-19-perl-webdb-vol131
date: 2022-10-19 20:54:00 +0900
comments: true
categories: [ aws, perl, aws-lambda ]
---

[WEB+DB PRESS Vol.131](https://gihyo.jp/magazine/wdpress/archive/2022/vol131)内の連載「第75回Perl Hackers Hub」に
「AWS Lambda入門……サーバレスでもPerlを活用しよう！」というタイトルで寄稿しました。
発売日は**10月22日**です。

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">WEB+DB PRESS Vol.131、どこよりも早い表紙画像です！<br>Rust入門、はじめてのElixir、実装して学ぶHTTP/3を大特集！10月22日発売です！<a href="https://twitter.com/hashtag/wdpress?src=hash&amp;ref_src=twsrc%5Etfw">#wdpress</a> <a href="https://t.co/uEIjuPYXu6">pic.twitter.com/uEIjuPYXu6</a></p>&mdash; WEB+DB PRESS編集部 (@wdpress) <a href="https://twitter.com/wdpress/status/1577119064807251968?ref_src=twsrc%5Etfw">October 4, 2022</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script> 

前回寄稿したときがVol.97第43回Perl Hackers Hubなので、約5年ぶり2回目の寄稿です。

- [WEB+DB PRESS Vol.97にPerlとRedisの記事を寄稿しました](https://shogo82148.github.io/blog/2017/02/23/perl-webdb-vol97/)

## 内容

[AWS Lambda](https://aws.amazon.com/jp/lambda/)の上でPerlを動かしてみよう！という内容です。
[AWS::Lambdaモジュール](https://metacpan.org/pod/AWS::Lambda)の簡単なチュートリアルになっています。
今年の4月に提供が開始された[AWS Lambda Function URLs](https://aws.amazon.com/jp/blogs/news/announcing-aws-lambda-function-urls-built-in-https-endpoints-for-single-function-microservices/)にも対応した内容です。

作るのはもちろん！[アクセスカウンター！](https://shogo82148.github.io/blog/2018/12/16/run-cgi-in-aws-lambda/)

AWS Lambdaでできるのは計算だけで、単体では大したことはできません。
AWS Lambdaの便利なところは、他のAWSのサービスと連携できることです。
今回寄稿した記事でもその便利さが伝わるといいなと思い、[Paws](https://metacpan.org/pod/Paws) (Perl SDK for AWS)を使って
DynamoDBと連携するところまでを書きました。
やったねたえちゃん！**カウンターの値が永続化されるよ！！！**

## まとめ

というわけで、続きは紙面でお楽しみください。

[WEB+DB PRESS Vol.131](https://gihyo.jp/magazine/wdpress/archive/2022/vol131)の「第75回Perl Hackers Hub」です。
発売日は**10月22日**。

## 参考

- [WEB+DB PRESS Vol.131](https://gihyo.jp/magazine/wdpress/archive/2022/vol131)
- [AWS Lambda](https://aws.amazon.com/jp/lambda/)
- [AWS::Lambdaモジュール](https://metacpan.org/pod/AWS::Lambda)
- [AWS Lambda Function URLs の提供開始: 単一機能のマイクロサービス向けの組み込み HTTPS エンドポイント](https://aws.amazon.com/jp/blogs/news/announcing-aws-lambda-function-urls-built-in-https-endpoints-for-single-function-microservices/)
- [AWS LambdaでCGIを蘇らせる](https://shogo82148.github.io/blog/2018/12/16/run-cgi-in-aws-lambda/)
