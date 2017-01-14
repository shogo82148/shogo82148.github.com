---
layout: post
title: "Re:golang の http.Client を速くする"
date: 2017-01-14 17:02:12 +0900
comments: true
categories: golang
---

先日[mattn](https://twitter.com/mattn_jp)さんの記事を読みました。

- [golang の http.Client を速くする](http://mattn.kaoriya.net/software/lang/go/20170112181052.htm)

[nett](https://github.com/abursavich/nett)というパッケージを使って
名前解決の結果をキャッシュすることで、`http.Client`を早くするというものです。
この記事に関して、ちょっと疑問に思ったことがあったので、検証してみました。

<!-- More -->

## 疑問

疑問に思ったのは以下の点です。

### 名前解決遅すぎでは？

ベンチマークの結果を見ると5億ns(=500ms)ほど速度が改善しています。
3つのURLに対してリクエストを投げているので、初回を除く2回DNSのキャッシュがヒットし、
名前解決2回分の速度改善になるはずです。
と、いうことは、名前解決1回あたり250msかかっている計算になります。
googleのsearchは302でリダイレクトがかかるので、`Client.Get`の呼び出し1回あたり2回リクエストが飛ぶ、
ということを計算に入れても100msほどかかる計算です。

Google先生の謎テクノロジーによってかなりの最適化がされているはずですし、
ネットワークプロバイダのDNSキャッシュにヒットする可能性も高いでしょう。
**名前解決程度にこんなに時間がかかっていたらスプラトゥーンが出来ない！**
(mattnさんがスプラトゥーンをプレイしているかは知らない)

もちろん、ネットワークが混雑していたり、
モバイルネットワークを利用していたり、という可能性もありますが、
ちょっと不自然な印象を受けました。


### Keep-Aliveされてるのでは？

スキーマがhttpsになっているので、Google先生相手ならHTTP2で通信していてもおかしくありません。
HTTP2は基本的にドメイン毎にコネクションを1つだけ張って、それを使いまわします。
もし仮にHTTP1.1で通信していたとしても、`http.Client`はデフォルトでKeep-Aliveが有効になっているので、
普通に使うとコネクションを再利用してくれます。

そういうわけで、名前解決以前にそもそもTCPのコネクション確立もスキップされている可能性が高いのでは？
と思ったわけです。
この予想が正しければ、名前解決は初回リクエストでしか行われないので、ベンチマークに差はでないはずです。


## HTTPリクエストの様子をトレースしてみる

これらの疑問を解消するために、HTTPリクエストの様子をさらに詳細に解析してみることにしました。

### DNSキャッシュなし版をトレースする

Go1.7から[net/http/httptrace](https://golang.org/pkg/net/http/httptrace/)というパッケージが追加され、
名前解決やコネクション確立etcのタイミングにフックを仕込めるようになりました。
これを利用すれば各段階でどの程度時間がかかっているかが具体的に分かるはずです。

頑張って自前でフックを差し込んでもよいのですが、
[deeeet](https://twitter.com/deeeet)さんの[go-httpstat](https://github.com/tcnksm/go-httpstat)という便利パッケージがあるので、
これをありがたく利用させていただきます。
go-httpstatを使うと時間計測を行うコードを簡単に差し込むことができます。

``` go
package main

import (
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"time"

	"github.com/tcnksm/go-httpstat"
)

var (
	urls = []string{
		"https://shogo82148.github.io/blog/2016/12/20/redis-fast-0-dot-19-released/",
		"https://shogo82148.github.io/blog/2016/12/15/leap-second-in-datetime-dot-pm/",
		"https://shogo82148.github.io/blog/2016/11/23/qr-code/",
	}
)

func main() {
	client := &http.Client{
		Transport: &http.Transport{
			Proxy:             http.ProxyFromEnvironment,
			// DisableKeepAlives: true,
		},
	}

	for _, url := range urls {
		log.Printf("GET %s", url)

		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			panic(err)
		}
		result := new(httpstat.Result)
		ctx := httpstat.WithHTTPStat(req.Context(), result)
		req = req.WithContext(ctx)

		resp, err := client.Do(req)
		if err != nil {
			panic(err)
		}
		io.Copy(ioutil.Discard, resp.Body)
		resp.Body.Close()

		result.End(time.Now())
		log.Printf("%+v\n", result)
	}
}
```

元記事はGoogleを叩いていましたが、あのURLだとリダイレクトが発生して考えることが増えそうなので、
このブログのURLに変更してあります。
あと静的ページなら相手に余計な負荷をかけることも無いですしね。

さっそく実行してみましょう。
**Keep-Aliveを有効**にした場合の結果です。

``` plain
2017/01/14 16:14:10 GET https://shogo82148.github.io/blog/2016/12/20/redis-fast-0-dot-19-released/
2017/01/14 16:14:10 DNS lookup:          30 ms
TCP connection:      16 ms
TLS handshake:      130 ms
Server processing:   17 ms
Content transfer:     1 ms
Name Lookup:      30 ms
Connect:          47 ms
Pre Transfer:    177 ms
Start Transfer:  195 ms
Total:           197 ms
2017/01/14 16:14:10 GET https://shogo82148.github.io/blog/2016/12/15/leap-second-in-datetime-dot-pm/
2017/01/14 16:14:10 DNS lookup:           0 ms
TCP connection:       0 ms
TLS handshake:        0 ms
Server processing:   17 ms
Content transfer:     2 ms
Name Lookup:       0 ms
Connect:           0 ms
Pre Transfer:      0 ms
Start Transfer:   17 ms
Total:            19 ms
2017/01/14 16:14:10 GET https://shogo82148.github.io/blog/2016/11/23/qr-code/
2017/01/14 16:14:10 DNS lookup:           0 ms
TCP connection:       0 ms
TLS handshake:        0 ms
Server processing:   17 ms
Content transfer:     4 ms
Name Lookup:       0 ms
Connect:           0 ms
Pre Transfer:      0 ms
Start Transfer:   17 ms
Total:            22 ms
```

二回目以降のDNS lookupやTCP connectionが0msになっています。
予想通りコネクションが再利用され、名前解決やコネクション確立がスキップされているようです。

次に**Keep-Aliveを無効**にした状態で実行してみます。
コード中の`DisableKeepAlives`のコメントを外すと都度接続になります。

``` plain
2017/01/14 16:14:33 GET https://shogo82148.github.io/blog/2016/12/20/redis-fast-0-dot-19-released/
2017/01/14 16:14:33 DNS lookup:          21 ms
TCP connection:      18 ms
TLS handshake:      131 ms
Server processing:   15 ms
Content transfer:     1 ms
Name Lookup:      21 ms
Connect:          40 ms
Pre Transfer:    171 ms
Start Transfer:  187 ms
Total:           188 ms
2017/01/14 16:14:33 GET https://shogo82148.github.io/blog/2016/12/15/leap-second-in-datetime-dot-pm/
2017/01/14 16:14:33 DNS lookup:           1 ms
TCP connection:      15 ms
TLS handshake:       33 ms
Server processing:   14 ms
Content transfer:     1 ms
Name Lookup:       1 ms
Connect:          16 ms
Pre Transfer:     49 ms
Start Transfer:   64 ms
Total:            65 ms
2017/01/14 16:14:33 GET https://shogo82148.github.io/blog/2016/11/23/qr-code/
2017/01/14 16:14:33 DNS lookup:           0 ms
TCP connection:      17 ms
TLS handshake:       35 ms
Server processing:   19 ms
Content transfer:     3 ms
Name Lookup:       0 ms
Connect:          18 ms
Pre Transfer:     54 ms
Start Transfer:   73 ms
Total:            76 ms
```

リクエスト毎に名前解決が行われるようになりました。
ですが、初回に比べて異様に速いですね。
OS側でキャッシュされてるんでしょうか。

`GODEBUG=netdns=go`と環境変数を設定すると、Pure Golangで名前解決が行われるらしいので、
その場合の結果も貼っておきます。

``` plain
2017/01/14 16:15:03 GET https://shogo82148.github.io/blog/2016/12/20/redis-fast-0-dot-19-released/
2017/01/14 16:15:03 DNS lookup:          33 ms
TCP connection:      15 ms
TLS handshake:      133 ms
Server processing:   16 ms
Content transfer:     0 ms
Name Lookup:      33 ms
Connect:          48 ms
Pre Transfer:    181 ms
Start Transfer:  197 ms
Total:           198 ms
2017/01/14 16:15:03 GET https://shogo82148.github.io/blog/2016/12/15/leap-second-in-datetime-dot-pm/
2017/01/14 16:15:03 DNS lookup:          17 ms
TCP connection:      14 ms
TLS handshake:       32 ms
Server processing:   19 ms
Content transfer:     0 ms
Name Lookup:      17 ms
Connect:          31 ms
Pre Transfer:     63 ms
Start Transfer:   82 ms
Total:            83 ms
2017/01/14 16:15:03 GET https://shogo82148.github.io/blog/2016/11/23/qr-code/
2017/01/14 16:15:03 DNS lookup:          18 ms
TCP connection:      15 ms
TLS handshake:       36 ms
Server processing:   18 ms
Content transfer:     2 ms
Name Lookup:      18 ms
Connect:          34 ms
Pre Transfer:     70 ms
Start Transfer:   89 ms
Total:            91 ms
```

### DNSキャッシュあり版をトレースする

DNSキャッシュありも同様にトレースしようと思ったのですが、
残念ながら[nett](https://github.com/abursavich/nett)は`context.Context`を引数に持つインターフェースをサポートしていません。
httptraceを利用するにはcontextが必要なので、同じ方法は使えません。

仕方がないので、頑張ってResolverを自作して、
時間計測するコードを埋め込んでいきます。

``` go
package main

import (
	"io"
	"io/ioutil"
	"log"
	"net"
	"net/http"
	"time"

	"github.com/abursavich/nett"
)

var (
	urls = []string{
		"https://shogo82148.github.io/blog/2016/12/20/redis-fast-0-dot-19-released/",
		"https://shogo82148.github.io/blog/2016/12/15/leap-second-in-datetime-dot-pm/",
		"https://shogo82148.github.io/blog/2016/11/23/qr-code/",
	}
)

type MyResolver struct {
	Resolver nett.Resolver
}

func (r *MyResolver) Resolve(host string) ([]net.IP, error) {
	start := time.Now()
	ips, err := r.Resolver.Resolve(host)
	log.Printf("Name Lookup: %s", time.Now().Sub(start))
	return ips, err
}

func main() {
	dialer := &nett.Dialer{
		Resolver: &MyResolver{
			&nett.CacheResolver{TTL: 5 * time.Minute},
		},
		IPFilter: nett.DualStack,
		Timeout:  10 * time.Second,
	}
	client := &http.Client{
		Transport: &http.Transport{
			Dial: func(network, address string) (net.Conn, error) {
				start := time.Now()
				conn, err := dialer.Dial(network, address)
				log.Printf("Connect: %s", time.Now().Sub(start))
				return conn, err
			},
			Proxy:             http.ProxyFromEnvironment,
			// DisableKeepAlives: true,
		},
	}
	for _, url := range urls {
		log.Printf("GET %s", url)
		resp, err := client.Get(url)
		if err != nil {
			panic(err)
		}
		io.Copy(ioutil.Discard, resp.Body)
		resp.Body.Close()
	}
}
```

こちらのコードも実行してみます。
**Keep-Aliveを有効**にした場合の結果です。

``` plain
2017/01/14 16:29:19 GET https://shogo82148.github.io/blog/2016/12/20/redis-fast-0-dot-19-released/
2017/01/14 16:29:19 Name Lookup: 22.239218ms
2017/01/14 16:29:19 Connect: 39.364428ms
2017/01/14 16:29:19 GET https://shogo82148.github.io/blog/2016/12/15/leap-second-in-datetime-dot-pm/
2017/01/14 16:29:19 GET https://shogo82148.github.io/blog/2016/11/23/qr-code/
```

こちらも予想通り名前解決とコネクション確立が初回しか行われないので、
最初の一回だけ時間計測のログが出力されています。

次に、**Keep-Aliveを無効**にした場合の結果です。
DNSキャッシュなし版と同様に`DisableKeepAlives`のコメントを外すと無効にできます。

``` plain
2017/01/14 16:29:41 GET https://shogo82148.github.io/blog/2016/12/20/redis-fast-0-dot-19-released/
2017/01/14 16:29:41 Name Lookup: 27.337342ms
2017/01/14 16:29:41 Connect: 44.552754ms
2017/01/14 16:29:41 GET https://shogo82148.github.io/blog/2016/12/15/leap-second-in-datetime-dot-pm/
2017/01/14 16:29:41 Name Lookup: 1.991µs
2017/01/14 16:29:41 Connect: 14.964222ms
2017/01/14 16:29:41 GET https://shogo82148.github.io/blog/2016/11/23/qr-code/
2017/01/14 16:29:41 Name Lookup: 2.024µs
2017/01/14 16:29:41 Connect: 22.782755ms
```

二回目以降の名前解決が一瞬で終わっており、キャッシュされている様子が確認できますね。

最後に名前解決にPure Golangを使った結果です。

``` plain
2017/01/14 16:30:04 GET https://shogo82148.github.io/blog/2016/12/20/redis-fast-0-dot-19-released/
2017/01/14 16:30:04 Name Lookup: 18.279786ms
2017/01/14 16:30:04 Connect: 35.113831ms
2017/01/14 16:30:04 GET https://shogo82148.github.io/blog/2016/12/15/leap-second-in-datetime-dot-pm/
2017/01/14 16:30:04 Name Lookup: 1.628µs
2017/01/14 16:30:04 Connect: 16.364037ms
2017/01/14 16:30:04 GET https://shogo82148.github.io/blog/2016/11/23/qr-code/
2017/01/14 16:30:04 Name Lookup: 1.77µs
2017/01/14 16:30:04 Connect: 16.048895ms
```


## 異様な高速化の理由

さて、ここまでの結果で、たしかにDNSキャッシュの効果があることは確認できました。
しかし、デフォルトの状態ではKeep-Aliveが有効になっているため、
事前の予想の通り**名前解決が行われるのは初回のみ**ということがわかりました。
mattnさんのベンチマークにはKeep-Alive無効化処理は入っていないので、
DNSキャッシュの有無で差はでないはずです。

思うに、`for i := 0; i < b.N; i++ {}`がないのが原因なのではないかと・・・。

``` go
package main

import (
	"testing"
	"time"
)

func BenchmarkHoge1(b *testing.B) {
	time.Sleep(1100 * time.Millisecond)
}

func BenchmarkHoge2(b *testing.B) {
	time.Sleep(997 * time.Millisecond)
}

func BenchmarkFuga1(b *testing.B) {
	for i := 0; i < b.N; i++ {
		time.Sleep(1100 * time.Millisecond)
	}
}

func BenchmarkFuga2(b *testing.B) {
	for i := 0; i < b.N; i++ {
		time.Sleep(997 * time.Millisecond)
	}
}
```

僕の手元では以下のような結果になりました。
(タイミングの問題なので、再現させるには数値の微調整が必要かも)

``` plain
BenchmarkHoge1-4   	       1	1104960703 ns/op
BenchmarkHoge2-4   	       2	 500677841 ns/op
BenchmarkFuga1-4   	       1	1103413336 ns/op
BenchmarkFuga2-4   	       1	1001147782 ns/op
PASS
```


## nettの問題点

[nett](https://github.com/abursavich/nett)の効果も確認できたし、
ベンチマークが異様に良い理由もわかったので、
ここで検証終了・・・といきたいところですが、
nettはあまりおすすめできないというのが僕の意見です。

### 古い

最終コミットが2年前と古いです。
まだGo1.7が出てないころなので、当然`context.Context`にも対応していないわけです。
そのため名前解決のタイムアウトやキャンセルを制御できません。
また、この検証でもhttptraceが使えなくて悲しい思いをしたので、
contextをサポートして欲しい・・・。

### DNSレコードのTTLを無視している

`nett.CacheResolver`のTTLには固定の時間しか設定できないようです。
DNSレコード自体にTTLが設定されているはずなので、本来であればそれを尊重するべきです。
短い時間のキャッシュであれば問題ないかもしれないですが、
アクセスした相手をDNS浸透問題(浸透いうな！)で悩ませてしまう可能性があるので、
できれば相手の意向を尊重したいところです。

### キャッシュクリアが無い

`nett.CacheResolver`のTTLの実装は
「前回の名前解決からの経過時間を見て再取得」という単純なものです。
ようするにガーベージコレクションがない状態です。
TTLが過ぎてもキャッシュから本当に消えるわけではないので、
多くのドメインを相手にする場合、メモリを食い尽くす可能性があります。


## 解決策は？

mattnさんの記事には「Go 1.8 からは Resolver提供されるので、自前で簡単に名前引きのキャッシュを実装出来る」とありますが、
**1.8にはユーザがResolverの動作をカスタマイズする機能はありません**。
[TODO: optional interface impl override hook](https://github.com/golang/go/blob/ecc4474341504f5893c8333dbb68c520dbe93ca5/src/net/lookup.go#L100)
な状態です。
マイルストーンをみる限り[1.9で入るらしい](https://github.com/golang/go/issues/12503)(？)ので、それを待ちましょう・・・。

また、現時点では、netパッケージにDNSレコードのTTLを取得する機能はありません。
つまり先に挙げたnettの欠点をすべて補うには、**「Pure GolangなDNSクライアントの独自実装」**が必要となります。
[golang.org/x/net/dnsが入る予定](https://github.com/golang/go/issues/16218)はあるようですが、
実装は未だ存在せず、入るバージョンも決まっていないようです。

つらい。どう考えても「楽な方法」ではない・・・。

Consulにも使われているという[miekg/dns](https://github.com/miekg/dns)は見つけたので、誰か強い人よろしくお願いします。
(ちなみにgolang.org/x/net/dnsの候補として一度は挙がったものの、別実装で行くらしい)


## まとめ

- [nett](https://github.com/abursavich/nett)は名前解決キャッシュに効果あり
  - しかしコードが古いので、Go1.7が出ている現状ではおすすめできない
- ResolverのカスタマイズはGo1.9かららしい(Go1.8ではまだ入らない)
- 暫定的な解決策は
  - [nett](https://github.com/abursavich/nett)を突っついてGo1.7対応をしてもらう(ただし、DNS浸透問題(浸透いうな！)解決にはDNSクライアントの実装が必要)
  - [miekg/dns](https://github.com/miekg/dns)を使ってDNSクライアントを頑張って独自実装(つらい)
- ベンチの際には`for i := 0; i < b.N; i++ {}`をわすれずに

http.Clientで名前解決結果cacheする楽な方法、現在も絶賛募集中です。


## おまけ

この記事書くのにnetパッケージの中を探っていたら、
ソースコードの中に[Gopther君を見つけた](https://github.com/golang/go/blob/ecc4474341504f5893c8333dbb68c520dbe93ca5/src/net/lookup.go#L39)。

ʕ◔ϖ◔ʔʕ◔ϖ◔ʔʕ◔ϖ◔ʔ
