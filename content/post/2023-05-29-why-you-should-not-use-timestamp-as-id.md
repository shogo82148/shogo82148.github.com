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

「そんなことやるわけないじゃん」とは思ったのですが、自分自身はともかく周りのひとは・・・？と考えたら心配になってきました。
そういうわけで、なぜタイムスタンプをIDとして扱ってはいけないのか、注意喚起することにしました。
もう話のネタとして旬は過ぎた感はあるけど、文章に残しておくことが大事なんだ。

## なぜタイムスタンプをIDとして扱ってはいけないのか

さて、「秒単位のタイムスタンプをIDに使う」という設計がなぜダメなのか考えていきましょう。

なお、今回の証明書誤交付の原因が「秒単位のタイムスタンプをIDに使ったため」と主張する意図はありません。
証明書発行システムの実装を例として、秒単位のタイムスタンプをIDに使った場合にどうなるか？という思考実験です。
実在のシステムとは関係ありません。

### 誕生日のパラドックス

ダメな理由として挙げられるのは誕生日のパラドックスでしょう。

- [誕生日のパラドックス - Wikipedia](https://ja.wikipedia.org/wiki/%E8%AA%95%E7%94%9F%E6%97%A5%E3%81%AE%E3%83%91%E3%83%A9%E3%83%89%E3%83%83%E3%82%AF%E3%82%B9)

たとえば、小中学校のクラスに同じ誕生日のペアがいたら、珍しいこともあるもんだ！と感じませんか？
実はそんなに珍しいことではないというのが誕生日のパラドックスです。
クラスに23人いれば、その中に「同じ誕生日である二人組」が50％以上の確率で存在します。

誕生日のパラドックスを証明書発行システムに当てはめて考えてみましょう。
ユーザーがいつ証明書発行を行うかわからないので、ユーザーは一年の中のランダムな時刻に証明書発行を行うと仮定します。
年間n人のユーザーが利用した場合にIDが重複する確率は、以下のプログラム（雑）で計算できます。

```python
# python
n = 60*60*24*365
p = 1.0
for i in range(n):
    p = p * (n - i) / n
    print(i, 1-p)
```

実行してみると年間6612人利用でIDが重複する確率が50%を超えます。
一年が3153.6万秒あることを考えると随分と少ないことがわかります。

```
...
6610 0.49986985152463326
6611 0.49997469552550755
6612 0.5000795334032722
6613 0.500184365152562
6614 0.5002891907680136
6615 0.5003940102442652
...
```

-----

川崎市の年間の証明書発行件数は、令和元年の実績で6000件程度らしいです。

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">資料より全国の交付数のうち戸籍の割合（累計:5.6%, 令和3年:6.7%）<br>89000×6.7%=5949<br>コンビニ交付のうち戸籍取り扱い時間（7:30-19:00）：11.5時間<br><br>以上より条件を変更<br>n=60*60*11.5*365<br>k=6000<br>→1.03回/年<br><br>資料：コンビニ交付サービス概要p9<a href="https://t.co/ZqJw3cnlbA">https://t.co/ZqJw3cnlbA</a></p>&mdash; Wataru Inoue (@Wataru__Inoue) <a href="https://twitter.com/Wataru__Inoue/status/1656324806357426179?ref_src=twsrc%5Etfw">May 10, 2023</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

- [コンビニエンスストアでの証明書交付サービスの臨時休止について（最終報）](https://www.city.kawasaki.jp/templates/press/250/0000151039.html)
- [令和２年度 文教委員会資料⑩](https://www.city.kawasaki.jp/980/cmsfiles/contents/0000116/116489/021119-12.pdf)

毎年50%の確率が衝突が起こってしまうので、これでは本番投入できないですね。

## マイクロ秒単位のタイムスタンプで解決しない理由

証明書誤発行の件ですが、バグは修正されたものの再発してしまいます。
再発の原因について以下のように説明しています。

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">【品川区】<br>コンビニ交付障害の対応について<br>5月18日【木】6:30〜23:00まで<br>利用出来ません。<a href="https://twitter.com/hashtag/%E3%83%9E%E3%82%A4%E3%83%8A%E3%83%B3%E3%83%90%E3%83%BC%E3%82%AB%E3%83%BC%E3%83%89?src=hash&amp;ref_src=twsrc%5Etfw">#マイナンバーカード</a><a href="https://twitter.com/hashtag/%E3%82%B3%E3%83%B3%E3%83%93%E3%83%8B%E4%BA%A4%E4%BB%98%E5%81%9C%E6%AD%A2?src=hash&amp;ref_src=twsrc%5Etfw">#コンビニ交付停止</a> <a href="https://t.co/KSKLAnZBtr">pic.twitter.com/KSKLAnZBtr</a></p>&mdash; 松永よしひろ 立憲民主党 品川区政担当 (@Matsunaga_1127) <a href="https://twitter.com/Matsunaga_1127/status/1658302051171053576?ref_src=twsrc%5Etfw">May 16, 2023</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

> 同日同時刻（マイクロ秒） まで同一のタイミングで別人がコンビニ交付を行った際にデータが入れ替わる。

「マイクロ秒」・・・なるほど。
この文章から「秒」を「マイクロ秒」に修正しただけだったのでは？という憶測が広まることになったのは、また別の話。

-----

実際どのような修正が行われたのかは不明ですが、
我々の思考実験でも「秒」を「マイクロ秒」に修正したシステムを考えてみましょう。
「マイクロ秒単位のタイムスタンプをIDに使う」ことで問題は解決するでしょうか？

実は解決しません。

### 誕生日のパラドックス再び

秒をマイクロ秒に修正したことで、発行できるIDの件数は100万倍になります。
これなら解決かと思いきや、再び誕生日のパラドックスが現れます。

秒をマイクロ秒に修正して、さきほどのプログラムを実行してみましょう。

```python
n = 60*60*24*365*1000*1000
p = 1.0
for i in range(n):
    p = p * (n - i) / n
    print(i, 1-p)
```

年間661万1972人利用でIDが重複する確率が50%を超えます。
IDの個数は100万倍になったのに、年間利用者数は1000倍程度にしかなっていません。

```
...
6611970 0.49999982540584387
6611971 0.49999993023799294
6611972 0.5000000350701359
6611973 0.5000001399022728
6611974 0.5000002447344034
6611975 0.5000003495665281
...
```

コンビニ証明書の今後の利用者人数推移によっては、まだまだ不安の残る確率です。

### コンピューターの時間精度

また、コンピューターの時間精度が本当にマイクロ秒まであるのか、という問題もあります。
たとえばLinuxのタイマーの精度は、カーネルビルド時の設定によります。

- [Man page of TIME](https://linuxjm.osdn.jp/html/LDP_man-pages/man7/time.7.html)

> タイムアウトを設定したり (例えば select(2), sigtimedwait(2))、 CPU 時間を計測したり (例えば getrusage(2))する様々なシステムコールの精度は ソフトウェアクロック の分解能 (resolution) に制限される。
> ソフトウェアクロックとは、カーネルが管理する jiffy 単位で時間を計測するクロックのことである。 jiffy の大きさはカーネル定数 HZ の値で決定される。 

Linux 2.6.0以降のHZの値は1000らしいので、ミリ秒単位の分解能しかありません。

もっとも、最近（2022年現在）のOSやデバイスは高精度タイマーをサポートしており、たいていマイクロ秒の分解能を持っていると思います。
とは思うのですが、すべての機器でマイクロ秒の分解能を持っている保証はありません。
実際にプログラムを実行する環境で確認することが重要です。

## 解決法

秒をマイクロ秒にかえただけでは解決しないことがわかりました。
ではどうすれば良いでしょう？
解決方法は他にもたくさんあると思いますが、代表的なものを見てみましょう。

### UUID v4

Twitterでは多くのひとが代替としてUUID v4を挙げていました。
UUID v4は122ビットのランダムなビット列をIDとして使います。
衝突が起こるために必要なIDの個数は、期待値で230京回だそうです。

- [UUID v4 - Wikipedia](https://ja.wikipedia.org/wiki/UUID#%E3%83%90%E3%83%BC%E3%82%B8%E3%83%A7%E3%83%B34)
- [UUID(v4) がぶつかる可能性を考えなくていい理由](https://qiita.com/ta_ta_ta_miya/items/1f8f71db3c1bf2dfb7ea)

これだけあれば衝突は考えなくても良いでしょう。

### Snowflake-likeなID

他によく使われるのは[TwitterのSnowflake](https://en.wikipedia.org/wiki/Snowflake_ID)（の変種）でしょうか。
Snowflakeは63ビットのIDで上位41ビットにミリ秒単位のタイムスタンプを埋め込みます。
タイムスタンプが重複したときは、下位12ビットに連番を埋め込むのでIDは重複しません。

- [Snowflake ID - Wikipedia](https://en.wikipedia.org/wiki/Snowflake_ID)
- [Twitter's reference implementation on GitHub](https://github.com/twitter-archive/snowflake/tree/b3f6a3c6ca8e1b6847baa6ff42bf72201e2c2231)

### 連番

川崎市の証明書発行数は年6000件くらいらしいので、この程度の規模なら連番IDも視野に入るでしょう。
たいていのデータベースシステムには連番ID発行機能がついていると思うので、実装も容易です。

## まとめ

「秒単位のタイムスタンプをIDに使う」という設計は「誕生日のパラドックス」により容易に重複してしまうことを説明しました。
UUID v4、Snowflake、連番などを利用し、重複が発生しないよう注意しましょう。

## 参考

- [川崎市様における証明書誤交付ついて（お詫び）](https://www.fujitsu.com/jp/group/fjj/about/resources/news/topics/2023/0509.html)
- [富士通JapanのMICJETで相次ぎ発生した証明書誤交付についてまとめてみた](https://piyolog.hatenadiary.jp/entry/2023/05/22/000742)
- [コンビニエンスストアでの証明書交付サービスの臨時休止について（最終報）](https://www.city.kawasaki.jp/templates/press/250/0000151039.html)
- [誕生日のパラドックス - Wikipedia](https://ja.wikipedia.org/wiki/%E8%AA%95%E7%94%9F%E6%97%A5%E3%81%AE%E3%83%91%E3%83%A9%E3%83%89%E3%83%83%E3%82%AF%E3%82%B9)
- [@Matsunaga_1127 on Twitter](https://twitter.com/Matsunaga_1127/status/1658302051171053576)
- [令和２年度 文教委員会資料⑩](https://www.city.kawasaki.jp/980/cmsfiles/contents/0000116/116489/021119-12.pdf)
- [Man page of TIME](https://linuxjm.osdn.jp/html/LDP_man-pages/man7/time.7.html)
- [time(7) — Linux manual page](https://man7.org/linux/man-pages/man7/time.7.html)
- [UUID v4 - Wikipedia](https://ja.wikipedia.org/wiki/UUID#%E3%83%90%E3%83%BC%E3%82%B8%E3%83%A7%E3%83%B34)
- [UUID(v4) がぶつかる可能性を考えなくていい理由](https://qiita.com/ta_ta_ta_miya/items/1f8f71db3c1bf2dfb7ea)
- [Snowflake ID - Wikipedia](https://en.wikipedia.org/wiki/Snowflake_ID)
- [Twitter's reference implementation on GitHub](https://github.com/twitter-archive/snowflake/tree/b3f6a3c6ca8e1b6847baa6ff42bf72201e2c2231)
