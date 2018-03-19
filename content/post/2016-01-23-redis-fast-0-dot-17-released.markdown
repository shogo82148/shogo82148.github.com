---
layout: post
title: "Redis::Fast 0.17 をリリースしました"
date: 2016-01-23T16:20:00+09:00
comments: true
categories: [perl, redis]
---

[Redis::Fast 0.17](https://metacpan.org/release/SHOGO/Redis-Fast-0.17) をリリースしました。
主な変更点は以下のとおりです。

- I/Oの待ち合わせに使うシステムコールをselect(2)からpoll(2)に変更
- hiredisをv0.13.3にアップデート

<!-- More -->

macでテストが終わらない問題がありましたが、この変更によって修正されています。

hiredisは[connect(2)](https://linuxjm.osdn.jp/html/LDP_man-pages/man2/connect.2.html)をnonblokingモードで呼び出しています。
nonblockingなので接続が未完了であってもすぐに制御を返し、errnoにEINPROGRESSが設定されます。
この場合、manにあるようにselect(2)で書き込み可能になるのを待つことで、接続完了を検知できます。

> select(2) で書き込み可能になった後に、 getsockopt(2) を使って SOL_SOCKET レベルで SO_ERROR オプションを読み出すこ とにより、 connect() が成功したか、失敗したかを判断できる。

linuxの場合はこれで上手く動くのですが、macだと何故かselect(2)が永遠に制御を返さない場合があるようです。
接続先が存在しない場合に起こるのですが、制御を返す場合もあるので謎です。

いろいろ調べてはみたのですがselect(2)だとどうやっても上手く動かなかったので、poll(2)に変更しました。
poll(2)変更版でテストしてみると、接続先が存在しない場合にPOLLOUTを返すケースとPOLLHUPを返すケースがあるようです。
どうやらPOLLHUPにあたるイベントが来た時の挙動がlinuxとmacとで違うらしい？
謎です。
