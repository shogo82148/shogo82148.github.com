---
layout: post
title: "tweepyでApplication-only authenticationしてみた"
slug: application-only-authentication-with-tweepy
date: 2013-05-09T23:29:00+09:00
comments: true
categories: [Python, Twitter]
---

Twitter の API リファレンスを久しぶりに見たら、
[Application-only authentication](https://dev.twitter.com/docs/auth/application-only-auth)とかいうのを発見。
特定のユーザと関連付けられない代わりに、普通に認証するより制限が緩いみたい。
3月に追加されてたらしい。

知らなかった・・・。
最近API叩いてなかったからな・・・。

便利そうなので、Python用のTwitterライブラリである[Tweepy](https://github.com/tweepy/tweepy)から使ってみた。

<!-- More -->

## AuthHandler
Tweepy用のAuthHandler。
認証部分は
[TwitterのApplication-only authenticationを試してみた](http://ktkrhr.hatenablog.com/entry/2013/03/27/002447)
のページからほぼコピペ。

``` python AppAuthHandler.py
import tweepy
import urllib
import urllib2
import base64
import json

class AppAuthHandler(tweepy.auth.AuthHandler):
    TOKEN_URL = 'https://api.twitter.com/oauth2/token'

    def __init__(self, consumer_key, consumer_secret):
        token_credential = urllib.quote(consumer_key) + ':' + urllib.quote(consumer_secret)
        credential = base64.b64encode(token_credential)

        value = {'grant_type': 'client_credentials'}
        data = urllib.urlencode(value)
        req = urllib2.Request(self.TOKEN_URL)
        req.add_header('Authorization', 'Basic ' + credential)
        req.add_header('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8')

        response = urllib2.urlopen(req, data)
        json_response = json.loads(response.read())
        self._access_token = json_response['access_token']

    def apply_auth(self, url, method, headers, parameters):
        headers['Authorization'] = 'Bearer ' + self._access_token
```

## 使ってみる

今まではOAuthHandlerを使っていたのを、上のAppAuthHandlerに置き換えるだけ。
あとは今までどおりAPIを叩ける。
以下は特定のユーザのツイートを取れるだけ取ってくる例。

``` python crawl.py
#!/usr/bin/env python
# -*- coding: utf-8 -*-

import tweepy
import codecs
import sys
import AppAuthHandler

sys.stdin = codecs.getreader('utf-8')(sys.stdin)
sys.stdout = codecs.getwriter('utf-8')(sys.stdout)

CONSUMER_KEY = 'hogehoge'
CONSUMER_SECRET = 'hogehoge'

def main():
    user_id = "JO_RI"

    auth = AppAuthHandler.AppAuthHandler(CONSUMER_KEY, CONSUMER_SECRET)
    api = tweepy.API(auth)

    arg = {'id': user_id, 'include_rts': 1}
    user_statuses = tweepy.Cursor(api.user_timeline, **arg).items(3200)
    for user_status in user_statuses:
        print user_status.text

if __name__ == "__main__":
  main()
```

## 参考
- [Application-only authentication](https://dev.twitter.com/docs/auth/application-only-auth)
- [TwitterAPIがApplication-only authenticationを公開。これを使うと検索API等の一部回数制限が大幅に緩和される。](http://blog.k52.org/0162)
- [TwitterのApplication-only authenticationをperlで試す。](http://www.macminiosx.com/2013/03/twitterapplication-only_authen.html)
- [TwitterのApplication-only authenticationを試してみた](http://ktkrhr.hatenablog.com/entry/2013/03/27/002447)
