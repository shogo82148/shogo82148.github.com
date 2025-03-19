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
[グロンギ語翻訳機](https://shogo82148.github.io/Grongish/)が利用されています。翻訳機のバックエンドはMeCabです。

- [日本語とグロンギ語の相互翻訳やってみた](https://shogo82148.hatenablog.com/entry/2012/02/11/181441)
- [MeCabをAWS Lambdaで動かす(2017年版)](https://shogo82148.github.io/blog/2017/12/06/mecab-in-lambda/)

このように今現在も利用されるMeCabですが、2025年3月19日現在、[オリジナルのMeCab](http://taku910.github.io/mecab/)の最終リリースは **2013-02-18** MeCab 0.996 です。
OSやコンパイラのアップデートへの追従、バグフィックス等のメンテナンス作業が完全に止まっています。

このままではマズいということで、勝手にフォークしてパッチを当てたものを作成しました。

- [shogo82148/mecab](https://github.com/shogo82148/mecab)

## なぜ今更Python Bindingを公開するのか

MeCabのPython Bindingには、すでに[mecab-python3](https://pypi.org/project/mecab-python3/)という素晴らしいモジュールがあります。
しかしオリジナルのMeCabに依存しているため、「本当にこのままメンテナンスを続けていけるか？」という点には疑問が残ります。

そこで自前のパッチを当てたMeCabを元に Python Binding を作ることにしました。

## 公開までの作業

Python Bindingのソースコード自体はオリジナルのMeCabに含まれています。
追加で行った作業は「Wheelsの作成」「mecab-python3 互換にするための修正」「GitHub Actions によるアップロードの自動化」です。

### Wheelsの作成

Pythonにはビルド済みのモジュールを配布するための Wheels という仕組みがあります。
とくにWindows上ではMeCabのビルドが大変なので、利用者の利便性のためには Wheels は必須です。
[mecab-python3](https://pypi.org/project/mecab-python3/) が Wheels のビルドを GitHub Actions 上で自動化しているので、
そのワークフローを大いに参考にさせていただきました。

### mecab-python3 互換にするための修正

オリジナルのMeCab Python Bindingは Tagger の引数が単純な空白区切りです。
そのため以下のコードでは、設定ファイル `"mecabrc"` (`mecabrc` でないことに注意！)を読みに行ってしまい、うまく動きません。

```python
import MeCab

# mecab-python3 では動くが、オリジナルのMeCabでは動かない！
tagger = MeCab.Tagger('-r "mecabrc" -d "dicdir"')
```

mecab-python3 では、引数の解析に [shlex](https://docs.python.org/ja/3.13/library/shlex.html) モジュールを使っているので、このような差が生まれます。
これは利用者が混乱するだろうと、[shlexの簡易C++移植板](https://github.com/shogo82148/shlex.cpp)を作成し組み込みました。

### GitHub Actions によるアップロードの自動化

Python Packaging User Guide に GitHub Actions からのアップロード方法がまとまってるので、それを参考にしました。

- [GitHub Actions CI/CD ワークフローを用いてパッケージ配布物のリリースを公開する](https://packaging.python.org/ja/latest/guides/publishing-package-distribution-releases-using-github-actions-ci-cd-workflows/)

[PyPI publish GitHub Action](https://github.com/marketplace/actions/pypi-publish) が GitHub Actions の OpenID Connect に対応しているので、シークレットの管理は不要です。
大まかに以下のようなワークフローを書けばOKです。

```yaml
jobs:
  pypi-publish:
    name: Upload release to PyPI
    runs-on: ubuntu-latest
    environment:
      name: pypi
      url: https://pypi.org/p/<your-pypi-project-name>
    permissions:
      id-token: write  # OIDCを有効化するために必要
    steps:
    # distディレクトリーに成果物を展開する処理を書く

    # dist/ 以下のファイルをPyPIにアップロードする
    - name: Publish package distributions to PyPI
      uses: pypa/gh-action-pypi-publish@release/v1
```

## まとめ

MeCabのPython BindingをPyPIに上げました。

- [mecab](https://pypi.org/project/mecab/)

ぜひご利用ください。

> ぽんぽん跳ねるコードの風\
> 新たなページに朝日が昇る\
> MeCab の知恵を胸に抱き\
> pip の一行で未来へジャンプ\
> うさぎは嬉しく踊り出す 🐇✨\
> 静かなる更新に祝福を贈る!
>
> by [CodeRabbit](https://www.coderabbit.ai/)

## 参考

- [mecab](https://pypi.org/project/mecab/)
- [mecab-python3](https://pypi.org/project/mecab-python3/)
- [言葉は分からないが、やたら耳かきが上手い部族に捕まった。](https://www.dlsite.com/home/work/=/product_id/RJ01353912.html)
- [グロンギ語翻訳機](https://shogo82148.github.io/Grongish/)
- [日本語とグロンギ語の相互翻訳やってみた](https://shogo82148.hatenablog.com/entry/2012/02/11/181441)
- [MeCabをAWS Lambdaで動かす(2017年版)](https://shogo82148.github.io/blog/2017/12/06/mecab-in-lambda/)
- [shogo82148/mecab](https://github.com/shogo82148/mecab)
- [SWIG](https://www.swig.org/)
- [shlex.cpp](https://github.com/shogo82148/shlex.cpp)
- [GitHub Actions CI/CD ワークフローを用いてパッケージ配布物のリリースを公開する](https://packaging.python.org/ja/latest/guides/publishing-package-distribution-releases-using-github-actions-ci-cd-workflows/)
- [PyPI publish GitHub Action](https://github.com/marketplace/actions/pypi-publish)
