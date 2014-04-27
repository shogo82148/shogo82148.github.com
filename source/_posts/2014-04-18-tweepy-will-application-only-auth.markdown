---
layout: post
title: "Tweepy が Application-only authentication に対応します"
date: 2014-04-18 06:37
comments: true
categories: [python, twitter, tweepy]
---

以前 「[tweepyでApplication-only Authenticationしてみた](http://shogo82148.github.io/blog/2013/05/09/application-only-authentication-with-tweepy/)」で
書いたTweepyのAuthHandlerを本体に取り込んでもらいました。
リリースタイミングとかよくわかってないですが、次のリリースとかでApplication-only Authenticationを簡単に使えるようになります、たぶん。

(2014-04-27追記)
このprを取り込んだTweepy 2.3.0がリリースされました。早速遊んでみたのでこちらもどうぞ>[Tweepyの2.3.0が出ました](http://shogo82148.github.io/blog/2014/04/27/2014-04-27-tweepy-2-dot-3-0-released/)

<!-- More -->

## 取り込まれるまでの経緯

- 「Application-only Authentication 対応しないの？」って質問は去年からあった([tweepy#318](https://github.com/tweepy/tweepy/issues/318))
- 先日「ここに動くコード載ってるよ」と[僕の記事が紹介される](https://github.com/tweepy/tweepy/issues/318#issuecomment-40291735)
- 昨日の夕方「コントリビュートしてみない？」とブログやgithub経由で頼まれる
- やるしか無い！と思って昨日のうちにpr作成
- 朝起きたら取り込まれてた

日本語なんてマイナーな言語で記事が書いてあっても、読んでくれる人は読んでくれるんですね。
Tweepy は僕も何度か使ったことがあるので Issue とかみて開発状況をチェックしていたんですが、
見覚えのある名前が見えたときはびっくりしました。

ちょっとしたコードでも公開しておくといいことがあるよ、というお話でした。
最近ここも全然更新してないので、もっとアウトプットしていかないと・・・。
