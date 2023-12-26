---
layout: post
title: "PerlのHTTP::Tinyがv0.083からデフォルトでTLSの証明書を検証するようになった件"
slug: 2023-12-27-perl-http-tiny-now-verify-tls
date: 2023-12-27 00:16:00 +0900
comments: true
categories: [perl]
---

この記事は、[Perl Advent Calendar 2023](https://qiita.com/advent-calendar/2023/perl) 22日目の記事（代打）です。
21日目は[@shogo82148](https://twitter.com/shogo82148)で「[5.36以降でのサブルーチンプロトタイプを復習する](https://shogo82148.github.io/blog/2023/12/24/2023-12-24-perl-prototype/)」でした。

-----

万策尽きたいっちーです。
そういえば今年こんなこともあったなーと思い出したので、メモとして残しておきます。

## HTTP::Tiny 0.083からデフォルトでTLSの証明書を検証するようになりました

今年の6月11日リリースの HTTP::Tiny 0.083 からデフォルトで **TLSの証明書を検証するようになりました！**

### 検証してみた

HTTP::TinyはPerlのコアモジュールに含まれている、超有名HTTPクライアントです。
「えっ、むしろ今まで検証してなかったの？」って思いますよね。

僕もそう思いました。というわけで証明書の検証していないことの検証してみましょう。

まずはお手元に古いHTTP::Tinyを用意します。

```
cpanm HTTP::Tiny@0.082
```

検証には不正な証明書を返すサーバーが必要です。
今回は [badssl.com](https://badssl.com/) を利用しました。
有効期限の切れたサイトへのアクセスを試してみます。

```perl
# get.pl
use v5.38;

use HTTP::Tiny;
my $response = HTTP::Tiny->new->get('https://expired.badssl.com/');
die "Failed!\n" unless $response->{success};
say $response->{content};
```

実行してみると・・・

```
% perl get.pl
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="shortcut icon" href="/icons/favicon-red.ico"/>
  <link rel="apple-touch-icon" href="/icons/icon-red.png"/>
  <title>expired.badssl.com</title>
  <link rel="stylesheet" href="/style.css">
  <style>body { background: red; }</style>
</head>
<body>
<div id="content">
  <h1 style="font-size: 12vw;">
    expired.<br>badssl.com
  </h1>
</div>

</body>
</html>
```

**不正な証明書なのにコンテンツにアクセスできてしまいました！！**

### 対応策1: 検証オプションを有効化する

HTTPクライアントの初期化時に `verify_SSL=>1` オプションを渡すと、証明書の検証が有効になります。

```perl
use v5.38;

use HTTP::Tiny;
my $response = HTTP::Tiny->new(verify_SSL=>1)->get('https://expired.badssl.com/');
die "Failed!\n" unless $response->{success};
say $response->{content};
```

```
% perl get.pl
Failed!
```

### 対応策2: HTTP：：Tinyをアップデートする

前述のとおり、0.083でデフォルト値が変わりました。アップデートでも対応できるはずです。

```
cpanm HTTP::Tiny@0.083
```

```
% perl get.pl
Failed!
```

めでたしめでたし。

## まとめ

HTTP::Tiny 0.083未満では **TLSの証明書検証が行われません。**
えっ令和5年にもなって・・・？という気持ちは拭えませんが、みなさんきちんとアップデートしましょう。

-----

明日23日目は[@doikoji](https://qiita.com/doikoji)で「[【さらばpptxよ】perlとJavaScriptとHTMLで超手軽にスライドを作る](https://qiita.com/doikoji/items/b0d850349a6640d0c396)」です。
お楽しみに！
