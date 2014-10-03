---
layout: post
title: "Github::Hooks::ReceiverがX-Hub-Signatureをサポートしました"
date: 2014-09-23 00:25
comments: true
categories: [perl]
---

[Github::Hooks::Receiver](https://metacpan.org/pod/Github::Hooks::Receiver)にX-Hub-SignatureをサポートするPull Requestを送ったら、
速攻取り込まれ、さらにGithubのコミット権とPAUSEのco-maintパーミッションをもらったというお話。

<!-- More -->

## X-Hub-Signature

GithubのWebhookは大変便利なんですが、特に対策をしないままだと
他の人にcurlとかで叩かれてしまう可能性があります。
本来であればIPアドレスで制限をかけるべきなんですが、
iptablesの設定とかよくわからないし・・・と思ってGithubのドキュメントを読んでいたら、
もっとお手軽な方法発見。

- [Securing your webhooks](https://developer.github.com/webhooks/securing/)

GithubからのリクエストにはX-Hub-Signatureというのがついていて、
これを使うとPayloadの検証ができるらしい。
[Github::Hooks::Receiver](https://metacpan.org/pod/Github::Hooks::Receiver)は
このヘッダを全くみていないようだったので[Pull Requestを送ってみた](https://github.com/Songmu/Github-Hooks-Receiver/pull/1)。

Github::Hooks::Receiver 0.02以降で、以下のようにsecretの指定ができるようになります。

``` perl
use Github::Hooks::Receiver::Declare;
my $receiver = receiver {
    secret 'secret1234'; # Webhookの設定画面のsecretの項目と同じものを入力
    on push => sub {
        # レポジトリにPushされた時の処理とかをゴニョゴニョ書く
    };
};
my $psgi = $receiver->to_app;
$receiver->run;
```

これでsecretを知らない人がリクエストを偽装できなくなるので安心です。
secretはエントロピーが高いほうがいいので
`ruby -rsecurerandom -e 'puts SecureRandom.hex(20)'`
みたいなコマンド使うといいらしいですよ。


## String::Compare::ConstantTime
Signatureの比較にはRubyの[secure_compare](http://rubydoc.info/github/rack/rack/master/Rack/Utils.secure_compare)のような関数を
使ったほうがいいらしい。
Github::Hooks::Receiverでは、そのPerl版の[String::Compare::ConstantTime](https://metacpan.org/pod/String::Compare::ConstantTime)を使ってみた。
ちょっと引数のチェックに甘いところがあって、segmentation fault場合があったので、こちらにもPull Requestを送っておきました。
Github::Hooks::Receiverは使う前にチェックを入れてあるので、現行バージョンでも問題なく動くはず。

String::Compare::ConstantTimeはXSで書かれたモジュールなんですが、
この手のバグが入り込みやすいのでXS難しいですね。

## まとめ

- XS怖い
- Github::Hooks::Receiverにsecretを指定できるようになったので、IP制限がかけられない場合でも安心
- でも、可能であればIP制限もしましょうね
- XS怖い

## 追記

### IP制限について

Songmu先生よりコメントをいただきました。

{% oembed https://twitter.com/songmu/status/514426458190528513 %}

確かにPlack::Middlewareとか使えばお手軽に弾けるので、
X-Hub-SignatureだけでなくIP制限もやっておくと良いですね。

### String::Compare::ConstantTime

String::Compare::ConstantTime ですが、僕のprが取り込まれた 0.310 がリリースされました。
`undef` を渡すとsegmentation fault で落ちるというバグが修正されています。
XS怖い。

## SEE ALSO

- [Github::Hooks::Receiver](https://metacpan.org/pod/Github::Hooks::Receiver)
- [String::Compare::ConstantTime](https://metacpan.org/pod/String::Compare::ConstantTime)
- [GithubのHookについてのまとめとソリューション](http://www.songmu.jp/riji/entry/2013-12-05-github-hooks.html)
- [Jenkinsでパラメータ付ビルドでブランチ指定出来るようにしつつ、GithubのHookも受け付けられるようにする](http://www.songmu.jp/riji/entry/2014-04-18-github-hooks.html)
