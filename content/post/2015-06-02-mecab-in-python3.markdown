---
layout: post
title: "MeCabをPython3から使う(中間報告)"
date: 2015-06-02T23:12:00+09:00
comments: true
categories: [mecab, python, python3]
---

先日このようなツイートを見かけて、
「Python3になってGCの挙動変わったのかな？」と疑問に思ったので調査してみました。

<blockquote class="twitter-tweet" data-lang="ja"><p lang="ja" dir="ltr">MeCabをPythonから使う注意点とか - Shogo&#39;s Blog <a href="http://t.co/vJnOqZfUd7">http://t.co/vJnOqZfUd7</a> <a href="https://twitter.com/shogo82148?ref_src=twsrc%5Etfw">@shogo82148</a>さんから python3だと変数に代入しなくても動くのだけど2.xでは留意しないといけない</p>&mdash; NOKUBI Takatsugu野首貴嗣 (@knok) <a href="https://twitter.com/knok/status/605197292086263808?ref_src=twsrc%5Etfw">2015年6月1日</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>


<!-- More -->

## Python3へのMeCabインストール

手元のPython3.4.3にMeCab Bindingをインストールします。
MeCabの公式(Google Codeサービス停止にともない[github pageへ移行している模様](https://taku910.github.io/mecab/))から落とせる
Python BindingはPython2.x向けのため、setup.pyがそのままでは動きません。
Python3.xでは非互換な文法の変更が入ったので以下のように書き換える必要があります。

``` diff
diff --git a/setup.py.org b/setup.py
index 4486cbb..657945a 100644
--- a/setup.py.org
+++ b/setup.py
@@ -7,7 +7,7 @@ def cmd1(str):
     return os.popen(str).readlines()[0][:-1]
 
 def cmd2(str):
-    return string.split (cmd1(str))
+    return cmd1(str).split()
 
 setup(name = "mecab-python",
        version = cmd1("mecab-config --version"),
```

あとは `python setup.py install` で入ります。

## 動かしてみる

以前書いた「[MeCabをPythonから使う注意点とか](http://shogo82148.github.io/blog/2012/12/15/mecab-python/)」を見返しながら、
GCされて上手く動かない例 をPython3.4.3で動かしてみます。
文字列の扱いが変わったり、print文の扱いが変わったりしているので、その部分だけ書き換えが必要です。

``` python
import MeCab
tagger = MeCab.tagger('')
text = u'MeCabで遊んでみよう！'

node = tagger.parseToNode(text)
# Python2.x ではencode必須だったのが要らなくなった！
# node = tagger.parseToNode(text.encode('utf-8'))

while node:
    print(node.surface + '\t' + node.feature)
	# printは文ではなくなったのでカッコで囲う必要がある
	node = node.next
```

さて、動かしてみましょう。

``` plain
    BOS/EOS,*,*,*,*,*,*,*,*
    名詞,一般,*,*,*,*,*
    助詞,格助詞,一般,*,*,*,で,デ,デ
    動詞,自立,*,*,五段・バ行,連用タ接続,遊ぶ,アソン,アソン
    助詞,接続助詞,*,*,*,*,で,デ,デ
Traceback (most recent call last):
  File "m.py", line 10, in <module>
    print( node.surface + '\t' + node.feature )
UnicodeDecodeError: 'utf-8' codec can't decode byte 0xa3 in position 1: invalid start byt
```

surfaceが全く読み取れていない・・・。
最後にはutf-8のデコードができず死んでしまっています。
全然変わってないじゃないか！

変わってないどころか、状況はさらに悪くなっています。
解決方法は以前の記事の通り「エンコード済みtext」を変数に保存・・・なのですが、
Python3.x(+SWIG)ではエンコードが自動的に行われてしまうので **ユーザが「エンコード済みtext」にアクセスすることができません！ **

[python3対応 Mecabの紹介](http://samurait.hatenablog.com/entry/Mecab-python3)や
[SWIG 3.0.5で作りなおしたPR](https://github.com/taku910/mecab/pull/16)等を試してみましたが、
同様の症状でした。

## まとめ

- Python3.xでもPython2.xと同様で、元テキストがGCで回収されてしまう
- Python3.xになって回避策が無くなった

ぱっと思いつく回避策は以下のような感じでしょうか・・・。

- 諦めて `parseToNode` を使わず、`parse`の結果を頑張って解析する
- SWIGの設定やC++側の書き方で頑張る(具体策は未調査)

インターフェースを変えずに後者の方法で何とかならないか、
引き続きいじってみようと思います。

## 追記(2015-12-20)

[続報](http://shogo82148.github.io/blog/2015/12/20/mecab-in-python3-final/)を書きました。

## 参考

- [taku910/MeCab](https://github.com/taku910/mecab)
- [MeCab](https://taku910.github.io/mecab/)
- [MeCabをPythonから使う注意点とか](http://shogo82148.github.io/blog/2012/12/15/mecab-python/)
- [Ubuntu14.04とPython3でMeCabを使う方法](http://www.trifields.jp/how-to-use-mecab-in-ubuntu-14-04-and-python-3-1196)
- [python3対応 Mecabの紹介](http://samurait.hatenablog.com/entry/Mecab-python3)
