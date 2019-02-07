---
layout: post
title: "Let's Encrypt の証明書取得を AWS Lambda でやってみた"
slug: acme-cert-updater
date: 2019-02-07 19:22:00 +0900
comments: true
categories: [acme, python, aws, lambda]
---

## 背景

ここ数年で暗号化されていないHTTPは減り、常時TLSが当たり前になってきました。
公開用のページはもちろん、開発段階のページでもTLSは必須です。
普段はAWS上で開発をしているので、[AWS Certificate Manager](https://aws.amazon.com/jp/certificate-manager/)を利用することが多いのですが、
ちょっとしたお遊びにELBやCloudFormationを使うのはオーバーキルです。
そこで EC2 にもインストールできて、無料で使える Let's Encrypt を使って証明書を発行することを考えました。

Let's Encrypt で発行できる証明書は期間が90日と短く、60日ごとの自動更新が推奨されています。
証明局とAPIとAPIクライアントの実装例は提供するから、あとの自動化部分は自前で頑張ってねという感じなので、自動化部分を頑張らないといけません。
今回は実行環境として AWS Labda、ACME(Automatic Certificate Management Environment)クライアントとして certbot、
認証方法に `dns-01`、認証に必要なDNSレコードの書き換えに AWS Route 53 を使用する、という構成にしました。

ソースコードをGitHubに挙げたのと、[前回](https://shogo82148.github.io/blog/2019/01/31/mackerel-cloudwatch-transfer/)と同様に
[AWS Serverless Application Repository](https://aws.amazon.com/jp/serverless/serverlessrepo/) へ上げたので、ぜひご利用ください。

- [shogo82148/acme-cert-updater](https://github.com/shogo82148/acme-cert-updater)
- [shogo82148/acme-cert-updater on AWS Serverless Application Repository](https://serverlessrepo.aws.amazon.com/applications/arn:aws:serverlessrepo:us-east-1:445285296882:applications~acme-cert-updater)


## 関連手法

### Amazon Linux 2 に certbot をインストールして使う

Amazon Linux 2 のドキュメントに TLS 対応のウェブサーバーを立てる例が載っています。
Let's Encrypt で証明書を取る方法も紹介されているので、まずはこれを利用することを考えました。

- [付録: Amazon Linux 2 での Let's Encrypt と Certbot の使用 - チュートリアル: Amazon Linux 2 で SSL/TLS を使用できるように Apache ウェブサーバーを設定する](https://docs.aws.amazon.com/ja_jp/AWSEC2/latest/UserGuide/SSL-on-an-instance.html#letsencrypt)

この方法は以下の理由から見送りました。

- ドメインの所有確認に Route 53 へのアクセス許可が必要だけど、Webサーバーやアプリケーションが同居しているサーバーにこのDNS操作の権限を与えるのはちょっと不安。証明書の取得とサービス提供は権限を分離したい。
- certbot が yum の標準レポジトリには入っていないため、インストール手順が少し煩雑。開発用なのにサーバーの作って壊してがやりにくくなる。

### cohalz/CertUpdater

[cohalz/CertUpdater](https://github.com/cohalz/CertUpdater) は、はてなで使われている証明書の自動更新システムです。

- [Let's Encrypt 証明書の自動更新システムを作る](http://developer.hatenastaff.com/entry/2018/12/11/133000)

certbot + AWS Lambda + Route 53 と、僕が考えていた構成に一番近いシステムです。
証明書はS3に保存されます。
しかし、ちょっと実装面で不満な部分があったので、 yet another CertUpdater を作ることにしました。

具体的にはS3への証明書アップロード方法です。
証明書がS3にあるだけでは役に立たないので、最終的にはダウンロードしてサーバーに読み込ませる必要があります。
証明書は複数のファイルで構成されており、CertUpdater は `privkey.pem` → `cert.pem` → `chain.pem` → `fullchain.pem` を順番にアップロードしていきます。
もし、このアップロード処理の途中で、証明書のダウンロード処理が走ったらどうなるでしょう？
一部のファイルだけ更新されてしまい、公開鍵と秘密鍵のペアが崩れ、サーバーが動かなくなってしまいます。

S3上のオブジェクトを上書き更新していることにも注意が必要です。
AWSのサービス初期から存在するS3は、AWSユーザーにとって身近な存在です。
それだけに忘れがちですが、 **S3は高度な分散ストレージ** です。
データーを分散して保存しているので、データーの整合性に制限があります。詳しくはドキュメントを参照。

- [Amazon S3 のデータ整合性モデル](https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/dev/Introduction.html#ConsistencyModel)

ここで問題になってくるのがこの部分です。

> Amazon S3 は、すべてのリージョンで PUT および DELETE の上書きについて結果整合性を提供しています。

S3が提供するのは **結果整合性** です。
結果整合性って何？という話ですが、簡単に説明すると上書き更新したあと、古い内容と新しい内容のどちらが返ってくるかは全くわからない、ということです。
つまり、CertUpdaterの更新処理が完全に終わったあとであっても、誤って古い内容を読んでしまい、公開鍵と秘密鍵のペアが崩れる可能性があります。

-----

・・・と、ここまで証明書が壊れる危険性を説明してきましたが、S3は優秀なので「古い内容と新しい内容のどちらが返ってくるかは全くわからない」という状況は数秒で終わり、
すぐに新しい内容を返してくれます。アップロード処理自体も数秒で終わるでことでしょう。
S3が壊れた証明書を返す可能性があるのはこの僅かな時間のみなので、実際に壊しちゃった人は相当運のいい人です。

とはいえ「数秒で終わる」というのは今までの経験則です。S3はこの時間に対して何も保証をしていません。
つまり・・・・S3がその気になればデーターの受け渡しは１０年２０年後ということも可能だろう・・・・・・・・・・ということ・・・・！

僕は心配性なので気になってしまって・・・


## 実装

CertUpdaterを大いに参考にされていただき、S3の一貫性の問題を回避した形で実装しました。

前述のとおり、S3は「古い内容と新しい内容のどちらが返ってくるかは全くわか」りませんが、言い換えると「古い内容か新しい内容のどちらかは必ず返」してくれます。
アップロード中の壊れたデーターを読み出すことはありません。
壊れてほしくないデーターは同じオブジェクトに連結してからアップロードすればいいのです。

ただ、証明書のファイルをそのまま同じオブジェクトに連結してしまうとマネージドコンソール等から扱いにくいかな？とも思ったので、
証明書のそれぞれのファイルは個別のオブジェクトとしてアップロードするようにしました。
ただし、すでに存在しているオブジェクトを上書きしないよう、オブジェクトの名前にタイムスタンプを付与し、
**必ずオブジェクトの新規作成** になるようにします。
S3は **S3 バケットの新しいオブジェクトの PUTS については "書き込み後の読み込み" 整合性を提供** しているので、こうやってアップロードすると
**必ず最新の内容** が取得できます。
`aws s3 ls` すると以下のようになるイメージ。

```
$ aws s3 ls s3://my-bucket/example.com/
2018-10-07T21:37:00/
2018-12-07T21:37:00/
2019-02-07T21:37:00/
...
```

どのファイルが最新の証明書なのかを示すために、 `s3://my-bucket/example.com.json` のようなJSONファイルを作って
最新の内容が入ったオブジェクト名を書いておきます。

```json
{
  "privkey":   "2019-02-07T21:37:00/privkey.pem",
  "cert":      "2019-02-07T21:37:00/cert.pem",
  "chain":     "2019-02-07T21:37:00/chain.pem",
  "fullchain": "2019-02-07T21:37:00/fullchain.pem",
  // ...その他メタ情報...
}
```

このJSONファイルは上書き更新になるので古い内容が返ってくることはありますが、
壊れた内容が返ってくることはありません。
これで安心して証明書を利用することができます。


## 使い方

### 更新設定

AWS Serverless Application Repositoryに公開したので、
SAMの [AWS::Serverless::Application](https://github.com/awslabs/serverless-application-model/blob/master/versions/2016-10-31.md#awsserverlessapplication) タイプとして利用可能です。

```yaml
AWSTemplateFormatVersion: 2010-09-09
Transform: AWS::Serverless-2016-10-31

Resources:
  AcmeCertUpdater:
    Type: AWS::Serverless::Application
    Properties:
      Location:
        ApplicationId: arn:aws:serverlessrepo:us-east-1:445285296882:applications/acme-cert-updater
        SemanticVersion: 0.0.10
      Parameters: 
        # ACMEサーバー、Let's Encrypt以外の証明局を利用したい場合は書き換える。
        # AcmeServer: https://acme-v02.api.letsencrypt.org/directory
        # 証明書を保存するバケット
        BucketName: YOUR_BUCKET_NAME
        # 更新したいドメイン
        Domains: YOUR_DOMAINS
        # メールアドレス
        Email: YOUR_EMAIL_ADDRESS
        # production or staging テストのときはstagingを指定する
        # Environment: production
        # Amazon Route 53 Hosted Zone ID
        HostedZone: YOUR_HOSTED_ZONE_ID
        # The Amazon SNS topic Amazon Resource Name (ARN) to which the updater reports events.
        Notification: ARN_SNS_TOPIC
        # Prefix of objects on S3 bucket
        # Prefix: "" 
```

テンプレートを書いたら `aws cloudformation deploy` でデプロイできます。

```
aws cloudformation deploy \
    --template-file template.yaml \
    --stack-name <STACK_NAME> \
    --capabilities CAPABILITY_AUTO_EXPAND CAPABILITY_IAM
```

なにか問題があって証明書が失効してしまったときのために、1日2回証明書の状態確認を行います。
更新があると SNS Topic に更新したドメインの情報を Publish するので、あとはメールで受信するなり、Slackへ投稿するなりご自由にどうぞ。

### 証明書の利用

証明書のダウンロードスクリプトは以下のようにしました。
オブジェクト名決め打ちなのは最初のJSONファイルのみで、
他のファイルのオブジェクト名はJSONから読み取っているのがポイントです。

```
#!/usr/bin/env bash

if [[ $# -lt 3 ]]; then
    echo "Usage: $(basename "$0") BUCKET_NAME OBJECT_KEY_NAME OUTPUT_DIRECTORY COMMAND"
    exit 2
fi

BUCKET=$1
OBJECT=$2
OUTPUT=$3

set -eu
JSON=$(aws s3 cp "s3://$BUCKET/$OBJECT" -)
if [[ -f "$OUTPUT/timestamp.txt" ]] && [[ ! $(echo "$JSON" | jq -r .timestamp) > $(cat "$OUTPUT/timestamp.txt") ]]; then
    exit 0
fi

aws s3 cp --only-show-errors "s3://$BUCKET/$(echo "$JSON" | jq -r .cert.cert)" "$OUTPUT"
aws s3 cp --only-show-errors "s3://$BUCKET/$(echo "$JSON" | jq -r .cert.chain)" "$OUTPUT"
aws s3 cp --only-show-errors "s3://$BUCKET/$(echo "$JSON" | jq -r .cert.fullchain)" "$OUTPUT"
aws s3 cp --only-show-errors "s3://$BUCKET/$(echo "$JSON" | jq -r .cert.privkey)" "$OUTPUT"
echo "$JSON" | jq -r .timestamp > "$OUTPUT/timestamp.txt"

shift 3
if [ $# -eq 0 ]; then
    exit 0
fi

exec "$@"
```

このスクリプトは簡単なラッパースクリプトになっていて、証明書に更新があった場合にのみ、引数のコマンドを実行します。
以下は証明書の更新時に systemd で動いている nginx に証明書を反映する例です。

```
./download-certificate.sh bucket-name example.com.json /etc/ssl/example.com systemctl reload nginx
```


## まとめ

- AWS Lambda 上で Let's Encrypt を用いて証明書を取得する [shogo82148/acme-cert-updater](https://github.com/shogo82148/acme-cert-updater) を公開しました
- [AWS Serverless Application Repository](https://serverlessrepo.aws.amazon.com/applications/arn:aws:serverlessrepo:us-east-1:445285296882:applications~acme-cert-updater) から利用可能です

acme-cert-updater は、米国東部 (オハイオ)、米国東部 (バージニア北部)、米国西部(北カリフォルニア)、米国西部 (オレゴン)、アジアパシフィック (東京)、アジアパシフィック (ソウル)、アジアパシフィック (ムンバイ)、アジアパシフィック (シンガポール)、アジアパシフィック(シドニー)、カナダ (中部)、欧州 (フランクフルト)、欧州 (アイルランド)、欧州 (ロンドン)、および南米 (サンパウロ) のリージョンでご利用いただけます。 


## 参考

- [Let’s Encrypt is a free, automated, and open Certificate Authority.](https://letsencrypt.org/)
- [付録: Amazon Linux 2 での Let's Encrypt と Certbot の使用 - チュートリアル: Amazon Linux 2 で SSL/TLS を使用できるように Apache ウェブサーバーを設定する](https://docs.aws.amazon.com/ja_jp/AWSEC2/latest/UserGuide/SSL-on-an-instance.html#letsencrypt)
- [Let's Encrypt 証明書の自動更新システムを作る](http://developer.hatenastaff.com/entry/2018/12/11/133000)
- [Amazon S3 のデータ整合性モデル](https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/dev/Introduction.html#ConsistencyModel)
- [certbot](https://certbot.eff.org/)
- [certbot-dns-route53](https://certbot-dns-route53.readthedocs.io/en/stable/)
- [shogo82148/acme-cert-updater](https://github.com/shogo82148/acme-cert-updater)
