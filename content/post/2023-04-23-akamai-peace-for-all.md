---
layout: post
title: "RE: Akamai x UNIQLOコラボTシャツに書かれたプログラムを解読してみる"
slug: 2023-04-23-akamai-peace-for-all
date: 2023-04-23 17:00:00 +0900
comments: true
categories: [ go ]
---

CDNサービスで有名な[Akamai](https://www.akamai.com/ja)がユニクロとコラボしてTシャツを作りました。

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">本日、Akamaiは <a href="https://twitter.com/UNIQLO_JP?ref_src=twsrc%5Etfw">@UNIQLO_JP</a> のチャリティTシャツプロジェクト「PEACE FOR ALL」に参画したことを発表4月21日(金)より グローバルで発売されます。このデザインには人々の安全、安心を守りたいというAkamaiの願いが込められています。<a href="https://t.co/HVxINmoEzd">https://t.co/HVxINmoEzd</a><a href="https://twitter.com/hashtag/AkamaiPeaceForAll?src=hash&amp;ref_src=twsrc%5Etfw">#AkamaiPeaceForAll</a> <a href="https://twitter.com/hashtag/Uniqlo?src=hash&amp;ref_src=twsrc%5Etfw">#Uniqlo</a> <a href="https://twitter.com/hashtag/%E3%82%A2%E3%82%AB%E3%83%9E%E3%82%A4?src=hash&amp;ref_src=twsrc%5Etfw">#アカマイ</a> <a href="https://t.co/dIS9YOQVZM">pic.twitter.com/dIS9YOQVZM</a></p>&mdash; アカマイ･テクノロジーズ (@akamai_jp) <a href="https://twitter.com/akamai_jp/status/1646709997726838786?ref_src=twsrc%5Etfw">April 14, 2023</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script> 

完全に二番煎じですが、Tシャツに描かれたコードを解読してみます。

- [Akamai x UNIQLOコラボTシャツに書かれたプログラムを解読してみる](https://kurochan-note.hatenablog.jp/entry/2023/04/22/101741)

## 解読してみる

Tシャツに描かれたこのコード、PEACE FOR ALLに参画するために作られたのではなく、企業ブランドの一部として作られたもののようです。
[Akamai](https://www.akamai.com/ja)のウェブページをよく見てみると、背景にも同じコードが使われています。

コードの文脈をまったく意識せず切り貼りしたため、Tシャツのデザインでは失われてしまった部分があります（内容を理解できる人間にとってはちょっと残念）。
しかし、営業資料っぽいPDFに同じコードが利用されており、ここからなら十分に復元可能です。

- [クラウド投資のリターンを最大化 - Akamai](https://www.akamai.com/site/ja/documents/ebook/maximizing-return-on-cloud-investments.pdf)
- [EコーマスEマガジン](https://www.akamai.com/site/ja/documents/white-paper/retail-reimagined-japan-issue-2.pdf)

行ごとに分割して、同じ文字列が出現する箇所をつなぎ合わせると、以下のようなコードが浮かび上がります。

```go
package main; import ( "fmt"; "html"; "log"; "net/http"; "strconv"; "strings"; "time" ); type ControlMessage struct { Target string; Count int64; }; func main() { controlChannel := make(chan ControlMessage);workerCompleteChan := make(chan bool); statusPollChannel := make(chan chan bool); workerActive := false;go admin(controlChannel, statusPollChannel); for { select { case respChan := <- statusPollChannel: respChan <- workerActive; case msg := <-controlChannel: workerActive = true; go doStuff(msg, workerCompleteChan); case status := <- workerCompleteChan: workerActive = status; }}}; func admin(cc chan ControlMessage, statusPollChannel chan chan bool) {http.HandleFunc("/admin", func(w http.ResponseWriter, r *http.Request) { hostTokens := strings.Split(r.Host, ":"); r.ParseForm(); count, err := strconv.ParseInt(r.FormValue("count"), 10, 64); if err != nil { fmt.Fprintf(w, err.Error()); return; }; msg := ControlMessage{Target: r.FormValue("target"), Count: count}; cc <- msg; fmt.Fprintf(w, "Control message issued for Target %s, count %d", html.EscapeString(r.FormValue("target")), count); }); http.HandleFunc("/status",func(w http.ResponseWriter, r *http.Request) { reqChan := make(chan bool); statusPollChannel <- reqChan;timeout := time.After(time.Second); select { case result := <- reqChan: if result { fmt.Fprint(w, "ACTIVE"); } else { fmt.Fprint(w, "INACTIVE"); }; return; case <- timeout: fmt.Fprint(w, "TIMEOUT");}}); log.Fatal(http.ListenAndServe(":1337", nil)); };
```

Goにしてはセミコロン（`;`）がたくさんあるのは、おそらくコードを一行にまとめるためでしょう。
本来各ステートメントはセミコロンで区切る必要がありますが、自動的にセミコロンを補完してくれる仕様があります。

- [Semicolons - The Go Programming Language Specification](https://go.dev/ref/spec#Semicolons)

普段見るGoのコードでセミコロンが少ないのは、この仕様のおかげでセミコロンを省略できているからです。
The code textureのようにセミコロンを省略せずに書くこともできます。

## 整形してみる

省略可能なセミコロンを明示的に書いているだけで、The code textureのコードは文法としては有効です。
実際 `go fmt` で整形できます。

```go
package main

import (
	"fmt"
	"html"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type ControlMessage struct {
	Target string
	Count  int64
}

func main() {
	controlChannel := make(chan ControlMessage)
	workerCompleteChan := make(chan bool)
	statusPollChannel := make(chan chan bool)
	workerActive := false
	go admin(controlChannel, statusPollChannel)
	for {
		select {
		case respChan := <-statusPollChannel:
			respChan <- workerActive
		case msg := <-controlChannel:
			workerActive = true
			go doStuff(msg, workerCompleteChan)
		case status := <-workerCompleteChan:
			workerActive = status
		}
	}
}
func admin(cc chan ControlMessage, statusPollChannel chan chan bool) {
	http.HandleFunc("/admin", func(w http.ResponseWriter, r *http.Request) {
		hostTokens := strings.Split(r.Host, ":")
		r.ParseForm()
		count, err := strconv.ParseInt(r.FormValue("count"), 10, 64)
		if err != nil {
			fmt.Fprintf(w, err.Error())
			return
		}
		msg := ControlMessage{Target: r.FormValue("target"), Count: count}
		cc <- msg
		fmt.Fprintf(w, "Control message issued for Target %s, count %d", html.EscapeString(r.FormValue("target")), count)
	})
	http.HandleFunc("/status", func(w http.ResponseWriter, r *http.Request) {
		reqChan := make(chan bool)
		statusPollChannel <- reqChan
		timeout := time.After(time.Second)
		select {
		case result := <-reqChan:
			if result {
				fmt.Fprint(w, "ACTIVE")
			} else {
				fmt.Fprint(w, "INACTIVE")
			}
			return
		case <-timeout:
			fmt.Fprint(w, "TIMEOUT")
		}
	})
	log.Fatal(http.ListenAndServe(":1337", nil))
}
```

## コンパイルしてみる

しかし残念なことにコンパイルは通りません。
以下のようなエラーが出ます。

```plain
% go run main.go
# command-line-arguments
./main.go:30:7: undefined: doStuff
./main.go:38:3: hostTokens declared and not used
```

コンパイルが通るように最低限を変更を加えます。

```diff
@@ -36,6 +36,7 @@
 func admin(cc chan ControlMessage, statusPollChannel chan chan bool) {
 	http.HandleFunc("/admin", func(w http.ResponseWriter, r *http.Request) {
 		hostTokens := strings.Split(r.Host, ":")
+		_ = hostTokens // hostTokensは使われていないが、コンパイルエラーにならないようにするために代入している
 		r.ParseForm()
 		count, err := strconv.ParseInt(r.FormValue("count"), 10, 64)
 		if err != nil {
@@ -64,3 +65,8 @@
 	})
 	log.Fatal(http.ListenAndServe(":1337", nil))
 }
+
+// doStuffが未定義なので追加
+func doStuff(msg ControlMessage, workerCompleteChan chan bool) {
+	log.Println("Target:", msg.Target, "Count:", msg.Count)
+}
```

できあがったコードはこちら。

```go
package main

import (
	"fmt"
	"html"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type ControlMessage struct {
	Target string
	Count  int64
}

func main() {
	controlChannel := make(chan ControlMessage)
	workerCompleteChan := make(chan bool)
	statusPollChannel := make(chan chan bool)
	workerActive := false
	go admin(controlChannel, statusPollChannel)
	for {
		select {
		case respChan := <-statusPollChannel:
			respChan <- workerActive
		case msg := <-controlChannel:
			workerActive = true
			go doStuff(msg, workerCompleteChan)
		case status := <-workerCompleteChan:
			workerActive = status
		}
	}
}
func admin(cc chan ControlMessage, statusPollChannel chan chan bool) {
	http.HandleFunc("/admin", func(w http.ResponseWriter, r *http.Request) {
		hostTokens := strings.Split(r.Host, ":")
		_ = hostTokens // hostTokensは使われていないが、コンパイルエラーにならないようにするために代入している
		r.ParseForm()
		count, err := strconv.ParseInt(r.FormValue("count"), 10, 64)
		if err != nil {
			fmt.Fprintf(w, err.Error())
			return
		}
		msg := ControlMessage{Target: r.FormValue("target"), Count: count}
		cc <- msg
		fmt.Fprintf(w, "Control message issued for Target %s, count %d", html.EscapeString(r.FormValue("target")), count)
	})
	http.HandleFunc("/status", func(w http.ResponseWriter, r *http.Request) {
		reqChan := make(chan bool)
		statusPollChannel <- reqChan
		timeout := time.After(time.Second)
		select {
		case result := <-reqChan:
			if result {
				fmt.Fprint(w, "ACTIVE")
			} else {
				fmt.Fprint(w, "INACTIVE")
			}
			return
		case <-timeout:
			fmt.Fprint(w, "TIMEOUT")
		}
	})
	log.Fatal(http.ListenAndServe(":1337", nil))
}

// doStuffが未定義なので追加
func doStuff(msg ControlMessage, workerCompleteChan chan bool) {
	log.Println("Target:", msg.Target, "Count:", msg.Count)
}
```

ここまで来れば実行する事もできます。
`/admin`にリクエストを投げると、バックグランドで処理を実行。
`/status`で処理の状況確認です。

```console
% go run main.go
% curl -d count=10 -d target=hoge http://localhost:1337/admin
Control message issued for Target hoge, count 10
% curl http://localhost:1337/status
ACTIVE
```

## The code texture

このコードについて調べてみたら、利用ガイドラインがありました。

- [Akamai Brand Guide for Third-Party Use](https://www.akamai.com/site/ja/documents/akamai/akamai-brand-guide-for-third-party-use.pdf)

リリース文だけ読んで「"texture"という名前のコード」かと思ってましたが、ガイドラインを読むと「"The code texture"という名前の画像」みたいですね。
「The code texture」＝「Akamaiが指定したコードを、Akamaiが指定したフォントで、Akamaiが指定した色を使って、レンダリングした結果の画像」というわけです。

## PEACE FOR ALL

コードの色の変わっている部分については、紹介動画でバッチリ言ってました。

<iframe width="560" height="315" src="https://www.youtube.com/embed/jfKEm5_0BNo" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>

> And on the front, you see some code.
> And this is actual code that is taken from some of our solutions to defend against attackers.
> And you see we've highlighted some of the letters in the code that spell peace for all.
>
> 全面にはコードが描かれています。
> 攻撃者から守るために当社の製品で実際に使われているコードを引用しました。
> peace for allを表すいくつかの文字をハイライトしました。

## まとめ

- Akamai x UNIQLOコラボTシャツに書かれたプログラムを解読してみました
- このコラボのために作られたコードではなく、もともとAkamaiがブランドイメージに使っていた画像

Gopherのひとりとしては、Tシャツにデザインされる過程で、不完全なコードになってしまったのが残念ですね。
せっかくならコンパイルできてほしかった。

## 参考

- [Akamai](https://www.akamai.com/ja)
- [twitter.com/akamai_jp/status/1646709997726838786](https://twitter.com/akamai_jp/status/1646709997726838786?s=20)
- [UNIQLO PEACE FOR ALL](https://www.uniqlo.com/us/en/contents/feature/peace-for-all/)
- [Akamai x UNIQLOコラボTシャツに書かれたプログラムを解読してみる](https://kurochan-note.hatenablog.jp/entry/2023/04/22/101741)
- [Akamai、ユニクロのチャリティTシャツプロジェクト「PEACE FOR ALL」に参画](https://prtimes.jp/main/html/rd/p/000000171.000031697.html)
- [Peace for All | Akamai and Uniqlo](https://www.youtube.com/watch?v=jfKEm5_0BNo)
- [Akamai Brand Guide for Third-Party Use](https://www.akamai.com/site/ja/documents/akamai/akamai-brand-guide-for-third-party-use.pdf)
- [クラウド投資のリターンを最大化 - Akamai](https://www.akamai.com/site/ja/documents/ebook/maximizing-return-on-cloud-investments.pdf)
- [EコーマスEマガジン - Akamai](https://www.akamai.com/site/ja/documents/white-paper/retail-reimagined-japan-issue-2.pdf)
- [Semicolons - The Go Programming Language Specification](https://go.dev/ref/spec#Semicolons)
