---
layout: post
title: "RFC9226 Bioctal: Hexadecimal 2.0 の Go 実装を書いてみた"
slug: 2022-04-15-implement-bioctal
date: 2022-04-15 20:44:00 +0900
comments: true
categories: [go, golang]
---

COVID-19 のワクチン接種3回目の副反応におびえているいっちーです。
摂取から5時間経ちましたが、まだ特に症状は表れていません。
翌朝が怖い。

さて、副反応への恐怖を少しでも紛らわせようと、 [RFC9226 Bioctal: Hexadecimal 2.0]((https://www.rfc-editor.org/rfc/rfc9226.html)) を実装してみた、というお話です。

- [shogo82148/go-bioctal](https://github.com/shogo82148/go-bioctal)

## RFC9226 Bioctal: Hexadecimal 2.0

4/1 に公開されていることから分かる通り、Joke RFC です。
実用性はありません・・・が、実装することは可能です。

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">今年のジョークRFC「16進数2.0」。16進数を表記するには0から9の数字にABCDEFを加えた物が一般的だが、01234567cjzwfsbvにする事で、数字かどうかで最上位bitがすぐ分かり、なんとなく形が似た文字から下3bitがすぐに連想できる為humanのbrain cyclesを抑えられるという内容<a href="https://t.co/BsmKFcqv4J">https://t.co/BsmKFcqv4J</a></p>&mdash; Fadis (@fadis_) <a href="https://twitter.com/fadis_/status/1510271358848344066?ref_src=twsrc%5Etfw">April 2, 2022</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script> 

一般的な16進数の変換に使われる文字を、下位3bit が同じもの同士が縦に並ぶよう配置すると、以下のようになります。

| 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| 8 | 9 | A | B | C | D | E | F |

下の段はアルファベットが入るのに、8, 9 だけが数字で不自然ですね(？)
というわけで、下段を英字だけにしたものが Bioctal です。

| 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| c | j | z | w | f | s | b | v |

一般的に人間が一度に覚えられる物事の数は 7±2 と言われています。
16個も文字とそれに対応するbit列を覚えるのは大変です。

Bioctal なら上の段の01234567の8文字についてだけ、そのビット列を覚えておけば十分です。
cjzwfsbvは「形が似ている数字」を思い浮かべてから、ビット列に変換します(似てるか？)。

## 使い方

インターフェースは [encoding/hex](https://pkg.go.dev/encoding/hex) と合わせました。
(というか実装ほぼコピペ。使う文字セットが違うだけで、変換アルゴリズムは一緒ですからね。)

```go
package main

import (
	"fmt"
	"log"

	"github.com/shogo82148/go-bioctal"
)

func main() {
	src := []byte("Hello Gopher!")

	dst := make([]byte, bioctal.EncodedLen(len(src)))
	bioctal.Encode(dst, src)

	fmt.Printf("%s\n", dst)

	// Output:
	// 4c656f6f6v20476v706c657221
}
```

## まとめ

16進数2.0 こと [RFC9226 Bioctal: Hexadecimal 2.0](https://www.rfc-editor.org/rfc/rfc9226.html) の Go 実装を書きました。

-----

ところで RFC9226 は Joke RFC だけあって、ところどころにネタが入ってます。例えば「16進数の数値がベジタリアンの不快に思う単語と衝突する」というのは、おそらく "DEAD BEEF" (死んだ牛, `0xDEADBEEF` は16進数としても正しい) のことでしょう。

ただ、コモドオオトカゲが出てくるのがわからない・・・。
"4b 4f" が16進数ともBioctalとも解釈できるという問題点があるのはわかるんですが、これの元ネタがわからない。
謝辞に「4章を書くにあたって R. Goldberg の協力を得た」とあるので、 [ルーブ・ゴールドバーグ・マシン](https://ja.wikipedia.org/wiki/%E3%83%AB%E3%83%BC%E3%83%96%E3%83%BB%E3%82%B4%E3%83%BC%E3%83%AB%E3%83%89%E3%83%90%E3%83%BC%E3%82%B0%E3%83%BB%E3%83%9E%E3%82%B7%E3%83%B3) (日本で言うところの[ピタゴラ装置](https://ja.wikipedia.org/wiki/%E3%83%94%E3%82%BF%E3%82%B4%E3%83%A9%E8%A3%85%E7%BD%AE))のことかな？と思ったんですが、コモドオオトカゲとの関係性がわからない。

誰かコモドオオトカゲについて詳しい方がいたら教えてください。

## 参考

- [RFC9226 Bioctal: Hexadecimal 2.0](https://www.rfc-editor.org/rfc/rfc9226.html)
- [shogo82148/go-bioctal](https://github.com/shogo82148/go-bioctal)
- [ルーブ・ゴールドバーグ・マシン](https://ja.wikipedia.org/wiki/%E3%83%AB%E3%83%BC%E3%83%96%E3%83%BB%E3%82%B4%E3%83%BC%E3%83%AB%E3%83%89%E3%83%90%E3%83%BC%E3%82%B0%E3%83%BB%E3%83%9E%E3%82%B7%E3%83%B3)
- [ピタゴラ装置](https://ja.wikipedia.org/wiki/%E3%83%94%E3%82%BF%E3%82%B4%E3%83%A9%E8%A3%85%E7%BD%AE)