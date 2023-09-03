---
layout: post
title: "湘南.pm #1 で「趣味でPerlのビルドをしている話」をしてきた"
slug: 2023-09-03-shonanpm-no-1
date: 2023-09-03 18:10:00 +0900
comments: true
categories: [perl]
---

すでに一週間が過ぎ、今更感がありますが・・・
「ブログに書くまでがYAPC」もといPerl Mongersという言葉もあるのでやっていきましょう。

[@\_\_papix\_\_](https://twitter.com/__papix__)に声をかけていただき、8/26に開催された[湘南.pm #1](https://shonanpm.connpass.com/event/289094/)で発表してきました。
「趣味でPerlのビルドをしている話」と題して、[AWS::Lambda]と[actions-setup-perl]のお話をしてきました。

<iframe class="speakerdeck-iframe" style="border: 0px; background: rgba(0, 0, 0, 0.1) padding-box; margin: 0px; padding: 0px; border-radius: 6px; box-shadow: rgba(0, 0, 0, 0.2) 0px 5px 40px; width: 100%; height: auto; aspect-ratio: 560 / 315;" frameborder="0" src="https://speakerdeck.com/player/d4d2359e7354426cb1d645c7474ba35b" title="2023-08-26 湘南.pm" allowfullscreen="true" data-ratio="1.7777777777777777"></iframe>

## 趣味でPerlのビルドをしている話

資料はSpeaker Deckを見てもらうとして、簡単に補足等します。

### AWS::Lambda

うっかりサンプルコードの末尾に `1;` を付けてしまいましたが、なんと！最新のPerlでは不要になりました！

```perl
use 5.38;
use utf8;

sub handle ($payload, $context) {
    return $payload;
}

# 1;
# ↑ スライド資料では付けてしまったけど、なくてよい
```

これは `use 5.38` で `module_true` feature が有効化されるためです。
詳細は「[Perlのmodule_trueフラグを先取り！]」という記事を書いたのでそちらをどうぞ。
この記事を書いたときは開発版のPerlで試しましたが、 Perl 5.38 で正式リリースされています。

Perl Hackers Hub に掲載したサンプルコードを流用したことがバレてしまう・・・。

- [Perl Hackers Hub 第75回 AWS Lambda入門 サーバレスでもPerlを活用しよう！（1）](https://gihyo.jp/dev/serial/01/perl-hackers-hub/007501?summary)
- [Perl Hackers Hub 第75回 AWS Lambda入門 サーバレスでもPerlを活用しよう！（2）](https://gihyo.jp/dev/serial/01/perl-hackers-hub/007501?summary)

---

さて、このサンプルコード、他にもPerlの（比較的）新しい機能を使っているのですが、気がついたひとはいますか？
実は引数の受け取り方が変わっています！

Perlには元々「サブルーチンの引数を定義する構文」がありませんでした。
`@_` という記号を使うか、 `shift` などの配列操作関数を使います。

```perl
use utf8;

# 昔からある引数の受け取り方
sub handle {
    my ($payload, $context) = @_;
    return $payload;
}

1;
```

記号が多くて大変初心者泣かせですね。

そこで、Perl 5.36 から `signatures` feature が有効化されるようになりました。
この機能を有効化するとサブルーチンに引数リストを書くことができます。

```perl
use 5.38; # use feature qw(signatures); で個別に有効化も可能
use utf8;

sub handle ($payload, $context) { # 引数リストを書ける！！！
    return $payload;
}
```

たった5行の短いサンプルコードですが、最近のPerlのアップデートを感じることのできる、味わい深いコードに仕上げました。

### actions-setup-perl

今はビルドしたバイナリをGitHub Releasesにアップロードしています。
そこにたどり着くまでは紆余曲折ありました。

- [Setup Perl GitHub Action を公開しました](https://shogo82148.github.io/blog/2019/09/18/actions-setup-perl/)
- [Setup Perl Environment Action のストレージを Azure Blob Storage に移行しました](https://shogo82148.github.io/blog/2021/02/03/setup-perl-uses-azure-blob-storage/)

Amazon S3, Azure Blob Storage と試してきたのですが、やはりネックになるのはお金。
その点GitHub Releasesは無料なのがありがたい！

発表の中で「408通りのPerlをビルドしている」とお話しました。
これはつまり「408個のPerlのバイナリ」ができるというわけです（[進次郎構文](https://dic.nicovideo.jp/a/%E9%80%B2%E6%AC%A1%E9%83%8E%E6%A7%8B%E6%96%87)）。
「そんなに大量のファイルをGitHub Releasesに突っ込んで大丈夫か？」という点が不安だったので、
GitHub Releasesは避けていました。だってそんなに突っ込む人間他にいないでしょ？

コストの増加に耐えられなくなってGitHub Releasesに移行してみたら、案外行けました。
案ずるより産むが易し、ですね。

---

「Perl Coreとその他のモジュールをわけてアップロードしないのはなぜ？」という趣旨の質問がありました。
[actions-setup-perl]は現代のコンピューター処理において欠かせないSSLやJSONといったモジュールを含んでいます。
これらのモジュールは今も開発が進んでいるので、ときどき更新入ります。
一方Perl Coreは、一度リリースされたものに関しては更新が入りません。
更新頻度が違うので、Perl Coreとこれらのモジュールを分離すれば、計算効率も空間効率も上がるのでは？という意図だと思います。

計算効率も空間効率も上がるのは、そのとおりです。実行に移してないのは主に僕のモチベーションの問題ですね。動くものができたので、ひとまずそこで満足しています。
お金の問題もひとまずの解決を見たので、そこまでの優先度がないのです。

## 他の方の発表等

一週間も経ってだいぶ記憶があやふやな部分がありますが、覚えているものだけ簡単にメモ。

### YAPC::Hiroshima 2024

- [YAPC::Hiroshima 2024の開催日及び会場が決定しました！]

> YAPC::Hiroshima 2024の開催日程および会場は, 以下の通りです.
> 開催日
>
> 2024年2月10日(土曜日)
>
> 会場
>
> 広島国際会議場

とのことです！
広島・・・行ったことないな。

### Go向けORM sqllaの紹介とJOINやUNIONを含んだクエリの扱い方

- [Go向けORM sqllaの紹介とJOINやUNIONを含んだクエリの扱い方]

<iframe class="speakerdeck-iframe" style="border: 0px; background: rgba(0, 0, 0, 0.1) padding-box; margin: 0px; padding: 0px; border-radius: 6px; box-shadow: rgba(0, 0, 0, 0.2) 0px 5px 40px; width: 100%; height: auto; aspect-ratio: 560 / 315;" frameborder="0" src="https://speakerdeck.com/player/b8ebe510161d42c49f169e7b05f0ac37" title="Go向けORM sqllaの紹介と JOINやUNIONを含んだクエリの扱い方" allowfullscreen="true" data-ratio="1.7777777777777777"></iframe>

### ドキュメントでプログラミング言語に貢献する

- [ドキュメントでプログラミング言語に貢献する]

この発表ではじめて [perldoc.jp](https://perldoc.jp/) のソースコード管理がGitHubに移行しているのを知りました。

- [Hack For Perl #3 を開催して、OSDN.net にあったperldoc.jpの翻訳データをCVSからgitへの移行検証ができ、8/17(木) に移行予定です](https://kfly8.hatenablog.com/entry/2023/08/02/214531)
- [perldoc-jp/translation](https://github.com/perldoc-jp/translation)

Perl 5.34がリリースされたときに誤字を見つけて報告したことがあります。今ならそのままプルリクエストを送ることができるわけです。これは便利。

- [perl5340deltaの誤字](https://ja.osdn.net/projects/perldocjp/ticket/42382)

### エンジニア育成に効くかもしれないレイヤードアーキテクチャーっぽいソフトウェア設計

- [エンジニア育成に効くかもしれないレイヤードアーキテクチャーっぽいソフトウェア設計]

### お土産

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr"><a href="https://twitter.com/hashtag/%E6%B9%98%E5%8D%97pm?src=hash&amp;ref_src=twsrc%5Etfw">#湘南pm</a> ですすめられた葦のチーズパイ美味しい😋 (撮影は娘) <a href="https://t.co/rp08VI1blc">pic.twitter.com/rp08VI1blc</a></p>&mdash; kobaken (@kfly8) <a href="https://twitter.com/kfly8/status/1695667414456033688?ref_src=twsrc%5Etfw">August 27, 2023</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script> 

主催者が「みなさん[YAuth]があって大変でしょうから」と紹介してくれたお土産です。僕も同じものを買いました。
美味しかった。

## まとめ

8/26に開催された[湘南.pm #1](https://shonanpm.connpass.com/event/289094/)で「趣味でPerlのビルドをしている話」をしてきました。

## 参考

- [湘南.pm #1](https://shonanpm.connpass.com/event/289094/)
- [趣味でPerlのビルドをしている話]
- [AWS::Lambda]
- [actions-setup-perl]
- [YAPC::Hiroshima 2024の開催日及び会場が決定しました！]
- [Go向けORM sqllaの紹介とJOINやUNIONを含んだクエリの扱い方]
- [ドキュメントでプログラミング言語に貢献する]
- [エンジニア育成に効くかもしれないレイヤードアーキテクチャーっぽいソフトウェア設計]

[趣味でPerlのビルドをしている話]: https://speakerdeck.com/shogo82148/2023-08-26-xiang-nan-dot-pm
[AWS::Lambda]: https://metacpan.org/pod/AWS::Lambda
[actions-setup-perl]: https://github.com/shogo82148/actions-setup-perl
[YAPC::Hiroshima 2024の開催日及び会場が決定しました！]: https://blog.yapcjapan.org/entry/2023/08/26/164500
[Go向けORM sqllaの紹介とJOINやUNIONを含んだクエリの扱い方]: https://speakerdeck.com/mackee/goxiang-keorm-sqllanoshao-jie-to-joinyaunionwohan-ndakuerinoxi-ifang
[ドキュメントでプログラミング言語に貢献する]: https://kfly8.hatenablog.com/entry/2023/08/26/214805
[エンジニア育成に効くかもしれないレイヤードアーキテクチャーっぽいソフトウェア設計]: https://github.com/ytnobody/perl-devcontainer/blob/bbebfbec08bad72a89fb47e76854b42c33347334/slide/shonan-pm-1.md
[YAuth]: http://lestrrat.ldblog.jp/archives/23208854.html
[Perlのmodule_trueフラグを先取り！]: https://shogo82148.github.io/blog/2022/12/25/2022-12-25-feature-module-true/
[perl5360delta.pod]: https://perldoc.jp/docs/perl/5.36.0/perl5360delta.pod#use32v5.36
