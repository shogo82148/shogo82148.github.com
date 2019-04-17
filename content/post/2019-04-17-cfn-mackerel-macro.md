---
layout: post
title: "CloudFormationのMackerel用インテグレーションを作ってる話"
slug: cfn-mackerel-macro
date: 2019-04-17 18:26:00 +0900
comments: true
categories: [go, golang, aws, cloudformation, mackerelio]
---

[Mackerel](https://mackerel.io/) は [mkr](https://mackerel.io/ja/docs/entry/advanced/cli) コマンドを用いて cli から操作ができます。
mkr コマンドを用いると [監視ルールを GitHub で管理](https://mackerel.io/ja/docs/entry/advanced/monitors-github) したり、
カスタムダッシュボードを管理したり、といったことができます。
しかし、個人的に以下のような不満があります。

- サービス、ロール、ホスト、新ダッシュボード等々、監視設定以外のリソースに対応していない
    - 旧ダッシュボードは対応しているんだけど、新ダッシュボード対応がまだ
    - 新ダッシュボードのUIは使いやすくてすごくいいんだけど、コピペや一斉置換ができないので、テキストで管理したい
- 出力がJSONなのつらい
     - JSON手で書くの難しくないですか？
- メトリックスの送信設定と監視設定の管理が別になってしまう
    - カスタムメトリックス送っているのに監視設定を忘れた、みたいなことが起こる

メトリックスの送信設定については、以前 [サーバーレスでCloudWatchメトリクスをMackerelに転送する](https://shogo82148.github.io/blog/2019/01/31/mackerel-cloudwatch-transfer/) で
CloudFormation上での管理を実現しました。
ここにさらに Mackerel の監視設定を追加できれば、最強なのでは？とやってみました。


## 例

あれこれ説明する前に例を見てもらったほうがわかりやすいと思うので、こんなことができますよ、という設定例から。

### 例1: レスポンスタイムの99%パーセンタイルを監視する

[Mackerel の AWSインテグレーション](https://mackerel.io/ja/docs/entry/integrations/aws/alb) は ALB に対応していますが、
レスポンスタイムのメトリックスは平均レスポンスタイムだけです。
「平均」は代表的な統計値ですが、全体としては速いんだけど一部のリクエストだけ遅い、という状況を見逃してしまいます。
レスポンスタイムの大まかな分布をパーセンタイルで把握したい、ということはよくありますよね？
(K社でZabbixを使って監視していたときによくお世話になった)

今回作ったインテグレーションを使えば、以下のように「Mackerelのサービス定義」「メトリックスの転送設定」「監視設定」が
CloudFormation のテンプレートとして表現できます。

```yaml
AWSTemplateFormatVersion: 2010-09-09

# Type: Mackerel::* を使うためのおまじない
Transform:
  - AWS::Serverless-2016-10-31
  - Mackerel
  - JSONString

Resources:
  MackerelService:
    Type: Mackerel::Service
    Properties:
      Name: "awesome-service"

  # メトリックスを転送する Lambda 関数
  MetricsForwarder:
    Type: AWS::Serverless::Application
    Properties:
      Location:
        ApplicationId: arn:aws:serverlessrepo:us-east-1:445285296882:applications/mackerel-cloudwatch-forwarder
        SemanticVersion: 0.0.9
      Parameters:
        ParameterName: "/api-keys/api.mackerelio.com/headers/X-Api-Key"
        ForwardSettings: !GetAtt MetricsForwarderSettings.Query

  # CloudWatch から99%パーセンタイルを取得する
  MetricsForwarderSettings:
    Type: JSON::String
    Properties:
      Query:
        - service: !GetAtt MackerelService.Name
          name: request_percentile.p99
          metric:
            - AWS/ApplicationELB
            - TargetResponseTime
            - LoadBalancer
            - !GetAtt LoadBalancer.FullName
            - TargetGroup
            - !GetAtt TargetGroup.TargetGroupFullName
          stat: p99

  MonitorP99:
    Type: Mackerel::Monitor
    Properties:
      Type: service
      Name: request_percentile.p99
      Duration: 1
      Service: !Ref MackerelService
      Metric: request_percentile.p99
      Operator: ">"
      Warning: 3 # 3秒を超えたらWarning
      Critical: 10 # 10秒を超えたらCritical
      MaxCheckAttempts: 3
```


### 例2: ログに吐かれたエラーを監視する

`check-aws-cloudwatch-logs` を使うと、 CloudWatch Logs に吐かれたログを検索して、エラーを見つけたらアラートを飛ばすということができます。

- [AWS CloudWatch Logs のチェック監視プラグインを追加しました ほか](https://mackerel.io/ja/blog/entry/weekly/20181001)

しかし、check pluginを使うには mackerel-agent をインストールするサーバーが必要です。
運用が大変になるので管理するサーバーはあまり増やしたくありません。

いろいろと調べた結果、 CloudWatch Logs のメトリックスフィルターが使えそうです。
CloudFormation のテンプレートは以下のようになります。

```yaml
AWSTemplateFormatVersion: 2010-09-09

# Type: Mackerel::* を使うためのおまじない
Transform:
  - AWS::Serverless-2016-10-31
  - Mackerel
  - JSONString

Resources:
  MackerelService:
    Type: Mackerel::Service
    Properties:
      Name: "awesome-service"

  LogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: awesome-service-log

  # ログの検索結果をメトリックスとして保存し、傾向をモニタリングできる
  # https://docs.aws.amazon.com/ja_jp/AmazonCloudWatch/latest/logs/Counting404Responses.html
  MetricFilter:
    Type: AWS::Logs::MetricFilter
    Properties:
      # JSON形式のログに対応しているので、エラーのみをフィルタリング
      FilterPattern: '{ $.level = "error" }'
      LogGroupName: !Ref LogGroup
      MetricTransformations:
        - DefaultValue: 0
          MetricName: error_count
          MetricNamespace: awesome-service
          MetricValue: 1

  # メトリックスを転送する Lambda 関数
  MetricsForwarder:
    Type: AWS::Serverless::Application
    Properties:
      Location:
        ApplicationId: arn:aws:serverlessrepo:us-east-1:445285296882:applications/mackerel-cloudwatch-forwarder
        SemanticVersion: 0.0.9
      Parameters:
        ParameterName: "/api-keys/api.mackerelio.com/headers/X-Api-Key"
        ForwardSettings: !GetAtt MetricsForwarderSettings.Query

  # エラー発生数を Mackerel に転送する設定
  MetricsForwarderSettings:
    Type: JSON::String
    Properties:
      Query:
        - service: !GetAtt MackerelService.Name
          name: error_count
          metric:
            - awesome-service
            - error_count
          stat: Sum

  # 監視設定
  MonitorError:
    Type: Mackerel::Monitor
    Properties:
      Type: service
      Name: error_count
      Duration: 1
      Service: !Ref MackerelService
      Metric: error_count
      Operator: ">"
      Warning: 0 # 1件でもエラーが発生したらWarning
      Critical: 10 # 10件でCritical
      MaxCheckAttempts: 3
```

## 仕組み

### CloudFormation マクロとトランスフォーム

CloudFormation マクロはテンプレートを実際に反映する前に、テンプレートの中身を書き換えることのできる機能です。
CloufFormationのテンプレートはどうしても長くなってしまいがちですが、
マクロを使うことでショートハンドを自作することができます。

AWS Serverless Application Model (SAM) も、実態はAWSが提供するCloudFormationマクロです。
テンプレートの Transform セクションに指定した `AWS::Serverless-2016-10-31` マクロが
SAMのショートハンドを展開し、最終的に通常の CloudFormation テンプレートへと変換します。

マクロは Lambda 関数で自作ができるので、好きな言語を使ってテンプレートを自由に書き換えることができます。
GitHubで公開されている [MacrosExamples](https://github.com/awslabs/aws-cloudformation-templates/tree/master/aws/services/CloudFormation/MacrosExamples/) を見てもらうとわかりますが、
[ショートハンドを定義する](https://github.com/awslabs/aws-cloudformation-templates/tree/master/aws/services/CloudFormation/MacrosExamples/ShortHand)のはもちろん、
[テンプレート内でPythonを実行](https://github.com/awslabs/aws-cloudformation-templates/tree/master/aws/services/CloudFormation/MacrosExamples/PyPlate)できるようにしたりと、
入出力の形式さえ守っていれば何でもできます。
何でも出来すぎて怖いですね。

上に挙げた例では `Type: Mackerel::Monitor` が指定されたリソースをカスタムリソースに書き換えることで、
他のAWSリソースと同じような記法で Mackerel のリソースを定義できるようにしています。
(MacrosExamplesに比べると、非常におとなしい書き換えに見えますね)


### CloudFormation カスタムリソース

CloudFormation カスタムリソースは、リソースの「作成」「更新」「削除」の処理をユーザーが定義することで、
CloudFormation 自体が対応していないリソースであっても、CloudFormation上で扱うことのできる機能です。
リソースの操作には Lambda 関数を使用できるので、 Mackerel のような外部サービスであっても、
「作成」「更新」「削除」の処理さえ実行できればOKです。

嬉しいことに Go の Lambda ライブラリには、カスタムリソースを扱うためパッケージが含まれるので、
カスタムリソースを提供する Lambda 関数を簡単に作れます。

- [aws/aws-lambda-go/cfn](https://github.com/aws/aws-lambda-go/tree/master/cfn)
- [godoc](https://godoc.org/github.com/aws/aws-lambda-go/cfn)

また、作成したリソースの属性を `Fn:GetAtt` 組み込み関数を利用して参照可能できます。
さらにリソースIDさえテキトウに発行すれば、実リソースを持たず、CloudFormation上で属性だけを持つリソースを作成可能です。
このことを利用して `JSON::String` カスタムリソースは、実リソースを作成せず、 `Properties` をJSONでエンコードした文字列を属性として返します。
これにより YAML の中に JSON 書く苦行から開放されました。


## 使い方

ソースコードとテンプレートはすべて GitHub に公開しています。

- [shogo82148/cfn-mackerel-macro](https://github.com/shogo82148/cfn-mackerel-macro)
- [shogo82148/cfn-json-string-macro](https://github.com/shogo82148/cfn-json-string-macro)

マクロを利用するには、自分の AWS アカウントにマクロをインストールする必要があります。
S3にテンプレートとビルド済みバイナリを上げておいたので、インストールは awscli でいっぱつです。

```
aws cloudformation create-stack \
    --template-url https://s3-ap-northeast-1.amazonaws.com/shogo82148-cloudformation-template-ap-northeast-1/cfn-mackerel-macro/latest.yaml \
    --stack-name cfn-mackerel-macro \
    --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND

aws cloudformation create-stack \
    --template-url https://s3-ap-northeast-1.amazonaws.com/shogo82148-cloudformation-template-ap-northeast-1/cfn-json-string-macro/latest.yaml \
    --stack-name json-macro \
    --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND
```

あとはマクロを使うための「おまじない」をテンプレートに追加すればOKです。

```yaml
Transform:
  - AWS::Serverless-2016-10-31
  - Mackerel
  - JSONString
```

プロパティー名は [Mackerel API ドキュメント（v0）](https://mackerel.io/ja/api-docs/) を参考にしてください。
とはいえ、ドキュメントがまったくないのは不便なので、徐々に整備していこうと思います・・・。


## まとめ

CloudFormation の「マクロ」「トランスフォーム」「カスタムリソース」を利用して、
Mackerel の構成管理に挑戦しているお話を紹介しました。

CloudFormation 意外と遊べて便利ですね()

## 参考

- [Mackerel API ドキュメント（v0）](https://mackerel.io/ja/api-docs/)
- [トランスフォーム](https://docs.aws.amazon.com/ja_jp/AWSCloudFormation/latest/UserGuide/transform-section-structure.html)
- [AWS CloudFormation マクロを使用したテンプレートのカスタム処理の実行](https://docs.aws.amazon.com/ja_jp/AWSCloudFormation/latest/UserGuide/template-macros.html)
- [AWS Serverless Application Model (SAM)](https://github.com/awslabs/serverless-application-model/blob/master/versions/2016-10-31.md)
- [カスタムリソース](https://docs.aws.amazon.com/ja_jp/AWSCloudFormation/latest/UserGuide/template-custom-resources.html)
- [aws/aws-lambda-go/cfn](https://github.com/aws/aws-lambda-go/tree/master/cfn)
- [MacrosExamples](https://github.com/awslabs/aws-cloudformation-templates/tree/master/aws/services/CloudFormation/MacrosExamples/)
- [サーバーレスでCloudWatchメトリクスをMackerelに転送する](https://shogo82148.github.io/blog/2019/01/31/mackerel-cloudwatch-transfer/)
- [ログデータの検索およびフィルタリング](https://docs.aws.amazon.com/ja_jp/AmazonCloudWatch/latest/logs/MonitoringLogData.html)
