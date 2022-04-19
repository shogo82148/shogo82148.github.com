---
layout: post
title: "EOL間近の AWS Lambda Runtimes を探すスクリプト"
slug: 2022-04-19-check-your-aws-lambda-runtimes
date: 2022-04-19 20:28:00 +0900
comments: true
categories: [aws, lambda]
---

「\[要対応\] AWS Lambda における Python 3.6 のサポート終了 | [Action Required] AWS Lambda end of support for Python 3.6」というメールを受け取ったので、その対応メモ。

## 背景

調査自体は簡単です。親切なことに送られてきたメールにやり方がバッチリ記載されています。

> 次のコマンドは、AWS CLI \[3\] を使用して、特定のリージョン内の Python 3.6 を使用しているすべての関数を一覧表示する方法を示しています。お客様のアカウント内のこうした関数すべてを確認するには、リージョンごとに次のコマンドを繰り返してください。

以下のコマンドを叩くだけ。

```
aws lambda list-functions \
    --function-version ALL \
    --region us-east-1 \
    --output text \
    --query "Functions[?Runtime=='python3.6'].FunctionArn"
```

ただ、「リージョンごとに次のコマンドを繰り返してください」とあるんですよね。
えっと・・・AWSって一体いくつリージョンあるんだっけ・・・？
このメールを書いた人は自社のリージョン数を把握しているんでしょうか？
管理しているAWSアカウントも複数あるので、全リージョン分繰り返すなんて不毛です。

## 調査方法

そういうわけで簡単なシェルスクリプトを書きました。

```bash
#!/bin/bash
​
for ACCOUNT in $(perl -nle 'print $1 if /^[[](?:profile\s+)?([^]]+)/' ~/.aws/config); do
    for REGION in $(aws ec2 describe-regions --region us-east-1 --profile "$ACCOUNT" --output text --query "Regions[].{Name:RegionName}"); do
        echo "$ACCOUNT, $REGION:" >&2
        aws lambda list-functions \
            --function-version ALL \
            --region "$REGION" \
            --profile "$ACCOUNT" \
            --output text \
            --query "Functions[?Runtime=='python3.6'].FunctionArn"
    done
done
```

見つけたらランタイムを Python 3.9 にアップグレードしましょう。
多くの場合単純にランタイムの設定を変えるだけだと思いますが、
必要に応じてコードを書き換えてください。

## まとめ

次のランタイムサポート終了のときに困らないようメモっておきました。
Python 3.9 のEOLは2025年10月なので、そのころにまた活躍することでしょう。
Queryの python3.6 の部分は適宜書き換えてください。

ちなみに2022-04-19現在、利用可能なリージョン数は22ありました(GovCloudのような特殊なリージョンを除く)。

## 参考

- [Runtime deprecation policy](https://docs.aws.amazon.com/lambda/latest/dg/runtime-support-policy.html)
- [「AWS リージョン別のサービス」](https://aws.amazon.com/jp/about-aws/global-infrastructure/regional-product-services/?p=ngi&loc=4)