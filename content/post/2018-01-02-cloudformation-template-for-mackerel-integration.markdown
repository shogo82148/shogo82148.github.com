---
layout: post
title: "Mackerel AWS Integration 用の CloudFormation テンプレートを書いた"
slug: cloudformation-template-for-mackerel-integration
date: 2018-01-02 12:36:51 +0900
comments: true
categories: [mackerel]
---

昨年の年末から Mackerel の本格導入を始めました。
それに当たって [AWS Integration](https://mackerel.io/ja/docs/entry/integrations/aws) 用の CloudFormation テンプレートを書いたので、
他のプロジェクトでも導入が簡単になるよう公開しました。

- [shogo82148/cf_mackerel](https://github.com/shogo82148/cf_mackerel)

<!-- More -->

## 使い方

GitHub Pages でテンプレートを公開しているので、
`template-body` にテンプレートのURLを指定して、
新しいスタックを作成するだけです。

```
aws cloudformation create-stack --stack-name "MackerelIntegrationIamUser" \
    --template-body https://shogo82148.github.io/cf_mackerel/mackerel.yaml \
    --capabilities CAPABILITY_NAMED_IAM
```

新しい名前付きIAMロールを作成するので `CAPABILITY_NAMED_IAM` が必要です。

作成がうまくいくとOutputに以下のようなARNが出力されるので、
MackerelのAWS Integrationの設定画面へ入力しましょう。

```
arn:aws:iam::xxxxxxxxxxxx:role/MackerelAWSIntegrationRole-ap-northeast-1
```

## ロール名について

ロール名が意図せずに変わってしまって連携が切れてしまうのを防ぐため、
ロール名は決め打ちです。

> MackerelAWSIntegrationRole-ap-northeast-1

ロール名にリージョン名(この場合は ap-northeast-1)が含まれていますが、
作成されたロールはグローバルなリソースなので、他のリージョンでも使用可能です。
わざわざリージョン名含めているのは CloudFormation の警告にしたがったためです。

> 警告
>
> IAM リソースに名前を付けると、複数のリージョンで同じテンプレートを再利用した場合に、回復不能なエラーが発生する場合があります。 これを防止するために、Fn::Join と AWS::Region を使用して、次の例のように地域固有の名前を作成することをお勧めします
> [RoleName](https://docs.aws.amazon.com/ja_jp/AWSCloudFormation/latest/UserGuide/aws-resource-iam-role.html#cfn-iam-role-rolename)

**回復不能なエラー！！**

コワイので実際に何が起こるかは試してませんが、警告には素直に従っておくことにします。

## 参考

- [AWS::IAM::Role - AWS CloudFormation -](https://docs.aws.amazon.com/ja_jp/AWSCloudFormation/latest/UserGuide/aws-resource-iam-role.html)
- [mackerelのAWSインテグレーション用IAM Userをcloudformationで作る](https://qiita.com/ara_ta3/items/db9ed78615b553af5f0b)
- [Tomohiro/tf_mackerel](https://github.com/Tomohiro/tf_mackerel) 同じことをするTerraformのモジュール
