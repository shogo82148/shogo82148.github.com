---
layout: post
title: "EC2 Instance Metadata Service と Amazon Time Sync Service で IPv6 エンドポイントが利用可能になりました"
slug: confused-deputy-problem-on-mackerelio
date: 2021-08-30 22:39:00 +0900
comments: true
categories: [aws]
---

今日はちょっとした小ネタを

[dependabot](https://docs.github.com/en/code-security/supply-chain-security/keeping-your-dependencies-updated-automatically/about-dependabot-version-updates) が作ったプルリクエストを整理していたら AWS Go SDK のリリースノートに面白そうなリリースを発見。

> [Release v1.40.0 (2021-07-14)](https://github.com/aws/aws-sdk-go/releases/tag/v1.40.0)
>
> `aws/session`: Support has been added for EC2 IPv6-enabled Instance Metadata Service Endpoints (#4006)

こんなところにも IPv6 の波が！

早速試してみようと思ったんですが、なかなかうまく行かない。
今日ようやくやり方がわかったのでメモしておきます。

## インスタンスメタデータ IPv6 エンドポイントを有効化する

リリースのアナウンスによるとインスタンスメタデータサービス(IMDS)の IPv6 エンドポイントは明示的に有効化する必要があるそうです。

> [IPv6 endpoints are now available for the Amazon EC2 Instance Metadata Service, Amazon Time Sync Service, and Amazon VPC DNS Server](https://aws.amazon.com/about-aws/whats-new/2021/08/Ipv6-amazon-ec2-metadata-time-sync-vpc-dns/)
>
> To get started, you need to enable the IPv6 endpoint for IMDS on your EC2 Instances.

ドキュメントを見ても有効化の方法どこにも書いてないぞ？？？と思ったんですが、それもそのはず。
AWS CLI が対応していないので、有効化する方法がなかったのです。
IPv6 エンドポイントに対応 4 日前にリリースされた [AWS CLI v2.2.33](https://github.com/aws/aws-cli/blob/v2/CHANGELOG.rst#2233) からでした・・・。

> api-change:`ec2`: Support added for IMDS IPv6 endpoint

```
$ aws --version
aws-cli/2.2.33 Python/3.9.6 Darwin/20.6.0 source/x86_64 prompt/off
```

AWS CLI v2.2.33 で IMDS のオプションを確認すると `HttpProtocolIpv6` といういかにもそれっぽいオプションが増えています。

```
$ aws ec2 modify-instance-metadata-options --instance-id i-009df055e1f06d17f
{
    "InstanceId": "i-009df055e1f06d17f",
    "InstanceMetadataOptions": {
        "State": "pending",
        "HttpTokens": "optional",
        "HttpPutResponseHopLimit": 1,
        "HttpEndpoint": "enabled",
        "HttpProtocolIpv6": "disabled"
    }
}
```

`--http-protocol-ipv6 enabled` で有効化できます。

```
$ aws ec2 modify-instance-metadata-options --instance-id i-009df055e1f06d17f --http-protocol-ipv6 enabled
{
    "InstanceId": "i-009df055e1f06d17f",
    "InstanceMetadataOptions": {
        "State": "pending",
        "HttpTokens": "optional",
        "HttpPutResponseHopLimit": 1,
        "HttpEndpoint": "enabled",
        "HttpProtocolIpv6": "enabled"
    }
}
```

有効になった IPv6 のアドレスは `fd00:ec2::254`。
アドレスの中にサービス名である EC2 が入っています。[Facebook みたい](https://www.na3.jp/entry/20120611/p1)でオシャレですね。
最後の `254` は IPv4 のアドレス `169.254.169.254` と合わせたものだと思います(でも IPv4 の表記は 10 進数だけど、IPv6 の表記は 16 進数だから値としては全く違うよね・・・)。
IPv4 と同様に curl で叩けます。

```
$ curl http://[fd00:ec2::254]/latest/meta-data/
ami-id
ami-launch-index
ami-manifest-path
block-device-mapping/
events/
hostname
iam/
identity-credentials/
instance-action
instance-id
instance-type
local-hostname
local-ipv4
mac
managed-ssh-keys/
metrics/
network/
placement/
profile
public-hostname
public-ipv4
reservation-id
security-groups
services
```

いや、まさか AWS CLI のバージョンが問題だったとはね・・・

## Amazon Time Sync Service の IPv6 エンドポイント

おまけ。

今回のリリースで AWS が提供する NTP サーバーである Amazon Time Sync Service も IPv6 対応しています。
IP アドレスは `fd00:ec2::123` です。`123` は NTP のポート番号ですね(IMDS と同様に、これ 16 進数表記だから値は全然 `123` ではないんだけどね)。これも IPv4 `169.254.169.123` の末尾 `123` と合わせたものでしょう。

chrony の設定ファイル(`/etc/chrony.conf`)に以下の行を追加すると有効化できます。

```
server fd00:ec2::123 prefer iburst minpoll 4 maxpoll 4
```

なお、当然のことながら(？)、この IP アドレスを使うには EC2 インスタンスに IPv6 アドレスを割り当てる必要があるようです。
これでちょっとハマりました。

これは今回追加されたアドレス(`fd00:ec2::254`, `fd00:ec2::123`)が[ユニークローカルアドレス](https://ja.wikipedia.org/wiki/%E3%83%A6%E3%83%8B%E3%83%BC%E3%82%AF%E3%83%AD%E3%83%BC%E3%82%AB%E3%83%AB%E3%82%A2%E3%83%89%E3%83%AC%E3%82%B9)(`fd00::/8`) であるためだと思ってます(たぶん)。
IPv4 の `169.254.169.254` や `169.254.169.123` は [リンクローカルアドレス](https://ja.wikipedia.org/wiki/%E3%83%AA%E3%83%B3%E3%82%AF%E3%83%AD%E3%83%BC%E3%82%AB%E3%83%AB%E3%82%A2%E3%83%89%E3%83%AC%E3%82%B9) 呼ばれるもので、 IPv6 では対応するのは `fe80::/64` だと思うのですが、この範囲の割り当てではないんですね。

・・・ムズカシイ

## 参考

- [AWS CLI CHANGELOG v2.2.33](https://github.com/aws/aws-cli/blob/v2/CHANGELOG.rst#2233)
- [aws/aws-sdk-go Release v1.40.0](https://github.com/aws/aws-sdk-go/releases/tag/v1.40.0)
- [EC2 IMDS IPv6 Support #4006](https://github.com/aws/aws-sdk-go/pull/4006)
- [Amazon EC 2 Instance Metadata Service、Amazon Time Sync Service、および Amazon VPC DNS サーバーで IPv6 エンドポイントを使用できるようになりました](https://aws.amazon.com/jp/about-aws/whats-new/2021/08/Ipv6-amazon-ec2-metadata-time-sync-vpc-dns/)
- [IPv6 endpoints are now available for the Amazon EC2 Instance Metadata Service, Amazon Time Sync Service, and Amazon VPC DNS Server](https://aws.amazon.com/about-aws/whats-new/2021/08/Ipv6-amazon-ec2-metadata-time-sync-vpc-dns/)
- [ユニークローカルアドレス - Wikipedia](https://ja.wikipedia.org/wiki/%E3%83%A6%E3%83%8B%E3%83%BC%E3%82%AF%E3%83%AD%E3%83%BC%E3%82%AB%E3%83%AB%E3%82%A2%E3%83%89%E3%83%AC%E3%82%B9)
- [リンクローカルアドレス - Wikipedia](https://ja.wikipedia.org/wiki/%E3%83%AA%E3%83%B3%E3%82%AF%E3%83%AD%E3%83%BC%E3%82%AB%E3%83%AB%E3%82%A2%E3%83%89%E3%83%AC%E3%82%B9)
- [Facebook の IPv6 アドレスがカッコイイ - 元 RX-7 乗りの適当な日々](https://www.na3.jp/entry/20120611/p1)
