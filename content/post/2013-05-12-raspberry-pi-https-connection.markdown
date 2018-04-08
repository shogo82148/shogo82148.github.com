---
layout: post
title: "RaspberryPiでhttps通信が失敗するのを何とかする"
slug: raspberry-pi-https-connection
date: 2013-05-12T16:48:00+09:00
comments: true
categories: [RaspberryPi, Python]
---

RaspberryPiをネットつないでみたので、PythonからいろんなURLを叩いて遊んでいたんだけど、
一部のhttps通信が Connection Timed Out で失敗しちゃう。
プログラムの問題かと思ったけど、curlで叩いてもやっぱりタイムアウト。
Macで全く同じ事をするとうまくいく・・・。
いろいろ調べて、何とかしてみたお話。

<!-- More -->

## 原因

接続先がTLSv1にしか対応していないのにSSLv3でアクセスしようとしていたことが問題だったらしい。
明示的にTLSv1を使うように指定して curl を叩いてみるとうまくいった。

``` bash
$ curl --tlsv3 https://hogehoge
```

なぜRaspberryPiではダメで
Macでは成功するのか、という根本的な原因はよくわからなかった。
SSLv3に対応していないなら自動的にフォールバックしてくれてもよさそうなものだけど、
なぜうまく行かないんだろう・・・？


## Pythonでの対処

PythonでもTLSv3を使えばうまくいくはずなんだけど、
暗号化方式を指定するオプションは見当たらない(2.7での話)。
どうやら標準ライブラリのファイルを直接書き換えるか、
実行時に中身を入れ替えるかしないとできないみたいだ。
この問題普通のUbuntuでも起こるらしく、
そのフォーラムで置き換えコードを見つけた。

``` python
import httplib
from httplib import HTTPConnection, HTTPS_PORT
import ssl

class HTTPSConnection(HTTPConnection):
    "This class allows communication via SSL."
    default_port = HTTPS_PORT

    def __init__(self, host, port=None, key_file=None, cert_file=None,
            strict=None, timeout=socket._GLOBAL_DEFAULT_TIMEOUT,
            source_address=None):
        HTTPConnection.__init__(self, host, port, strict, timeout,
                source_address)
        self.key_file = key_file
        self.cert_file = cert_file

    def connect(self):
        "Connect to a host on a given (SSL) port."
        sock = socket.create_connection((self.host, self.port),
                self.timeout, self.source_address)
        if self._tunnel_host:
            self.sock = sock
            self._tunnel()
        # this is the only line we modified from the httplib.py file
        # we added the ssl_version variable
        self.sock = ssl.wrap_socket(sock, self.key_file, self.cert_file, ssl_version=ssl.PROTOCOL_TLSv1)

#now we override the one in httplib
httplib.HTTPSConnection = HTTPSConnection
# ssl_version corrections are done
```

これを通信開始前に読みこめば、あとは`urllib`で読み込めるようになるはず。

## 参考
- [RubyでHTTPS通信に失敗したのでcURLで対処した](http://www.abe3.net/2012/12/ruby-https-error/)
- [Python HTTPS requests (urllib2) to some sites fail on Ubuntu 12.04 without proxy](http://askubuntu.com/questions/116020/python-https-requests-urllib2-to-some-sites-fail-on-ubuntu-12-04-without-proxy)
