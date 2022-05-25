---
layout: post
title: "サーバーレスでCloudWatchメトリクスをMackerelに転送する"
slug: mackerel-cloudwatch-transfer
date: 2019-01-31 17:44:00 +0900
comments: true
categories: [go, golang, aws, mackerel]
---

## 背景

サーバーの監視に[Mackerel](https://mackerel.io/ja/)を使っているのですが、
用意されているメトリクスでは足りずカスタムメトリクスを追加することが多々あります。
[Mackerel Agent Plugins](https://github.com/mackerelio/mackerel-agent-plugins)を利用すればメトリクスを増やすこと自体は簡単なのですが、
Agentを設置するインスタンスが増えるので、サーバー保守の手間が増えてしまいます。

僕のユースケースでは監視対象はたいていAWSのマネージド・サービスなので、
AWS CloudWatch に投稿されたメトリクスが Mackerel で見れれば十分なことが多いです。

そこで、以下の記事を参考に AWS Lambda と CloudWatch Events を組み合わせて、Mackerelへメトリクスを転送するスクリプトを書いてみました。

- [Amazon LambdaでCloudWatchのメトリクスをMackerelに監視させる](https://blog.jicoman.info/2016/11/cloudwatch_mackerel/)


## デプロイしてみる

今回はなんと！皆さんの AWSマネジメントコンソールから、クリックひとつでデプロイできるようにしてみました！

- [mackerel-cloudwatch-forwarder](https://serverlessrepo.aws.amazon.com/applications/arn:aws:serverlessrepo:us-east-1:445285296882:applications~mackerel-cloudwatch-forwarder)

・・・と、その前に下準備が必要です。
MackerelのダッシュボードからAPIキーをコピーしてきて、
[AWS Systems Manager パラメータストア](https://docs.aws.amazon.com/ja_jp/systems-manager/latest/userguide/systems-manager-paramstore.html)に
Secure String として登録しておきます。
スクショでは Mackerel のものだと分かりやすいよう `/development/api.mackerelio.com/headers/X-Api-Key` という名前をつけました。
この名前を後で使うので覚えておきましょう。

![パラメーターストア](/images/2019-01-31-parameter-store.png)

次に AWS Lambda の画面を開き、「関数の作成」をクリックします。

![関数の作成](/images/2019-01-31-create-new-function.png)

「一から作る」「設計図」「AWS Serverless Application Repository」の3つの選択肢が表れるので、
**「AWS Serverless Application Repository」** を選択します。
検索BOXに「Mackerel」と入れると、[mackerel-cloudwatch-forwarder](https://serverlessrepo.aws.amazon.com/applications/arn:aws:serverlessrepo:us-east-1:445285296882:applications~mackerel-cloudwatch-forwarder)が
出てくるので、それを選択します。
なお、この選択肢はデフォルトでは表示ないので、「**Show apps that create custom IAM roles or resource policies**」にチェックを入れましょう。

![アプリケーションの検索](/images/2019-01-31-search-application.png)

アプリケーションの内容とパラメーターの設定画面に移ります。
「ParameterName」にパラメーターストアに登録したパラメーター名を入れましょう。
スクショの例では「`/development/api.mackerelio.com/headers/X-Api-Key`」を入力します。

![内容を確認してデプロイ](/images/2019-01-31-deploy.png)

「カスタムIAMロールを作成することに同意」のチェックボックスを選択したあと、デプロイ！

しばらく待っていると CloudFormation を利用して [mackerel-cloudwatch-forwarder](https://serverlessrepo.aws.amazon.com/applications/arn:aws:serverlessrepo:us-east-1:445285296882:applications~mackerel-cloudwatch-forwarder) がデプロイされます。

![アプリケーションがデプロイされました](/images/2019-01-31-deployed.png)


## 実装

元記事では Python を利用していましたが、今回の実装には Go を利用しました。
APIのレスポンスを待つ時間がほとんどで、並行処理が得意な言語のほうが金銭的にお得になるからです。

- [shogo82148/mackerel-cloudwatch-forwarder](https://github.com/shogo82148/mackerel-cloudwatch-forwarder)

「[S3からファイルを落とすだけのツールを作った](https://shogo82148.github.io/blog/2018/06/20/s3cli-mini/)」に続き、
今回も aws-sdk-v2 を使ってみました。

MackerelのAPIを叩く部分は net/http を素で使っています。
というのも、公式提供の [mackerelio/mackerel-client-go](https://github.com/mackerelio/mackerel-client-go) は context に未対応で、
Exponential Back Off のようなリトライ機能が無いためです。
使うAPIは2つだけなので、直接 http を喋ったほうが早いということで、実装しました。
もうちょっと汎用化できるような工夫ができたら、本家クライアントにも入れてもらいたいですね。

こういう外部のAPIを叩くときに、何かと頭を悩ませるのがシークレットの管理です。
他の人の記事を読むと、「KMSで暗号化して環境変数に埋め込み」というのをよく見るのですが、
Lambda関数を追加するたびに環境変数の設定をやるのは大変です。
そこで mackerel-cloudwatch-forwarder では [AWS Systems Manager パラメータストア](https://docs.aws.amazon.com/ja_jp/systems-manager/latest/userguide/systems-manager-paramstore.html) にシークレットを保存、
環境変数にはパラメーター名だけを渡すようにしました。


## アプリケーションを公開する

Lambda関数の記述にGoを採用したのはいいものの、Goはビルドが必要なので、実際に利用するのは少し面倒です。
なんとかできないものかと調べてみると、去年(2018年)2月に [AWS Serverless Application Repository](https://aws.amazon.com/jp/serverless/serverlessrepo/) が一般公開された記事を見つけました。

- [AWS Serverless Application Repository が一般公開されました](https://aws.amazon.com/jp/about-aws/whats-new/2018/02/aws-serverless-application-repository-now-generally-available/)

リリースからの時期が浅いこともあって、[AWS Serverless Application Repository](https://aws.amazon.com/jp/serverless/serverlessrepo/) に登録されているのは
AWSやアメリカの企業が目立ちますが、AWSのアカウントさえ持っていれば、企業に限らず個人もアプリケーションを公開することができます。

### SAM CLI

[公式のドキュメント](https://docs.aws.amazon.com/ja_jp/serverlessrepo/latest/devguide/serverless-app-publishing-applications.html)には
AWS マネジメントコンソールやawscliから公開する方法がかいてありますが、
アプリケーションのメタデータを別途管理する必要があるので、AWS SAM(Serverless Application Model) CLIを使うのが簡単です。

- [Publishing Applications Using AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-template-publishing-applications.html)

通常のSAMのテンプレートに、以下のような10行程度のメタデータをつければ、SAM CLI がこれを読み取ってくれます。

```yaml
Metadata:
  AWS::ServerlessRepo::Application:
    Name: mackerel-cloudwatch-forwarder
    Description: Forward the metrics in AWS CloudWatch to the Mackerel.
    Author: Shogo Ichinose
    SpdxLicenseId: MIT
    LicenseUrl: LICENSE
    ReadmeUrl: README.md
    Labels: ['tests']
    HomePageUrl: https://github.com/shogo82148/mackerel-cloudwatch-forwarder
    SemanticVersion: 0.0.4
    SourceCodeUrl: https://github.com/shogo82148/mackerel-cloudwatch-forwarder

# 以下、SAMの定義
```

### S3へのアップロード

SAMアプリケーションの本体はS3にアップロードしますが、
AWS Serverless Application Repository へ公開するには S3 へのアクセス権限付与が必要です。
ドキュメントを参考にして、アップロード先のS3バケットにAWS Serverless Application Repositoryからのアクセスを許可する
バケットポリシーを付与します。

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service":  "serverlessrepo.amazonaws.com"
            },
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::<your-bucket-name>/*"
        }
    ]
}
```

アップロードの手順は通常のSAMアプリケーションと同様、 `sam package` コマンドを使用します。

```
sam package \
    --template-file template.yaml \
    --output-template-file packaged.yaml \
    --s3-bucket <your-bucket-name>
```

### 公開

公開には `sam publish` コマンドを使用します。

```
sam publish \
    --template packaged.yaml \
    --region us-east-1
```

アップロード自体は東京リージョンでも可能ですが、一般公開はできません。
2019年1月現在 us-east-1, us-east-2 のどちらかのリージョンで公開する必要があります。

> https://aws.amazon.com/jp/blogs/aws/now-available-aws-serverless-application-repository/
> You can publish from the US East (N. Virginia) or US East (Ohio) Regions for global availability.

ちゃんと計測はしていませんが、公開ボタンを押してから別リージョンでアクセス可能になるまで30分くらいかかりました。
進捗もわからないし、公開処理が完了するまでは404ページになって、かなり不安になったのですが、まあ、そういうものです。


## CloudFormationから利用する

公開したアプリケーションはSAMの [AWS::Serverless::Application](https://github.com/awslabs/serverless-application-model/blob/master/versions/2016-10-31.md#awsserverlessapplication) タイプとして利用可能です。

```yaml
  MetricsForwarder:
    Type: AWS::Serverless::Application
    Properties:
      Location:
        ApplicationId: arn:aws:serverlessrepo:us-east-1:445285296882:applications/mackerel-cloudwatch-forwarder
        SemanticVersion: 0.0.4
      Parameters:
        ParameterName: "/api-keys/api.mackerelio.com/headers/X-Api-Key"
        ForwardSettings: |
            {
              "service_metrics": [
                {
                  "service": "your service name",
                  "name": "metric name",
                  "metric": [ "namespace", "metrics name" ],
                  "stat": "Sum"
                }
              ]
            }
```

JSON string in YAML になって大変気持ち悪いですが、JSON string in JSON よりはマシだと言い聞かせて・・・

こうして埋め込んだアプリケーションは CloudFormation上は Nested Stack として表現されるようです。

## ForwardSettingsの指定方法

CloudWatchメトリクスからMackerelメトリクスへの変換方法は、以下のようなJSONで指定します。

```json
{
    "service_metrics": [
        {
            "service": "your service name",
            "name": "metric name on mackerel",
            "metric": [ "Namespace", "MetricName", "Dimension1Name", "Dimension1Value", {} ],
            "stat": "Sum"
        },
        {
            "service": "your service name",
            "name": "metric name on mackerel",
            "metric": [ "Namespace", "MetricName", "Dimension1Name", "Dimension1Value"],
            "stat": "Sum"
        }
    ],
    "host_metrics": [
        {
            "hostId": "host id",
            "name": "metric name on mackerel",
            "metric": [ "Namespace", "MetricName", "Dimension1Name", "Dimension1Value", {} ],
            "stat": "Sum"
        },
        {
            "hostId": "host id",
            "name": "metric name on mackerel",
            "metric": [ "Namespace", "MetricName", "Dimension1Name", "Dimension1Value"],
            "stat": "Sum"
        }
    ]
}
```

`metric` の指定方法は CloudWatch のダッシュボードを参考にしました。

![CloudWatch](/images/2019-01-31-cloudwatch.png)

CloudWatchのコンソールからメトリクスを確認するときに、「ソース」タブをクリックするとグラフの定義が現れます。
ここでプレビューを確認して、ソースの `metrics` 部分をそのままコピペすれば動くという寸法です。
なお、最後の `{ "stat": "Sum", "period": 60 }` となっている部分は無視されます。


## まとめ

- CloudWatchメトリクスをMackerelに転送する [mackerel-cloudwatch-forwarder](https://serverlessrepo.aws.amazon.com/applications/arn:aws:serverlessrepo:us-east-1:445285296882:applications~mackerel-cloudwatch-forwarder) を作った
- はじめての AWS SAM アプリケーションを作ってみた
- [AWS Serverless Application Repository](https://aws.amazon.com/jp/serverless/serverlessrepo/) デビュー

こう・・・グラフ定義が CloudFormation でできるようになったので、監視設定も CloudFormation でやりたくなってきますね・・・
(CloudFormationに侵食されてきた)

AWS の中で完結すると楽なんですが、監視に関してはやっぱり Mackerel 便利なんですよね・・・世の中うまくいかない。

mackerel-cloudwatch-forwarder は、米国東部 (オハイオ)、米国東部 (バージニア北部)、米国西部(北カリフォルニア)、米国西部 (オレゴン)、アジアパシフィック (東京)、アジアパシフィック (ソウル)、アジアパシフィック (ムンバイ)、アジアパシフィック (シンガポール)、アジアパシフィック(シドニー)、カナダ (中部)、欧州 (フランクフルト)、欧州 (アイルランド)、欧州 (ロンドン)、および南米 (サンパウロ) のリージョンでご利用いただけます。 

## 参考

- [Amazon LambdaでCloudWatchのメトリクスをMackerelに監視させる](https://blog.jicoman.info/2016/11/cloudwatch_mackerel/)
- [AWS Serverless Application Repository](https://aws.amazon.com/jp/serverless/serverlessrepo/)
- [Applications - AWS Serverless Application Repository](https://serverlessrepo.aws.amazon.com/applications)
- [AWS Serverless Application Repository とは](https://docs.aws.amazon.com/ja_jp/serverlessrepo/latest/devguide/what-is-serverlessrepo.html)
- [アプリケーションの公開](https://docs.aws.amazon.com/ja_jp/serverlessrepo/latest/devguide/serverless-app-publishing-applications.html)
- [Publishing Applications Using AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-template-publishing-applications.html)
- [What Is the AWS Serverless Application Model (AWS SAM)?](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html)
- [Now Available – AWS Serverless Application Repository](https://aws.amazon.com/jp/blogs/aws/now-available-aws-serverless-application-repository/)
- [AWS Serverless Application Model (SAM)](https://github.com/awslabs/serverless-application-model/blob/master/versions/2016-10-31.md)
- [Metric Widget: Format for Each Metric in the Array - Dashboard Body Structure and Syntax](https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/CloudWatch-Dashboard-Body-Structure.html#CloudWatch-Dashboard-Properties-Metrics-Array-Format)
- [shogo82148/mackerel-cloudwatch-forwarder](https://github.com/shogo82148/mackerel-cloudwatch-forwarder)
- [mackerel-cloudwatch-forwarder](https://serverlessrepo.aws.amazon.com/applications/arn:aws:serverlessrepo:us-east-1:445285296882:applications~mackerel-cloudwatch-forwarder)
