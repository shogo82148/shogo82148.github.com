---
layout: post
title: "Go1.9から使える Monotonic Clocks を試してみた"
slug: go19-monotonic-clock
date: 2017-06-26 09:21:42 +0900
comments: true
categories: [go, golang, time, leapsecond]
---

先日Go1.9beta1がリリースされました。

<blockquote class="twitter-tweet" data-lang="ja"><p lang="en" dir="ltr">Go 1.9 Beta 1 is released!<br><br>Announcement:<a href="https://t.co/lV5nvXwOoR">https://t.co/lV5nvXwOoR</a><br><br>Get it!<a href="https://t.co/2LhlOo2EtX">https://t.co/2LhlOo2EtX</a><a href="https://twitter.com/hashtag/golang?src=hash&amp;ref_src=twsrc%5Etfw">#golang</a> <a href="https://t.co/zm09DwX93q">pic.twitter.com/zm09DwX93q</a></p>&mdash; Go (@golang) <a href="https://twitter.com/golang/status/875117556595515392?ref_src=twsrc%5Etfw">2017年6月14日</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

- [Go 1.9 Release Notes](https://tip.golang.org/doc/go1.9)

型エイリアスのサポート、[math/bits](https://tip.golang.org/pkg/math/bits/)パッケージ、
[sync.Map](https://tip.golang.org/pkg/sync/#Map)型など、
今回のアップデートでも便利そうな機能が追加されます。
詳しくは[tenntenn](https://twitter.com/tenntenn)さんの[Gopher Fest 2017参加レポート](https://www.slideshare.net/takuyaueda967/gopher-fest-2017)をどうぞ。

今回のリリースノートを見て、個人的に注目しているのは**Monotonic Clocksのサポート**です。
他の機能追加はTwitterとかで見かけるけど、
Monotonic Clocksはなぜかあまり見ない・・・。
beta1がでて手軽に試せるようになったので、試してみました。

## Monotonic Clocks

Go1.8以前で取得していた時刻は「wall clock」といい、**現在の正しい時刻**を知るために使います。
一方「monotonic clock」は、**時間を計る**ために使うものです。
Go1.9からは`time.Now`で取得できる時刻に「wall clock」と「monotonic clock」が含まれるようになります。

[timeパッケージのドキュメント](https://tip.golang.org/pkg/time/#hdr-Monotonic_Clocks)から
コード片を引用します。

``` plain
t := time.Now()
... operation that takes 20 milliseconds ...
u := time.Now()
elapsed := t.Sub(u)
```

上のコードで `elapsed` は 20ms となるはずですが、
実際はそうはならないケースがあります。
具体的には以下のようなケースです。

- ntpdなどによってOSの時刻が変更された場合
- うるう秒が挿入・削除された場合

Go1.9からはこのようなケースでも正しく時間を計ることができます。

## うるう秒を入れてみた

うるう秒が入ったときの挙動が気になったので実際にやってみました。
セットアップが簡単になるよう[NICTのPerl版SNTP](http://jjy.nict.go.jp/tsp/link/leap.html)のGolangポートを作ったので、
それを使って偽物のうるう秒を挿入してみます。

- [shogo82148/fakentpd](https://github.com/shogo82148/fakentpd)

インストールはいつものように`go get`です。
`-p`オプションで正のうるう秒挿入、`-n`オプションで負のうるう秒削除です(ほんとうは月末だけだけど、雑な実装のため毎日その日の終わりに挿入・削除されます)。
引数にRFC3339形式で日時を指定すると、その日時を起動時の日時として扱います。

たとえば今月末に正のうるう秒を挿入するには以下のように指定します。

``` bash
# 上位ntpd側
$ go get github.com/shogo82148/fakentpd
$ sudo fakentpd -p 2017-06-30T23:00:00Z # well known portを使うのでroot権限が必要
```

このSNTPサーバーを上位ntpdとして参照したクライアントを用意し、`date`コマンドで様子を確認してみましょう。
(ntpdの設定などの詳細は[tkuchikiさんのうるう秒検証記事](http://tkuchiki.hatenablog.com/entry/2015/06/19/083025) を参照)

``` bash
# 下位ntpd側
$ while :; do date +'%Y-%m-%d %H:%M:%S.%3N'; usleep 100000; done
```


``` plain
(前略)
2017-06-30 23:59:59.040
2017-06-30 23:59:59.141
2017-06-30 23:59:59.243
2017-06-30 23:59:59.344
2017-06-30 23:59:59.445
2017-06-30 23:59:59.547
2017-06-30 23:59:59.648
2017-06-30 23:59:59.749
2017-06-30 23:59:59.851
2017-06-30 23:59:59.952 #
2017-06-30 23:59:59.053 # うるう秒挿入！
2017-06-30 23:59:59.155
2017-06-30 23:59:59.256
2017-06-30 23:59:59.357
2017-06-30 23:59:59.458
2017-06-30 23:59:59.559
2017-06-30 23:59:59.661
2017-06-30 23:59:59.762
2017-06-30 23:59:59.863
2017-06-30 23:59:59.964
2017-07-01 00:00:00.066
```

うるう秒が挿入されたため、59.952から59.053へ時間が巻き戻っていることが確認できます。

これと同等のプログラムをGoで書いて挙動を確認します。
monotonic clockの確認をするために、一緒に起動時からの経過時間も表示するようにしました。

``` go
package main

import (
	"fmt"
	"time"
)

func main() {
	start := time.Now()
	for {
		now := time.Now()
		fmt.Println(now, now.Sub(start))
		time.Sleep(100 * time.Millisecond)
	}
}
```

`date`コマンドで検証したときと同様の条件で、
このプログラムを**Go1.8で実行**すると以下のような結果になりました。

``` plain
(前略)
2017-06-30 23:59:59.038281905 +0000 UTC 32m42.970735711s
2017-06-30 23:59:59.138469005 +0000 UTC 32m43.070922811s
2017-06-30 23:59:59.238662875 +0000 UTC 32m43.171116681s
2017-06-30 23:59:59.338835875 +0000 UTC 32m43.271289681s
2017-06-30 23:59:59.439025825 +0000 UTC 32m43.371479631s
2017-06-30 23:59:59.539213666 +0000 UTC 32m43.471667472s
2017-06-30 23:59:59.63940551 +0000 UTC 32m43.571859316s
2017-06-30 23:59:59.739603502 +0000 UTC 32m43.672057308s
2017-06-30 23:59:59.839783301 +0000 UTC 32m43.772237107s
2017-06-30 23:59:59.939980591 +0000 UTC 32m43.872434397s #
2017-06-30 23:59:59.043820722 +0000 UTC 32m42.976274528s # うるう秒挿入！
2017-06-30 23:59:59.143987505 +0000 UTC 32m43.076441311s
2017-06-30 23:59:59.244160716 +0000 UTC 32m43.176614522s
2017-06-30 23:59:59.344336707 +0000 UTC 32m43.276790513s
2017-06-30 23:59:59.444546067 +0000 UTC 32m43.376999873s
2017-06-30 23:59:59.544717014 +0000 UTC 32m43.47717082s
2017-06-30 23:59:59.644876123 +0000 UTC 32m43.577329929s
2017-06-30 23:59:59.745050732 +0000 UTC 32m43.677504538s
2017-06-30 23:59:59.845230425 +0000 UTC 32m43.777684231s
2017-06-30 23:59:59.945421532 +0000 UTC 32m43.877875338s
2017-07-01 00:00:00.045595155 +0000 UTC 32m43.978048961s
```

うるう秒が挿入されたため、59.9から59.0に時刻が巻き戻っていることが確認できます。
それと同時に経過時刻も32m43.87sから32m42.97sと巻き戻ってしまいました。

おなじプログラムをGo1.9で実行してみます。

``` plain
(前略)
2017-06-30 23:59:59.038322917 +0000 UTC m=+1962.019889237 32m42.01969158s
2017-06-30 23:59:59.138507805 +0000 UTC m=+1962.120074107 32m42.11987645s
2017-06-30 23:59:59.238704422 +0000 UTC m=+1962.220270727 32m42.22007307s
2017-06-30 23:59:59.338875317 +0000 UTC m=+1962.320441617 32m42.32024396s
2017-06-30 23:59:59.439066666 +0000 UTC m=+1962.420632996 32m42.420435339s
2017-06-30 23:59:59.539255964 +0000 UTC m=+1962.520822264 32m42.520624607s
2017-06-30 23:59:59.639446597 +0000 UTC m=+1962.621012897 32m42.62081524s
2017-06-30 23:59:59.739644525 +0000 UTC m=+1962.721210832 32m42.721013175s
2017-06-30 23:59:59.839827168 +0000 UTC m=+1962.821393501 32m42.821195844s
2017-06-30 23:59:59.94003045 +0000 UTC m=+1962.921596780 32m42.921399123s #
2017-06-30 23:59:59.043859649 +0000 UTC m=+1963.025425981 32m43.025228324s # うるう秒挿入！
2017-06-30 23:59:59.144008957 +0000 UTC m=+1963.125575282 32m43.125377625s
2017-06-30 23:59:59.244196844 +0000 UTC m=+1963.225763148 32m43.225565491s
2017-06-30 23:59:59.344388476 +0000 UTC m=+1963.325954758 32m43.325757101s
2017-06-30 23:59:59.444598162 +0000 UTC m=+1963.426164679 32m43.425967022s
2017-06-30 23:59:59.54473741 +0000 UTC m=+1963.526303708 32m43.526106051s
2017-06-30 23:59:59.644895019 +0000 UTC m=+1963.626461309 32m43.626263652s
2017-06-30 23:59:59.745084175 +0000 UTC m=+1963.726650464 32m43.726452807s
2017-06-30 23:59:59.845264185 +0000 UTC m=+1963.826830509 32m43.826632852s
2017-06-30 23:59:59.94546352 +0000 UTC m=+1963.927029829 32m43.926832172s
2017-07-01 00:00:00.04563023 +0000 UTC m=+1964.027196518 32m44.026998861s
```

うるう秒が挿入されるとwall clockは59.9から59.0に時刻が巻き戻っています。
しかし経過時刻は32m42.9から32m43.0と巻き戻りは発生していません。

Go1.9から`t.String()`がmonotonic clockの情報を返すようになるので、今回の検証ログにも表示されています。
monotonic clockも m=+1962.921596780 から m=+1963.025425981 と巻き戻りは発生していません。
(mの意味はよくわかってないけどプロセスの起動時間？)


## 時刻を変えてみた

検証用のfakentpdを止めて本物の上位ntpdを復活させると、
時刻の差が大きいため元の時刻に一気に修正されます。
この場合についても試してみました。

Go1.8で実行した場合。
時刻が戻ると同時に経過時間が-144hとおかしな値になってしまいました。

``` plain
(前略)
2017-07-01 00:30:20.802110381 +0000 UTC 4m52.493894502s
2017-07-01 00:30:20.9022538 +0000 UTC 4m52.594037921s
2017-07-01 00:30:21.002404752 +0000 UTC 4m52.694188873s #
2017-06-24 23:41:17.694698679 +0000 UTC -144h44m10.6135172s # 正しい時刻に戻った
2017-06-24 23:41:17.794881161 +0000 UTC -144h44m10.513334718s
2017-06-24 23:41:17.895024223 +0000 UTC -144h44m10.413191656s
```


Go1.9で実行した場合です。
wall clockは正しい時刻に戻りましたが、monotonic clockはその影響を受けず、
経過時間も正しく計算できています。

``` plain
2017-07-01 00:30:20.802071152 +0000 UTC m=+289.102414299 4m49.102265199s
2017-07-01 00:30:20.902234666 +0000 UTC m=+289.202577610 4m49.20242851s
2017-07-01 00:30:21.00238566 +0000 UTC m=+289.302728596 4m49.302579496s #
2017-06-24 23:41:17.694655753 +0000 UTC m=+289.402903206 4m49.402754106s # 正しい時刻に戻った
2017-06-24 23:41:17.794841932 +0000 UTC m=+289.503089435 4m49.502940335s
2017-06-24 23:41:17.895004891 +0000 UTC m=+289.603252211 4m49.603103111s
```


## ドリフトしてみた

monotonic time は ntpd の干渉を全く受けないわけではなく、
ドリフトの補正は受けます。
せっかくなのでこれも確認してみました。

以下のコマンドで500PPM(Parts-per-Million)早く時刻が進むntpdとして動作します。
1PPMは100万分の1の誤差なので、500PPMでは2000秒(約33分)で1秒ズレます。

``` bash
$ sudo fakentpd -d 500
```

(ほんとうは2倍速！とかやってみたかったけど、さすがに偽ntpdだとバレて同期対象から外された)

起動からの経過時間を返すサーバーと、
サーバーとの時刻を比較するクライアントを用意します。

``` go
package main

import (
	"fmt"
	"log"
	"net/http"
	"time"
)

func main() {
	start := time.Now()
	http.HandleFunc("/", func(w http.ResponseWriter, req *http.Request) {
		// 起動からの経過時間を返す
		fmt.Fprintf(w, "%.6f", time.Since(start).Seconds())
		log.Printf("%.6f", time.Since(start).Seconds())
	})
	http.ListenAndServe(":8080", nil)
}
```

``` go
package main

import (
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"
)

// サーバー側の経過時間を取得する
func get(u string) float64 {
	resp, _ := http.Get(u)
	defer resp.Body.Close()
	data, _ := ioutil.ReadAll(resp.Body)
	t, _ := strconv.ParseFloat(string(data), 64)
	return t
}

func main() {
	start := time.Now()
	startRemote := get(os.Args[1])
	for {
		time.Sleep(time.Second)
		end := time.Now()
		endRemote := get(os.Args[1])
		log.Printf("local:  %.6f", end.Sub(start).Seconds())
		log.Printf("remote: %.6f", endRemote-startRemote)
	}
}
```

ドリフト補正が反映されるよう数時間同期状態を保ったあと、
検証用プログラムを走らせると以下のような結果になりました。

``` plain
(前略)
2017/06/25 08:34:27 local:  1997.178992
2017/06/25 08:34:27 remote: 1998.176471
2017/06/25 08:34:28 local:  1998.179892
2017/06/25 08:34:28 remote: 1999.177970
2017/06/25 08:34:29 local:  1999.180993
2017/06/25 08:34:29 remote: 2000.179569
2017/06/25 08:34:30 local:  2000.182062
2017/06/25 08:34:30 remote: 2001.181200
```

起動から2000秒で1秒のズレ＝500PPMのドリフトがかかっていることが確認できました。


## まとめ

Go1.9からサポートされるmonotonic clockについて検証を行いました。
うるう秒や時刻変更の影響を受けず、正しく経過時間を測定できることが確認できました。
また、ドリフトの調整は受けることも確認できました。

monotonic clockになると、methaneさんが紹介している[zero time cache](http://dsas.blog.klab.org/archives/2016-09-20/isucon5q.html)の
実用性があがって利用しやすくなりますね。
さらに[Cloudflare DNSがうるう秒にやられる](https://blog.cloudflare.com/how-and-why-the-leap-second-affected-cloudflare-dns/)
こともなくなるので安心です。

注意点としては`t.String()`がmonotonic clockの情報を返すので、
時刻の出力を雑に`fmt.Println(t)`とかしていると出力が変わってしまうことくらいでしょうか。
(皆さんちゃんとFormatしてますよね？)

もうすぐ来年1月1日のうるう秒の有無が発表される時期です。
それまでにはGo1.9の正式版がリリースされているはずなので、
変な罠に引っかからないよう皆さんアップデートしましょう！


## 参考

- [Gopher Fest 2017参加レポート](http://tech.mercari.com/entry/gopherfest2017_report)
- [Gopher Fest 2017参加レポート(スライド)](https://www.slideshare.net/takuyaueda967/gopher-fest-2017)

<iframe src="//www.slideshare.net/slideshow/embed_code/key/ebzs4FaAdpQVst" width="595" height="485" frameborder="0" marginwidth="0" marginheight="0" scrolling="no" style="border:1px solid #CCC; border-width:1px; margin-bottom:5px; max-width: 100%;" allowfullscreen> </iframe> <div style="margin-bottom:5px"> <strong> <a href="//www.slideshare.net/takuyaueda967/gopher-fest-2017" title="Gopher Fest 2017参加レポート" target="_blank">Gopher Fest 2017参加レポート</a> </strong> from <strong><a href="https://www.slideshare.net/takuyaueda967" target="_blank">Takuya Ueda</a></strong> </div>

- [うるう秒とコンピュータクロック | NICT](http://jjy.nict.go.jp/tsp/link/leap.html)
- [NTP設定](http://d.hatena.ne.jp/incarose86/20110505/1312522379)
- [2015年うるう秒の検証方法と検証結果 (Amazon Linux, CentOS)](http://tkuchiki.hatenablog.com/entry/2015/06/19/083025)
- [Leap Second Insertion フラグを受信後にそのフラグを削除する](https://access.redhat.com/ja/node/1362753)
- [RFC2030 参考訳 IPv4・IPv6・OSI用簡易ネットワーク時刻プロトコル（SNTP）Version 4](http://www.geocities.co.jp/SiliconValley/6876/rfc2030j.htm)
- [RFC2030  Simple Network Time Protocol (SNTP) Version 4 for IPv4, IPv6 and OSI](https://tools.ietf.org/html/rfc2030)
- [ISUCON6予選をトップ通過しました](http://dsas.blog.klab.org/archives/2016-09-20/isucon5q.html)
    - zero time cache について紹介されています
- [How and why the leap second affected Cloudflare DNS](https://blog.cloudflare.com/how-and-why-the-leap-second-affected-cloudflare-dns/)
