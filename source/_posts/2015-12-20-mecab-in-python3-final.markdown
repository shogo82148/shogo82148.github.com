---
layout: post
title: "MeCabをPython3から使う(続報)"
date: 2015-12-20 01:03
comments: true
categories: [python, mecab]
---

Python3からMeCabを扱おうとして挫折していたのですが
([MeCabをPython3から使う(中間報告)](http://shogo82148.github.io/blog/2015/06/02/mecab-in-python3/))、
改めて調査して、上手くいかなかった原因が分かったのでご報告します。

<!-- More -->

## おさらい

Python3で以下のようにMeCabを使おうとすると

``` python
import MeCab
tagger = MeCab.Tagger('')
text = u'MeCabで遊んでみよう!'
node = tagger.parseToNode(text)
while node:
    print(node.surface + '\t' + node.feature)
    node = node.next
```

surfaceが全く読み取れないという現象に遭遇していました。

``` plain
BOS/EOS,*,*,*,*,*,*,*,*
名詞,一般,*,*,*,*,*
助詞,格助詞,一般,*,*,*,で,デ,デ
動詞,自立,*,*,五段・バ行,連用タ接続,遊ぶ,アソン,アソン
助詞,接続助詞,*,*,*,*,で,デ,デ
Traceback (most recent call last):
  File "m.py", line 10, in <module>
  print( node.surface + '\t' + node.feature )
  UnicodeDecodeError: 'utf-8' codec can't decode byte 0xa3 in position 1: invalid start byte
```

## 解決策

詳しい原因なんてどうでもいいからMeCabを使いたい人向けに、最初に解決方法を書いておきます。
以下のように本当に解析したい対象を解析する前に、一度`parse`をしておけばOKです。

``` python
import MeCab
tagger = MeCab.Tagger('')

tagger.parse('') # これ重要！！！！

text = u'MeCabで遊んでみよう!'
node = tagger.parseToNode(text)
while node:
    print(node.surface + '\t' + node.feature)
    node = node.next
```

解析結果を全く使わずに捨てていて無駄のように思えますが、この一行が重要です！
これを入れると以下のように正常に解析ができます。

``` plain
        BOS/EOS,*,*,*,*,*,*,*,*
MeCab   名詞,一般,*,*,*,*,*
で      助詞,格助詞,一般,*,*,*,で,デ,デ
遊ん    動詞,自立,*,*,五段・バ行,連用タ接続,遊ぶ,アソン,アソン
で      助詞,接続助詞,*,*,*,*,で,デ,デ
みよ    動詞,非自立,*,*,一段,未然ウ接続,みる,ミヨ,ミヨ
う      助動詞,*,*,*,不変化型,基本形,う,ウ,ウ
!       名詞,サ変接続,*,*,*,*,*
        BOS/EOS,*,*,*,*,*,*,*,*
```

解析を行うメソッドであれば`parseToNode`でも構いません。


## 原因

結果が壊れる直接的な原因は[MeCabをPythonから使う注意点とか](http://shogo82148.github.io/blog/2012/12/15/mecab-python/)で紹介したように、
解析対象の文字列がPythonの管理下から外れGCされてしまったからです。
高速化のために余計なメモリーアロケーションを避けており、メモリ管理は利用者の責任というわけです。

なんとかならないものかと、よくソースコードを追ってみると`MECAB_ALLOCATE_SENTENCE`というフラグをONにすれば
[メモリ管理をMeCabに任せることができる](https://github.com/taku910/mecab/blob/6b392e3960a4f5562e18742cb390ae1e22353d2a/mecab/src/tagger.cpp#L769-L775)ということがわかりました。
これはTaggerを作るときの引数から指定でき、`-C`もしくは`--allocate-sentence`というオプションがこのフラグに対応します。
これを有効にすれば解決だ！と思ったのですが、実は各種言語バインディングからMeCabを利用する場合は[デフォルトで有効になっています](https://github.com/taku910/mecab/blob/6b392e3960a4f5562e18742cb390ae1e22353d2a/mecab/swig/MeCab.i#L102)。

何故だ・・・とさらにコードを追ってみると`parseToNode`の実装が[以下のようになっていること](https://github.com/taku910/mecab/blob/6b392e3960a4f5562e18742cb390ae1e22353d2a/mecab/src/tagger.cpp#L602-L611)がわかりました。

``` c
const Node *TaggerImpl::parseToNode(const char *str, size_t len) {
  Lattice *lattice = mutable_lattice();
  lattice->set_sentence(str, len); // このなかでMECAB_ALLOCATE_SENTENCEフラグが立ってるか確認している
  initRequestType();               // このなかでMECAB_ALLOCATE_SENTENCEフラグを立ててる
  if (!parse(lattice)) {
    set_what(lattice->what());
    return 0;
  }
  return lattice->bos_node();
}
```

**MECAB_ALLOCATE_SENTENCEフラグを立てる前に、立っているかを確認しています。**

解析対象の文字列を渡す前に`initRequestType()`を呼んで`MECAB_ALLOCATE_SENTENCE`フラグを立てれば良いのですが、
残念ながら`initRequestType()`も`mutable_lattice()`もprivateなメソッドなのでPythonから直接呼ぶことはできません。
そこで`parse()`を使って`initRequestType()`を間接的に呼び出せば問題解決というわけです。


## 別解

`mutable_lattice()`は触れなくても、自分で作ったlatticeなら自由にいじれるので、
以下のようにlatticeをPython側で作るのも手ですね。

``` python
lattice = MeCab.Lattice()
import MeCab
tagger = MeCab.Tagger('')
lattice = MeCab.Lattice()
text = u'MeCabで遊んでみよう!'
lattice.set_sentence(text)
tagger.parse(lattice)
node = lattice.bos_node()
while node:
    print(node.surface+"\t"+node.feature)
    node = node.next
```

いずれの方法でもnodeからlatticeやtaggerへの参照がない(実際はあるけどPythonはそのことを知らない)ので、
解析結果を読んでいる最中にlatticeやtaggerがGCで回収されないよう注意しましょう。
