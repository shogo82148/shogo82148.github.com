---
layout: post
title: "Google Cloud Messaging for Chrome を試してみた"
date: 2013-05-15T11:26:00+09:00
comments: true
categories: [chrome, perl]
---

少し前に[Google Cloud Messaging for Chrome](http://developer.chrome.com/apps/cloudMessaging.html)
が発表されました。
Android向けに提供されていた Push 通信の仕組みである GCM の Chrome 版です。
ちょうど GCM for Android に触っていたところだったので、
for Chrome のほうも試してみることにしました。

<!-- More -->

## 拡張機能の登録

公式ページの説明にしたがって、
APIを使えるようにします。
GCMはOAuth2.0で認証を行うので、

1. クライアントIDを作る
2. Refresh Token を作る

という2ステップが必要。

### クライアントIDを作る

まず、新しい OAuth2.0 のアプリを作成。
拡張機能をアップロードする予定のGoogleアカウントで以下の作業して
Client IDを作ります。

1. [Google APIs Console](https://code.google.com/apis/console/) にログインする
2. ** Create... ** メニューから新しいプロジェクトを作成
3. "Services" を開いて ** Google Cloud Messaging for Chrome API ** を有効化
4. "API Access" を開いて ** Create an OAuth 2.0 cliend ID... ** というボタンをクリック
5. branding information を適当に入力
7. "Application Type" という項目の "Web application" を選択
8. "Create client ID"！！

Client ID と Client Secret が表示されるのでメモしておきましょう。


### Refresh Token を取得する

次に作成したクライアントIDを使って、
OAuth2.0認証。

1. シークレットウィンドウを開く(複数アカウント持ってない場合は必要ない)
2. [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)へアクセス
3. ** OAuth2.0 Configuration ** をクリック
4. "Use your own OAuth credentials" にチェックを入れ、Client ID と Client Secret を入力。"Close"を押して画面を閉じる
5. "Step 1"セクションの"Input your own scopes"に `https://www.googleapis.com/auth/gcm_for_chrome` を入力して、"Authorize APIs"ボタンを押す
6. ログインページにリダイレクトされるので、拡張機能をアップロードする予定のアカウントで認証
7. 今度はアプリの認証画面に飛ぶので "Allow Access" をクリック
8. "Step 2" セクションの "Exchange authorization code for tokens" ボタンをクリック

以上の手順で Access Token と Refresh Token がもらえる。
通知を送るには Access Token があれば十分なんだけど、有効期間が1時間程度しかない。
有効期間が切れたら Refresh Token を使って再取得する必要がある。
Refresh Token の方には有効期間は無いので、大事にとっておこう。

(GCM for Android みたいに Sever key 作るだけじゃダメだったのかな・・・OAuth2.0認証面倒・・・)

## 拡張機能でGCMを使う

次は通知を受け取る拡張機能を作ります。


### パーミッションを追加

まずはマニフェストを作成。
permissions という項目に "pushMessaging" を追加しておくのがポイント。

``` javascript manifest.json
{
    "manifest_version": 2,
    "name": "Shogo GCM Test",
    "description": "It's test extension",
    "version": "1.0",

    "permissions": [
        "pushMessaging",
        "notifications"
    ],

    "background": {
        "scripts": ["background.js"]
    }
}
```

### JavaScript を書く

通知を受け取るプログラムを書いてみます。

``` javascript background.js
// ChannelIDを取得
chrome.pushMessaging.getChannelId(false, function (response){
    console.log(response); // 本当はサーバに送るんだけど、とりあえず、コンソールに出力しておく
});

// 通知を受け取るイベントハンドラを登録
chrome.pushMessaging.onMessage.addListener(function (message) {
    // デスクトップ通知で表示
    var notification = webkitNotifications.createNotification(
        '',
        'Message',
        message.payload
    );
    notification.show();
});
```

### マーケットに公開！

ローカル環境でも Channel ID の取得まではできるんだけど、
実際に Push 通知を受信するには、マーケットへのアップロードが必要。

[デベロッパーダッシュボード](https://chrome.google.com/webstore/developer/dashboard)で
新しいアイテムを追加ボタンを押し、さっきのファイルをzipで固めたファイルを送ります。
公開するには初回のみ5ドル必要です。
さすがに開発中のものを全世界に公開するのはまずいので、
テスターにのみ公開というオプションを選択しておきましょう。


## Push 通知を送る

さあ、Push通知を送ってみましょう。

### 新しい Access Token を取得する

と、そのまえに

そろそろ最初にもらった Access Token の有効期間が切れているころだと思うので、
新しいものを取得しておきましょう。

最近 Perler になりつつあるので、Perlで書いてみます。
Client ID, Client Secret, Refresh Token を Post するだけの簡単なスクリプトです。

``` perl refresh_token.pl
#!/usr/bin/env perl

use warnings;
use strict;
use Encode;
use Data::Dumper;

use Furl;
use JSON::XS;

my $refresh = 'your_refresh_token';
my $client_id = 'your_client_id.apps.googleusercontent.com';
my $client_secret = 'your_client_secret';

my $furl = Furl->new;
my $res = $furl->post(
    'https://accounts.google.com/o/oauth2/token',
    [ ],
    [
        client_id => $client_id,
        client_secret => $client_secret,
        refresh_token => $refresh,
        grant_type => 'refresh_token',
    ],
);

print Dumper decode_json($res->content);
```

### Push! Push! Push!

さあ、ようやくPush！

Access Token をヘッダにつけ、
メッセージをChannel IDと一緒に POST するだけ。

Channel ID は `chrome://extensions/` から自分の拡張機能の選択、
ビューを調査: \_generated\_background\_page.html というところをクリックすると、
Consoleが見れるのでそこから確認できます。

``` perl push.pl
#!/usr/bin/env perl

use warnings;
use strict;
use Encode;

use Furl;
use JSON::XS;

my $access = 'your_access_token';
my $channelId = 'your_channel_id';

my $data = {
    channelId => $channelId,
    subchannelId => "0",
    payload => decode_utf8(join(' ', @ARGV)),
};

my $furl = Furl->new;
my $res = $furl->post(
    'https://www.googleapis.com/gcm_for_chrome/v1/messages',
    [
        'Content-Type' => 'application/json',
        'Authorization' => "Bearer $access",
    ],
    encode_json $data,
);
```

``` bash Command
$ perl push.pl hogehoge
```

うまくいくと、デスクトップ通知が出るはず！


## 参考
- [Google Cloud Messaging for Chrome](http://developer.chrome.com/apps/cloudMessaging.html)
- [Google Cloud Messaging for Chromeを体験してみた](http://blog.maripo.org/2013/05/gcm-for-chrome/)
