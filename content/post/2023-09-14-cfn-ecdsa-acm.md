---
layout: post
title: "CloudFormationでECDSA形式のTLS証明書が取れた"
slug: 2023-09-14-cfn-ecdsa-acm
date: 2023-09-14 18:53:00 +0900
comments: true
categories: [aws, cloudformation]
---

2022 年 11 月から ECDSA（楕円曲線デジタル署名アルゴリズム）に対応しています。

- [AWS Certificate Manager が楕円曲線デジタル署名アルゴリズム TLS 証明書のサポートを開始](https://aws.amazon.com/jp/about-aws/whats-new/2022/11/aws-certificate-manager-elliptic-curve-digital-signature-algorithm-tls-certificates/)

しかし、

> CloudFormation のサポートは近日中に提供が開始されます。

と書いてあるように、CloudFormation からの利用はできませんでした。

今日試してみたら、行けたっぽい（？）ので、設定方法のメモです。

## 設定方法

`KeyAlgorithm` に `EC_prime256v1` もしくは `EC_secp384r1` を指定します。

```yaml
AWSTemplateFormatVersion: "2010-09-09"

Resources:
  Certificate:
    Type: AWS::CertificateManager::Certificate
    Properties:
      DomainName: shogo82148.com
      ValidationMethod: DNS
      DomainValidationOptions:
        - DomainName: shogo82148.com
          HostedZoneId: Z1TR8BQNS8S1I7
      KeyAlgorithm: EC_prime256v1
```

## 注意

ふと、[AWS::CertificateManager::Certificate](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-certificatemanager-certificate.html#cfn-certificatemanager-certificate-keyalgorithm) リソースのドキュメントを読んでいたら `KeyAlgorithm` という属性を見つけたので試してみました。
しかし、2023-09-14 現在説明文は

> Property description not available.

の一文のみ。
リリースの案内も見つけられなかったので、心配な人は正式リリースの案内を待ちましょう。

基本的に CloudFormation のプロパティーはサービスの API と同じ名前です。
今回試してみた `EC_prime256v1` という値も、ACM の API リファレンスの `KeyAlgorithm` を参照しました。

- [ACM API Reference: RequestCertificate KeyAlgorithm](https://docs.aws.amazon.com/acm/latest/APIReference/API_RequestCertificate.html#ACM-RequestCertificate-request-KeyAlgorithm)

## 参考

- [AWS Certificate Manager が楕円曲線デジタル署名アルゴリズム TLS 証明書のサポートを開始](https://aws.amazon.com/jp/about-aws/whats-new/2022/11/aws-certificate-manager-elliptic-curve-digital-signature-algorithm-tls-certificates/)
- [ACM API Reference: RequestCertificate KeyAlgorithm](https://docs.aws.amazon.com/acm/latest/APIReference/API_RequestCertificate.html#ACM-RequestCertificate-request-KeyAlgorithm)
- [AWS::CertificateManager::Certificate: KeyAlgorithm](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-certificatemanager-certificate.html#cfn-certificatemanager-certificate-keyalgorithm)
