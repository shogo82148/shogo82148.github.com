---
layout: post
title: "AWS SDK for Perl Lambda Layerを公開しました"
slug: aws-lambda-paws-layer
date: 2019-07-16 22:43:00 +0900
comments: true
categories: [perl, aws, lambda]
---

ハイラルからこんにちは。

[AWS LambdaでCGIを蘇らせる](https://shogo82148.github.io/blog/2018/12/16/run-cgi-in-aws-lambda/) で作成した Perl Custom Runtime 用の AWS Lambda Layer ですが、
中でイベントのハンドリングをしているモジュールを [AWS::Lambda](https://metacpan.org/pod/AWS::Lambda) として CPAN で公開したところ、
[AWS SDKを入れて欲しい](https://github.com/shogo82148/p5-aws-lambda/issues/22) との要望が来ました。
完全にネタとして作成したモジュールですが、いるんですね使う人。
というわけで AWS SDK を含んだ AWS Lambda Layer を公開しました。

## 使い方

### 公開レイヤーを使う

AWS公式ではPerl用のSDKは提供していないので、[Paws](https://metacpan.org/pod/Paws)という非公式SDKを使いました。
何も考えずにテキトウにインストールしてみたらSDKだけで121MBありました。
Perl本体が85MBなのでSDKのほうがでかい。
AWS Lambdaで作成できる関数は250MBが上限なので、流石に半分SDKに持っていかれるのはつらかろうと、Perl本体とは別のレイヤーに分けてあります。

レイヤーは最大5つまで登録できるので、Perl本体(例: `arn:aws:lambda:ap-northeast-1:445285296882:layer:perl-5-30-runtime:2` )に加えて
以下のレイヤーを追加することで、[Paws](https://metacpan.org/pod/Paws) を呼び出すことができるようになります。

- `arn:aws:lambda:ap-east-1:445285296882:layer:perl-5-30-paws:1`
- `arn:aws:lambda:ap-northeast-1:445285296882:layer:perl-5-30-paws:1`
- `arn:aws:lambda:ap-northeast-2:445285296882:layer:perl-5-30-paws:1`
- `arn:aws:lambda:ap-south-1:445285296882:layer:perl-5-30-paws:1`
- `arn:aws:lambda:ap-southeast-1:445285296882:layer:perl-5-30-paws:1`
- `arn:aws:lambda:ap-southeast-2:445285296882:layer:perl-5-30-paws:1`
- `arn:aws:lambda:ca-central-1:445285296882:layer:perl-5-30-paws:1`
- `arn:aws:lambda:eu-central-1:445285296882:layer:perl-5-30-paws:1`
- `arn:aws:lambda:eu-west-1:445285296882:layer:perl-5-30-paws:1`
- `arn:aws:lambda:eu-west-2:445285296882:layer:perl-5-30-paws:1`
- `arn:aws:lambda:eu-west-3:445285296882:layer:perl-5-30-paws:1`
- `arn:aws:lambda:sa-east-1:445285296882:layer:perl-5-30-paws:1`
- `arn:aws:lambda:us-east-1:445285296882:layer:perl-5-30-paws:1`
- `arn:aws:lambda:us-east-2:445285296882:layer:perl-5-30-paws:1`
- `arn:aws:lambda:us-west-1:445285296882:layer:perl-5-30-paws:1`
- `arn:aws:lambda:us-west-2:445285296882:layer:perl-5-30-paws:1`

いつの間にかマネージドコンソールから編集ができるようになっていたので、開発がはかどりますね。

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">カスタムランタイムでもAWS Lambdaのマネージドコンソールから内容の編集ができる・・・？ Perl も編集できるぞ・・・ <a href="https://t.co/4228rG0hca">pic.twitter.com/4228rG0hca</a></p>&mdash; Ichinose Shogo (@shogo82148) <a href="https://twitter.com/shogo82148/status/1150945172890382336?ref_src=twsrc%5Etfw">July 16, 2019</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

### ZIP アーカイブを使う

ビルド済みのZIPアーカイブも公開しています。
以下のURLを指定して新規レイヤーを作成することで利用できます。

- `https://shogo82148-lambda-perl-runtime-$REGION.s3.amazonaws.com/perl-$VERSION-paws.zip`

### Docker で使う

Pawsインストール済みのDockerイメージも公開しました。

    # Install the dependency.
    docker run --rm -v $(PWD):/var/task shogo82148/p5-aws-lambda:build-5.30-paws \
        cpanm --notest --local-lib extlocal --no-man-pages --installdeps .

    # run an event.
    docker run --rm -v $(PWD):/var/task shogo82148/p5-aws-lambda:5.30-paws \
        handler.handle '{"some":"event"}'

## 自分だけのカスタムモジュールレイヤーを作る

今回公開した Paws Layer のようなCPANモジュールを含んだLayerを作りたい！という方は、
Dockerコンテナ内で `/opt/lib/perl5/site_perl` にモジュールをインストールすることで作成できます。
以下は `Some::Module` というモジュールをインストールする例です。

    docker run --rm \
        -v $(PWD):/var/task \
        -v $(PATH_TO_LAYER_DIR)/lib/perl5/site_perl:/opt/lib/perl5/site_perl \
        shogo82148/p5-aws-lambda:build-5.30 \
        cpanm --notest --no-man-pages Some::Module
    cd $(PATH_TO_LAYER_DIR) && zip zip -9 -r $(PATH_TO_DIST)/some-module.zip .

## site_perl と vendor_perl

モジュール追加インストールするだけなら簡単だろうと思っていたら、
Perl本体のレイヤーとPawsのレイヤーを分ける必要があったので意外と面倒でした。

Perlランタイムがインストールされたレイヤーには、イベントをハンドリングするために AWS::Lambda があらかじめインストールしてあります。
普通に Paws を追加インストールすると Paws 用のレイヤーに AWS::Lambda も混ざってしまいます。
同じ名前のファイルがあったら単に上書きされるだけなので問題はないんですが、ちょっと気持ち悪いですよね。
そういうわけで、今回 AWS::Lambda を `vendor_perl` にインストールするよう変更しました。

Linux上で動くソフトは Perl や CPANモジュールに依存しているものが多いので、
yum や apt のような OS のパッケージマネージャーでは Perl 本体に加えて、CPANモジュールをインストールすることができます。
`vendor_perl` はそういったパッケージマネージャーがCPANモジュールをインストールするための場所です。
cpanmでインストールしたモジュールなど、パッケージマネージャー管理外のモジュールは `site_perl` にインストールされるので、
誤って上書きしてしまうのを防ぐことができます。

で、ここらへんのインストール先の設定は、cpanm を使っていると cpanm がいい感じにやってくれるのですが、
cpanm は `vendor_perl` へのインストールに対応していないため自前でなんとかする必要があります。
モジュールのビルドツールには [Module::Build](https://metacpan.org/pod/Module::Build) や [ExtUtils::MakeMaker](https://metacpan.org/pod/ExtUtils::MakeMaker) といろいろ種類があるので、
ビルドツール毎に個別の設定が必要です。

```
PERL_MB_OPT="--installdirs=vendor" # Module::Build 用
PERL_MM_OPT="INSTALLDIRS=vendor" # ExtUtils::MakeMaker 用
cpan App::cpanminus
```

さらに Perl のビルド時のデフォルト設定では `vendor_perl` を作成してくれないので、Perl自体のビルドオプションもいじる必要があります。
cpanm と perl-build に慣れたゆとり世代にはちょっと厳しかった。

## まとめ

AWS Lambda の Perl Custom Runtime から簡単にAWS APIを叩くことができるようになりました。
具体的な用途とかよくわかってないですが、きっと便利なのでみなさん使ってください。

## 参考

- [tokuhirom/Perl-Build](https://github.com/tokuhirom/Perl-Build)
- [Common Configure options - Perl INSTALL](https://metacpan.org/pod/distribution/perl/INSTALL#Common-Configure-options)
- [Paws - A Perl SDK for AWS (Amazon Web Services) APIs](https://metacpan.org/pod/Paws)
