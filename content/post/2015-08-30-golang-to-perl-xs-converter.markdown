---
layout: post
title: "PerlからGolangを呼び出す"
slug: golang-to-perl-xs-converter
date: 2015-08-30T22:52:00+09:00
comments: true
categories: [perl, go, golang]
---

GoのコードをPerlから呼び出せるようにする[go2xs](https://github.com/shogo82148/go2xs)を書いてみました。

<!-- More -->

## 使い方

Perlから使いたい関数に以下のようにgo2xsで始まるコメントを付けておきます。

``` go hoge
package main

//go2xs hello
func hello(str string) string {
  return "Hello " + str
}
```


[go2xs](https://github.com/shogo82148/go2xs)をgo getして、xsのグルーコードを作成。
その後通常のPerlモジュールと同じ手順でコンパイルします。
Go 1.5から入ったShared Libraryの機能を使っているのでGo 1.5が必要です。

``` bash
go get https://github.com/shogo82148/go2xs/cli/go2xs
go2xs -name hoge hoge.go
perl Makefile.PL
make
```

あとは普通に呼び出すだけ。

```
perl -Mblib -Mhoge -e 'print hoge::hello("World")'
Hello World
```

## 制限事項

今はまだ、整数・浮動小数点型・文字列しか扱えません。

あとGoのShared Libraryを複数回読み込むことができないっぽい？ (ref. https://github.com/golang/go/issues/11100 )
ので、go2xsを使ったコードを二つ以上useすると死にます。

## FFI::Rawを使う方法

go2xsはGoをShared Libraryとしてコンパイルしているだけなので、go2xsを使わなくても頑張れば呼び出すことができます。
[Golang で Shared Library を出力する。](http://qiita.com/yanolab/items/1e0dd7fd27f19f697285)で紹介されているこちらのコードで試してみます。

``` go libgofib.go
package main

import (
  "C"
  "log"
)

//export fib
func fib(n int) int {
  if (n < 2) { return n }
  return fib(n - 2) + fib(n - 1)
}

func init() {
  log.Println("Loaded!!")
}

func main() {
}
```

ビルドしてShared Libraryを作ってみます。

``` bash
build -buildmode=c-shared -o libgofib.so libgofib.go
```

PerlからShared Libraryを呼び出すには[FFI::Raw](https://metacpan.org/pod/FFI::Raw)を使うのがお手軽のようです。

``` perl test.pl
use FFI::Raw;

my $fib = FFI::Raw->new(
    'libfib.so', 'fib',
    FFI::Raw::int, # 戻り値
	FFI::Raw::int, # 引数
);

print $format->call(32);
```


## 文字列の受け渡しをしてみる

FFI::Rawを使った方法はお手軽ですが、文字列の受け渡しをしようとすると色々と面倒です。

### 素朴に実装してみる

Golangの`string`はPerlでそのまま扱えないので、`C.GoString`と`C.CString`を使い一度C言語の文字列形式を経由してから相互変換する必要があります。

``` go libgofmt.go
import "C"

import (
  f "go/format"
)

//export format
func format(src *C.char) *C.char {
  gosrc := C.GoString(src)
  dst, _ := f.Source([]byte(gosrc))
  return C.CString(string(dst))
}

func main() {
}
```

``` perl test.pl
use FFI::Raw;

my $format = FFI::Raw->new(
    'libgofmt.so', 'format',
	FFI::Raw::str, # 戻り値
	FFI::Raw::str,  # 引数1
);

print $format->call(<<"EOF");
package main
import   "fmt"
func main(   )   {
fmt.Println("hogehoge") }
EOF
```

なんとなく動いてよさ気な感じがしますが、
実はこのコード、メモリーリークしてます。
`C.CString`で作ったC言語の文字列はGolangの管理から外れるのでGCで回収されません。
そのため、どこかで`free`を実行して開放する必要があります。

### strcpyで頑張る

Golang側でバッファを確保するとPerlに戻った時にバッファ開放ができないので、
Perl側で結果を格納するバッファを確保してみます。

``` go libgofmt.go
package main

/*
#include <stdlib.h>
#include <string.h>
*/
import "C"

import (
  f "go/format"
  "unsafe"
)

//export format
func format(dst *C.char, src *C.char) {
  gosrc := C.GoString(src)
  godst, _ := f.Source([]byte(gosrc))
  cs := C.CString(string(godst))
  defer C.free(unsafe.Pointer(cs))
  C.strcpy(dst, cs)
}

func main() {
}
```

``` perl test.pl
use FFI::Raw;

my $format = FFI::Raw->new(
  'libgofmt.so', 'format',
  FFI::Raw::void, # 戻り値
  FFI::Raw::str,
  FFI::Raw::ptr,
);

while(1) {
  my $hoge;
  my $coderef = sub { $hoge = shift };
  my $callback = FFI::Raw::callback($coderef, FFI::Raw::void, FFI::Raw::str);
  $format->call(<<"EOF", $callback);
package main
import   "fmt"
func main(   )   {
fmt.Println("hogehoge") }
EOF
}
```

この方式なら作ったShared Libraryを他の言語からも呼びやすいので無難かも？
ただし、まだまだ実装が不十分で、このコードはバッファオーバーランの危険があります。
しっかり実装するなら、最初の一回でバッファのサイズだけ計算、次の呼び出しで結果取得・・・のようなフローを踏む必要があります。


### コールバック

結果の保存をコールバック関数の呼び出しで行えば、Golang側でfreeを実行するタイミングが分かるので、メモリーリークを防ぐことができます。
ただし、Goからは関数ポインタを呼び出すことはできないので、gcoでグルーコードを書いてあげる必要があります。

``` go libgofmt.go
package main

/*
#include <stdlib.h>
typedef void (*callbackFunc) (const char*);

void bridge_callback(callbackFunc f, const char* str);
*/
import "C"

import (
  f "go/format"
  "unsafe"
  )

//export format
func format(src *C.char, dstCallback unsafe.Pointer) {
  gosrc := C.GoString(src)
  godst, _ := f.Source([]byte(gosrc))
  cs := C.CString(string(godst))
  defer C.free(unsafe.Pointer(cs))
  C.bridge_callback(C.callbackFunc(dstCallback), cs)
}

func main() {
}
```

``` c libgofmt.c
typedef void (*callbackFunc) (const char*);

void bridge_callback(callbackFunc f, const char* str) {
    f(str);
}
```

``` perl test.pl
use FFI::Raw;

my $format = FFI::Raw->new(
    'libgofmt.so', 'format',
    FFI::Raw::void, # 戻り値
	FFI::Raw::str, FFI::Raw::ptr,
);

while(1) {
    my $hoge;
	my $coderef = sub { $hoge = shift };
	my $callback = FFI::Raw::callback($coderef, FFI::Raw::void, FFI::Raw::str);
	$format->call(<<"EOF", $callback);
package main
import   "fmt"
func main(   )   {
fmt.Println("hogehoge") }
EOF
}
```

## まとめ

GoのShared Libraryの呼び出しは数値型だけを相手にしていれば比較的簡単ですが、文字列を扱おうとすると少し面倒です。
go2xsを使うとそこら辺が簡単になります。
あんましライブラリ作ったことないですが、文字列の受け渡しをするときには、一般的にはどんな感じのインターフェースにするべきなんですかね？

GoのShared Libraryまだまだ出たばかりで、複数回読み込めなかったりと問題はありますが、
Goの機能を他の言語から呼び出せるのは便利ですね。
今後に期待です。
