---
layout: post
title: "AWS Lambda で MeCab を動かす(改)"
slug: mecab-in-lambda
date: 2016-02-10T14:52:00+09:00
comments: true
categories: [aws-lambda, python, mecab]
---

MeCabのPythonバインディングをいじってた関係で、MeCabについてインターネットをさまよっていたら、
[AWS Lambda で MeCab を動かす](http://dev.classmethod.jp/cloud/aws-lambda-with-mecab/)という記事を見つけました。
Lambdaの計算リソースで形態素解析できるのは楽しいですねー。
ただ実装にまだまだ改善できそうな部分があったので修正してみました。

**2017/12/06追記**
Norio Kimuraさんのコメントを受けて、[MeCabをAWS Lambdaで動かす(2017年版)](https://shogo82148.github.io/blog/2017/12/06/mecab-in-lambda/)を書きました。
以下の手順でも動きますが、少し簡単に出来るようになっています。

<!-- More -->

## 問題点

第一に**「外部プロセスを起動しているので遅い」**という点です。
外部プロセスの起動は非常に重くて数百msかかります。
MeCabは非常に高速で数msもあれば解析が終わるのに、もったいないですよね。

第二に**「OSコマンドインジェクションの危険性がある」**という点です。
解析対象の文字列をコマンドライン引数として渡しており、この際シェルを経由しています。
そのため、`{"sentence": "$(ls)"}`のような文字列を渡すと、シェルがコマンドとして実行してしまいます。
API Gatewayなどで外部に公開した場合、第三者が何でもし放題な状態になってしまいます。


## 頑張ってMeCabをライブラリとして呼ぶ

全ての元凶は外部プロセス起動にあるので、頑張ってMeCabをライブラリとして呼んでみましょう。
そもそもなんで外部プロセス起動をしていたかというと、
`LD_LIBRARY_PATH`が正しく設定されていないため`import MeCab`時に`libmecab.so`を発見できないからです。
なんとかならないものかと探したところ、Stack Overflowにそれっぽい記事がありました。

- [Setting LD_LIBRARY_PATH from inside Python](http://stackoverflow.com/questions/6543847/setting-ld-library-path-from-inside-python)

「環境変数を設定してから自分自身をexecし直す方法」と「`ctypes`を使って絶対パス指定で読み込む方法」が紹介されています。
前者の方がvoteは多いですがLambdaでこれをやるのは大変そうなので、後者で試してみます。

``` python lambda_function.py
# preload libmecab
import os
import ctypes
libdir = os.path.join(os.getcwd(), 'local', 'lib')
libmecab = ctypes.cdll.LoadLibrary(os.path.join(libdir, 'libmecab.so'))
```

一度読み込んでしまったライブラリは再利用されるため、
`import MeCab`はここで読み込んだライブラリにリンクされます(importの順番が重要なの闇な感じがする)。
`LD_LIBRARY_PATH`が正しく設定されている必要はありません。

さて、これで`lambda_function.py`と`tokenizer.py`が分かれている必要がなくなったので、二つを合体してみましょう。

``` python lambda_function.py
# coding=utf-8
import os
import settings

import logging
logger = logging.getLogger(__name__)
logger.setLevel(settings.LOG_LEVEL)

# preload libmecab
import ctypes
libdir = os.path.join(os.getcwd(), 'local', 'lib')
libmecab = ctypes.cdll.LoadLibrary(os.path.join(libdir, 'libmecab.so'))

import MeCab

# prepare Tagger
dicdir = os.path.join(os.getcwd(), 'local', 'lib', 'mecab', 'dic', 'ipadic')
rcfile = os.path.join(os.getcwd(), 'local', 'etc', 'mecabrc')
default_tagger = MeCab.Tagger("-d{} -r{}".format(dicdir, rcfile))
unk_tagger = MeCab.Tagger("-d{} -r{} --unk-feature 未知語,*,*,*,*,*,*,*,*".format(dicdir, rcfile))

DEFAULT_STOPTAGS = ['BOS/EOS']

def lambda_handler(event, context):
    sentence = event.get('sentence', '').encode('utf-8')
    stoptags = event.get('stoptags', '').encode('utf-8').split(',') + DEFAULT_STOPTAGS
    unk_feature = event.get('unk_feature', False)

    tokens = []
    tagger = unk_tagger if unk_feature else default_tagger
    node = tagger.parseToNode(sentence)
    while node:
        feature = node.feature + ',*,*'
        part_of_speech = get_part_of_speech(feature)
        reading = get_reading(feature)
        base_form = get_base_form(feature)
        token = {
            "surface": node.surface.decode('utf-8'),
            "feature": node.feature.decode('utf-8'),
            "pos": part_of_speech.decode('utf-8'),
            "reading": reading.decode('utf-8'),
            "baseform": base_form.decode('utf-8'),
            "stat": node.stat,
        }

        if part_of_speech not in stoptags:
            tokens.append(token)
        node = node.next
    return {"tokens": tokens}

def get_part_of_speech(feature):
    return '-'.join([v for v in feature.split(',')[:4] if v != '*'])

def get_reading(feature):
    return feature.split(',')[7]

def get_base_form(feature):
    return feature.split(',')[6]
```


## 試してみる

[forkして上記の修正をいれたレポジトリ](https://github.com/shogo82148/aws-lambda-ja-tokenizer)を用意したので、READMEにしたがってzipファイルを作り、Lambdaに登録しましょう。
雑なテストですが、Testボタンを5回押しみてログを見てみました。

まずは元記事にあったオリジナルのコードから。

| Duration | Billing Duration | Memory Size | Max Memory Used |
|:---:|:---:|:---:|:---:|
| 280.76 ms | 300 ms | 128 MB | 29 MB |
| 310.00 ms | 400 ms | 128 MB | 29 MB |
| 205.99 ms | 300 ms | 128 MB | 30 MB |
| 205.74 ms | 300 ms | 128 MB | 30 MB |
| 213.96 ms | 300 ms | 128 MB | 30 MB |

外部プロセスを起動しないように修正したバージョンです。

| Duration | Billing Duration | Memory Size | Max Memory Used |
|:---:|:---|:---:|:---:|
| 0.74 ms | 100 ms | 128 MB | 11 MB |
| 0.74 ms | 100 ms | 128 MB | 11 MB |
| 0.70 ms | 100 ms | 128 MB | 11 MB |
| 0.69 ms | 100 ms | 128 MB | 11 MB |
| 0.73 ms | 100 ms | 128 MB | 11 MB |

速くなった！！！


## まとめ

- AWS Lambdaでは外部プロセス起動は案外重たいのでなるべく避ける
- 深遠な理由により外部プロセス起動する場合でもシェルは使わない方が無難
- `LD_LIBRARY_PATH`の設定が必要なときは、`ctypes.cdll.LoadLibrary`を使って直接読みこめばなんとかなる

外部ライブラリを読み込めるのは、いろいろ遊べそうですね・・・


## 追記(2016-02-15)

[pullreq送って](https://github.com/KunihikoKido/aws-lambda-ja-tokenizer/pull/1)取り込んでもらいました。

- [【改】AWS Lambda で MeCab を動かす](http://dev.classmethod.jp/cloud/improved-aws-lambda-with-mecab/)
