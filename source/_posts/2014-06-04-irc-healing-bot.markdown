---
layout: post
title: "IRCに癒やしボットを入れてみた"
date: 2014-06-04 07:37
comments: true
categories: [ perl, unazusan ]
---

別チームがIRCに癒やしボットを入れてたので、自分のチームのチャンネルにも入れてみた。

<!-- More -->


## Instagramに登録する

[InstagramのDeveloperサイト](http://instagram.com/developer/)に開発者として登録します。
[Authentication](http://instagram.com/developer/authentication/)
のページを見ながら、Server-side (Explicit) Flow を参考にアクセストークンを取得します。

## Instagram APIを叩く

`https://api.instagram.com/v1/tags/$TAGNAME/media/recent?access_token=YOUR_ACCESS_TOKEN`を叩くと
TAGNAMEに関連する画像の情報がJSONで帰ってくるので、
Perlからこのエンドポイントを叩きます。
IRCとのやりとりには[UnazuSan](http://www.songmu.jp/riji/entry/2013-09-09-unazusan.html)を使いました。

``` perl
!/usr/bin/env perl
use 5.014;
use warnings;
use strict;
use utf8;
use Encode qw/encode_utf8/;
use Furl;
use JSON;

use UnazuSan;

sub neko {
    state $data = undef;
    state $time = 0;
    if( !$data || time - $time > 60 * 60) {
        $time = time;
        my $furl = Furl->new;
        my $res = $furl->get('https://api.instagram.com/v1/tags/%E7%8C%AB/media/recent?access_token=YOUR_ACCESS_TOKEN');
        my $hash = JSON::decode_json($res->content);
        $data = $hash->{data};
    }
    my $media = $data->[rand(scalar @$data)];
    return $media->{images}{standard_resolution}{url};
}

my $unazu_san;
my $NICKNAME = 'iyashi';
$unazu_san = UnazuSan->new(
    host       => '127.0.0.1',
    enable_ssl => 1,
    join_channels => ['#test'],
    respond_all   => 1,
    nickname      => $NICKNAME,
);

$unazu_san->on_message(
    qr/^\s+$NICKNAME:/ => sub {
        my $receive = shift;
        $receive->reply('うんうん');
    },
    qr/(.*)/ => sub {
        my ($receive, $match) = @_;
        say $match;
        say $receive->message;
    },
);

$unazu_san->on_command(
   ' 癒やし' => sub {
        my ($receive, @args) = @_;
        $receive->reply(neko());
    }
);

$unazu_san->run;
```

「癒して」と話しかけると猫画像を検索して返してくれます。

## 引数をMeCabで解析する

``` plain
acidlemon unazu_san: 癒やしをうさぎで頼む
acidlemon ネコやん! ('-'#)
```

みたいなことがあったので、「癒して」のあとも見ることにしました。
MeCabを使って名詞っぽいものを抽出して、タグ名に使います。

``` perl
state $mecab = Text::MeCab->new();

my $n = $mecab->parse(join ' ', @_);
my $keyword = undef;
while ($n) {
    my $f = decode_utf8 $n->feature;
    $keyword //= decode_utf8($n->surface) if ($f =~ /^名詞,/) && ($f !~ /^名詞,代名詞,/);
    $n = $n->next;
}
$keyword //= '猫';
my $word = uri_escape_utf8($keyword);
my $res = $furl->get("https://api.instagram.com/v1/tags/$word/media/recent?access_token=ACCESS_TOKEN");
```

これで癒やしをうさぎで頼まれてもウサギ画像を返せるようになりました。
