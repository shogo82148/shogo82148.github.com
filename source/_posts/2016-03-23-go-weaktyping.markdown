---
layout: post
title: "数値と文字列がごちゃ混ぜになっているJSONをよしなにParseするやつ作った"
date: 2016-03-23 20:44
comments: true
categories: [golang]
---

Goは数値と文字列を厳格に区別しますが、他の言語もそうとは限りません。
例えばPerlは数値と文字列を自動変換してくれるので、気をつけていないといつの間にか数値が文字列になっていたりします。
その言語の中に閉じていいれば問題ないのですが、Goとやり取りしようとすると困ります。
そんなときに使えるライブラリを書いてみました。

- [shogo82148/go-weaktyping](https://github.com/shogo82148/go-weaktyping)

<!-- More -->

## 背景

`map[string][]*string`を返してくるライブラリがあって、
そのままだと扱いにくいのでなんとか構造体にできないかと頭を悩ませていました。
JSONに一旦変換すれば楽かなーとも思ったのですが、一部フィールドを数値に変換する必要がありました。
JSONの数値と文字列を区別するため、JSONの文字列をGoの数値型に変換するのは厄介です。
タグに`json:",string"`と指定すると変換可能になりますが、逆にJSONの数値を受け付けなくなりますし、
JSONに変換すると文字列になってしまいます。
変換先の構造体は普通のJSONの操作にも使いたかったので、これでは困ります。
「数値も文字列もUnmarshalできて、Marshalするときには数値になる」ようなJSONライブラリが必要でした。

`"encoding/json"`に代わる新しいJSONライブラリを・・・とも考えたのですが、
よく考えるとUnmarshal時の挙動は`"encoding/json".Unmarshaler`インターフェースを実装することでカスタマイズ可能です。
こうして作ったのが go-weaktyping です。

## 使い方

builtinの型の先頭を大文字にしたものを用意しているので、
適当にUnmarshalして欲しいところでbuiltinの型の代わりに指定するだけです。
以下は整数型をUnmarshalする例です。

``` go
package main

import (
	"encoding/json"
	"fmt"
	"log"

	"github.com/shogo82148/go-weaktyping"
)

func main() {
	ptr := &struct {
		Foo weaktyping.Int `json:"foo"`
	}{}

	if err := json.Unmarshal([]byte(`{"foo":123}`), ptr); err != nil {
		log.Fatal(err)
	}
	fmt.Println("Foo:", ptr.Foo)

	if err := json.Unmarshal([]byte(`{"foo":"456"}`), ptr); err != nil {
		log.Fatal(err)
	}
	fmt.Println("Foo:", ptr.Foo)
}
```

`{"foo":123}`が正常にUnmarshalできるのはもちろん、
通常はエラーになってしまう`{"foo":"456"}`のUnmarshalも問題なく行えます。
Marshal時は通常のint型と同様に振る舞います。

数値型だけでなく`weaktyping.String`も用意されていて、
通常はエラーになってしまう `{"foo":123}` も `struct { Foo weaktyping.String }{"123"}`にUnmarshal可能です。

その他使える型は [godoc](https://godoc.org/github.com/shogo82148/go-weaktyping) をどうぞ。


## 各種Boolたち

builtinの`bool`に対応する`weaktyping.Bool`も実装してみたのですが、
何を持って真偽を判断するか難しい・・・。
例えば空のARRAYは真とみなすべきか、偽とみなすべきか。
普段触っている言語によって意見が分かれるのではないでしょうか。
(そもそも型が違うからエラーという人もいるだろうけど、そういうときは普通に`bool`を使いましょう)

JSONはもともとJavaScriptから派生した形式なので、JavaScriptに合わせるのが妥当かなと思い、
`weaktyping.Bool`の挙動はJavaScriptに合わせてあります。
「[各言語におけるtrue/falseまとめ](http://blog.mirakui.com/entry/20090604/truefalse)」を参考に言語別のBoolも用意しています。

- `Bool`/`JavaScriptBool`: `false`, `0`, `0.0`, `""`, `null` は偽、それ以外は真
- `RubyBool`: `false`, `null` は偽、それ以外は真
- `PHPBool`: `false`, `0`, `0.0`, `""`, `null`, `"0"`, `[]` は偽、それ以外は真
- `PerlBool`: `false`, `0`, `0.0`, `""`, `null`, `"0"` は偽、それ以外は真
- `PythonBool`: `false`, `0`, `0.0`, `""`, `null`, `[]`, `{}` は偽、それ以外は真

ややこしい・・・なるべく使わない方がいいと思います。


## 最後に

これを作るきっかけになった問題ですが、reflectで解決しました。reflect最強。
go-weaktypingを使うとすべてのUnmarshal時に有効になってしまって怖いなと考えたためです。

今後もなるべく go-weaktyping を使わずに済むよう祈ってます。
