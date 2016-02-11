---
layout: post
title: "MeCabのGolangバインディングを書いてみた"
date: 2016-02-11 19:32
comments: true
categories: [mecab, golang]
---


Golangから[MeCab](http://taku910.github.io/mecab/)を呼び出すライブラリ探せばあるにはあるのですが、
なんだかどれもメモリ管理がちょっと怪しいんですよね・・・。

- [GolangでMeCabを使う。](http://yukihir0.hatenablog.jp/entry/2015/01/18/164446)
  - [yukihir0/mecab-go](https://github.com/yukihir0/mecab-go)
- [Go言語から mecab を使う - Qiita](http://qiita.com/rerofumi/items/2bb1e49b20f2175ecaac)
  - [rerofumi/mecab](https://bitbucket.org/rerofumi/mecab)
- [Go で Mecab を使ってみた](http://d.hatena.ne.jp/gtaka555/20091116/p2)

メモリ管理は[bluele/mecab-golang](https://github.com/bluele/mecab-golang)が一番しっかりしているっぽいですが、
libmecabの一番高機能だけど面倒な使い方しか対応していなくて、ちょっとカジュアルに遊ぶにはつらい。

というわけで、カジュアルな用途から高度な使い方まで対応したWrapperを書いてみました。

- [shogo82148/go-mecab](https://github.com/shogo82148/go-mecab)

<!-- More -->

## 使い方

READMEと[godocのexamples](https://godoc.org/github.com/shogo82148/go-mecab#pkg-examples)からのコピペになってしまいますが、
簡単に使い方の紹介です。

### インストール

`go get`で取ってくることはできますが、事前にlibmecabとリンクするための設定が必要です。

``` bash
$ export CGO_LDFLAGS="-L/path/to/lib -lmecab -lstdc++"
$ export CGO_CFLAGS="-I/path/to/include"
$ go get github.com/shogo82148/go-mecab
```

`mecab`コマンドと一緒に`mecab-config`がインストールされているはずなので、
それを使うのが楽でしょう。

``` bash
$ export CGO_LDFLAGS="`mecab-config --libs`"
$ export CGO_FLAGS="`mecab-config --inc-dir`"
$ go get github.com/shogo82148/go-mecab
```

MeCabはデフォルトで`/usr/local/`以下に入るので、他の実装では決め打ちしている例が多いですが、
100%とは言い切れないので面倒ですが都度指定にしてあります。
cgoはpkg-configに対応しているで、MeCab側が対応してくれると環境変数の設定が不要になってもっと楽なんですけどね。


### カジュアルに使う

`Parse`を使うと`mecab`コマンドと同等の結果を文字列として受け取れます。

``` go
tagger, err := mecab.New(map[string]string{})
if err != nil {
    panic(err)
}
defer tagger.Destroy()

result, err := tagger.Parse("こんにちは世界")
if err != nil {
    panic(err)
}
fmt.Println(result)
```

オプションの渡し方ですが、いろいろ考えた結果`map`で渡すようにしてみました。
(Perlの[Text::MeCab](https://metacpan.org/release/Text-MeCab)からのインスパイア)
例えば、`mecab.New(map[string]string{"output-format-type": "wakati"})`のようにすると、分かち書きで出力されます。


### ノードの詳細情報にアクセスする

`ParseToNode`を使うと表層表現と品詞が最初から分かれた形で取得できます。
生起コストのようなより詳細な情報も取れます。

``` go
tagger, err := mecab.New(map[string]string{})
if err != nil {
    panic(err)
}
defer tagger.Destroy()

// XXX: avoid GC problem with MeCab 0.996 (see https://github.com/taku910/mecab/pull/24)
tagger.Parse("")

node, err := tagger.ParseToNode("こんにちは世界")
if err != nil {
    panic(err)
}

for ; node != (mecab.Node{}); node = node.Next() {
    fmt.Printf("%s\t%s\n", node.Surface(), node.Feature())
}
```

以前紹介した[MeCabをPython3から使う(続報)](http://shogo82148.github.io/blog/2015/12/20/mecab-in-python3-final/)の件、
実はPythonに限ったことではなく、公式で提供されている全ての言語バインディングで発生します。
(例えばRubyでも発生するっぽい: [Ruby + MeCab で Segmentation fault が発生した場合の対処](http://qiita.com/Salinger/items/3448d481b5b1e6cd2efb))
Pythonが参照カウント方式のGCを採用しているので、たまたま発見されるのが速かったというだけですね(Rubyだとメモリを圧迫するまで落ちないらしい)。

そして、公式で提供されているバインディングを参考に書いたので、今回のGo版でも発生します。
[MeCab側で対応してもらった](https://github.com/taku910/mecab/pull/24)のでわざわざバインディング側で対応することもないだろうとの考えから、go-mecabでは特に対策をとっていません。
MeCab 0.996以下を使っている方は注意してください。(残念ながら0.996がまだ最新リリースだけど・・・)


### Modelを共有する

[MeCab ライブラリ](http://taku910.github.io/mecab/libmecab.html)で紹介されている、マルチスレッド環境の場合での使い方にも対応しています。

``` go
model, err := mecab.NewModel(map[string]string{})
if err != nil {
    panic(err)
}
defer model.Destroy()

tagger, err := model.NewMeCab()
if err != nil {
    panic(err)
}
defer tagger.Destroy()

lattice, err := mecab.NewLattice()
if err != nil {
    panic(err)
}
defer lattice.Destroy()

lattice.SetSentence("こんにちは世界")
err = tagger.ParseLattice(lattice)
if err != nil {
    panic(err)
}
fmt.Println(lattice.String())
```

複数のゴルーチンから`model`や`tagger`を共有できると思います。`lattice`だけはゴルーチン毎に生成してください。
(へいれつへーこーしょりとかよくわかってないですが、スレッドセーフならゴルーチンセーフという認識であってますよね？)
メモリ効率もいいのでは(未検証なので誰か確かめて・・・)。


## GoからCへ文字列を渡す方法について

### 一般的な方法

GoからCへ文字列を渡すには、Goの文字列を`C.CString`を使ってCの文字列に変換する必要があります。

``` go
cstring := C.CString(gostring)
defer C.free(unsafe.Pointer(cstring))

C.some_useful_function(cstring)
```

ここで注意が必要なのは`C.CString`の戻り値はGoのガーベージコレクションの対象から外れるということです。
C側での使用状況をGoのランタイムが把握しきれないからですね。
`C.free`を使って明示的に開放してあげないとメモリーリークになります。
巷にあふれているMeCabバインディングはここがちょっと甘いものがほとんどでした。


### 黒魔術を使う

別に`C.CString`でも十分だとは思ったのですが、
[golang で string を []byte にキャストしてもメモリコピーが走らない方法を考えてみる](http://qiita.com/mattn/items/176459728ff4f854b165)を見て、つい魔が差してしまいました。
Goの`string`をメモリーコピーを避けて`[]byte`にできるのなら、Cの文字列型(`*C.char`)でも同じことができるはず・・・！

``` go
cstring := *(**C.char)(unsafe.Pointer(&gostring))
C.some_useful_function2(cstring, len(gostring))
```

通常C言語の文字列は末尾に`'\\0'`が番兵としてついており、`C.CString`はそこら辺の事情を考慮してくれます。
しかし、この方法は番兵がいないため、文字列の長さを別途渡してあげる必要があります。
幸いMeCabは文字列長さを明示するインターフェースを備えているので、そちらを使えばOKでした。

Goの`string`はもちろんGCの対象なので、GCには要注意です。
関数内で閉じた状態にするのが無難ですね。
また、空文字が渡されるとヌルポで死んでしまうようなので、そこにも注意しましょう。


## まとめ

- カジュアルな用途から高度な使い方まで対応したMeCabのWrapperを書いてみました
  - [shogo82148/go-mecab](https://github.com/shogo82148/go-mecab)
- MeCab 0.996 と一緒に使う場合はGCに注意しましょう
- GoからCへの文字列の渡し方を紹介しました
  - `C.CString`を使った方法
  - `unsafe.Ponter`を使った方法

ピンポーン **unsafe をご使用になる時は、用法・用量を守り正しくお使い下さい。**
