---
layout: post
title: "なぜタイムスタンプをIDとして扱ってはいけないのか"
slug: 2023-05-29-why-you-should-not-use-timestamp-as-id
date: 2023-05-29 17:00:00 +0900
comments: true
categories: [ ]
---

## 背景

マイナンバーカードの導入により、今まで役所で行っていた証明書の発行手続きを、コンビニに行えるようになりました。
このコンビニ証明書交付サービスにおいて、2023年5月9日誤って他人の戸籍全部事項証明書が発行されてしまうバグが明らかになりました。

開発元である富士通Japan株式会社は、この原因について以下のように説明しています。

- [川崎市様における証明書誤交付ついて（お詫び）](https://www.fujitsu.com/jp/group/fjj/about/resources/news/topics/2023/0509.html)

> 本事象の原因は、2か所のコンビニで、2名の住民の方が同一タイミング（時間間隔1秒以内）で証明書の交付申請を行った際に、後続の処理が先行する処理を上書きしてしまうことによるものです。

「時間間隔1秒以内」という条件から、
Twitterを始めとしたSNSでは「タイムスタンプ（秒）をIDにしているのでは？」という憶測が広まりました。
（もしくはIDに類するもの）

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">ファイル名が秒単位の時刻なので、1秒間に複数申請があれば、後の申請の出力に上書きされてしまう、ということなのか。どうしてこれでうまくいくと思ったのか＞富士通Japan <a href="https://t.co/FOvWWMdqar">https://t.co/FOvWWMdqar</a></p>&mdash; Haruhiko Okumura (@h_okumura) <a href="https://twitter.com/h_okumura/status/1656155148861980674?ref_src=twsrc%5Etfw">May 10, 2023</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

「そんなことするやつ、いるわけないじゃん！」と思ったのですが、自分自身はともかく他の知り合いは・・・？と考えたら心配になってきました。
そういうわけで、もう話のネタとして旬は過ぎた感はありますが、注意喚起として「なぜタイムスタンプをIDとして扱ってはいけないのか」を記事にすることにしました。

## なぜタイムスタンプをIDとして扱ってはいけないのか

### 鳩の巣原理

### 誕生日のパラドックス

## 参考

- [川崎市様における証明書誤交付ついて（お詫び）](https://www.fujitsu.com/jp/group/fjj/about/resources/news/topics/2023/0509.html)
- [富士通JapanのMICJETで相次ぎ発生した証明書誤交付についてまとめてみた](https://piyolog.hatenadiary.jp/entry/2023/05/22/000742)
- [@Matsunaga_1127 on Twitter](https://twitter.com/Matsunaga_1127/status/1658302051171053576)
