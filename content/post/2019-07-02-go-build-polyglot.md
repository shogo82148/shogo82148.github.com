---
layout: post
title: "GoのバイナリをRubyスクリプトとしても扱う"
slug: go-build-polyglot
date: 2019-07-02 21:55:00 +0900
comments: true
categories: [go, golang, perl, php, ruby]
---

<iframe src="https://hatenablog-parts.com/embed?url=https%3A%2F%2Fcodehex.hateblo.jp%2Fentry%2F2019%2F07%2F02%2F090000" title="Go のバイナリを Perl スクリプトとしても扱う - アルパカ三銃士" class="embed-card embed-blogcard" scrolling="no" frameborder="0" style="display: block; width: 100%; height: 190px; max-width: 500px; margin: 10px 0px;"></iframe>

<iframe src="https://hatenablog-parts.com/embed?url=https%3A%2F%2Fuzulla.hateblo.jp%2Fentry%2F2019%2F07%2F02%2F191859" title="GoのバイナリをPHPスクリプトとしても扱う - uzullaがブログ" class="embed-card embed-blogcard" scrolling="no" frameborder="0" style="display: block; width: 100%; height: 190px; max-width: 500px; margin: 10px 0px;"></iframe>

```plain
$ ruby --help
Usage: ruby [switches] [--] [programfile] [arguments]
(中略)
  -x[directory]   strip off text before #!ruby line and perhaps cd to directory
(後略)
```

なんか Ruby にも `-x` あるらしいので。

```go
package main

import (
	"fmt"
	"runtime"
)

const script = `
#!ruby
puts "Hello Ruby World!!\n"
__END__
`

func init() {
	runtime.KeepAlive([]byte(script))
}

func main() {
	fmt.Println("This is Go world!!")
}
```

はい。

```plain
$ go build -o main main.go
$ ./main
This is Go world!!
$ ruby -x main
Hello Ruby World!!
```

`runtime.KeepAlive` なら最適化で削除されないことが保証されているので、問題なく動く、はず。
`runtime.KeepAlive(script)` でも良さそうなものだけど、なぜかうまくいかない。
ただの遊びなので、そこまで深く調べてない・・・。


## おまけ

各言語は独立なので、全部混ぜても動くわけですね。

```go
package main

import (
	"fmt"
	"runtime"
)

const script = `
# 何故かこのコメントが無いと動かない
#!ruby
puts "Hello Ruby World!!\n"
__END__
#!perl
print "Hello, Perl World!!\n";
__END__
<?php
file_put_contents("php://stderr", "This is PHP world!!!".PHP_EOL);
__halt_compiler();
`

func init() {
	runtime.KeepAlive([]byte(script))
}

func main() {
	fmt.Println("This is Go world!!")
}
```

```plain
$ go build -o main main.go
$ ruby -x main
Hello Ruby World!!
$ perl -x main
Hello, Perl World!!
$ php ./main 2>&1 > /dev/null
This is PHP world!!!
```

「# 何故かこのコメントが無いと動かない」の行を削除すると、なぜか動かない。

```plain
$ ruby -x main
main:1112: invalid multibyte char (UTF-8)
```

`#!ruby` が何故か二回登場している、ということまではわかったけど、ここで飽きたので誰か任せた。
