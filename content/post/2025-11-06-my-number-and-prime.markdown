---
layout: post
title: "マイナンバーを全列挙して含まれる素数の数を数えた"
slug: my-number-and-prime
date: 2025-11-06 17:16:00 +0900
comments: true
categories: [go, golang]
---

## 背景・目的

「マイナンバー.csvというファイルにチェックディジットの正しい12桁整数を大量に入れておくいたずらを考えた」という𝕏の発言を見て、

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">マイナンバーが保存された状態でコンピュータが故障したら修理にも出せない <a href="https://t.co/ZNK9KKtFkZ">https://t.co/ZNK9KKtFkZ</a> ので、絶対にメールでは送らないように言われたことがあったっけ。マイナンバー.csvというファイルにチェックディジットの正しい12桁整数を大量に入れておくいたずらを考えたけど実行してない</p>&mdash; Haruhiko Okumura (@h_okumura) <a href="https://twitter.com/h_okumura/status/1985242389007716813?ref_src=twsrc%5Etfw">November 3, 2025</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

そういえば、過去にマイナンバーの可能性のある数列をすべて列挙した人がいたよなーと思い出しました。
完全に二番煎じですが、自分でもやってみました。

## 前例

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">計算が終了 <a href="https://t.co/UivoSSaAJU">https://t.co/UivoSSaAJU</a> <a href="https://t.co/zm1ZznWWtA">pic.twitter.com/zm1ZznWWtA</a></p>&mdash; 弥生　水葉𝕏 (@yayoi_mizuha) <a href="https://twitter.com/yayoi_mizuha/status/1861049195135979625?ref_src=twsrc%5Etfw">November 25, 2024</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

## マイナンバー一覧生成

C++よくわからずコンパイル通らなかったので、Goで再実装してみました。

