---
layout: post
title: "net/httpで安全に静的ファイルを返す"
date: 2016-04-13 02:29
comments: true
categories: [go]
---

[net/httpで静的ファイルを返す](http://konboi.hatenablog.com/entry/2016/04/12/121105)で、
`http.ServeFile`を使っていてアレ？と思ったのでちょっと詳しく調べてみました。
(`http.FileServer`を使うものだと思ってたため。[godocのexample](https://golang.org/pkg/net/http/#example_FileServer)にはそっちの例しか載ってない)

結論だけ先に書いておくと

- やはり、特に理由がなければ`http.FileServer`を使ったほうが良さそう
- どうしても`http.ServeFile`を使う場合は定数でパス指定をする
- 「自作パスルータを使っている」かつ「Go 1.6.1 未満を使っている」場合はとくに要注意

<!-- More -->

## ディレクトリトラバーサル脆弱性

紹介されているのは以下のコードです。

``` go
http.HandleFunc("/static/", func(w http.ResponseWriter, r *http.Request) {
  http.ServeFile(w, r, r.URL.Path[1:])
})
```

しかし、参照先の「[Go Golang to serve a specific html file](http://stackoverflow.com/questions/25945538/go-golang-to-serve-a-specific-html-file)」には
**Actually, do not do that.** (やっちゃいけない)とコメントされています。
[ディレクトリトラバーサル](https://ja.wikipedia.org/wiki/%E3%83%87%E3%82%A3%E3%83%AC%E3%82%AF%E3%83%88%E3%83%AA%E3%83%88%E3%83%A9%E3%83%90%E3%83%BC%E3%82%B5%E3%83%AB)により
脆弱性の原因となってしまう可能性があるためです。

脆弱性再現のために、以下の様なコードを書いてGo1.5でコンパイルして実行してみました。

``` go
package main

import (
	"net/http"
	"strings"
)

func main() {
	http.ListenAndServe(":3000", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/static/") {
			http.ServeFile(w, r, r.URL.Path[1:])
		} else {
			http.NotFound(w, r)
		}
	}))
}
```

`..`を含んだパスをリクエストしてみます。(実行した場所によって`..`の数は変わるので適宜調整してみてください)

``` plain
$ curl -v http://localhost:3000/static/../../../.ssh/id_rsa
* About to connect() to localhost port 3000 (#0)
*   Trying ::1... connected
* Connected to localhost (::1) port 3000 (#0)
> GET /static/../../../.ssh/id_rsa HTTP/1.1
> User-Agent: curl/7.19.7 (x86_64-redhat-linux-gnu) libcurl/7.19.7 NSS/3.19.1 Basic ECC zlib/1.2.3 libidn/1.18 libssh2/1.4.2
> Host: localhost:3000
> Accept: */*
>
< HTTP/1.1 200 OK
< Accept-Ranges: bytes
< Content-Length: 1679
< Content-Type: text/plain; charset=utf-8
< Last-Modified: Fri, 13 Jun 2014 04:57:05 GMT
< Date: Tue, 12 Apr 2016 17:53:19 GMT
<
-----BEGIN RSA PRIVATE KEY-----
(中略)
-----END RSA PRIVATE KEY-----
* Connection #0 to host localhost left intact
* Closing connection #0
```

macのcurlで試したらクライアント側で相対パスを解決した状態でリクエストが飛んでしまって上手く行きませんでした。
オプションで外す方法がよくわかなかったので、`telnet`で叩いてみた例も載せておきます。

``` plain
$ telnet localhost 3000
Trying ::1...
Connected to localhost.
Escape character is '^]'.
GET /static/../../../.ssh/id_rsa HTTP/1.0

HTTP/1.0 200 OK
Accept-Ranges: bytes
Content-Length: 1679
Content-Type: text/plain; charset=utf-8
Last-Modified: Fri, 13 Jun 2014 04:57:05 GMT
Date: Tue, 12 Apr 2016 18:02:56 GMT

-----BEGIN RSA PRIVATE KEY-----
(中略)
-----END RSA PRIVATE KEY-----
Connection closed by foreign host.
```

ああ、僕の秘密鍵が・・・。


## 脆弱性を回避する

### Go1.6以降を使う

Go1.6以降では修正されており、
同じコードをGo1.6でコンパイルしてcurlで叩くと400が帰ってきます。

``` plain
$ curl -v http://localhost:3000/static/../../../.ssh/id_rsa
* About to connect() to localhost port 3000 (#0)
*   Trying ::1... connected
* Connected to localhost (::1) port 3000 (#0)
> GET /static/../../../.ssh/id_rsa HTTP/1.1
> User-Agent: curl/7.19.7 (x86_64-redhat-linux-gnu) libcurl/7.19.7 NSS/3.19.1 Basic ECC zlib/1.2.3 libidn/1.18 libssh2/1.4.2
> Host: localhost:3000
> Accept: */*
> 
< HTTP/1.1 400 Bad Request
< Content-Type: text/plain; charset=utf-8
< X-Content-Type-Options: nosniff
< Date: Tue, 12 Apr 2016 18:12:46 GMT
< Content-Length: 17
< 
invalid URL path
* Connection #0 to host localhost left intact
* Closing connection #0
```

### `http.ServeMux`を使う

`http.ServeMux`にはパスの正規化機能が組み込まれており、
正規化されていないURLにアクセスが来た場合は自動的リダイレクトしてくれるようです。
HTTPハンドラに渡ってくるときには、必ず相対パスが含まれていない状態になっています。
(これに最初は気が付かず、脆弱性が再現しないので困ってた。)

``` go
package main

import "net/http"

func main() {
  // 内部でhttp.ServeMuxを使ってくれる
  http.HandleFunc("/static/", func(w http.ResponseWriter, r *http.Request) {
    // r.URLには相対パスが含まれない形で渡ってくる
    http.ServeFile(w, r, r.URL.Path[1:])
  })
  http.ListenAndServe(":3000", nil)
}
```

相対パスを含んだリクエストを投げてもアクセスはできません。

``` plain
$ curl -v http://localhost:3000/static/../../../.ssh/id_rsa
* About to connect() to localhost port 3000 (#0)
*   Trying ::1... connected
* Connected to localhost (::1) port 3000 (#0)
> GET /static/../../../.ssh/id_rsa HTTP/1.1
> User-Agent: curl/7.19.7 (x86_64-redhat-linux-gnu) libcurl/7.19.7 NSS/3.19.1 Basic ECC zlib/1.2.3 libidn/1.18 libssh2/1.4.2
> Host: localhost:3000
> Accept: */*
> 
< HTTP/1.1 301 Moved Permanently
< Location: /.ssh/id_rsa
< Date: Tue, 12 Apr 2016 18:14:49 GMT
< Content-Length: 47
< Content-Type: text/html; charset=utf-8
< 
<a href="/.ssh/id_rsa">Moved Permanently</a>.

* Connection #0 to host localhost left intact
* Closing connection #0
```


### `http.FileServer`を使う

`http.Dir`と`http.FileServer`を使うとルートディレクトリを指定でき、
その外へはアクセスできなくなるので想定外のファイルが見えてしまうことはありません。

``` go
package main

import (
  "net/http"
  "strings"
)

func main() {
  fileServer := http.StripPrefix("/static/", http.FileServer(http.Dir("static")))
  http.ListenAndServe(":3000", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    if strings.HasPrefix(r.URL.Path, "/static/") {
      fileServer.ServeHTTP(w, r)
    } else {
      http.NotFound(w, r)
	}
  }))
}
```

相対パスを含んだURLにアクセスしても404になって見れません。

``` plain
$ curl -v http://localhost:3000/static/../../../.ssh/id_rsa
* About to connect() to localhost port 3000 (#0)
*   Trying ::1... connected
* Connected to localhost (::1) port 3000 (#0)
> GET /static/../../../.ssh/id_rsa HTTP/1.1
> User-Agent: curl/7.19.7 (x86_64-redhat-linux-gnu) libcurl/7.19.7 NSS/3.19.1 Basic ECC zlib/1.2.3 libidn/1.18 libssh2/1.4.2
> Host: localhost:3000
> Accept: */*
> 
< HTTP/1.1 404 Not Found
< Content-Type: text/plain; charset=utf-8
< X-Content-Type-Options: nosniff
< Date: Tue, 12 Apr 2016 18:39:34 GMT
< Content-Length: 19
< 
404 page not found
* Connection #0 to host localhost left intact
* Closing connection #0
```


### `http.ServeFile`に定数を渡す

どうしても特定のファイルを指定したい場合は`http.Request`の中身は一切見ずにファイルパスを直接`http.ServeFile`に渡すべきです。
例えば、「[Go Golang to serve a specific html file](http://stackoverflow.com/questions/25945538/go-golang-to-serve-a-specific-html-file)」の質問者が上げている例を
正しく書きなおすと以下のようになると思います。

> `http.Handle("/", http.FileServer(http.Dir("static")))`
> Serves the html file in static directory.
>
> Is there any way in Go that we can specify the html file to serve?
>
> Something like render_template in Flask
>
> I want to do something like:
>
> `http.Handle("/hello", http.FileServer(http.Dir("static/hello.html")))`


``` go
package main

import "net/http"

func main() {
  http.HandleFunc("/hello", func(w http.ResponseWriter, r *http.Request) {
    http.ServeFile(w, r, "static/hello.html")
  })
  http.ListenAndServe(":3000", nil)
}
```


## まとめ

まとめ再掲。

- やはり、特に理由がなければ`http.FileServer`を使ったほうが良さそう
- どうしても`http.ServeFile`を使う場合は定数でパス指定をする
- 「自作パスルータを使っている」かつ「Go 1.6.1 未満を使っている」場合はとくに要注意

## まとめのまとめ

[godocのexample](https://golang.org/pkg/net/http/#example_FileServer)どおりにやるのが一番。

``` go
package main

import "net/http"

func main() {
  http.HandleFunc("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("static"))))
  http.ListenAndServe(":3000", nil)
}
```
