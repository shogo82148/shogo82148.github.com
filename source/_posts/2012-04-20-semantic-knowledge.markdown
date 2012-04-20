---
layout: post
title: "第1回 意味知識勉強会"
date: 2012-04-20 15:12
comments: true
categories: [勉強会, 意味知識勉強会]
---

なんだか誘われたので、行ってきた。
メモメモ。

紹介された論文とか、スライドは[自然言語処理研究室の意味知識勉強会のページ](http://www.jnlp.org/makabi/semantic_knowledge)からどうぞ。

## 関連学会
- ACL
- AAAI
- IJCNLP
- Coling
- JIST
- 人工知能学会誌
- 自然言語処理(学会誌)

## 背景
- 人工知能の目指すところ
- 常識知識(common-sense knowledge)が必要

## 知識表現
- オントロジー(ontology)
- 上位オントロジー 具体的な事象を対象としないオントロジー
    - 常識オントロジー(Common-Sence Ontology)
        - OpenCyc
    - 語彙オントロジー(e.g. WordNet)
    - 形式オントロジー

### OpenCyc
- 常識知識をデータベース化するCyc Project の一部。
- 専門家の手によって、手作業で構築されているオントロジー。

### Open Mind Common Sense(OMCS)
- 機械的な常識知識獲得プロジェクト。
- 獲得した知識は ConceptNet というデータベースに取り込まれる。
- GithubにデータベースアクセスのためのAPIが上がってるよ。


## Recognizing Textual Entailment(RTE)

- テキスト含意関係認識
- テキスト(Text)に対する仮定(Hypothesis)が含意している・矛盾している・Uknownであるかを判定するタスク
- RTEの初期のデータセットは無料で公開されている


## 論文紹介:Types of Common-Sense Knowledge Needed for Recognizing Texual Entailment

- RTE-5データセットから常識知識がなければ解けないものを「人手」で選択
    - 単語の単純な言い換えなどで解決できないもの
    - 600あるデータセットから108個見つけた
- 仮説が含意していると判定されるために必要な根拠を考える
- 分類して整理したよ！
    - 必要とされる回数が多いカテゴリは重要だよね！(ホント？元のデータセットに偏りない？)
    - 言語処理でよく使うpart-of, is-a の様な関係が使われるのは、全体の40%でしかない
    - 分類が正しさを表す指標としてκ値(Fleiss's κ)を使って評価

20のカテゴリは大きく3つ分けられる

- Form-based Categories
    - 因果関係とか
- Content-based Categories
    - 計算しないといけない奴とか
    - 地理関係とか
- Miscellaneous Categories
    - みんなやっているから、この人もやっているはず！みたいな根拠のない関係
    - Omniscience(全知)

