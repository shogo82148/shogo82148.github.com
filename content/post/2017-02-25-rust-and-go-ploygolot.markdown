---
layout: post
title: "Rust vs Go の終戦へ向けてPolyglotを作ってみた"
date: 2017-02-25 16:58:27 +0900
comments: true
categories: [rust, rustlang, go, golang]
---

「Golang Rust」とググると、関連項目は「Rust vs Go」のように
GolangとRustが対立しているような項目ばかりです。
まあまあ、もっと仲良くやろうじゃないですか、ということで、
どうしたら仲良くなれるかを考えました。
Polyglotにして同じソースコードの中に閉じ込めてやれば、
そのうち仲良くなるのではないかと考え、
RustとGoのPloyglotを作ってみました。

<!-- More -->

## 結果

``` rust polyglot.rs
/*/*/
package main

import "fmt"

func main() {
	fmt.Print("Hello Go!!")
	_ = `*/*/
fn main() {
    println!("Hello Rust!!");
//`
}
```

``` go polyglot.go
/*/*/
package main

import "fmt"

func main() {
	fmt.Print("Hello Go!!")
	_ = `*/*/
fn main() {
    println!("Hello Rust!!");
//`
}
```


## 仕組み

一番のポイントは最初の行の `/*/*/` です。
RustもGoも`/* */`形式の複数行コメントに対応していますが、
Rustはネストに対応しており、Goはネストはできないという違いがあります。
この違いにより、Rustは`/*/*/`を`/* /* /`のように「二重にネストしたコメントの開始部分」として扱いますが、
Goは`/* / */`のように「`/`をコメントアウトしたもの」と見なします。
これにより2行目`package main`以降はGoには普通のコードに見えますが、
Rustからは単なるコメントとして認識されます。

次はGoからRustへの切り替えです。
Goではバッククオートで複数行文字列を定義できるので、その中にRustのコードを書きます。
この中ではバッククオートさえ使わなければ自由にRustのコードを書くことが出来るので、
あとはGoのコードだけ上手くコメントアウトされるよう調整すれば完成です。


## せっかくなのでリンクしてみた

GoからRustのコードを呼び出すサンプルコードを見つけたので、
せっかくなのでリンクしてみました。

- [medimatrix/rust-plus-golang](https://github.com/medimatrix/rust-plus-golang)

`main.go`と`lib.go`を以下のように置き換えます。
内容は一緒なので、シンボリックリンクにすると編集が楽でいいかもしれませんね。

``` go main.go
/*golang code starts from here/*/
package main

/*
#cgo LDFLAGS: -L./lib -lhello
void hello(char *name);
*/
import "C"

func main() {
	C.hello(C.CString("John Smith"))

	_ = `rustlang code starts from here */*/
extern crate libc;
use std::ffi::CStr;

#[no_mangle]
pub extern "C" fn hello(name: *const libc::c_char) {
    let buf_name = unsafe { CStr::from_ptr(name).to_bytes() };
    let str_name = String::from_utf8(buf_name.to_vec()).unwrap();
    println!("Hello {}!", str_name);
//`
}
```

``` rust lib.rs
/*golang code starts from here/*/
package main

/*
#cgo LDFLAGS: -L./lib -lhello
void hello(char *name);
*/
import "C"

func main() {
	C.hello(C.CString("John Smith"))

	_ = `rustlang code starts from here */*/
extern crate libc;
use std::ffi::CStr;

#[no_mangle]
pub extern "C" fn hello(name: *const libc::c_char) {
    let buf_name = unsafe { CStr::from_ptr(name).to_bytes() };
    let str_name = String::from_utf8(buf_name.to_vec()).unwrap();
    println!("Hello {}!", str_name);
//`
}
```

呼び出し元と呼び出し先のコードが一度に確認できて便利(？)

## まとめ

Goの最初に`package main`を書かなければいけない制限が意外と厳しいため、
Polyglotにする言語には相性があります。
つまりRustとGoは相性バツグンということですね！(？？？)
みなさんもRustとGoを仲良く使っていきましょう！！！！！

(※ジョークなので本気にしないでくださいね、念のため)

## 参考

- [The Rust Reference#comment](https://doc.rust-lang.org/reference.html#comments)
- [PerlとGolangで実行できるPolyglot書いてみた](https://shogo82148.github.io/blog/2016/04/05/polyglot-of-perl-and-golang/)
  - どうやらGoはPerlとも相性がいいようです
- [medimatrix/rust-plus-golang](https://github.com/medimatrix/rust-plus-golang)
