---
layout: post
title: "MeCabをPythonから使う注意点とか"
date: 2012-12-15 17:38
comments: true
categories: [NLP, MeCab, Python]
---

日本語の文章をコンピュータで色々いじるときに，
必ずと言っていいほどよく使うのが形態素解析器．
スペースなどの明示的な区切りの無い日本語を単語に分割してくれるツールです．
中でもMeCabが非常に有名で，さまざまなところで使われています．

MeCabはいろいろな言語から呼び出すことができます．
自然言語処理の分野ではPythonが人気のようですね．僕も使っています．
しかし，MeCabをPythonから使う場合，注意する点がいくつかあります．
そこにハマっている後輩を見かけたので，文章として残しておくことにします．
Python2系が対象です(3系はよくわからない)．
注意するのは以下の二点です．

- MeCabに渡す文字列はencode，戻ってきた文字列はdecodeする
- MeCabに渡した文字列は必ず変数に入れておく

<!-- More -->

## EncodeとDecode

Python2系の文字列には，バイト列として扱われる文字列(str)と，Unicodeで表現された文字列(unicode)があります．
日本語を扱う場合，strだといろいろ問題があるので，特に理由がなければunicodeを使うべきです．
しかし，MeCabはstrしか受け付けません．
そこでMeCabに渡す直前・直後でencode・decodeするようにします．

```python
import MeCab
tagger = MeCab.tagger('-Owakati')
text = u'MeCabで遊んでみよう！'

result = tagger.parse(text) # エラー！

encoded_text = text.encode('utf-8') # encodeが必要
encoded_result = tagger.parse(text)
result = result.decode('utf-8') # 必ずdecode
```

`'utf-8'`の部分は辞書の文字コードに合わせて適宜書き換えてください．
デフォルトはeuc-jpですが，utf-8の方が幸せになれると思います．


## 必ず変数に入れる

次にMeCabの作ったノードに直接アクセスして，品詞情報などを取ってくることを考えます．
適当に書いてみるとこんな感じでしょうか．

```python
import MeCab
tagger = MeCab.tagger('')
text = u'MeCabで遊んでみよう！'

node = tagger.parseToNode(text.encode('utf-8'))
while node:
    #printはstrを渡す必要があるのでdecodeは不要
    print node.surface + '\t' + node.feature
    node = node.next
```

MeCabに渡す直前にencodeもしているので上手く動きそうです．
(decodeしてないのはprintに渡すためなので気にしなくておｋ)
しかし，このコードの出力は下のような悲惨なものとなるのです
(ブラウザさんに配慮して一部修正，環境によっても違うと思います)

``` plain
        BOS/EOS,*,*,*,*,*,*,*,*
MeCab   名詞,一般,*,*,*,*,*
        ??   助詞,格助詞,一般,*,*,*,で,デ,デ
?詞,?   動詞,自立,*,*,五段・バ行,連用タ接続,遊ぶ,アソン,アソン
???     助詞,接続助詞,*,*,*,*,で,デ,デ
??,*,*       動詞,非自立,*,*,一段,未然ウ接続,みる,ミヨ,ミヨ
,*,     助動詞,*,*,*,不変化型,基本形,う,ウ,ウ
*,*     記号,一般,*,*,*,*,！,！,！
        BOS/EOS,*,*,*,*,*,*,*,*
```

なぜこのようなことが起きてしまったのでしょう？
答えは`text.encode('utf-8')`の戻り値の寿命と，MeCabノードの構造にあります．

みんなさんが普段お使いのPythonは，C言語で実装されたCPythonだと思います．
「CPythonでは、ガベージコレクションの方式として参照カウント方式とマーク・アンド・スイープ方式を併用」しています
([Python - Wikipedia](http://ja.wikipedia.org/wiki/Python#.E3.83.87.E3.83.BC.E3.82.BF.E5.9E.8B))．
参照カウント方式おかげでCPythonは不要になったオブジェクトを不要になった瞬間に検出し，そのオブジェクトを解放することができます．
つまり実際には5行目を少し細かく見ると，Pythonは以下の処理をします．

1. `text.encode('utf-8')`を呼び出し，"エンコード済みtext"を作成
2. `tagger.parseToNode`を呼び出し，結果を`node`に代入
3. 不要になった** "エンコード済みtext"を破棄 **

ポイントは3番ですね．6行目を実行する前に，"エンコード済みtext"は破棄されてしまいます．

さて，次にMeCabがどのようにノードの情報を扱っているか見てみましょう．
MeCabの言語バインディングのページには，ノードのsurfaceは文字列型であるような定義が書いてありますが，あれは嘘です．
[ソース](http://code.google.com/p/mecab/source/browse/trunk/mecab/src/mecab.h)を見ればわかりますが，みんな大好きポインタとして定義されています．
実はこのポインタ，** "エンコード済みtext"上の開始点を指し示しています **．

つまり，どういうことかというと，

- MeCabはsurfaceを作るのに毎回"エンコード済みtext"からコピペしてた
- しかし，MeCabはPythonにそのことを伝えていなかった
- 不要と判断したPythonによって"エンコード済みtext"はすでに破棄されており，そこには何もなかった

これを解決するにはPythonに"エンコード済みtext"が使用中であることを伝え，破棄されないようにする必要があります．
一番簡単な方法は変数に保存しておくことです．変数のスコープにいる間は"エンコード済みtext"が破棄される心配はありません．

```python
import MeCab
tagger = MeCab.tagger('')
text = u'MeCabで遊んでみよう！'

encoded_text = text.encode('utf-8')
node = tagger.parseToNode(encoded_text) # 変数に入れる！
while node:
    print node.surface + '\t' + node.feature
    node = node.next
```

これで上手く行きます．

encode_textとnodeの寿命が一致している必要があります．
nodeの結果を何度も利用する場合は一度nodeの内容をすべてPythonのリストか何かに格納しましょう．
一度変換してしまえば，ガーベージコレクションは正しく動きます．


## まとめ

- MeCabに渡す文字列はencode，戻ってきた文字列はdecodeする
- MeCabに渡した文字列は必ず変数に入れておく

面倒なのでラッパーを書くかといいかもしれませんね．
もしくは自前で実装とか．
