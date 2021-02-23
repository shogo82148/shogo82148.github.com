---
layout: post
title: "改: PerlとGolangで実行できるPolyglot書いてみた"
slug: improve-go-and-perl-polyglot
date: 2021-02-23 18:00:00 +0900
comments: true
categories: [go, golang, perl]
---

仕事をしているときにふとひらめいた。

- [Perl と Golang で実行できる Polyglot 書いてみた](/blog/2016/04/05/polyglot-of-perl-and-golang/)

文字列置換の `s///` に使う記号はダブルクオーテーションでも行ける！

```go
package main;

import (s"fmt"/*");
sub import { print "Hello macotasu"; }
__END__
*/)
func main() { s.Println("Hello macotasu") }
```

```perl
package main;

import (s"fmt"/*");
sub import { print "Hello macotasu"; }
__END__
*/)
func main() { s.Println("Hello macotasu") }
```

Go で dot import をしなければならない、という制限がなくなるので、自由度が上がりました。

```go
package main;

import (s"fmt"/*");
sub import { print "Hello macotasu"; }
__END__
*/)
import "math"
func main() { s.Println("Hello macotasu", math.Pi) }
```

もし万が一 Go でも Perl でも動作するコードを書かないと行けないときでもこれなら安心です。
ぜひご利用ください。

## おまけ

明日使えるムダ知識をあなたへ。

これでもコンパイル通る。 https://play.golang.org/p/r4awYWmXolN

```go
package main

import ()
const ()
var ()

func main() {
}
```
