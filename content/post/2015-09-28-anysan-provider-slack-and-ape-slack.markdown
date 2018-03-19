---
layout: post
title: "AnySan::Provider::Slackとape-slackを書いた"
date: 2015-09-28 22:11
comments: true
categories: [perl, go]
---

先週、今のプロジェクトでのメインのコミュニケーションツールをIRCからSlack切り替えました。
それにともないIRCに済んでいたボットたちもお引越しする必要があったので、
ボットとSlackをつなぐためのライブラリを書きました。

- [AnySan::Provider::Slack](https://metacpan.org/release/AnySan-Provider-Slack)
- [ape-slack](https://github.com/shogo82148/ape-slack)

Perlとgoのボットが住んでいるのでそれぞれの言語で実装してあります。

<!-- More -->

## AnySan::Provider::Slack

Perlの[AnySan](https://metacpan.org/pod/AnySan)用のモジュールです。

``` perl
use AnySan;
use AnySan::Provider::Slack;
my $slack = slack
    token => 'YOUR SLACK API TOKEN',
    channels => {
        'general' => {},
    };
$slack->send_message('slack message', channel => 'C024BE91L');
AnySan->run;
```

AnySanを使うだけでも便利なんですが、
今のプロジェクトではAnySanを対話形式で使いやすくするように[UnazuSan](http://www.songmu.jp/riji/entry/2013-09-09-unazusan.html)を使っています。
UnazuSanはIRC前提で書かれていて、AnySan::Provider::Slackをインストールしてもそのままは使えません。

UnazuSanを置き換えるもの面倒なので、イベントの名前を書き換えて投げ直すことで、
SlackのメッセージをIRCに見せかける方法をとっています。
また[SlackのOutgoing Webhookで@つきのmentionを捕まえる](https://beatsync.net/main/log20150926.html)にもあるように、
Slackのメンションは &lt;@U08DGJVJ7&gt;のような形式になってしまい、UnazuSanは自分へのメッセージとして扱ってくれません。
これをUnazuSanが解釈できる形式に置き換えるのがポイントです。

``` perl
use 5.010;
use warnings;
use utf8;
use Encode qw/encode_utf8/;
use UnazuSan;
use AnySan;
use AnySan::Provider::Slack;

my $unazu_san = UnazuSan->new(
    host       => 'example.com',
    password   => 'xxxxxxxxxxx',
    enable_ssl => 1,
    join_channels => [qw/arcade/],
    respond_all   => 1,
);


my $slack = slack(
    token    => 'YOUR SLACK TOKEN',
    channels => {},
    as_user => 1,
);

AnySan->register_listener(
    slack => {
        event => 'message',
        cb => sub {
            my $receive = shift;
            # fake irc privmsg
            $receive->{event} = 'privmsg';
            $receive->{message} =~ s/<\@xxxxx>:/unazusan:/;
            AnySan->broadcast_message($receive);
        },
    }
);

$unazu_san->on_command(
    help => sub {
        my ($receive, @args) = @_;
        $receive->reply('help '. ($args[0] || ''));
    }
);

$unazu_san->run;
```


## ape-slack

[ape](https://github.com/m0t0k1ch1/ape)のSlack対応版です。
SlackRTM APIを使ってイベントを受け取ります。

GoはWebSocketも比較的カンタンに使えるので、実はape-slackを使わなくても以下のようなコードだけでSlackRTM APIを使えてしまいます。

``` go
import (
  "encoding/json"
  "fmt"
  "net/http"
  "net/url"

  "golang.org/x/net/websocket"
)


func main() {
  resp, _ := http.PostForm("https://slack.com/api/rtm.start", url.Values{"token": {"YOUR SLACK TOKEN"}})
  var r struct {
    Url   string `json:"url"`
  }

  json.NewDecoder(resp.Body).Decode(&r)

  ws := websocket.Dial(r.Url, "", "https://slack.com/")

  for {
    var data map[string]interface{}
    websocket.JSON.Receive(ws, &data)
    fmt.Println(data)
  }
}
```

Outgoing Webhookを使うとSlackから呼んでもらえるようセキュリティの設定が必要で面倒ですが、
WebSocketならインターネッツに繋がった環境なら大抵そのままつながります。
Outgoing WebhookならチャンネルにJOINしていなくてもイベントを受け取れたりして便利ですが、
ちょっとしたボットならこちらの方がお手軽ですね。
