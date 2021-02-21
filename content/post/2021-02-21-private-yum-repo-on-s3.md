---
layout: post
title: "AWS Lambda + S3 を使ってyumレポジトリを作った"
slug: private-yum-repo-on-s3
date: 2021-02-21 08:11:00 +0900
comments: true
categories: [aws]
---

世の中にはたくさんの OSS が公開されていて、それを Linux 上で動かす選択肢も多様になってきました。
今まで通り自前でビルドするのはもちろん, Go のようにシングルバイナリになってるならバイナリ落としてくるだけのものもあります。
[DockerHub](https://hub.docker.com/) で公開されているものなら [Docker](https://www.docker.com/) でコンテナイメージをダウンロードするという手もあります。
[Homebrew on Linux](https://docs.brew.sh/Homebrew-on-Linux) なんてものも登場しましたね。

選択肢が増えて動かすだけなら楽になったんですが、
事前の環境構築が最小限で済んで、バージョン管理もできて、依存もいい感じに解決してくれて、
といろいろ考えると結局は Red Hat 系なら標準のパッケージマネージャーである [yum](https://ja.wikipedia.org/wiki/Yellowdog_Updater_Modified) が楽なんですよね。

そういうわけで [JFrog Bintray](https://bintray.com/) にバイナリをあげて、yum レポジトリを公開していました。
ところが今月になって **突然の Bintray 終了のお知らせ！！！**

- [Into the Sunset on May 1st: Bintray, JCenter, GoCenter, and ChartCenter](https://jfrog.com/blog/into-the-sunset-bintray-jcenter-gocenter-and-chartcenter/)

前置きが長くなりましたね。
要するに Bintray からのお引越しを考えないといけなくなったので、
yum レポジトリを AWS S3 上に移行した、というお話です。

## 標準的な yum レポジトリの作り方

yum レポジトリを作るには、まず公開したい rpm パッケージが必要です。
Bintray だろうが S3 だろうが、rpm 作成の手順は一緒なので省略します。

rpm さえできてしまえば、レポジトリの作成は非常に簡単です。
`createrepo` コマンドをインストールして実行するだけ。

```
yum install createrepo
createrepo /PATH/TO/REPOSITORY
```

`/PATH/TO/REPOSITORY` の中を自動的に検索して、
メタデータを作成してくれます。
これをこのまま HTTP で公開すれば yum レポジトリの完成です。

## yum レポジトリをサーバーレス化する

しかしこの方法では HTTP サーバーの運用が必要です。
yum レポジトリが落ちると、利用しているサービスにクリティカルに影響するので、
割と真面目に運用しないといけません。面倒ですね。

S3 にアップロードすれば HTTP サーバーの運用問題は解決なんですが、
`createrepo` をどこで実行するかという問題が残ります。

### 先行事例

S3 の更新イベントを AWS Lambda で受け取って、 EC2 インスタンスを起動するという事例がいくつか見つかります。

- [S3 に RPM がアップロードされたらレポジトリを更新する Lambda スクリプト](https://gist.github.com/GedowFather/56cce476c2ee5219909f)
- [S3+Lambda+CloudFormation でサーバレス yum リポジトリ](https://so-wh.at/entry/2015/08/08/S3%2BLambda%2BCloudFormation%E3%81%A7%E3%82%B5%E3%83%BC%E3%83%90%E3%83%AC%E3%82%B9yum%E3%83%AA%E3%83%9D%E3%82%B8%E3%83%88%E3%83%AA)

EC2 インスタンス上では大まかに以下のようなスクリプトを実行します。

```bash
yum install -y createrepo

# S3上のパッケージをすべてダウンロード
aws s3 sync s3://my-yum-repository/ /repo

# メタデータ更新
createrepo /repo

# 更新したメタデータをアップロード
aws s3 sync /repo s3://my-yum-repository/
```

`createrepo` を実行するにはレポジトリ上のすべての rpm ファイルが必要なので、
「S3 上のパッケージをすべてダウンロード」する必要があります。
yum レポジトリの規模にもよりますが、全ファイル転送は時間がかかりそうです。

EC2 インスタンスを毎回起動するのもなんとかしたい部分です。
起動だけで数分必要になってしまいます。

そこで AWS Lambda 内で完結させる方法を考えました。

### AWS Lambda に createrepo コマンドをインストールする

AWS Lambda 内で完結するには、 AWS Lambda の環境に `createrepo` コマンドをインストールする必要があります。
これは先日の AWS Lambda アップデートで非常に簡単になりました。

- [AWS Lambda の新機能 – コンテナイメージのサポート](https://aws.amazon.com/jp/blogs/news/new-for-aws-lambda-container-image-support/)

Lambda 用のベースイメージには yum コマンドが含まれているので、普通に `yum install` するだけです。

```dockerfile
FROM amazon/aws-lambda-provided:al2

RUN yum update -y && yum install -y createrepo_c && rm -rf /var/cache/yum/* && yum clean all
```

これまでは `/var/task` 以下にインストールする必要があったので、
yum のようなパッケージマネージャーが使えず、自前でビルドする等の工夫が必要でした。

- [MeCab を AWS Lambda で動かす(2017 年版)](https://shogo82148.github.io/blog/2017/12/06/mecab-in-lambda/)

↑ MeCab で頑張ったときの例。

### レポジトリのメタデータだけダウンロードする

先行事例と同様に S3 の更新イベントを AWS Lambda で受け取って、メタデータの更新処理を行います。

先行事例では rpm パッケージを含んだレポジトリの全データーをダウンロードしてきていました。
AWS Lambda で自由に使えるディスク容量は `/tmp` の 512MB のみで、全データーダウンロードするには心もとないです。
そこでここではメタデータのみをダウンロードします。

```bash
aws s3 sync s3://my-yum-repository/repodata /tmp/repo/repodata
```

メタデータは `repodata` ディレクトリに入っているので、このディレクトリだけダウンロードしてきます。

### 新しい rpm だけの yum レポジトリを構築する

新しくアップロードされた rpm パッケージのみダウンロードして、そのパッケージのみを含んだ yum レポジトリを構築します。
ここでは例として `new-package.rpm` がアップロードされたとしましょう。
この場合、以下のような処理を実行します。

```bash
mkdir -p /tmp/new-repo
aws s3 cp s3://my-yum-repository/new-package.rpm /tmp/new-repo
createrepo /tmp/new-repo
```

### レポジトリのマージを行う

さて、ここまでで２つのレポジトリのメタデータができました。
これをなんとかひとつにまとめたいです。
何か良い方法は無いものか・・・と、[createrepo_c のレポジトリ](https://github.com/rpm-software-management/createrepo_c)を眺めていたところ、
ピッタリなコマンドがありました。

- [mergerepo_c](https://github.com/rpm-software-management/createrepo_c#mergerepo_c)

このコマンドを使うと 2 つ以上のレポジトリをマージすることができます。
その際、rpm パッケージのチェックは行われないので、メタデータしかない不完全なレポジトリ (`/tmp/repo`) も扱うことができます。

現在のレポジトリ `/tmp/repo` に、 新しい rpm を含んだレポジトリ `/tmp/new-repo` をマージして、`/tmp/merged-repo` に出力する場合の例は
以下のようになります。

```bash
mergerepo --database --omit-baseurl --all --repo /tmp/new-repo --repo /tmp/repo --outputdir /tmp/merged-repo
```

`mergerepo` はマージの際に、パッケージがどのレポジトリ由来のものかという情報をメタデータに追加します。
ここではマージ元にローカルレポジトリを指定しているため、そのまま公開しても外部からはアクセスできません。
そのため `--omit-baseurl` でこの挙動を抑制しています。

これで `/tmp/merged-repo` に必要なパッケージの情報が全て入ったレポジトリができました。

### S3 上のメタデータを更新する

`/tmp/merged-repo` のメタデータには必要なパッケージの情報がすべて入っているので、これを S3 にアップロードします。

```bash
aws s3 sync /tmp/merged-repo/repodata s3://my-yum-repository/repodata
```

これで `new-package.rpm` のレポジトリへの追加完了です。

## 実装

これを実装したものを以下で公開しています。

- [shogo82148/private-rpm-repo](https://github.com/shogo82148/private-rpm-repo)

ここで説明したものをそっくりそのまま実装したのではなく、以下のような工夫が入ってます。

- aws cli は重たいので、Go を使って実装
- rpm への署名
- `repodata/repomd.xml` を解析して本当に必要なメタデータのみダウンロードする
  - `repodata` 以下には過去の分のゴミも含まれているので、全部は必要ない
- メタデータのアップロード順序の工夫
  - メタデータは複数のファイルから構成されているので、順序を間違うと一時的に壊れた状態になる
  - 処理が正常に完了すれば問題ないんだけど、万が一クラッシュしたら・・・？
  - 具体的には `repodata/repomd.xml` を最後にアップロードする
- 排他制御
  - メタデータ更新が並列して走るとロストアップデートの可能性がある
  - DynamoDB を使った排他的ロックを実装

## まとめ

S3 上に yum レポジトリを構築しました。
S3 の更新イベントをトリガーにして AWS Lambda でメタデータの更新を行っているので、
S3 へアップロードするだけで rpm の追加が行えます。

さて・・・yum レポジトリの移行は終わったけど、Bintray JCenter の移行が残っている・・・。
特に Android 界隈の影響が大きそうですが、どうなるんですかね？

## 参考

- [独自の RPM パッケージや yum リポジトリを作ってみよう](https://mag.osdn.jp/14/01/10/090000)
- [rpm-software-management/createrepo_c](https://github.com/rpm-software-management/createrepo_c)
- [Into the Sunset on May 1st: Bintray, JCenter, GoCenter, and ChartCenter](https://jfrog.com/blog/into-the-sunset-bintray-jcenter-gocenter-and-chartcenter/)
- [S3 に RPM がアップロードされたらレポジトリを更新する Lambda スクリプト](https://gist.github.com/GedowFather/56cce476c2ee5219909f)
- [S3+Lambda+CloudFormation でサーバレス yum リポジトリ](https://so-wh.at/entry/2015/08/08/S3%2BLambda%2BCloudFormation%E3%81%A7%E3%82%B5%E3%83%BC%E3%83%90%E3%83%AC%E3%82%B9yum%E3%83%AA%E3%83%9D%E3%82%B8%E3%83%88%E3%83%AA)
