---
layout: post
title: "CloudFormationでECSタスクのドレインをやる"
slug: drain-ecs-task-with-cloudformation
date: 2019-01-26 17:44:00 +0900
comments: true
categories: [go, golang, mysql, aws]
---

やってみたはいいものの、1年後には仕組みを忘れていそうなのでメモ。

## 背景

昔はサービス毎にポコポコEC2インスタンスを立てていたのですが、
幸か不幸かインスタンスのリソースが余り気味でした。
そこで、最近流行りのコンテナ技術に乗っかって Amazon ECS (Amazon Elastic Container Service) を使って、
ひとつのインスタンスに複数のサービスを載せようと目論みました。

ちょうどその頃、[Spot Fleet](https://docs.aws.amazon.com/ja_jp/AWSEC2/latest/UserGuide/spot-fleet.html)というものを使うと、
スポットインスタンスをお手軽に借りられるという話を聞いたので、
Spot Fleet + ECS で格安クラスターを作ってみよう！と手を出してみました。

-----

(・・・もちろん、Fargateが東京リージョンで使えるようになったことは知っているけれど、スポットインスタンスの価格に負けてしまった・・・)

- [AWS Fargate 東京リージョン サービス開始のお知らせ](https://aws.amazon.com/jp/blogs/news/aws-fargate-tokyo/)
- [AWS Fargate で最大 50% の値下げを発表](https://aws.amazon.com/jp/about-aws/whats-new/2019/01/announcing-aws-fargate-price-reduction-by-up-to-50-/)


### ECS最適化インスタンスの更新問題

クラスターを作るだけなら、そう難しくはなく、インスタンス起動時に[Amazon ECS-Optimized Amazon Linux AMI](https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/al2ami.html)を使うだけです。
問題はこのイメージは定期的に更新される、ということです。
更新情報を流しているSNSトピックがあるので、これをサブスクライブしておくと、時たま更新通知が来ます。

- [Amazon ECS-Optimized Amazon Linux AMI の更新の通知のサブスクライブ](https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/ECS-AMI-SubscribeTopic.html)

この更新には機能追加はもちろん、セキュリティーフィックスも含まれているので、
なるべく早く新しいイメージに移行する必要があります。
移行は大まかに以下の手順で進めます。

1. 新しいAMIイメージに更新した Spot Fleet を作成する
2. **古いインスタンスに残っているタスクをいい感じに終了する(ドレイン)**
  - 突然殺すとユーザーにエラーが見えてしまうので、受付中のリクエストを捌き切ってから終了しないといけない
  - ドレインが始まるとECSがタスク数を調整するために、新しいインスタンスにタスクをお引越ししてくれる
3. ドレインが終了したら、古いインスタンスをシャットダウンする

ここで問題になってくるのが「古いインスタンスに残っているタスクをいい感じに終了する(ドレイン)」の部分。
コンソールからポチポチするのも面倒なので、自動化したいところですが、
いろいろとドキュメントをあさってみたのですが、公式ブログでも 「APIかawscliを叩く」「SNSとAWS Lambda をうまいこと組み合わせて頑張る」みたいな方法しか見当たらない・・・

- [コンテナインスタンスのドレイン](https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/container-instance-draining.html)
- [How to Automate Container Instance Draining in Amazon ECS](https://aws.amazon.com/jp/blogs/compute/how-to-automate-container-instance-draining-in-amazon-ecs/)
- [Amazon ECS におけるコンテナ インスタンス ドレイニングの自動化方法](https://aws.amazon.com/jp/blogs/news/how-to-automate-container-instance-draining-in-amazon-ecs/)

・・・みんなどうやってるの・・・？

## CloudFormationでECSタスクのドレイン

クラスターインスタンスを自由に選べるのが利点なので、自分で頑張れってことなんだろうと、仕方なく頑張ってみました。
インフラ構築にはCloudFormationを利用しているので、うまいこと連携できないかと探ってみました。

### CloudFormationのカスタムリソース

そこで目をつけたのが [CloudFormationのカスタムリソース](https://docs.aws.amazon.com/ja_jp/AWSCloudFormation/latest/UserGuide/template-custom-resources.html) です。
これを使うとCloudFormationが直接サポートしていないリソースをCloudFormationの管理下に置けます。
リソースの作成・更新・削除を行うべきタイミングで Amazon SNS や AWS Lambda 経由でイベントを受け取ることができるので、
プログラムで自動更新できるものは何でもCloudFormationの管理下に置けます。

この機能を使って、「ドレイン対象のECSタスク」をCloudFormationの管理下においてしまおう、という作戦です。

### カスタムリソースの仕組み

`Custom::` で始まるリソースタイプは自由に名前をつけることができるので、
好きな名前を `Type` にタイプを指定します。
プロパティーの `ServiceToken` には、カスタムリソースの更新イベントを受け取る Amazon SNS や AWS Lambda の arn を指定います。
必須項目はこれだけで、あとのプロパティーは、カスタムリソースの提供者が自由に決められます。

```yaml
ECSDrain:
    # 先頭に Custom:: をつけるだけ。簡単！　ECSDrain の部分は自由に決められる
    Type: Custom::ECSDrain
    Version: '1.0'
    Properties:
        # カスタムリソースの更新を行うLambda関数を指定
        ServiceToken: !GetAtt Function.Arn

        # 残りのプロパティーは自由に決めることができる
        SpotFleet: !Ref SpotFleet
```

流れてくるイベントはこんな感じです(作成時の例)。
プロパティーの内容が渡ってくるので、これをもとにリソース更新を行います。

```json
{
    "RequestType": "Create",
    "ServiceToken": "arn:aws:lambda:ap-northeast-1:1234567890:function:funcation-name",
    "ResponseURL": "https://cloudformation-custom-resource-response-apnortheast1.s3-ap-northeast-1.amazonaws.com/xxxxx",
    "StackId": "arn:aws:cloudformation:ap-northeast-1:1234567890:stack/foobar/12345678-1234-1234-1234-123456789abc",
    "RequestId": "12345678-1234-1234-1234-123456789abc",
    "LogicalResourceId": "ECSDrain",
    "ResourceType": "Custom::ECSDrain",
    "ResourceProperties": {
        "ServiceToken": "arn:aws:lambda:ap-northeast-1:1234567890:function:funcation-name",
        "SpotFleet": "sfr-12345678-1234-1234-1234-123456789abc"
    }
}
```

リソースの更新が終わったら、 `ResponseURL` に結果を投げます(S3のURLなの面白い)。
あとから作成したカスタムリソースを特定できるように `PhysicalResourceId` を一緒に返します。

```json
{
    "Status": "SUCCESS",
    "PhysicalResourceId": "my-custom-resource",
    "StackId": "arn:aws:cloudformation:ap-northeast-1:1234567890:stack/foobar/12345678-1234-1234-1234-123456789abc",
    "RequestId": "12345678-1234-1234-1234-123456789abc",
    "LogicalResourceId": "ECSDrain",
}
```

### ECSタスクドレイン用カスタムリソース

さて、本題のECSタスクドレイン用カスタムリソースです。
「カスタムリソースは Spot Fleet に依存する」というふうに定義しておくと、
「Spot Fleet が作成された後」**「Spot Fleet が削除される前」**に作成・削除のイベントを受け取ることができます。
「Spot Fleet が削除される前」のイベントで、タスクのドレインを行えば、インスタンス終了前にタスクを安全に終了することができるはずです。

・・・というわけで、頑張って書いたのがこちら。

```yaml
  ECSDrainFunction:
    Type: AWS::Lambda::Function
    Properties:
      Code:
        ZipFile: |
          import boto3, json, logging, time
          from botocore.vendored import requests
          logging.basicConfig()
          logger = logging.getLogger()
          logger.setLevel(logging.DEBUG)
          ec2 = boto3.client('ec2')
          ecs = boto3.client('ecs')
          def cfn_response(url, body):
              data = json.dumps(body)
              headers = {'content-type' : '','content-length' : str(len(data))}
              requests.put(url, data=data, headers=headers)
        
          # リソースの作成イベント処理。タスクの作成は ECS::Service で行うので、特に何もしない。
          def _create(ret, event):
              ret['Status'] = 'SUCCESS'
              ret['PhysicalResourceId'] = event['ResourceProperties']['SpotFleet']
              return ret

          # リソースの更新イベント処理。PhysicalResourceId に更新前とは異なる値を設定しているのがポイント
          def _update(ret, event):
              ret['Status'] = 'SUCCESS'
              ret['PhysicalResourceId'] = event['ResourceProperties']['SpotFleet']
              return ret

          # リソースの削除イベント処理。 Spot Fleet 内のタスクをドレイン。
          def _delete(ret, event):
              ret['Status'] = 'SUCCESS'
              fleet = event['PhysicalResourceId']
              instances = get_targets(fleet)
              logging.debug('start to drain {}'.format(instances))
              while True:
                  logging.debug('check instance state')
                  tasks = drain(instances)
                  if tasks == 0:
                      break
                  logging.debug('{} tasks are running'.format(tasks))
                  time.sleep(10)
              logging.debug('drain complete')
              ret['PhysicalResourceId'] = fleet
              return ret

          # Spot Fleet 内のインスタンス取得
          def get_targets(fleet):
              pages = ec2.get_paginator('describe_spot_fleet_instances').paginate(SpotFleetRequestId=fleet)
              instances = set()
              for page in pages:
                  for instance in page['ActiveInstances']:
                      instances.add(instance['InstanceId'])
              return instances

          # 実際にドレインを実行する関数
          # ドレインが終了するまでポーリング！！
          def drain(instances):
              tasks = 0
              pages = ecs.get_paginator('list_container_instances').paginate(cluster='komtar-wordpress')
              for page in pages:
                  resp = ecs.describe_container_instances(cluster='komtar-wordpress',containerInstances=page['containerInstanceArns'])
                  for instance in resp['containerInstances']:
                      if instance['ec2InstanceId'] not in instances:
                          continue
                      logger.debug(instance)
                      arn = instance['containerInstanceArn']
                      if instance['status'] != 'DRAINING':
                          logging.debug('drain {}'.format(arn))
                          ecs.update_container_instances_state(cluster='komtar-wordpress',containerInstances=[arn],status='DRAINING')
                      tasks += instance['runningTasksCount']
              return tasks

          # RequestType に応じて処理を切り替え 
          def lambda_handler(event, context):
              logger.debug(event)
              ret = {
                  'StackId': event['StackId'],
                  'RequestId': event['RequestId'],
                  'LogicalResourceId': event['LogicalResourceId']
              }
              try:
                  if event['RequestType'] == 'Create':
                      _create(ret, event)
                  elif event['RequestType'] == 'Update':
                      _update(ret, event)
                  elif event['RequestType'] == 'Delete':
                      _delete(ret, event)
              except Exception as err:
                  logger.debug(err)
                  ret['Status'] = 'SUCCESS'
                  ret['PhysicalResourceId'] = event['PhysicalResourceId']
              finally:
                  cfn_response(event['ResponseURL'], ret)

      Description: manage ECS Cluster and Spot Fleet
      Handler: index.lambda_handler
      MemorySize: 256
      Runtime: python3.6
      Timeout: 900
      Role: !GetAtt ECSDrainRole.Arn
```

Spot Fleet で起動するイメージを変更するには、Spot Fleet の作り直しが必要なので、
イメージを変更すると Spot Fleet のIDが更新され、カスタムリソースの Update イベントが実行されます。
このとき `PhysicalResourceId` にUpdate前とは異なる値を設定しているのが一番のポイントです。
こうすると、 CloudFormation は「これは置換を伴う更新だ」と判断して、古いリソースの削除を自動的に行ってくれます。
置換処理を自前で書く必要はありません。
カスタムリソースの削除はリソース間の依存関係を保ったまま行われるので、置換後の古いSpot Fleetは古いカスタムリソースの削除が終わった後に実行されます。


## 未解決の課題

さて、先に挙げた「[Amazon ECS におけるコンテナ インスタンス ドレイニングの自動化方法](https://aws.amazon.com/jp/blogs/news/how-to-automate-container-instance-draining-in-amazon-ecs/)」では、
ドレイン終了を待つのに Amazon SNS を使っています。

しかし、構成要素が増えてプログラムも複雑になって面倒なので、今回書いたプログラムは **Lambda 関数の中でドレイン終了までポーリングする** ようにしました！！

Lambdaの制約上、タイムアウトの時間は15分から伸ばせません。
ドレインが15分で終わらない場合どうなるのか・・・
とりあえず何回か試しているけどタイムアウトしたことはない。


## まとめ

CloudFormationの AWS Lambda-backend カスタムリソースの応用例をして、ECSタスクのドレインを行う例を紹介しました。

・・・もっといい方法知っている人教えて

いや、金の弾丸で Fargate 使えばいいんだけども


## 参考

- [AWS Fargate 東京リージョン サービス開始のお知らせ](https://aws.amazon.com/jp/blogs/news/aws-fargate-tokyo/)
- [AWS Fargate で最大 50% の値下げを発表](https://aws.amazon.com/jp/about-aws/whats-new/2019/01/announcing-aws-fargate-price-reduction-by-up-to-50-/)
- [Amazon ECS-Optimized Amazon Linux AMI](https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/al2ami.html)
- [Amazon ECS-Optimized Amazon Linux AMI の更新の通知のサブスクライブ](https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/ECS-AMI-SubscribeTopic.html)
- [コンテナインスタンスのドレイン](https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/container-instance-draining.html)
- [How to Automate Container Instance Draining in Amazon ECS](https://aws.amazon.com/jp/blogs/compute/how-to-automate-container-instance-draining-in-amazon-ecs/)
- [Amazon ECS におけるコンテナ インスタンス ドレイニングの自動化方法](https://aws.amazon.com/jp/blogs/news/how-to-automate-container-instance-draining-in-amazon-ecs/)
- [CloudFormation カスタムリソース](https://docs.aws.amazon.com/ja_jp/AWSCloudFormation/latest/UserGuide/template-custom-resources.html)
