---
layout: post
title: "MeCabのPython BindingをPyPIに上げた"
slug: mecab-python-module-is-released
date: 2025-03-19 01:15:00 +0900
comments: true
categories: [mecab, python]
---

MeCabのPython BindingをPyPIに上げました。

- [mecab](https://pypi.org/project/mecab/)

はじめてのPyPI公開なので、モジュールの紹介と、公開までに行った作業についてのメモを残しておきたいと思います。

## 使い方

```plain
pip install mecab
```

もしくは

```plain
python -m pip install mecab
```

でインストール可能です。
辞書は含まれていないので、別途インストールしてください。
たとえば ipadic であれば、

```plain
pip install ipadic
```

でインストール可能です。
以下のように辞書の場所を指定すればすぐに使えます。

```python
import MeCab
import ipadic
tagger = MeCab.Tagger(ipadic.MECAB_ARGS)
print(tagger.parse("図書館にいた事がバレた"))
```

[mecab-python3](https://pypi.org/project/mecab-python3/) のドロップインリプレイスメントになるように作ったので、
`pip install mecab-python3` の代わりに `pip install mecab` するだけで使えるはずです。

## なぜ今更MeCabなのか

[KyTea](http://www.phontron.com/kytea/index-ja.html), [JUMAN++](http://nlp.ist.i.kyoto-u.ac.jp/index.php?JUMAN++),
[Sudachi](https://github.com/WorksApplications/Sudachi), [SentencePiece](https://github.com/google/sentencepiece) 等の
後発の形態素解析エンジンも進んでおり、 MeCab は形態素解析エンジンとしては古株です。
しかしながら、使い勝手の良さや使用例の多さから今なお現役で利用されています。

たとえば、先日リリースされたASMR[言葉は分からないが、やたら耳かきが上手い部族に捕まった。](https://www.dlsite.com/home/work/=/product_id/RJ01353912.html)の制作には
[グロンギ語翻訳機](https://shogo82148.github.io/Grongish/)が利用されています。このバックエンドはMeCabです。

- [日本語とグロンギ語の相互翻訳やってみた](https://shogo82148.hatenablog.com/entry/2012/02/11/181441)
- [MeCabをAWS Lambdaで動かす(2017年版)](https://shogo82148.github.io/blog/2017/12/06/mecab-in-lambda/)

このように今現在も利用されるMeCabですが、2025年3月19日現在、[オリジナルのMeCab](http://taku910.github.io/mecab/)の最終リリースは **2013-02-18** MeCab 0.996 です。
OSやコンパイラのアップデートへの追従、バグフィックス等のメンテナンス作業が完全に止まっています。

このままではマズいということで、勝手にフォークしてパッチを当てたものを作成しました。

- [shogo82148/mecab](https://github.com/shogo82148/mecab)

## なぜ今更Python Bindingをあげるのか

MeCabのPython Bindingには、すでに[mecab-python3](https://pypi.org/project/mecab-python3/)という素晴らしいモジュールがあります。
しかしオリジナルのMeCabに依存しているため、「本当にこのままメンテナンスが続いていくか？」という点には疑問が残ります。
