---
layout: post
title: "CloudFormationのテンプレートのLinter actions-cfn-lint のご紹介"
slug: actions-cfn-lint
date: 2019-12-06 00:00:00 +0900
comments: true
categories: [go, github]
---

この記事は[フラーAdvent Calendar 2019](https://adventar.org/calendars/4155)の6日目の記事です。
5日目は[@shogo82148](https://twitter.com/shogo82148) さんで「[GitHub Goveralls Action を公開しました](https://shogo82148.github.io/blog/2019/12/05/actions-goveralls/)」でした。

-----

さて、最近 GitHub Actions を作るのにハマっているので、今日も GitHub Actions の紹介です。

- [GitHub Action for CloudFormation Linter with reviewdog](https://github.com/marketplace/actions/actions-cfn-lint)
- [shogo82148/actions-cfn-lint](https://github.com/shogo82148/actions-cfn-lint)

## Amazon CloudFormation

Infrastructure as Code の盛り上がりも一段落し、今では当たり前のように使っている人も多いと思います。
[フラー共創スタジオ](https://www.kyoso-studios.com/)はAWSがメインなので、[CloudFormation](https://aws.amazon.com/jp/cloudformation/)をメインに使っています。
色々とクセは強いですが、[少なくともtfstateが行方不明](https://techblog.kayac.com/2019/12/02/123151)になったりはしないので、まあまあ仲良くやっています。


## CloudFormation Linter

テンプレートを書いている上で地味にややこしいのが、プロパティーの名前や型の統一感が微妙にない、ということです。

例を挙げると、[`AWS::ApplicationAutoScaling::ScalableTarget` の `MaxCapacity`](https://docs.aws.amazon.com/ja_jp/AWSCloudFormation/latest/UserGuide/aws-resource-applicationautoscaling-scalabletarget.html#cfn-applicationautoscaling-scalabletarget-maxcapacity) は整数型です。
これはまあ、納得できますね。

ところが [`AWS::AutoScaling::AutoScalingGroup` の `MaxSize`](https://docs.aws.amazon.com/ja_jp/AWSCloudFormation/latest/UserGuide/aws-properties-as-group.html#cfn-as-group-maxsize) は
**文字列型** なんです。説明文には「Auto Scaling グループの Amazon EC2 インスタンスの最大数」とあるのに！
オートスケールという似たような機能を持っていて、どちらもスケーリンググループの最大数を表しているの、名前も違えば型が全く違う。

この手のミスは aws cli に付属している テンプレートの validation 機能では見つけられす、実際に反映してみるしかありません。
すぐに失敗してくれればいいんですが、失敗するまでにも十数分かかったりしてかなり面倒です。

-----

そこでおすすめなのが [CloudFormation Linter](https://github.com/aws-cloudformation/cfn-python-lint)。
この手の名前のミスや型のミスを指摘してくれるコマンドラインツールです。
各種エディタ用の拡張もあり、[VSCodeでも使える](https://marketplace.visualstudio.com/items?itemName=kddejong.vscode-cfn-lint) ので、ぼくはいつもこれを使っています。

CloudFormation Linter については Classmethod さんの紹介記事もどうぞ。

- [Linterを使ってCloudFormationの間違いに爆速で気づく](https://dev.classmethod.jp/cloud/aws/use-linter-to-notice-mistakes-of-cloudformation/)

## GitHub Action for CloudFormation Linter with reviewdog

この機能を GitHub Action にしたのが、 「[GitHub Action for CloudFormation Linter with reviewdog](https://github.com/marketplace/actions/actions-cfn-lint)」です。
多人数で開発していると、チーム内に `cfn-lint` を入れてない人も出てきてしまいます。
GitHub上でLintを実行することで誰でもすぐにLintの結果を得られるようにするための GitHub Actions です。

似たような GitHub Actionに [GitHub Action for CloudFormation Linter](https://github.com/marketplace/actions/cfn-lint-action) があるのですが、
それとの違いは [reviewdog](https://github.com/reviewdog/reviewdog) と連携しているところです。
テンプレートに問題があるとプルリクエストのdiffにこんなふうにコメントを残してくれます。

![reviewdogのコメント](/images/2019-12-05-actions-cfn-lint.png)

設定もとくに難しくなくて、これを `.github/workflows/reviewdog.yml` に置くだけ。
簡単ですね！

```yaml
name: reviewdog
on: [pull_request]
jobs:
  shellcheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v1
      - uses: reviewdog/action-shellcheck@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

※実際にはCloudFormationのテンプレートとは無関係のYAMLやjsonも解析してしまい、エラーを吐くことがあるので、調整が必要な場合もあります。

## まとめ

以上、[CloudFormation Linter](https://github.com/aws-cloudformation/cfn-python-lint) と [reviewdog](https://github.com/reviewdog/reviewdog) を組み合わせた GitHub Action
[GitHub Action for CloudFormation Linter with reviewdog](https://github.com/marketplace/actions/actions-cfn-lint) の紹介でした。

-----

[フラーAdvent Calendar 2019](https://adventar.org/calendars/4155) 7日目の担当は [すまんな、氏川氏...](https://twitter.com/ujikawa1026) さんで「Androidで何か書く」です。
