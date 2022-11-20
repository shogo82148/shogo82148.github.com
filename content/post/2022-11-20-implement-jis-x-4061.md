---
layout: post
title: "50音順(JIS X 4061)をGoで実装してみた"
slug: 2022-11-20-implement-jis-x-4061
date: 2022-11-20 17:17:00 +0900
comments: true
categories: [ go, golang ]
---

今後Go言語でも50音順ソートしたくなるのでは、と虫の知らせがあったので作ってみました。

- [shogo82148/jisx4061](https://github.com/shogo82148/jisx4061)

## 50音順とは何者か

50音順は「あいうえおかきくけこ・・・」あたりまでなら簡単なので、すごく簡単に思えるじゃないですか。
しかしここに濁音・半濁音・拗音・片仮名・長音記号etc. が入ってくるとだいぶややこしくなります。

### 濁音を含んだソート

たとえば濁点の扱いを見てみましょう。
「さどう」「さとうや」「サトー」「さと」「さど」「さとう」「さとおや」という7つの単語を並べ替えます。
普通にGo標準のソートを使うと以下のようになります。

```go
package main

import (
	"fmt"
	"sort"
)

func main() {
	list := []string{
		"さどう",
		"さとうや",
		"サトー",
		"さと",
		"さど",
		"さとう",
		"さとおや",
	}
	sort.Strings(list)
	fmt.Println(list)
  // Output:
  // [さと さとう さとうや さとおや さど さどう サトー]
}
```

一見良さそうですが・・・「さと」と「さど」が遠く離れてしまいました。
このふたつは音が似ているので近くに配置したいです。

### jisx4061を使ったソート

[shogo82148/jisx4061](https://github.com/shogo82148/jisx4061)を使うと解決します。

```go
package main

import (
	"fmt"

	"github.com/shogo82148/jisx4061"
)

func main() {
	list := []string{
		"さどう",
		"さとうや",
		"サトー",
		"さと",
		"さど",
		"さとう",
		"さとおや",
	}
	jisx4061.Sort(list)
	fmt.Println(list)
  // Output:
  // [さと さど さとう さどう さとうや サトー さとおや]
}
```

「さと」「さど」が近くに来て探しやすくなりましたね。

### JIS X 4061

この規則は「日本語文字列照合順番」という名前でJIS X 4061に定義されています。

- [日本語文字列照合順番](https://ja.wikipedia.org/wiki/%E6%97%A5%E6%9C%AC%E8%AA%9E%E6%96%87%E5%AD%97%E5%88%97%E7%85%A7%E5%90%88%E9%A0%86%E7%95%AA)

あいうえお順というと簡単に聞こえますが、規格化して統一が必要な程度には難しい問題なんですね。

## まとめ

あいうえお順って難しいよ。
よかったら [shogo82148/jisx4061](https://github.com/shogo82148/jisx4061) 使ってね。

## 参考

- [日本語文字列照合順番](https://ja.wikipedia.org/wiki/%E6%97%A5%E6%9C%AC%E8%AA%9E%E6%96%87%E5%AD%97%E5%88%97%E7%85%A7%E5%90%88%E9%A0%86%E7%95%AA)
- [ShiftJIS::Collate - Shift-JIS 文字列の照合](http://nomenclator.la.coocan.jp/perl/mod/sjcol-j.htm)
- [ShiftJIS::Collate](https://metacpan.org/dist/ShiftJIS-Collate/view/Collate.pod)
- [Lingua::JA::Sort::JIS](https://metacpan.org/dist/Lingua-JA-Sort-JIS/view/JIS.pod)
- [shogo82148/jisx4061](https://github.com/shogo82148/jisx4061)