- [shogo82148/go-generate-my-number](https://github.com/shogo82148/go-generate-my-number)

```go
package main

import (
  "bufio"
  "io"
  "os"
)

func main() {
  w := bufio.NewWriterSize(os.Stdout, 1<<20)
  for i := range 100_000_000_000 {
    if err := checkDigit(w, i); err != nil {
      panic(err)
    }
  }
  if err := w.Flush(); err != nil {
    panic(err)
  }
}

func checkDigit(w io.Writer, num int) error {
  var buf [13]byte
  a := num % 10
  num /= 10
  b := num % 10
  num /= 10
  c := num % 10
  num /= 10
  d := num % 10
  num /= 10
  e := num % 10
  num /= 10
  f := num % 10
  num /= 10
  g := num % 10
  num /= 10
  h := num % 10
  num /= 10
  i := num % 10
  num /= 10
  j := num % 10
  num /= 10
  k := num % 10
  num /= 10

  if num != 0 {
    panic("num is larger than 11 digits")
  }
  sum := a*2 + b*3 + c*4 + d*5 + e*6 + f*7 + g*2 + h*3 + i*4 + j*5 + k*6
  sum %= 11
  if sum <= 1 {
    sum = 0
  } else {
    sum = 11 - sum
  }
  buf[0] = byte('0' + k)
  buf[1] = byte('0' + j)
  buf[2] = byte('0' + i)
  buf[3] = byte('0' + h)
  buf[4] = byte('0' + g)
  buf[5] = byte('0' + f)
  buf[6] = byte('0' + e)
  buf[7] = byte('0' + d)
  buf[8] = byte('0' + c)
  buf[9] = byte('0' + b)
  buf[10] = byte('0' + a)
  buf[11] = byte('0' + sum)
  buf[12] = '\n'
  _, err := w.Write(buf[:])
  return err
}
```

ごちゃごちゃとしていて申し訳ない・・・。
for ループ使ったり、`Sprintf`, `Printf` 使えばもうちょっとシンプルにかけるだろっていう話はあるんだけど、
チェックデジット生成の処理が軽すぎて、簡単な整形処理がボトルネックになってしまうのです。
結果、愚直に書くのが一番早いという結論になりました。

-----

ではやっていきましょう。
残念ながら手元に1TB保存できるようなストレージはなかったので、列挙と並列してzstdで圧縮します。

```plain
% go run main.go | zstd -11 -T0 -v -o out.txt.zstd
*** Zstandard CLI (64-bit) v1.5.7, by Yann Collet ***
Note: 10 physical core(s) detected
/*stdin*\            :  3.62%   (  1.18 TiB =>   43.9 GiB, out.txt.zstd)
```

結果は43.9GiB。圧縮済みであればUSBメモリーにも十分収まるサイズですね。

SHA256ハッシュを計算してみます。

```plain
time zstdcat out.txt.zstd | sha256sum
21077f2dac68161eff9fa39578b55712a5cc315fd7cc89fb415a07d52193074a  -
zstdcat out.txt.zstd  1426.85s user 180.50s system 112% cpu 23:47.51 total
sha256sum  598.59s user 76.96s system 47% cpu 23:47.51 total
```

先人と同じ結果が得られました。内容はあっていそうです。

<blockquote class="twitter-tweet"><p lang="in" dir="ltr">sha256sum: 21077f2dac68161eff9fa39578b55712a5cc315fd7cc89fb415a07d52193074a</p>&mdash; 弥生　水葉𝕏 (@yayoi_mizuha) <a href="https://twitter.com/yayoi_mizuha/status/1861266073963897005?ref_src=twsrc%5Etfw">November 26, 2024</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script> 

## 素数の数を数えてみる

**自分のマイナンバーが素数であるか否か**、というのは誰しもが気になるところだと思います。
せっかくマイナンバーの一覧を手に入れたので、その中に含まれる素数の数を数えてみましょう。

$10^6$程度の小さな素数であれば単純な[エラトステネスの篩](https://ja.wikipedia.org/wiki/%E3%82%A8%E3%83%A9%E3%83%88%E3%82%B9%E3%83%86%E3%83%8D%E3%82%B9%E3%81%AE%E7%AF%A9)で簡単に求められます。

```go
package main

import "fmt"

var isPrime [1_000_000]bool

func main() {
  for i := 2; i < len(isPrime); i++ {
    isPrime[i] = true
  }

  for i := 2; i*i < len(isPrime); i++ {
    if isPrime[i] {
      for j := i * i; j < len(isPrime); j += i {
        isPrime[j] = false
      }
    }
  }

  for i, p := range isPrime {
    if p {
      fmt.Printf("%d\n", i)
    }
  }
}
```

しかし、今必要なのは $10^{12}$ までの素数です。
単純に篩にかけるだけではメモリーが足りなくなります。
そこで、区間篩を用いて10億件ごとに分割して素数一覧を計算する方法をとりました。

```go
package main

import (
  "bufio"
  "errors"
  "fmt"
  "io"
  "os"
)

// 10⁶ までの素数を事前計算しておく
var primes = []int{
  2,
  3,
  5,
  7,
  /* ... (snip) ... */
  999983,
}

var primeMap [1_000_000_000]bool
var lower = -1
var upper = -1

func isPrime(num int) bool {
  if num < 2 {
    return false
  }
  // 計算済みの場合は、その結果を返す
  if lower <= num && num <= upper {
    return primeMap[num-lower]
  }

  // 次の10億件についてあらかじめ篩にかけておく
  lower = (num / len(primeMap)) * len(primeMap)
  upper = lower + len(primeMap) - 1
  for i := range primeMap {
    primeMap[i] = true
  }
  for _, prime := range primes {
    if prime*prime > upper {
      break
    }
    for i := upper / prime * prime; i >= lower && i > prime; i -= prime {
      primeMap[i-lower] = false
    }
  }
  return primeMap[num-lower]
}

func main() {
  // 入出力をバッファリングする
  w := bufio.NewWriter(os.Stdout)
  r := bufio.NewReader(os.Stdin)

  for {
    // 標準入力からマイナンバーをひとつ読み込む
    var num int
    if _, err := fmt.Fscanf(r, "%d\n", &num); err != nil {
      if errors.Is(err, io.EOF) {
        break
      }
      panic(err)
    }

    // 素数だったら標準出力へ出力
    if isPrime(num) {
      if _, err := fmt.Fprintf(w, "%012d\n", num); err != nil {
        panic(err)
      }
    }
  }

  if err := w.Flush(); err != nil {
    panic(err)
  }
}
```

実行結果：

```plain
% time zstdcat out.txt.zstd | go run ./is_prime | zstd -11 -T0 -v -o primes.txt.zstd
*** Zstandard CLI (64-bit) v1.5.7, by Yann Collet ***
Note: 10 physical core(s) detected
/*stdin*\            : 24.71%   (  41.4 GiB =>   10.2 GiB, primes.txt.zstd)
zstdcat out.txt.zstd  1423.88s user 620.84s system 4% cpu 11:41:34.52 total
go run ./is_prime  41508.48s user 511.37s system 99% cpu 11:41:34.54 total

% zstdcat primes.txt.zstd | wc -l
 3418925855
```

34億1892万5855個。

マイナンバーは1000億通りあるので、
仮にランダムにマイナンバーが割り当てられているとすると、**3.418925855%の確率で素数**、ということになります。

-----

他の人が計算した概算約3%という結果とも一致するので、あってる気がします、たぶん。

- [マイナンバーが素数になる確率を概算する](https://note.com/noios/n/n5737b78a19a3)
- [マイナンバーが素数になる確率は？](https://detail.chiebukuro.yahoo.co.jp/qa/question_detail/q14150083094)

## まとめ

マイナンバーとして解釈したときにチェックデジットが正しく、素数である12桁の数字は**34億1892万5855通り**。

> 🐰 新しいポストが到着しました、\
> 素数を数える知恵の旅、\
> 12桁の数たちが踊り、\
> ふるいにかけられて輝く、\
> マイナンバーの謎、解き明かされます ✨
>
> by [CodeRabbit](https://www.coderabbit.ai/)

## 参考

- <https://twitter.com/h_okumura/status/1985242389007716813>
- <https://twitter.com/yayoi_mizuha/status/1861049195135979625>
- [yayoimizuha/mynumber_generator](https://github.com/yayoimizuha/mynumber_generator)
- [エラトステネスの篩](https://ja.wikipedia.org/wiki/%E3%82%A8%E3%83%A9%E3%83%88%E3%82%B9%E3%83%86%E3%83%8D%E3%82%B9%E3%81%AE%E7%AF%A9)
- [エラトステネスの篩の高速化](https://qiita.com/peria/items/a4ff4ddb3336f7b81d50)
- [マイナンバーが素数になる確率を概算する](https://note.com/noios/n/n5737b78a19a3)
- [マイナンバーが素数になる確率は？](https://detail.chiebukuro.yahoo.co.jp/qa/question_detail/q14150083094)
- [shogo82148/go-generate-my-number](https://github.com/shogo82148/go-generate-my-number)
