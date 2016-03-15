---
layout: post
title: "nginx-omniauth-adapterのGolangポート作った"
date: 2016-03-10 12:51
comments: true
categories: [go]
---

「[nginx で omniauth を利用してアクセス制御を行う](http://techlife.cookpad.com/entry/2015/10/16/080000)」という記事で、
[ngx_http_auth_request_module](http://nginx.org/en/docs/http/ngx_http_auth_request_module.html)の存在を知ったので、
Golangで[nginx\_omniauth\_adapter](https://github.com/sorah/nginx_omniauth_adapter)と似たようなものを作ってみました。

- [shogo82148/go-nginx-oauth2-adapter](https://github.com/shogo82148/go-nginx-oauth2-adapter)

<!-- More -->

## 背景

[typester/gate](https://github.com/typester/gate)は単体でも動くようになっていますが、
例えばIP制限などちょっと高度なことをしたい場合には結局nginxを前段に置く必要があります。
nginxとgateの設定を同時にいじる必要があって煩雑だと感じていました。

そんな中「[nginx で omniauth を利用してアクセス制御を行う](http://techlife.cookpad.com/entry/2015/10/16/080000)」という記事で、
[ngx_http_auth_request_module](http://nginx.org/en/docs/http/ngx_http_auth_request_module.html)の存在を知りました。
gateが認証＋Proxyをやってしまうのに対して、認証だけRubyのomniauthモジュールで行いProxyはnginxに任せるという方法です。

以前から記事の存在は知っていたのですが、Rubyの実行環境をそろえるのが億劫で手を出せずにいました。
小さなアプリなので自分の慣れた言語で実装しても大したことないのではと思い、Goで実装してみることにしました。


## 使い方

`go get`で落として来れます。
最低限client\_idとclient\_secretの指定が必要です。
nginx\_omniauth\_adapterと同じ環境変数名で設定できるほか、YAML形式の設定ファイルを読みこませることができます。
YAMLの形式はREADMEを参照してください。

``` bash
$ go get github.com/shogo82148/go-nginx-oauth2-adapter/cli/go-nginx-oauth2-adapter
$ export NGX_OMNIAUTH_GOOGLE_KEY=YOUR_CLIENT_ID
$ export NGX_OMNIAUTH_GOOGLE_SECRET=YOUR_CLIENT_SECRET
$ go-nginx-oauth2-adapter
$ go-nginx-oauth2-adapter -c conf.yaml # 設定ファイルでの指定も可能
```

PerlでHTTPサーバ書いているひとにはおなじみのServer::Starterにも対応しているので、
それ経由で立ち上げておくと設定の更新・プログラム自身の更新等が楽になると思います。

``` bash
start_server --port 18081 -- go-nginx-oauth2-adapter -c conf.yaml
```

nginx側の設定は[examples](https://github.com/shogo82148/go-nginx-oauth2-adapter/blob/master/examples/nginx/nginx-site.conf)ディレクトリを参照してください。
ヘッダ名・パス名等を合わせてあるので、nginx\_omniauth\_adapterと同じ設定で動くはずです。

また、[h2o](https://h2o.examp1e.net/)の設定はプログラマブルだからh2oでもちゃんと設定ファイルを書けば動くのではと考え、
[h2oの設定](https://github.com/shogo82148/go-nginx-oauth2-adapter/blob/master/examples/h2o/oauth.rb)も書いてみました。
mrubyからproxyに渡るリクエストを書き換える方法がない(？)っぽいので、アプリ側で認証情報をとることはできないですが、一応制限はできます。
basic認証の実装を見る限りremote-userヘッダだけは渡せるようなので、これを使えばなんとかなるかもしれないですが、未確認です。
(Ruby慣れてないからってGoで実装したけど、結局Rubyを書いていて面白い)


## nginx\_omniauth\_adapterとの違い

厳密に同じ挙動を実装するのが面倒だったため、挙動に若干の違いがあります。
一番大きなものは認証後のリダイレクト先です。

nginx\_omniauth\_adapterは認証後、一度adapterのURLにリダイレクトしてから、アプリサーバの`/_auth/callback`にリダイレクトします。
それに対してgo-nginx-oauth2-adapterは認証後、アプリサーバの`/_auth/callback`に直接リダイレクトします。
この違いのため、Google Developers Consoleの「承認済みのリダイレクト URI」に設定するべきURIが異なることに注意してください。
nginx\_omniauth\_adapterはadapter自身のURI、go-nginx-oauth2-adapterはアプリサーバの`/_auth/callbak`を指定します。

この挙動のため、go-nginx-oauth2-adapterはアプリの追加のたびにnginxの設定に加え「承認済みのリダイレクト URI」に正しいURIを追加する必要があります。
もちろん設定箇所がGoogle Developers Consoleではないだけで、nginx\_omniauth\_adapterもリダイレクト先の設定は必要です。
GoogleでもFacebookでも認証できるようにしたいという場合、nginx\_omniauth\_adapterは設定を一箇所変えればOKですが、go-nginx-oauth2-adapterは各サービスに登録し直す必要があります。
現状、認証に使うサービスをユーザが選ぶ仕組みがないので、そのまま放置してあります。


## まとめ

[nginx\_omniauth\_adapter](https://github.com/sorah/nginx_omniauth_adapter)のGolangポート
[shogo82148/go-nginx-oauth2-adapter](https://github.com/shogo82148/go-nginx-oauth2-adapter)を紹介しました。

adapter自身の公開設定をしなくて良い分簡単にセットアップできます。
nginx\_omniauth\_adapter互換ですぐに乗り換えもできるので、ぜひお気軽にお試し下さい。
