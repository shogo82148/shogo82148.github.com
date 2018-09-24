---
layout: post
title: "PHPer向けGoのJSONデコーダーを作った"
slug: go-phper-json
date: 2018-09-24 17:44:00 +0900
comments: true
categories: [go, golang, php]
---

必要に迫られて作りました。
PHPでエンコードしたJSONをいい感じにデコードしてくれるGoのパッケージです。

- [shogo82148/go-phper-json](https://github.com/shogo82148/go-phper-json)

## 背景

さて、PHPerの方々には当たり前のことかもしれませんが、PHPの言語仕様について少しおさらいです。
それがどうしてGoで問題になるか見ていきます。

### PHPのarray問題

PHPはとても便利なプログラミング言語なので、配列を扱うことができます。
ここでPHPの配列のマニュアルを読んでみましょう。

> http://php.net/manual/ja/language.types.array.php 
> PHP の配列は、実際には順番付けられたマップです。マップは型の一種で、 値をキーに関連付けます。 この型は、さまざまな使い道にあわせて最適化されます。 **配列としてだけでなく、リスト (ベクター)、 ハッシュテーブル (マップの実装の一つ)、辞書、コレクション、スタック、 キュー等として使用することが可能です。** PHP の配列には他の PHP 配列を値として保持することができるため、 非常に簡単にツリー構造を表現することが可能です。
> (強調部分は筆者によるもの)

重要なことなのでもう一度。

> **配列としてだけでなく、リスト (ベクター)、 ハッシュテーブル (マップの実装の一つ)、辞書、コレクション、スタック、 キュー等として使用することが可能です。**

他の言語でリスト、ハッシュテーブル、辞書等と呼ばれているものは、PHPにおいてはいずれも配列です。
PHPにとっては、整数を添字にしているか、文字列を添字にしているかの違いでしかありません。
(PHP7.xから整数が添字の場合に最適化が入るようになったらしいけど、大きな挙動の変更はないはず)

そのため、以下のスクリプトは `true` を返します。

```php
<?php

$a = array("apple", "banana");
$b = array(0 => "apple", 1 => "banana");

var_dump($a == $b); // bool(true)
```

この仕様のため、JSONにエンコードすると最初は配列だったのに、
処理を進めていくうちにうっかり文字列のキーを作ってしまって、
JSONのオブジェクトに変わってました、ということが起こりえます。
Goにおいて両者は全く違う型なので、デコードの際に非常に困ります。

```php
<?php

$a = array(1, 2, 3);
print json_encode($a); // [1,2,3]

$a["foo"] = "bar";
print json_encode($a); // {"0":1,"1":2,"2":3,"foo":"bar"}
```

このような悲劇を防ぐために、 `JSON_FORCE_OBJECT` というオプションがあるのですが、
オプションの名前通りに全部JSONのオブジェクトになってしまいます。
この要素だけJSONの配列にして欲しい！といった細かな操作はできません。

```php
<?php

$a = array(1, 2, 3);
print json_encode($a, JSON_FORCE_OBJECT); // {"0":1,"1":2,"2":3}

$a["foo"] = "bar";
print json_encode($a, JSON_FORCE_OBJECT); // {"0":1,"1":2,"2":3,"foo":"bar"}
```

`\[1,2,3\]` が来るか、 `{"0":1,"1":2,"2":3}` が来るか、深遠な事情により知ることはできません。
Goの型が `\[\]interface{}` になるか `map\[string\]interface{}` になるかで、
扱い方が全く違うので困ったことです。

### PHPのType Jaggling

PHPは文脈によって型が柔軟に変わります。

> http://php.net/manual/ja/language.types.type-juggling.php 
> PHP は、変数定義時に明示的な型定義を必要と(または、サポート) しません。ある変数の型は、その変数が使用される文により定義されます。 

動的型付けなので、文字列として処理していたのにうっかり整数になっちゃった、
あるいはその逆が簡単に起こります。

```php
<?php

$a = "1";
print json_encode($a); // "1"

$a *= 2;
print json_encode($a); // 2
```

## go-phper-json

本職のPHPerの方なら、これらの問題に対してもっと良い解決方法を思いつくことでしょう。
思いついた人はコメントにでも、こっそり書いておいてください。
しかし、今回は深遠な理由により、PHPのコードに手を入れられないので、Goでなんとかすることにしました。
察して。

- [shogo82148/go-phper-json](https://github.com/shogo82148/go-phper-json)

このパッケージを使うと、普通のJSON配列が来た場合でも、PHPのJSONエンコーダーで `JSON_FORCE_OBJECT` を指定した配列が来た場合でも、
Goから同じように扱うことができます。

```go
import (
	"fmt"
	"os"
	"reflect"

	phperjson "github.com/shogo82148/go-phper-json"
)

func ExampleUnmarshal() {
	var jsonBlob = []byte(`[
	{"Name": "Platypus", "Order": "Monotremata"},
	{"Name": "Quoll",    "Order": "Dasyuromorphia"}
]`)
	type Animal struct {
		Name  string
		Order string
	}

	// 普通のJSON配列が来た場合
	var animals1 []Animal
	if err := phperjson.Unmarshal(jsonBlob, &animals1); err != nil {
		fmt.Println("error:", err)
	}
	fmt.Printf("%+v\n", animals1)

	// PHPのJSONエンコーダーでJSON_FORCE_OBJECTを指定した配列が来た場合
	var phpJSONBlob = []byte(`{
	"0": {"Name": "Platypus", "Order": "Monotremata"},
	"1": {"Name": "Quoll",    "Order": "Dasyuromorphia"}
}`)
	var animals2 []Animal
	if err := phperjson.Unmarshal(phpJSONBlob, &animals2); err != nil {
		fmt.Println("error:", err)
	}
	fmt.Printf("%+v\n", animals2)

	// 全く同じように扱える！！！
	fmt.Println(reflect.DeepEqual(animals1, animals2))

	// Output:
	// [{Name:Platypus Order:Monotremata} {Name:Quoll Order:Dasyuromorphia}]
	// [{Name:Platypus Order:Monotremata} {Name:Quoll Order:Dasyuromorphia}]
	// true
}
```

文字列が来ようが、浮動小数点数が来ようが、こちらが整数が欲しいと言えば整数になって帰ってきます。

```go
func ExampleUnmarshal_typeJaggling() {
	var jsonBlob = []byte(`{
	"R": 98,
	"G": "218",
	"B": 255.0
}`)
	type RGB struct {
		R uint8
		G uint8
		B uint8
	}
	// phperjson.Unmarshal is compatible with json.Unmarshal.
	var color RGB
	if err := phperjson.Unmarshal(jsonBlob, &color); err != nil {
		fmt.Println("error:", err)
	}
	fmt.Printf("%+v\n", color)

	// Output:
	// {R:98 G:218 B:255}
}
```

ヤッタネ！！！！

## 実装

構文解析までする余力はない＆正しく実装する自信がないので、
一旦 `interface{}` にデコードし、

```go
// https://github.com/shogo82148/go-phper-json/blob/922880857ada8c020ae83f6ca6220e826d57d09b/decode.go#L129-L140

// Decode reads the next JSON-encoded value from its input and stores it in the value pointed to by v.
func (dec *Decoder) Decode(v interface{}) error {
	var iv interface{}
	if err := dec.dec.Decode(&iv); err != nil {
		return err
	}
	rv := reflect.ValueOf(v)
	if rv.Kind() != reflect.Ptr || rv.IsNil() {
		return &InvalidUnmarshalError{Type: reflect.TypeOf(v)}
	}
	return dec.decode(iv, rv)
}
```

型アサーション( `switch v := in.(type) {}` )で値を取り出し、 [reflectパッケージ](https://golang.org/pkg/reflect/)で対象の変数に書き込んでいく方式を取りました。

```go
// https://github.com/shogo82148/go-phper-json/blob/922880857ada8c020ae83f6ca6220e826d57d09b/decode.go#L171-L183
	switch v := in.(type) {
	case nil:
		switch out.Kind() {
		case reflect.Interface, reflect.Ptr, reflect.Map, reflect.Slice:
			out.Set(reflect.Zero(out.Type()))
			// otherwise, ignore null for primitives
		}
	case bool:
		switch out.Kind() {
		default:
			return dec.withErrorContext(&UnmarshalTypeError{Value: "bool", Type: out.Type()})
		case reflect.Bool:
			out.SetBool(v)
// ...以下略...
```


## ベンチマーク

扱うJSONの大きさにもよりますが、Goの標準パッケージの2倍から8倍程度遅いです。
大きなJSONでは型変換よりもデコードに時間がかかるようで、差は縮まります。

```plain
$ go test -bench . -benchmem
goos: darwin
goarch: amd64
pkg: github.com/shogo82148/go-phper-json
BenchmarkUnicodeDecoder/json-4           5000000               274 ns/op          51.04 MB/s          36 B/op          2 allocs/op
BenchmarkUnicodeDecoder/phper-json-4     3000000               432 ns/op          32.36 MB/s          68 B/op          4 allocs/op
BenchmarkCodeUnmarshal/json-4                100          20498031 ns/op          94.67 MB/s     3274027 B/op      92663 allocs/op
BenchmarkCodeUnmarshal/phper-json-4           30          38771577 ns/op          50.05 MB/s    16434644 B/op     566562 allocs/op
BenchmarkUnmarshalString/json-4         10000000               181 ns/op             176 B/op          2 allocs/op
BenchmarkUnmarshalString/phper-json-4    2000000              1034 ns/op            2672 B/op          9 allocs/op
BenchmarkUnmarshalFloat64/json-4        10000000               163 ns/op             164 B/op          2 allocs/op
BenchmarkUnmarshalFloat64/phper-json-4   1000000              1120 ns/op            2660 B/op          9 allocs/op
BenchmarkUnmarshalInt64/json-4          10000000               124 ns/op             160 B/op          1 allocs/op
BenchmarkUnmarshalInt64/phper-json-4     2000000               983 ns/op            2656 B/op          8 allocs/op
BenchmarkUnmapped/json-4                 2000000               617 ns/op             216 B/op          4 allocs/op
BenchmarkUnmapped/phper-json-4            500000              2321 ns/op            2528 B/op         33 allocs/op
PASS
ok      github.com/shogo82148/go-phper-json     23.683s
```

構文解析から書き直せばもう少し肉薄するでしょうが、
とりあえず速度では困ってないので良しとします。

## まとめ

- PHPの吐いたJSONをいい感じにデコードするGoのライブラリを書いたよ
- こんなの使わなくていい世の中が早く来てほしい

## 関連

以前、こんなのも書いてましたね。
[shogo82148/go-phper-json](https://github.com/shogo82148/go-phper-json) のおかげで、
無事(?)卒業することができました。

- [数値と文字列がごちゃ混ぜになっているJSONをよしなにParseするやつ作った](https://shogo82148.github.io/blog/2016/03/23/go-weaktyping/)

ヤッタネ！！！！
