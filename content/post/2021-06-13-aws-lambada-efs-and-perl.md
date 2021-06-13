---
layout: post
title: "AWS Lambda に EFS をマウントして Perl CGI 完全復活"
slug: aws-lambada-efs-and-perl
date: 2021-06-13 22:39:00 +0900
comments: true
categories: [perl, aws]
---

[AWS Lambda で CGI を蘇らせる](https://shogo82148.github.io/blog/2018/12/16/run-cgi-in-aws-lambda/) で蘇った CGI には致命的な問題点がありました。

**カウンターの値が永続化されない**

この問題を Elastic File System(EFS) をマウントすることで解決したよ、というお話です。

## Amazon Elastic File System for AWS Lambda

もう一年前になるんですが、 AWS Lambda の環境に Elastic File System(EFS) をマウントできるようになりました。

- [新機能 – Lambda 関数の共有ファイルシステム – Amazon Elastic File System for AWS Lambda](https://aws.amazon.com/jp/blogs/news/new-a-shared-file-system-for-your-lambda-functions/)

従来 AWS Lambda でデーターを永続化するには DynamoDB, RDS, S3 といったデーターストアを別途用意する必要がありました。
ファイル書き込みができる領域として `/tmp` がありますが、 `/tmp` は 512MB に制限されていたり、永続化できなかったりと、用途は限定されます。
EFS がマウントできることによって実質これらの制限がなくなります。
プログラムからは普通のファイルとして見えるので、読み書きをするのも簡単です。

よし、じゃあ、 CGI の書き込み先として試してみるか！と思ったものの、
先のリリースを見つけたときには既に別の方がやってました。

- [懐かしの CGI 掲示板スクリプトを AWS Lambda ＋ EFS で動かしてみた](https://d.nekoruri.jp/entry/2020/06/17/serverless-minibbs)

`AWS::Lambda` を利用してもらって非常にありがたいのですが、作者が遅れをとるとは不覚・・・
自ら二番煎じをする必要もないかと、ずっと放置していたのでした。

## WwwCounter 4.0 !?

そんなある日のこと。
懐かしのふと[とほほの WWW 入門](https://www.tohoho-web.com/www.htm)を見ていたところ、更新履歴に以下の文字が

> WwwCounter を 4.0 にバージョンアップしました。

**WwwCounter 4.0 ！？**

まだ更新続いてるの！！？？？
しかも 1999 年から **22 年ぶりのメジャーバージョンアップ**です。

> (前略)  
> 1999/05/30 nkf を使用しないようにした。(Ver3.00)  
> (中略)  
> 2021/05/16 ソースコードの見直し。機能は変わらず。(4.0)

リリース履歴のとおり機能は変わっていないようですが、コードが 3.x のときよりモダンな書き方になっています。

- 文字コードが utf8 になっている
- `warnings` プラグマが有効になっている
- 変数宣言してる
- 関数を使って構造化されている
- あと WwwCounter と直接は関係ないけど、サイトが https になってる

欲を言うと、 `strict` プラグマも使って欲しいなとか、 3 引数の `open` を使って欲しいなとか、そもそも CGI ...とか、まあ色々ありますが、
まだ更新が続いていて、しかもモダンな Perl の書き方にリファクタリングされているのはびっくりです。

杜甫々さんの継続力に感銘を受けたので、 [examples](https://github.com/shogo82148/p5-aws-lambda/tree/main/examples/cgi) 更新(CGI の動作例として WwwCounter を同梱しています)のついでに、
EFS マウントも試してみることにしました。

## 実装

EFS なんて利用するつもりがまったくなかったので知らなかったのですが、 AWS SAM にも EFS マウントのための属性が追加されていたそうです。

- [SAM を利用して EFS ファイルシステムをマウントした Lambda 関数を作る](https://53ningen.com/sam-efs-lambda/)

参考にした記事では、実行ロールへ明示的に VPC・EFS へのアクセス権を設定していますが、 `VpcConfig`, `FileSystemConfigs` の設定のみで自動的に設定してくれました。

```yaml
# SAMテンプレートより関数の定義のみ抜粋
WwwCounter:
  Type: AWS::Serverless::Function
  Metadata:
    BuildMethod: makefile
  Properties:
    Description: Www Counter
    CodeUri: ./WwwCounter/
    Handler: handler.handle
    Runtime: provided.al2
    Environment:
      Variables:
        WWWCOUNT_DIR: /mnt/efs0
    Layers:
      - arn:aws:lambda:ap-northeast-1:445285296882:layer:perl-5-34-runtime-al2:2
    Events:
      CatchAll:
        Type: HttpApi

    # VPC の設定
    VpcConfig:
      SecurityGroupIds:
        - !Ref LambdaSecurityGroup
      SubnetIds:
        - !Ref Subnet1

    # EFS のマウント
    FileSystemConfigs:
      - Arn: !GetAtt AccessPoint.Arn
        LocalMountPath: "/mnt/efs0"
```

あとは `/mnt/efs0` へカウントの値を書き込むよう `wwwcount.cgi` の中身を書き換えるだけです(設定をいじるのに CGI ファイルを直接書き換えないと行けないところは変わってない)。

![CGIが動作する様子(EFSあり)](/images/2021-06-14-cgi-in-aws-lambda.png)

このサンプルにはカウンターが 3 つ仕込まれているのですが、カウンターの数値がそれぞれ異なっていることに気が付きましたか？
(うち 1 つは隠しカウンターなので数値は見えませんが)
以前 EFS 無しで動かしたときは、画面内のすべてのカウンターが同じ値になっていました。

![CGIが動作する様子(EFSなし)](/images/2018-12-16-cgi-in-aws-lambda.png)

ブラウザがほば同時にカウンター画像へアクセスするので、Lambda の実行環境が画像の枚数分立ち上がります。
EFS なしだと実行環境の間でカウンターの値を共有しないので、それぞれの環境の中だけでカウンターが進み、その結果同じ値がでる場合があります。
一方 EFS ありだとカウンターの値を Lambda 実行環境間で共有しているので、正しくカウントアップできるというわけです。

## まとめ

- **祝 WwwCounter v4.0.0 リリース**
- AWS Lambda に EFS をマウントすることで、カウントの永続化に成功しました

これによって Perl CGI を AWS Lambda 上に完全復活させることに成功したといえるのではないでしょうか・・・！

## 参考

- [新機能 – Lambda 関数の共有ファイルシステム – Amazon Elastic File System for AWS Lambda](https://aws.amazon.com/jp/blogs/news/new-a-shared-file-system-for-your-lambda-functions/)
- [懐かしの CGI 掲示板スクリプトを AWS Lambda ＋ EFS で動かしてみた](https://d.nekoruri.jp/entry/2020/06/17/serverless-minibbs)
- [WwwCounter 4.0 利用メモ](https://www.tohoho-web.com/soft/wwwcounter/readme.html)
- [SAM を利用して EFS ファイルシステムをマウントした Lambda 関数を作る](https://53ningen.com/sam-efs-lambda/)
- [AWS::Lambda](https://metacpan.org/pod/AWS::Lambda)
