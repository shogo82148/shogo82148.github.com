---
layout: post
title: "Tweepyの2.3.0が出ました"
date: 2014-04-27T21:51:00+09:00
comments: true
categories: [python, tweepy, twitter]
---

Tweepyの2.3.0が出ました。
「[Tweepy が Application-only Authentication に対応します](http://shogo82148.github.io/blog/2014/04/18/tweepy-will-application-only-auth/)」僕のprも取り込まれていて、
Application-only Authentication が標準で使えるようになりました。
というわけで、早速遊んでみます。


## Application-only Authenticationで遊ぶ

使い方は「[tweepyでApplication-only Authenticationしてみた](http://shogo82148.github.io/blog/2013/05/09/application-only-authentication-with-tweepy/)」のときとほぼ同じ。
Tweepy本体に取り込んでもらったので、名前空間がちょこっと変わったくらいです。
Consumer Key と Consumer Secretだけ設定すればいいので、簡単に使えます。

``` python
#!/usr/bin/env python
# -*- coding: utf-8 -*-

import tweepy
import codecs
import sys

sys.stdin = codecs.getreader('utf-8')(sys.stdin)
sys.stdout = codecs.getwriter('utf-8')(sys.stdout)

CONSUMER_KEY = 'YOUR CONSUMER KEY'
CONSUMER_SECRET = 'YOUR CONSUMER SECRET'

def main():
    user_id = "JO_RI"
    auth = tweepy.AppAuthHandler(CONSUMER_KEY, CONSUMER_SECRET)
    api = tweepy.API(auth)

    arg = {'id': user_id, 'include_rts': 1}
    user_statuses = tweepy.Cursor(api.user_timeline, **arg).items(3200)
    for user_status in user_statuses:
        print user_status.text

if __name__ == "__main__":
    main()
```
