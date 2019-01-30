---
layout: post
title: "AWS LambdaでCGIを蘇らせる"
slug: run-cgi-in-aws-lambda
date: 2018-12-16 17:44:00 +0900
comments: true
categories: [perl, aws, lambda]
---

この記事は [Perl Advent Calendar 2018](https://qiita.com/advent-calendar/2018/perl)の15日目の記事です。
(キリの良いところまでできたのと、記事が書かれていなかったので代打投稿)

-----

Custom Runtime のリリースにより、AWS Lambda 上でPerlが動くようになりました。

- [PerlをAWS Lambdaで動かす](https://shogo82148.github.io/blog/2018/11/30/perl-in-lambda/)

<blockquote class="twitter-tweet" data-lang="ja"><p lang="ja" dir="ltr">次は AWS Lambda + CGI でサーバーレスだな...</p>&mdash; Ichinose Shogo (@shogo82148) <a href="https://twitter.com/shogo82148/status/1071292804402278400?ref_src=twsrc%5Etfw">2018年12月8日</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

ということで、やっていきましょう。

## できたもの

動かすのはもちろん、 **CGIアクセスカウンター** 。
なんと嬉しいことに、最近になって [WwwCounter](http://www.tohoho-web.com/soft/wcnt.htm) の新バージョン(Ver3.16)がリリースされ、
Perl 5.26 に対応しました！

> 2018-11-11 perl 5.26に対応。(Ver3.16)

更新履歴によれば一つ前の Ver 3.15 のリリースは2003-03-23なので、なんと15年ぶりのアップデートです。
杜甫々さんの **AWS Lambda で動かしてくれ！！** という声が聞こえてきそうですね・・・！！！

![CGIが動作する様子](/images/2018-12-16-cgi-in-aws-lambda.png)

動いたーーーー！！！！

実装はこちら

- [AWS::Lambda](https://github.com/shogo82148/p5-aws-lambda)

-----

ちなみにWwwCounterのアップデートはPerl 5.26で「@INCからカレントディレクトリが削除」された件への対応だと思います(コミットログがないので予想)。

- [第46回　Perl 5.26で変わること（1） - Perl Hackers Hub](https://gihyo.jp/dev/serial/01/perl-hackers-hub/004601)

## 実装説明

「そもそもCGIってなんだ？」っていう人も多くなってきたと思うので、そこらへんの歴史の話にも軽く触れます。
この辺の歴史をリアルに体験したわけではないので、誤り等あればご指摘ください。

### CGIとは

[Common Gateway Interface](https://en.wikipedia.org/wiki/Common_Gateway_Interface) の略で、
WebサーバーとCLI(Command Line Interface)アプリケーションのやり取りの方法を決めた規格です。

CGIができたのは1993年。
Perl(1987年登場)やPython(1991年登場)といった、2018年現在ではWebアプリケーション記述言語として主流となった言語たちは、
まだまだできたてホヤホヤな時代です。
Ruby on Railsで一躍有名となった Ruby (1995年登場) に至ってはまだ登場すらしていません。
(ちなみに1993年当時筆者5歳・・・CGIのほうが若かったのか・・・)

そんな当時のプログラミング言語たちには自力でHTTPをしゃべる能力はありませんでした。
そんな時代に生まれたのがCGIです。環境変数と標準入出力さえ扱うことができれば、どんなプログラミング言語でもWebアプリケーションを開発できます。

以下はC言語で書いた「Hello CGI」を書かれたWebページを返すだけの簡単なCGIプログラムの例です。

```c
#include <stdio.h>

int main() {
    printf("Content-type: text/html\n\n");
    printf("<!DOCTYPE html>\n");
    printf("<html>");
    printf("<head><title>Hello CGI!</title></head>");
    printf("<body>Hello CGI!</body>");
    printf("</html>");
    return 0;
}
```

使っている関数は `printf` だけ。とても簡単ですね！

とはいえ少し複雑なことをしようとすると文字列処理が必要となり、C言語だけで正しい文字列処理を行うのは大変です。
また、開発環境のOSとサーバーのOSとが違った場合、クロスコンパイルが必要となるため反映作業が煩雑となります。
そんな中スクリプト言語としては少し先輩だった Perl が CGI の記述言語として主流となっていきます。


### 画像式CGIアクセスカウンター

今で言うGoogle Analyticsのようなアクセス解析サービスの超簡易版といったところでしょうか。

1990年台のJavaScript(1995年登場)はまだまだ普及段階で、すべての閲覧者の環境でJavaScriptを使えるとは限りませんでした。
(JavaScriptが大きな注目を集めるようになるのは、2005年にAjaxという言葉が登場するまで待たなければなりません。)
そのため、今のような解析用のJavaScriptを埋め込む形式には限界があります。
そんななか注目されたのが、静的なページにも手がるに埋め込むことができる画像です。

IMGタグを埋め込むだけでアクセス数がわかるので、アクセス解析の手法として
「ようこそ！あなたは〇〇人目の訪問者です！！」の文言をトップページに置くのが流行りました。
(きっと懐かしいと思う人がたくさんいるはず)


### 画像式CGIアクセスカウンターとGIF

当時の画像式CGIアクセスカウンターではGIFが主に使われていました。
というのも後発のPNGはまだまだ普及率が低く、PurePerlでJPEGのエンコーダーを実装する酔狂な人はいなかったからだと思います(たぶん)。

しかしGIFにも全く問題がないわけではなく、特許に関する問題がありました。
GIFのエンコードに使われている[LZW](https://ja.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch)は
Unisys社が特許を持っており、GIF画像を扱うソフトの開発に使用料を取っていたのです。

これに対抗してネットの民たちは、GIFのアニメーション機能を匠に使って LZW エンコードをしないで、
GIF画像の編集を行うハックを開発しました。
そのハックを利用して作られた、代表的なアクセスカウンターが最初に出てきた [WwwCounter](http://www.tohoho-web.com/soft/wcnt.htm) です。

ちなみに作者の杜甫々さんは、90年代後半から2000年代のウェブ制作者の間では結構有名な人です。
少なくともインタビュー記事が書かれるくらいには(元記事は消えてしまってアーカイブしか見つからなかった・・・)。

- [「娘に情報が古いと指摘されます」 老舗サイト「とほほのWWW入門」の管理人ってどんな人？(Internet Archive)](https://web.archive.org/web/20180316103637/hrnabi.com/2017/11/17/15642/)


### API Gateway/ALB のイベントを PSGI に変換する

さて、歴史の話はこれくらいにして、時間を現代に戻しましょう。
CGIは言語を問わないとても汎用性が高く便利な仕組みでしたが、インターネットが普及するにつれパフォーマンスが問題となってきました。
そこで言語毎にWebサーバーとのより高速なインターフェースが作られるようになります。
Perlの世界では [PSGI](https://plackperl.org/) がそれに当たります。

PSGIではWebアプリケーションを関数の形で定義します。
例えば、以下は "hello, world" と返す簡単なWebアプリケーションです。

```perl
my $app = sub {
    return [200, ['Content-Type' => 'text/plain'], ["hello, world\n"]];
}
```

入出力の形式は [PSGIの仕様](https://metacpan.org/pod/PSGI) で定義されています。

一方 API Gateway/ALB のイベントの形式は AWSの公式ドキュメントに記載されています。

- API Gateway: [Set up a Proxy Integration with a Proxy Resource](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-set-up-simple-proxy.html)
- ALB: [Using AWS Lambda with an Application Load Balancer](https://docs.aws.amazon.com/lambda/latest/dg/services-alb.html)

イベントはJSON形式なので、それをうまいことPSGIのインターフェースに変換します。

### PSGIをCGIに変換する

PSGIもCGIもHTTPをやり取りするためのインターフェースなので、相互に変換できます。
これに関してはPSGIの公式リファレンス実装である [Plack](https://metacpan.org/pod/Plack) が変換モジュールを用意してくれているので、それを利用します。

- [Plack::App::WrapCGI](https://metacpan.org/pod/Plack::App::WrapCGI)

## 自分でも動かす

### ビルド済み Docker Image を使う

[lambci/lambda](https://hub.docker.com/r/lambci/lambda/) をベースにビルド済みPerlを組み込んだDockerイメージを公開しました。

- [shogo82148/p5-aws-lambda](https://hub.docker.com/r/shogo82148/p5-aws-lambda)

使い方は [lambci/lambda](https://hub.docker.com/r/lambci/lambda/) と同様です。
Perl の依存モジュールのインストールや、イベントの実行などを、手元の環境で行うことができます。

```bash
# 依存モジュールをインストールする
docker run --rm -v $(PWD):/var/task shogo82148/p5-aws-lambda:build-5.28 \
        cpanm --notest -L extlocal --installdeps .

# イベントを実行する
docker run --rm -v $(PWD):/var/task shogo82148/p5-aws-lambda:5.28 \
        handler.handle '{"some":"event"}'
```

ビルド済みイメージには API Gateway/ALB のイベントを PSGI に変換するモジュールも同梱してあります。
以下のコードを追加するだけで、既存の PSGIアプリケーションが API Gateway や ALB をかえして AWS Lambda 上で動くようになります。

```perl
use utf8;
use warnings;
use strict;
use AWS::Lambda::PSGI;

my $app = require "$ENV{'LAMBDA_TASK_ROOT'}/app.psgi";
my $func = AWS::Lambda::PSGI->wrap($app);

sub handle {
    my $payload = shift;
    return $func->($payload);
}

1;
```

### ビルド済みの 公開 Lambda Layer を使う

ビルド済みの AWS Lambda Layer も用意しました。
新規レイヤーと追加するときに「Provide a layer version ARN」を選択し「Layer version ARN」に以下のARNを入力してください。
(ちなみに ap-northeast-1 の 5.26 だけバージョンが4なのは、デプロイスクリプトのミスです。もとに戻せないの悲しい。)

- Perl 5.28
    - `arn:aws:lambda:ap-northeast-1:445285296882:layer:perl-5-28-runtime:3`
    - `arn:aws:lambda:ap-northeast-2:445285296882:layer:perl-5-28-runtime:3`
    - `arn:aws:lambda:ap-south-1:445285296882:layer:perl-5-28-runtime:3`
    - `arn:aws:lambda:ap-southeast-1:445285296882:layer:perl-5-28-runtime:3`
    - `arn:aws:lambda:ap-southeast-2:445285296882:layer:perl-5-28-runtime:3`
    - `arn:aws:lambda:ca-central-1:445285296882:layer:perl-5-28-runtime:3`
    - `arn:aws:lambda:eu-central-1:445285296882:layer:perl-5-28-runtime:3`
    - `arn:aws:lambda:eu-west-1:445285296882:layer:perl-5-28-runtime:3`
    - `arn:aws:lambda:eu-west-2:445285296882:layer:perl-5-28-runtime:3`
    - `arn:aws:lambda:eu-west-3:445285296882:layer:perl-5-28-runtime:3`
    - `arn:aws:lambda:sa-east-1:445285296882:layer:perl-5-28-runtime:3`
    - `arn:aws:lambda:us-east-1:445285296882:layer:perl-5-28-runtime:3`
    - `arn:aws:lambda:us-east-2:445285296882:layer:perl-5-28-runtime:3`
    - `arn:aws:lambda:us-west-1:445285296882:layer:perl-5-28-runtime:3`
    - `arn:aws:lambda:us-west-2:445285296882:layer:perl-5-28-runtime:3`
- Perl 5.26
    - `arn:aws:lambda:ap-northeast-1:445285296882:layer:perl-5-26-runtime:4`
    - `arn:aws:lambda:ap-northeast-2:445285296882:layer:perl-5-26-runtime:3`
    - `arn:aws:lambda:ap-south-1:445285296882:layer:perl-5-26-runtime:3`
    - `arn:aws:lambda:ap-southeast-1:445285296882:layer:perl-5-26-runtime:3`
    - `arn:aws:lambda:ap-southeast-2:445285296882:layer:perl-5-26-runtime:3`
    - `arn:aws:lambda:ca-central-1:445285296882:layer:perl-5-26-runtime:3`
    - `arn:aws:lambda:eu-central-1:445285296882:layer:perl-5-26-runtime:3`
    - `arn:aws:lambda:eu-west-1:445285296882:layer:perl-5-26-runtime:3`
    - `arn:aws:lambda:eu-west-2:445285296882:layer:perl-5-26-runtime:3`
    - `arn:aws:lambda:eu-west-3:445285296882:layer:perl-5-26-runtime:3`
    - `arn:aws:lambda:sa-east-1:445285296882:layer:perl-5-26-runtime:3`
    - `arn:aws:lambda:us-east-1:445285296882:layer:perl-5-26-runtime:3`
    - `arn:aws:lambda:us-east-2:445285296882:layer:perl-5-26-runtime:3`
    - `arn:aws:lambda:us-west-1:445285296882:layer:perl-5-26-runtime:3`
    - `arn:aws:lambda:us-west-2:445285296882:layer:perl-5-26-runtime:3`

### ビルド済みの zip アーカイブを使う

以下のURLにビルドしたzipアーカイブを置きました。`${REGION}` に使用しているリージョンを入れてご使用ください。

- `https://s3-${REGION}.amazonaws.com/shogo82148-lambda-perl-runtime-${REGION}/perl-5-28-runtime.zip`

東京リージョンの場合は以下のようになります。

- https://s3-ap-northeast-1.amazonaws.com/shogo82148-lambda-perl-runtime-ap-northeast-1/perl-5-26-runtime.zip
- https://s3-ap-northeast-1.amazonaws.com/shogo82148-lambda-perl-runtime-ap-northeast-1/perl-5-28-runtime.zip

新規レイヤーを作る際に「Upload a file from Amazon S3」を選択し、このURLを入力すれば使えるようになります。

## 既知の問題

- カウンターの値が永続化されない
    - AWS Lambda では `/tmp` にしか書き込み権限がないので、先の動作例ではここにカウンターの値を書き込むよう修正をしました。
    - `/tmp` なのでもちろん永続化はされません。放置しておくと0リセットされます。
- [CGI::Compile](https://metacpan.org/pod/CGI::Compile) が使えない
    - Perl製のCGIスクリプトをPSGIスクリプトに変換するという闇モジュールなのですが、AWS Lambda内では `$0` を操作する部分で死にます。
    - 「Can't set $0 with prctl(): Operation not permitted」だ、そうです
- API Gatewayでレスポンスにバイナリを含むことができない
    - ALBはリクエスト、レスポンスともにBodyにバイナリを含むことができます
    - リクエストに関してはAPI Gatewayでも「Binary Media Types」にメディアタイプを追加することで送信できました
    - [Enable Binary Support Using the API Gateway Console](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-payload-encodings-configure-with-console.html)

## まとめ

AWS Lambda 上で CGIアクセスカウンターが動きました。

あとは CGI::Compile が動いてくれれば、forkのコストを気にする必要がなくなるので、CGI+Perlを使った開発がはかどりますね！
(その場合、結局最後はPSGIアプリケーションに変換されるんだけど、気にしない気にしない)

-----

16日目は [@magnolia_k_](https://twitter.com/magnolia_k_)さんで「[Time::Pieceを使って日付の計算をしようとしてハマった話をします](https://qiita.com/magnolia_k_/items/19cd1dd748b1611963d8)」です！

## 参考

- [PSGI](https://plackperl.org/)
- [PSGI Specification](https://metacpan.org/pod/PSGI)
- [Plack::App::CGIBin](https://metacpan.org/pod/Plack::App::CGIBin)
- [WwwCounter](http://www.tohoho-web.com/soft/wcnt.htm)
- [Set up a Proxy Integration with a Proxy Resource](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-set-up-simple-proxy.html)
- [Using AWS Lambda with an Application Load Balancer](https://docs.aws.amazon.com/lambda/latest/dg/services-alb.html)
- [Enable Binary Support Using the API Gateway Console](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-payload-encodings-configure-with-console.html)
- [「娘に情報が古いと指摘されます」 老舗サイト「とほほのWWW入門」の管理人ってどんな人？(Internet Archive)](https://web.archive.org/web/20180316103637/hrnabi.com/2017/11/17/15642/)
