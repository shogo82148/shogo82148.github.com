---
layout: post
title: "go-JSONStoreの高速化と機能追加"
date: 2017-03-05 16:19:25 +0900
comments: true
categories: [go, golang]
---

以前mattnさんが紹介していた[schollz/jsonstore](https://github.com/schollz/jsonstore)。
時間が経ってしまいましたが「ここは高速化できそうだなー」といじってみたので、
やってみたことをメモ。

本来は上流にフィードバックしたほうがよいのですが、
本家のほうも修正が入ってコンフリクトして面倒になったので、
フォーク版をそのまま置いておきます。

- [shogo82148/jsonstore](https://github.com/shogo82148/jsonstore)

<!-- More -->

## 高速化

まだまだ高速化できそうなところがあったので、いじってみた部分です。

### ロックの範囲を最小にする

ロックの範囲を小さくすることで、並列処理時の性能が上がります。
例えば、jsonstoreに値を入れる`Set`メソッドは、
以下のように`Set`全体がロックの対象になっていました。

``` go
func (s *JSONStore) Set(key string, value interface{}) error {
	// Set の中全体がロックの対象になっている
	s.Lock()
	defer s.Unlock()

	b, err := json.Marshal(value)
	if err != nil {
		return err
	}

	if s.data == nil {
		s.data = make(map[string]*json.RawMessage)
	}
	s.data[key] = (*json.RawMessage)(&b)
	return nil
}
```

jsonのエンコード処理はjsonstoreの中身を触らないので並列実行可能です。
次のように `s.data` だけをロックの対象にすれば十分です。

``` go
func (s *JSONStore) Set(key string, value interface{}) error {
	// json.Marshal は並列実行可能
	b, err := json.Marshal(value)
	if err != nil {
		return err
	}

	// s.data を触る直前でロック
	s.Lock()
	defer s.Unlock()

	if s.data == nil {
		s.data = make(map[string]*json.RawMessage)
	}
	s.data[key] = (*json.RawMessage)(&b)
	return nil
}
```

デコード処理も同様に並列化が可能なので、`Get`にも同じ修正をいれました。
修正前後でベンチを取ってみたところ以下のようになりました。

``` plain
Before:
BenchmarkGet-4            	 1000000	      1923 ns/op	     272 B/op	       5 allocs/op
BenchmarkParaGet-4        	 1000000	      1000 ns/op	     272 B/op	       5 allocs/op
BenchmarkSet-4            	 1000000	      1159 ns/op	     216 B/op	       3 allocs/op
BenchmarkParaSet-4        	 1000000	      1974 ns/op	     216 B/op	       3 allocs/op

After:
BenchmarkGet-4           	 1000000	      1793 ns/op	     256 B/op	       4 allocs/op
BenchmarkParaGet-4       	 2000000	       845 ns/op	     256 B/op	       4 allocs/op
BenchmarkSet-4           	 1000000	      1212 ns/op	     248 B/op	       4 allocs/op
BenchmarkParaSet-4       	 2000000	       686 ns/op	     248 B/op	       4 allocs/op
```

Paraが付いているのが並列実行したとき、付いていないのが単一のgorotineで実行したときの結果です。
単一gorotineでは修正前後で余り大きな性能差はありませんが、
並列実行の性能が向上していることがわかりますね。

(他にも細々とした修正を入れたので、全部がロックの効果ではないと思いますが)

### ストリーミングAPIを利用する

ファイル保存時にjsonのエンコーディングをしているのですが、
修正前のコードでは`json.MarshalIndent`を使用していました。
`json.MarshalIndent`は結果をメモリ上に出力するので、
メモリの消費量が増え、そのメモリをアロケーションする分だけ性能が劣化します。

`io.Writer`に書き込むだけなら、以下のように`json.NewEncoder`を利用するのが効率的です。

``` go
enc := json.NewEncoder(w)
return enc.Encode(data)
```

### 不要な再エンコードを避ける

元のコードでは一度jsonに変換した値を、ファイル保存時に`string`にキャストしていました。
そのため、出力されたjsonは以下のように文字列の中にjsonが入っている形になります。
この形式だと`"`のエスケープが必要になるので、
処理性能的にも、ファイル容量的にも不利です。

``` go
package main

import (
	"encoding/json"
	"os"
)

func main() {
	b := []byte(`{"Name":"Dante","Height":5.4}`)
	data := map[string]string{
		"human:1": string(b), // ここでキャストしている
	}
	enc := json.NewEncoder(os.Stdout)
	enc.Encode(data)
}
```

``` json
{"human:1": "{\"Name\":\"Dante\",\"Height\":5.4}"}
```

値は既にjsonエンコード済みなので、ファイル出力時に手を加える必要はありません。
以下のように`*json.RawMessage`型に変換することで、
余計な再エンコードを避けることができます。

``` go
package main

import (
	"encoding/json"
	"os"
)

func main() {
	b := []byte(`{"Name":"Dante","Height":5.4}`)
	data := map[string]*json.RawMessage{
		"human:1": (*json.RawMessage)(&b),
	}
	enc := json.NewEncoder(os.Stdout)
	enc.Encode(data)
}
```

``` json
{"human:1":{"Name":"Dante","Height":5.4}}
```

`json.RawMessage`でなく`*json.RawMessage`とポインタを使っているのがポイントです。
`json.RawMessage`だと`[]byte`とみなされてbase64エンコーディングされてしまうのです・・・。

``` go
package main

import (
	"encoding/json"
	"os"
)

func main() {
	b := []byte(`{"Name":"Dante","Height":5.4}`)
	data := map[string]json.RawMessage{
		"human:1": json.RawMessage(b),
	}
	enc := json.NewEncoder(os.Stdout)
	enc.Encode(data)
}
```

``` json
// Go1.7以下で実行時
{"human:1":"eyJOYW1lIjoiRGFudGUiLCJIZWlnaHQiOjUuNH0="}

// Go1.8で実行時
{"human:1":{"Name":"Dante","Height":5.4}}
```

ちなみにこの挙動、1.8で`json.RawMessage`も`*json.RawMessage`と同じ結果になる修正されたようです(この記事を書いていて気がついた)。
1.7以下を切り捨てるなら`json.RawMessage`の方が良さそうですね。

「ストリーミングAPIを利用する」「不要な再エンコードを避ける」をやった結果は以下のとおりです。

``` plain
Before:
BenchmarkSave-4           	     500	   3324647 ns/op	 1418718 B/op	    3121 allocs/op

After:
BenchmarkSave-4          	     500	   2455853 ns/op	 1127372 B/op	    3094 allocs/op
```

### 浅いコピーで並列処理性能を上げる

一度`Set`で`json.RawMessage`に変換されたデータは書き換えられることがないので、
浅いコピーをするだけでスナップショットが簡単にとれます。

``` go
func (s *JSONStore) Snapshot() *JSONStore {
	s.RLock()
	defer s.RUnlock()
	results := make(map[string]*json.RawMessage)
	for k, v := range s.data {
		results[k] = v
	}
	return &JSONStore{
		data:     results,
	}
}
```

一度スナップショットを取ってしまえば、ファイルへの書き込み時にはロックが不要になります。
ファイルの書き込みはI/Oを伴うとても重い処理なので、
この部分をロックの外側に出せるのは非常に効果大です。

``` go
func (s *JSONStore) Save() {
	snapshot := s.Snapshot()

	// snapshotを取ったあとはLock不要
	enc := json.NewEncoder(w)
	return enc.Encode(snapshot.data)
}
```

別gorotineでひたすらSaveを繰り返しながらSetのベンチを取ってみた結果です。
修正前はSaveがほとんどの時間ロックを獲得していまうので、Saveと同程度の性能しか出ません。
修正後はSaveとSetを並列実行できるようになるので、大幅に性能が改善します。

``` plain
Before:
BenchmarkSaveSet-4        	     500	   3260143 ns/op	 1382516 B/op	    3047 allocs/op

After:
BenchmarkSaveSet-4       	 1000000	      1948 ns/op	     914 B/op	       5 allocs/op
```

### 正規表現をなるべく避ける

元のjsonstoreには正規表現でキーを指定して値を取ってくる機能があります。

``` go
func GetAll(re *regexp.Regexp) map[string]json.RawMessage
```

Gopherのみなさんなら御存知の通り、Goの正規表現はとても遅いです。
stringsパッケージなどを使えるよう、関数を受け取るインターフェースの方がよいでしょう。

``` go
func GetAll(matcher func(key string) bool) map[string]json.RawMessage
```

このインターフェースなら簡単なものであれば自分で関数をかけば良いし、
どうしても正規表現が必要な場合は`s.GetAll(re.MatchString)`とやればいいので大きな問題にはなりません。

以下ベンチマークの結果です。Afterの方は正規表現ではなくstringsパッケージを使用しています。

``` plain
Before:
BenchmarkRegex-4          	    3000	    449209 ns/op	  206954 B/op	      67 allocs/op

After:
BenchmarkRegex-4         	    5000	    251788 ns/op	  124483 B/op	      68 allocs/op
```

## 機能追加

実際使うなら最低限こんな機能も必要だよな・・・
といくつか機能追加も行いました。

### アトミックなデータ保存

例えば`humans.json.gz`に保存されたデータを書き換えることを考えます。
単純に書くと以下のようになるでしょう。

``` go
ks, _ := jsonstore.Open("humans.json.gz")

// ksに何か操作を行う

go jsonstore.Save(ks, "humans.json.gz")

// もしpanicしたら・・・？
panic("error!!")
```

ここでもしSaveの最中にプログラムが強制終了してしまったらどうなるでしょう。
書きかけの`humans.json.gz`だけが残り、元のデータが失われてしまう可能性があります。

それを避けるために、一度テンポラリファイルに書き出し、Renameするのが安全です。
たとえ途中でクラッシュしてしまっても、最悪変更前のデータは残ります。

``` go
ks, _ := jsonstore.Open("humans.json.gz")

// ksに何か操作を行う

go func() {
	jsonstore.Save(ks, "humans.json.tmp.gz")
	os.Rename("humans.json.tmp.gz", "humans.json.gz")
}()

panic("error!!")
```

これを勝手にやってくれる`SaveAndRename`という関数を追加しました。

Linuxの場合、Renameはアトミックに行われるので、
サーバを起動したままデータベースのバックアップを取るのも安全にできます。
しかしWindowsの場合、アトミック性は保証されていない模様・・・？
本当は`SafeSave`とかにしたかったけど、Windowsの事情がよくわからなったので、
やってることをそのまま名前にしました。

### 自動保存機能

変更のたびに毎回ファイルに書き込んでいたら、極端に性能が劣化してしまうので、
適当なタイミングで自動保存してくれる機能を追加しました。
次のようにすることで、1000回変更があるたびに保存、
変更回数が1000回に満たなくても最低60秒毎に保存してくれます。

``` go
ks := new(jsonstore.JSONStore)
ks.StartAutoSave("db.json.gz", 60 * time.Second, 1000)
defer ks.StopAutoSave()
```

## まとめ

以下の高速化を行いました。

- ロックの範囲を最小にする
- ストリーミングAPIを利用する
- 不要な再エンコードを避ける
- 浅いコピーで並列処理性能を上げる
- 正規表現をなるべく避ける

また、実際使う際に必要になるであろう、次の機能も追加しました。

- アトミックなデータ保存
- 自動保存機能

これだけあれば、簡単なおもちゃを作るときのデータベースに使うくらいは出来るんじゃないですかね。

プロセス間でデータ共有できない問題はありますが・・・
まあ、そういうときは素直にRedisとかSQLiteとかboltdbとか使って下さい。
