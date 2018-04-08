---
layout: post
title: "RaspberryPiからメールを送る"
slug: mail-from-raspberrypi
date: 2013-05-12T21:50:00+09:00
comments: true
categories: [ RaspberryPi]
---

RaspberryPi に cron を仕込んで定期実行をやってみようと考えました。
cron の設定自体は `crontab -e` コマンドを実行すれば簡単にできます。
ただ、これだけだとちゃんと動いているか少し心配なので、
エラーが起きた時に何か通知して欲しい。
普通なら設定ファイルに `MAILTO=hogehoge@example.com` と書いておくと
メールが送られるはずなのですが、
メールサーバが動いてないのでうまくいかない・・・。

そういうわけで、RaspberryPiからメールを送るための設定をしたのでメモ。

<!-- More -->

## MTAをインストールする

Raspberry Pi には標準でMTA(Message Transfer Agent)が入ってないようなのでインストール。
今回はPostfixを採用

``` bash
sudo apt-get install postfix
```

最初、Sendmailも試してみたんだけど、送信者マスカレードがなぜかうまく行かなったので断念。
後述するように、この設定がないとスパムフィルタに引っかかってしまうのです。

## プロバイダのSMTPにリレーしてもらう

実際にメールを送りには以下の条件を満たす必要があるようです。

- 送信元のドメインを引ける
- 固定IPからのアクセス

固定IPなんて自前で持ってないし、
cron からのメールは送信元が pi@raspberrypi になってしまいドメインを引けません。
そのためそのままではスパムメールとして扱われてしまい、メールが届きません。

そこで、プロバイダが提供しているSMTPサーバにメールをリレーしてもらいます。
`/etc/postfix/main.cf`に以下の行を追加します。

``` plain /etc/postfix/main.cf
sender_canonical_maps = regexp:/etc/postfix/canonical

relayhost = [smtp.example.com]:587
smtp_sasl_auth_enable = yes
smtp_sasl_password_maps = hash:/etc/postfix/relay_password
smtp_sasl_security_options = noanonymous
```

プロバイダにリレーしてもらうには SMTP-Auth で認証する必要があるので、
ユーザ名とパスワードを設定しておきます。

```plain /etc/postfix/elay_password
smtp.example.com hogehoge:your-password
```

postmapコマンドを使って、Postfixから扱える形式に変換します。

``` bash command
$ postmap hash:/etc/postfix/relay_password
```

さらに、エンベロープのFromがプロバイダから提供されたメールアドレスでないと
メールをリレーしてくれないので、
すべてのメールのFromをすべて書き換えるよう設定します。

``` plain /etc/postfix/canonical
/.*/ hogehoge@example.com
```

最後にPostfixに設定を読み込ませて設定完了。
cron からメールを送れるようになるはず。

``` bash command
$ sudo /etc/init.d/postfix reload
```

・・・この設定にたどり着くのに非常に苦労した。
メールなんてもう嫌だ・・・。

## 参考
- [PostfixでメールのToやFromを書き換える方法](http://blog.cohtan.org/2009/03/postfixtofrom.html)
- [Postfix でメールリレーの設定 (SMTP クライアント + SMTP Auth)](http://www.maruko2.com/mw/Postfix_%E3%81%A7%E3%83%A1%E3%83%BC%E3%83%AB%E3%83%AA%E3%83%AC%E3%83%BC%E3%81%AE%E8%A8%AD%E5%AE%9A_(SMTP_%E3%82%AF%E3%83%A9%E3%82%A4%E3%82%A2%E3%83%B3%E3%83%88_%2B_SMTP_Auth))
- [【トラブル】raspberry pi(ラズベリーパイ)を使ってみる - raspbianでcronがうまく動かないような…?](http://www.limemo.net/blog/2013/02/raspberry-pi-not-working-cron-on-raspbian.html)
  - Sendmailでの設定。なぜかうまく行かなかった。

