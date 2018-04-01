---
layout: post
title: "PerlとGolangで実行できるPolyglot書いてみた"
date: 2016-04-05T12:27:00+09:00
comments: true
categories: [perl, go, golang]
---

Rubyの会社をPerlの会社に変えてしまおう計画。
Golangのフリをして忍び込ませれば行けるのではという話になったので、
GoでもPerlでも実行できるコードを書いてみた。

<!-- More -->

出来上がったのがこちら。

``` plain
package main;
import ("fmt");
var (s=0/*==);
sub import {}
sub var { print "Hello macotasu"; }
__END__
*/)
func main() { fmt.Println("Hello macotasu") }
```

一番のポイントは`var (s=0/*==);`の行ですね。
Perlで解釈すると正規表現置換`s///`として解釈され、`/*`が無視されます。
Goで解釈すると変数`s`への代入として解釈され、`/*`がコメントとして扱われます。

あとはGoのキーワードをPerlが解釈できないので、ちょっと書き方を工夫します。

- `package main` はGoでもPerlでも似たような意味で解釈されるのでそのまま
- Goの `import`, `var` はPerlで解釈できないので、()を省略せずに書いてPerlの関数呼び出しっぽくする
- 省略可能なセミコロンをちゃんと書く

GoとPerlのコードは分かれているのでどんな処理でも自由に書くことができますが、
`import` だけGoでもPerlでも解釈されてしまうというという制限があります。
`import` するパッケージが一個だけなら問題ないんですが、
複数書く場合は以下のように２個め以降をすべてドットインポートする必要があって男気あふれる感じです。
(Perlでは文字列結合として解釈される。Goでは`var`のあとに`import`かけないっぽいので、ここに押し込むしかない。)

``` plain
package main;
import (
  "fmt"
  . "math"
);
var (s=0/*==);
sub import {}
sub var { print "Hello macotasu"; }
__END__
*/)
func main() { fmt.Println("Hello macotasu", Pi) }
```


もっと簡潔にかけないかな。


## 追記

シンタックスハイライトしてみたらわかりやすいかなと思ってやってみた。

Perlのシンタックスハイライト。

``` perl
package main;
import ("fmt");
var (s=0/*==);
sub import {}
sub var { print "Hello macotasu"; }
__END__
*/)
func main() { fmt.Println("Hello macotasu") }
```

Goのシンタックスハイライト。

``` go
package main;
import ("fmt");
var (s=0/*==);
sub import {}
sub var { print "Hello macotasu"; }
__END__
*/)
func main() { fmt.Println("Hello macotasu") }
```


## 参考

- [The Go Programming Language Specification](https://golang.org/ref/spec)
- [polyglot 基礎の基礎](http://d.hatena.ne.jp/sugyan/20110306/1299418878)
