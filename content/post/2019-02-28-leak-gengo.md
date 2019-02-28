---
layout: post
title: "新元号の候補約4510万件が漏洩！！"
slug: leak-gengo
date: 2019-02-28 18:26:00 +0900
comments: true
categories: []
---

平成の次の元号候補、4510万4656件の漏洩が確認された。

- [テキスト形式](https://s3-ap-northeast-1.amazonaws.com/shogo82148-jis0208/product.txt) (301MB)
- [gz圧縮版](https://s3-ap-northeast-1.amazonaws.com/shogo82148-jis0208/product.txt.gz) (108MB)

政府は「[新元号、情報管理を徹底へ　漏洩なら差し替え](https://www.nikkei.com/article/DGXMZO41696000V20C19A2PP8000/)」との方針を示しており、
早急な差し替え対応を行うと思われる。

-----

と、まあ、二番煎じなわけですが。$$ $$

<blockquote class="twitter-tweet" data-lang="ja"><p lang="ja" dir="ltr">新元号は漏洩すると変更されるということなので常用漢字2文字の全組み合わせ約228万通りをすべて記載したテキストファイルを作成しました。漏洩させていきましょう。<a href="https://t.co/G06utDbgka">https://t.co/G06utDbgka</a> <a href="https://t.co/8UcPDqNdXo">pic.twitter.com/8UcPDqNdXo</a></p>&mdash; いんぐらむ (@kazuokiriyama_) <a href="https://twitter.com/kazuokiriyama_/status/1100347532675149825?ref_src=twsrc%5Etfw">2019年2月26日</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

ただ、このツイートのリプライのもあるとおり漏洩漏れがあるようですし、
新元号に使われる可能性のある漢字は常用漢字ではない可能性だってあると僕は考えています。
だって、お国のやることですからね。下手したら改元に合わせて「常用漢字の見直しもやる」ということだって考えられます。

というわけで、僕は ShiftJIS, EUC-JP で表現可能な文字列まで範囲を広げることにしました。
Unicodeへの統一が進んでいるとはいえ、 ShiftJIS, ECU-JP で動いているレガシーなシステムもあるでしょうし、この範囲に収めるだろうなという予想です。

ShiftJISからUnicodeへの変換には規則性がないので、変換テーブルを使う必要があります。
[Goのコードを漁った](https://github.com/golang/text/blob/master/encoding/japanese/tables.go) ら以下の変換表を参照していたので、これを利用しました。

- https://encoding.spec.whatwg.org/index-jis0208.txt

非漢字も含まれているので、雑に漢字を絞ったあと、

```
curl https://encoding.spec.whatwg.org/index-jis0208.txt | grep CJK | cut -f3 | cut -d' ' -f1 | sort | uniq > kanji.txt
```

直積列挙スクリプトに突っ込めば出来上がり。

```python
import sys
import itertools

a = [l.rstrip() for l in sys.stdin]

for l in itertools.product(a, a):
    print(''.join(l))
```

```
python product.py < kanji.txt > product.txt 
```

本当は全部Shell芸したかったけど、Pythonスクリプトに頼ってしまいました。
もっと強い芸人さん、よろしくおねがいします。

あと、途中で「候補の漢字が重複している」との報告を受けて調べたのですが、ShiftJIS->Unicodeの変換は一意に決まるけど、Unicode->ShiftJISは一意に決まらない、という闇があるようです。
もうUnicodeの闇でお腹いっぱいなので深くは調べていません。

-----

最後に

念のため「どうせ公表後に新元号を追加したデーターを作っただけだろ！」と言われないよう、ハッシュ値を貼っておきます。

<blockquote class="twitter-tweet" data-conversation="none" data-lang="ja"><p lang="in" dir="ltr">元号候補一覧 <a href="https://t.co/OCaFAriJIt">https://t.co/OCaFAriJIt</a> SHA512: 245f3f616f3ee627ee2e2edd426663bba86fd2fbdb756505ff9d9f69fed7d6f16e2e711cf03cb1fb1b9efdcc261bf1b968de0756660cfa98cf1acbd43f89ae18</p>&mdash; Ichinose Shogo (@shogo82148) <a href="https://twitter.com/shogo82148/status/1101052320303898625?ref_src=twsrc%5Etfw">2019年2月28日</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

<blockquote class="twitter-tweet" data-conversation="none" data-lang="ja"><p lang="zh" dir="ltr">元号候補一覧(gz圧縮) <a href="https://t.co/qlUkfZkwod">https://t.co/qlUkfZkwod</a> SHA512: c3802935335371bf264114fe0c005220a2dcbf8ab1c8e925b9b8563171221b2598cb8a5fb8a9adc9d75646826140ee2998123de26d4fbcf5fa7ea17b39f8e76d</p>&mdash; Ichinose Shogo (@shogo82148) <a href="https://twitter.com/shogo82148/status/1101052520065953792?ref_src=twsrc%5Etfw">2019年2月28日</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
