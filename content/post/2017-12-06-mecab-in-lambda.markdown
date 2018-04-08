---
layout: post
title: "MeCabをAWS Lambdaで動かす(2017年版)"
slug: mecab-in-lambda
date: 2017-12-06 05:39:57 +0900
comments: true
categories: [aws-lambda, python, mecab]
---

[AWS Lambda上で鯖(Mackerel)の曖昧性問題を機械学習で解決しよう](http://www.yasuhisay.info/entry/saba_disambiguator)の記事の中で、
Lambda上でMeCabを動かすことについて以下のように触れられています。

> 日本語を扱う自然言語処理ではMeCabを扱うことが多いですが、Lambda上でMeCabを動かすのは一手間必要なようです。

確かにLambda上でMeCabを動かすのは一手間必要です。
しかし、参照している記事は少し古くて、今はもう少し手軽にできるようになっています。

ブコメでも言及しましたが、改めて記事として残しておこうと思います。

<!-- More -->

## ビルド方法(2017年版)

結論から言うと [Norio Kimura さんのコメント](https://shogo82148.github.io/blog/2016/02/10/mecab-in-lambda/#comment-2550852533) 通りにビルドするのが、2017年12月現在一番楽な方法です。
(お返事すっかり忘れていてスイマセン・・・情報提供ありがとうございます)

> 調べてみると、AWS Lambda では環境変数 LD_LIBRARY_PATH が既に設定されていて /var/task/lib を含んでいました。元記事で ./configure --prefix=$PROJECT_HOME/local ではなく ./configure --prefix=$PROJECT_HOME とすればライブラリとの動的リンクは何もしなくても実現できます。さらにコードが展開されるディレクトリ /var/task を固定値だと決め打ちして PROJECT_HOME を /var/task にして開発すれば MeCab に渡すパラメーターの設定（-d, -r）も不要になります。undocumented な仕様に２つも依存していて気持ち悪いですが、MeCab を呼ぶ側のコードを Lambda 用に変更する必要がなくなります。

コメント中の元記事というのは、こちらの記事のことです。

- [AWS Lambda で MeCab を動かす](https://dev.classmethod.jp/cloud/aws-lambda-with-mecab/)

``` bash install.sh
export PROJECT_HOME=/var/task # LAMBDA_TASK_ROOT

# 1. プロジェクト用にディレクトリを作成
mkdir -p "$PROJECT_HOME"

# 2. MeCabのダウンロードとインストール
# googlecodeサービス終了に伴い、ダウンロードURLが元記事と変わっていることに注意
cd "$HOME"
curl -fsSL "https://drive.google.com/uc?export=download&id=0B4y35FiV1wh7cENtOXlicTFaRUE" -o mecab.tar.gz
cd mecab-0.996
./configure --prefix="$PROJECT_HOME" --enable-utf8-only # ※ここでのprefix指定がポイント
make && make install

# 3. 辞書のダウンロードとインストール
cd "$HOME"
curl -fsSL "https://drive.google.com/uc?export=download&id=0B4y35FiV1wh7MWVlSDBCSXZMTXM" -o mecab-ipadic.tar.gz
tar zvxf mecab-ipadic.tar.gz
cd mecab-ipadic-2.7.0-20070801
export PATH=$PROJECT_HOME/bin:$PATH
./configure --prefix="$PROJECT_HOME" --enable-utf8-only # ※ここでのprefix指定がポイント
make && make install

# 4. Python用MeCab-bindingをインストール
pip install -t "$PROJECT_HOME" -r mecab-python
```

## Lambda関数を書いてみる

上記方法でMeCabをインストールすると[AWS Lambda で MeCab を動かす(改)](https://shogo82148.github.io/blog/2016/02/10/mecab-in-lambda/)で紹介したコードは以下のように簡略化できます。

``` python lambda_function.py
# coding=utf-8
import os
import settings

import logging
logger = logging.getLogger(__name__)
logger.setLevel(settings.LOG_LEVEL)

"""
# https://shogo82148.github.io/blog/2016/02/10/mecab-in-lambda/ にあったpreload処理は不要になります。
# preload libmecab
import ctypes
libdir = os.path.join(os.getcwd(), 'local', 'lib')
libmecab = ctypes.cdll.LoadLibrary(os.path.join(libdir, 'libmecab.so'))
"""

import MeCab

# prepare Tagger
"""
# 辞書のパスの明示的な指定が不要になります。
dicdir = os.path.join(os.getcwd(), 'local', 'lib', 'mecab', 'dic', 'ipadic')
rcfile = os.path.join(os.getcwd(), 'local', 'etc', 'mecabrc')
default_tagger = MeCab.Tagger("-d{} -r{}".format(dicdir, rcfile))
unk_tagger = MeCab.Tagger("-d{} -r{} --unk-feature 未知語,*,*,*,*,*,*,*,*".format(dicdir, rcfile))
"""
default_tagger = MeCab.Tagger("")
unk_tagger = MeCab.Tagger("--unk-feature 未知語,*,*,*,*,*,*,*,*")

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

## 解決した課題と未解決の課題

この方法は undocumented な仕様に依存しているという課題がありましたが、一部は解決しています。

### 環境変数 LD_LIBRARY_PATH の設定に依存

これについては2017年12月現在ドキュメントに明示されています。

- [Lambda 関数で使用できる環境変数](http://docs.aws.amazon.com/ja_jp/lambda/latest/dg/current-supported-versions.html#lambda-environment-variables)

> /lib64、/usr/lib64、LAMBDA_TASK_ROOT、LAMBDA_TASK_ROOT/lib が含まれます。ヘルパーライブラリおよび関数コードの保存に使用されます。

「zip ファイルが展開されるパス」と「zip ファイルが展開されるパス/lib」が含まれているので問題ありません。

また、[前回の記事](https://shogo82148.github.io/blog/2016/02/10/mecab-in-lambda/)を書いたときは環境変数の上書きは出来ませんでしたが、現在では可能になっています。

- [【アップデート】AWS Lambdaで環境変数を使えるようになりました！！！](https://dev.classmethod.jp/cloud/aws/aws-lambda-env-variables/)

### .zip ファイルが展開されるパスを決め打ち

これに関してはドキュメントに明示的な記載を見つけることが出来ませんでした。
決め打ちが怖い人は `LAMBDA_TASK_ROOT` 環境変数を参照することをオススメします。

``` python lambda_function.py
root = os.environ.get("LAMBDA_TASK_ROOT", os.getcwd()) 
dicdir = os.path.join(root, 'lib', 'mecab', 'dic', 'ipadic')
rcfile = os.path.join(root, 'etc', 'mecabrc')
default_tagger = MeCab.Tagger("-d{} -r{}".format(dicdir, rcfile))
unk_tagger = MeCab.Tagger("-d{} -r{} --unk-feature 未知語,*,*,*,*,*,*,*,*".format(dicdir, rcfile))
```

## まとめ

MeCabをAWS Lambdaで動かす(2017年版)最新版をお伝えしました。
通常のインストール方法との差はprefixの指定だけなので、
今までMeCabを利用していた人にとってはさほど高いハードルではないと思います。

とはいえ、依然としてLambda関数ビルド専用のLinux環境を用意する煩雑さはあります。
オフィシャルに提供されているAMIに加え、
[lambci/docker-lambda](https://github.com/lambci/docker-lambda)Dockerイメージを使うという手もありますが、
Goのクロスコンパイルの簡単さはやはり魅力的ですね・・・。

## オマケ

[グロンギ語語翻訳機](https://shogo82148.github.io/Grongish/) はこの方法でMeCabをLambda上で動かし、
API Gateway を用いてAPIとして公開しています。
実装例として遊んでみて下さい。

## 参考

- [AWS Lambda で MeCab を動かす](https://dev.classmethod.jp/cloud/aws-lambda-with-mecab/)
- [【改】AWS Lambda で MeCab を動かす](https://dev.classmethod.jp/cloud/improved-aws-lambda-with-mecab/)
- [AWS Lambda で JNI を利用する（MeCab を例として）](https://qiita.com/norioxkimura/items/5ba3699cec54070566dc)
- [Lambda 実行環境と利用できるライブラリ](http://docs.aws.amazon.com/ja_jp/lambda/latest/dg/current-supported-versions.html)
- [lambci/docker-lambda](https://github.com/lambci/docker-lambda)
- [AWS Lambda で MeCab を動かす(改)](https://shogo82148.github.io/blog/2016/02/10/mecab-in-lambda/)
