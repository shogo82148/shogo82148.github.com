---
layout: post
title: "ISUCON5の予選に参加して惨敗してきた"
slug: isucon5-qualifying
date: 2015-09-28T06:16:00+09:00
comments: true
categories: [isucon]
---

こんにちは、チームぽわわ4 feat. ネコトーストラボです。
[ISUCON5](http://isucon.net/archives/45166636.html)の予選に参加してきて見事に惨敗してきました。

<!-- More -->

## お題

「ISUxi」という名前の「高負荷に耐えられるSNSコミュニティサイト」。
日記やコメントの投稿ができて、ホーム画面には「あしあと」「あなたへのコメント」「あなたの友だちの日記エントリ」「あなたの友だちのコメント」が表示されています。
日記にはprivateとpublicの公開範囲があって、これの出し分けも必要です。
やることおおい・・・。

## やったこと

### 〜開始

<blockquote class="twitter-tweet" data-lang="ja"><p lang="ja" dir="ltr">時間余裕でしょと思ったら全くそんなことなかった</p>&mdash; ひさいち (@hisaichi5518) <a href="https://twitter.com/hisaichi5518/status/647559828068413442?ref_src=twsrc%5Etfw">2015年9月25日</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>


<blockquote class="twitter-tweet" data-lang="ja"><p lang="ja" dir="ltr">時間余裕でしょと思ったら全くそんなことなかった</p>&mdash; Ichinose Shogo (@shogo82148) <a href="https://twitter.com/shogo82148/status/647560930629279744?ref_src=twsrc%5Etfw">2015年9月25日</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

<blockquote class="twitter-tweet" data-lang="ja"><p lang="ja" dir="ltr">5時間で決着をつける <a href="https://t.co/AbnnSyHuZ8">https://t.co/AbnnSyHuZ8</a></p>&mdash; Ichinose Shogo (@shogo82148) <a href="https://twitter.com/shogo82148/status/647574277529583616?ref_src=twsrc%5Etfw">2015年9月26日</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>


<blockquote class="twitter-tweet" data-lang="ja"><p lang="ja" dir="ltr">バッテリ残量との戦いがすでに始まっている <a href="https://twitter.com/hashtag/ISUCON?src=hash&amp;ref_src=twsrc%5Etfw">#ISUCON</a> <a href="https://twitter.com/hashtag/%E3%82%A2%E3%83%80%E3%83%97%E3%82%BF%E5%BF%98%E3%82%8C%E3%81%9F?src=hash&amp;ref_src=twsrc%5Etfw">#アダプタ忘れた</a></p>&mdash; Ichinose Shogo (@shogo82148) <a href="https://twitter.com/shogo82148/status/647579466898608128?ref_src=twsrc%5Etfw">2015年9月26日</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>



### 〜午前中

ソースコードをgit管理下に置くとか準備したあと、ソースコードを眺めてスキーマやクエリの改善ができないかを見てました。
主にインデックスに不足は無いか、ループクエリは無いかを見てみました。
インデックスに関しては必要そうなところにはすでに貼ってあって、これ以上することなさそうな感じ。
ループクエリに関しては、ホーム画面の「あなたの友だちのコメント」の部分で、エントリ情報や、関連するユーザの情報を取ってくるところで見つけたので、JOINに書き換えられないか着手。
しかし、実行計画が大きく変わって極端に遅くなってしまい、なんだこれーってなってました。

### 〜14時

SQLじゃ無理だってことで、Redisに切り替え。
エントリやコメントをRedisのリストで管理して、
エントリやコメントを投稿したときに友だち全員に配信する形式に変更しました。

ある程度書けてこれで動くのでは！ってとこまで書けたんだけど、
「投稿した時に友だちに配信」形式だと、友だち関係があとから変化するケースに対応できないという気がつく。
いろいろ考えてみたものの、友だち関係が変化した場合は元の実装を使うしか思いつきませんでした。

そしてここでバッテリー切れ・・・

<blockquote class="twitter-tweet" data-lang="ja"><p lang="ja" dir="ltr">あと3%…(ヽ´ω`)</p>&mdash; Ichinose Shogo (@shogo82148) <a href="https://twitter.com/shogo82148/status/647648583173275648?ref_src=twsrc%5Etfw">2015年9月26日</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>


### 〜16時

アダプタを借りることができて延命しました。ありがとうございます！

<blockquote class="twitter-tweet" data-lang="ja"><p lang="ja" dir="ltr">アダプター貸していただけました。ありがとうございます！m(__)m <a href="https://twitter.com/hashtag/isucon?src=hash&amp;ref_src=twsrc%5Etfw">#isucon</a></p>&mdash; Ichinose Shogo (@shogo82148) <a href="https://twitter.com/shogo82148/status/647650705411473409?ref_src=twsrc%5Etfw">2015年9月26日</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>



コメント部分のキャッシュが一応は動いたので、エントリ部分についてもRedisを使ったキャッシュ化を進めてました。
200位スコアはあがるものの劇的な改善にはならず・・・(ヽ´ω`)


### 〜19時

コメントや日記部分これ以上の改善案を思いつけなかったので、諦めてあしあとの改善に着手。
DATE()関数をGROUP BY句に使っていてインデックスが使えない感じだったので、
カラムにしてインデックスが効くように書き換え。
しかし、ベンチが最後まで通らず、この修正は断念・・・。

ユーザのIDとかニックネームとかは書き換わらないので、
perlのコードにユーザ情報を埋め込んでループクエリを削除みたいな姑息な手段で足掻いたりしましたが、
コメントやエントリの一覧を取ってくるところがボトルネックなのでほとんど効果なしでした。


## まとめ

忘れ物するし、全くスコア上がらないし、いいとこなしのまま終わってしまいました。
毎回、Redisでの置き換えを頑張るけど元の実装を完全に置き換えることができずそこがボトルネックになって全然スコア上がらない、
というパターンになってしまうので、実装能力を上げていきたい・・・。
