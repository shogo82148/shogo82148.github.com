---
layout: post
title: "PerlのXS中に起きたシグナルの扱い"
slug: signal-in-xs
date: 2014-07-05T11:56:00+09:00
comments: true
categories: [ perl ]
---

[Redis::Fast](https://metacpan.org/pod/Redis::Fast) にIssueが来ていたので、
それに関して調査したお話です。

- 接続タイムアウトすると double free check に引っかかる
- `brpop` みたいな長時間ブロックするコマンド中にシグナルが入ると、最初の1回が無視される

前者はC言語つらいって話で頑張って double free になる条件を探せばいいんですが、
後者はシグナル時のPerlやPOSIX APIの挙動を知らなくと解決できなそう。
そういうわけで、主に後者について調べた結果をまとめておきます。

<!-- More -->


## PERL_ASYNC_CHECKってXS中から呼んでもいいの？

言いたいことは最初に書いとけって偉い人に言われたので、最初にこの記事の結論を。
「よしななタイミングでPERL_ASYNC_CHECKを呼べばいいっぽい」みたいです。
でも、 ** 「PERL_ASYNC_CHECKってXS中から呼んでもいいの？」 ** という点に確証が持ててないので、
識者のご意見を募集してます！

## selectの挙動を調べる

Redis::FastはRedisからのレスポンスを待つのにLinuxのselect apiを叩いてます。
ファイルとかが読み書き可能になるまで処理をブロックしてくれるいいやつです。
しかし、select が処理をブロックしている間にシグナルを受信すると、うまく処理ができてないらしい。
そこで割り込み発生時の挙動を確認してみます。

困った時の[manページ(select)](http://linuxjm.sourceforge.jp/html/LDP_man-pages/man2/select.2.html)
をちゃんと読めば書いてありますね。

> エラーならば -1 を返し、 errno にエラーを示す値が設定される;
>
> EINTR
> シグナルを受信した。

Redis::Fastは`errno`を特に確認せず、とにかくエラーが発生したらリトライになってたのでダメだったみたいです。
通信にエラーが起きたわけではないので、再接続処理とかみたいな複雑なリトライ処理は必要なく、
単にもう一度selectしなおせば良さそうです。

## Perlさんのシグナル処理のタイミング

「割り込みかかったら再度select」っていうふうに修正してみたんですが、
今度はPerlのシグナルハンドラがなかなか呼び出されない！！

```perl
use Redis::Fast;
$SIG{TERM}= sub {
    warn "TERM handler called";
};
my $c =->new(reconnect=>2, every => 100, server => "localhost:6379");
$c->brpop("a", 100); # 100秒経ったら諦めて戻ってくる
```

このコードを実行中にSIGTERMを送ると、送った瞬間に"TERM handler called"と表示されて欲しいのですが、
`brpop`コマンドが終わるまで実行されない……

ググってみるとPerlはシグナルハンドラを即座に処理しているのではなく、
シグナルハンドラを安全に実行できるタイミングを見計らって実行しているみたいです。

- [Q4M を使ってる時のシグナル処理に注意](http://perl-users.jp/articles/advent-calendar/2009/data-model/03.html)


この記事では「Low Levelなシグナルハンドラを使おう」っていうことになってますが、できることならライブラリ側で対応したい。
安全にシグナルハンドラを実行できるタイミングで`PERL_ASYNC_CHECK`を呼び出しているので、
XS中でもこいつを呼べばできるのでは！ってことでやってみたら動いてるっぽい……？

ただDBIでもシグナルの扱いに同様の問題があるらしく、
これで解決するならDBIが解決してるよな・・・何か罠があるんだろうか。不安だ・・・。

## まとめ

- selectはシグナルを受信するとエラーを返すので、`errno` をみて適切に扱うこと
- Perlはシグナルハンドラを安全に実行できるタイミングでしか実行しない
- `PERL_ASYNC_CHECK`を使えば解決しそうだけど、どこからか椅子が飛んでくるんじゃないだろうか怖い
