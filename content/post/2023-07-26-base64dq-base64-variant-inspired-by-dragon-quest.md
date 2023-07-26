---
layout: post
title: "「ふっかつのじゅもん」みたいなBase64亜種「base64dq」を書いた"
slug: 2023-07-26-base64dq-base64-variant-inspired-by-dragon-quest
date: 2023-07-26 21:48:00 +0900
comments: true
categories: [golang]
---

[ドラゴンクエスト]シリーズ第一作目に登場する「ふっかつのじゅもん」っぽいBase64亜種を書いてみました。

- [shogo82148/base64dq]

## 使い方

簡単に使えるようコマンドラインインターフェイスも用意しました。`go install`でインストール可能です。

```
$ go install github.com/shogo82148/base64dq/cmd/base64dq@latest
```

`base64dq`コマンドが使えるようになります。
Coreutilsの`base64`コマンドと同様に使えます。

```
$ echo 'こんにちは' | base64dq
づづきとづづさとづづきわづづきめづづきげうむ・・

$ echo 'づづきとづづさとづづきわづづきめづづきげうむ・・' | base64dq --decode
こんにちは
```

## ふっかつのじゅもん

「ふっかつのじゅもん」は[ドラゴンクエスト]シリーズ第一作目で採用されたゲームのセーブ方式です。
ゲームを中断するときには、再開したときに同じ状態からゲームを始められるよう、ゲームの状態を保存しておく必要があります。
しかし[ドラクエI]が発売されたのは1986年5月。
当時[ドラクエI]は[ファミコン]向けに発売されたのですが、[ファミコン]にはフラッシュROMのような贅沢なハードウェアはついていません。
電源を落とすと簡単にデーターは失われてしまいます。

そこでゲームの状態を20文字の「ふっかつのじゅもん」にエンコードし、
再開時には「ふっかつのじゅもん」をプレイヤーに入力してもらう、というセーブ方式が編み出されました。

プレイヤーはゲームを中断するたびに「ふっかつのじゅもん」を書き写す必要がありました。
当時は液晶ディスプレイなどあるはずもなく、一般の家庭にあるのはブラウン管のアナログディスプレイです。
解像度が荒く読み取るのが大変なため、「ふっかつのじゅもん」を間違え散っていったプレイヤーも多くいたと聞いています（筆者はまだ生まれていないのでよく知らない）。

## ふっかつのじゅもんとBase64の関係

今では有志による解読も進み[ふっかつのじゅもんのジェネレーター](https://yoshi389111.github.io/dq1pswd/)も開発されています。

[DQ1 復活の呪文解析日記]によると、「ふっかつのじゅもん」は**64種類のひらがな**で構成されているそうです。
**64**。実に切りのいい数字です。
1文字で6ビットの情報を表し、合計で120ビットのセーブデータを表現しています。

このエンコード方法はBase64とまったく同じですね！
「ふっかつのじゅもん」は、64種類のASCII文字の代わりに、64種類のひらがなを使ったBase64の亜種、と考えることができます。

ちなみにBase64がRFCに登場したのは1987年4月の[RFC 989](https://datatracker.ietf.org/doc/html/rfc989)だそうです。
当時はBase64という言葉すらなく、printable encodingと呼ばれていたようです。
[ドラクエI]が発売されたのは1986年5月なので、Base64が一般に広まる前に「ふっかつのじゅもん」は世に公開されたわけですね。
すごい！

もちろん規格化されていないだけで「64種類の文字で情報をエンコードする」というアイディア自体はもっと昔からあったのでしょう。
でも似たようなものがゲームに使われていたのはおもしろいですね。

## base64dq

そういうわけで「ふっかつのじゅもん」の影響を受けて作ったのが [shogo82148/base64dq] です。
64種類のASCII文字の代わりに、以下の64種類のひらがなを使います。

```
あいうえお
かきくけこ
さしすせそ
たちつてと
なにぬねの
はひふへほ
まみむめも
やゆよ
らりるれろ
わ
がぎぐげご
ざじずぜぞ
だぢづでど
ばびぶべぼ

・（パディング）
```

「ふっかつのじゅもん」にはパディングはないので、適当に「・」を選びました。

## 性能

### 空間効率

3バイトを4文字のひらがなにエンコードします。UTF-8の場合、ひらがなは3バイトなので、4×3=12バイト。
したがって、エンコードするとデーター量は4倍に増えます。
とても非効率です。

### 計算性能

base64dqはデフォルトで「ふっかつのじゅもん」っぽい文字を使いますが、この文字はカスタマイズ可能です。
もちろんASCII文字も指定できるので、以下のように通常のBase64エンコードにも使えます。

```go
package main

import (
	"fmt"

	"github.com/shogo82148/base64dq"
)

func main() {
	// デフォルトの文字
	fmt.Println(base64dq.StdEncoding.EncodeToString([]byte("こんにちは")))
	// づづきとづづさとづづきわづづきめづづきげ

	// encoding/base64.StdEncoding相当
	enc := base64dq.NewEncoding("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/").WithPadding('=')
	fmt.Println(enc.EncodeToString([]byte("こんにちは")))
	// 44GT44KT44Gr44Gh44Gv
}
```

これを利用して、入出力の条件をそろえたうえで、標準ライブラリの[encoding/base64]との性能比較をしてみました。
末尾がBase64で終わっているのがbase64dqで通常のBase64を実現したもの、StdBase64で終わっているのが標準ライブラリの[encoding/base64]です。

```
goos: darwin
goarch: arm64
pkg: base64dq
BenchmarkEncodeToString-10              	   37768	     30578 ns/op	 267.90 MB/s
BenchmarkEncodeToString_Base64-10       	   37674	     31834 ns/op	 257.33 MB/s
BenchmarkEncodeToString_StdBase64-10    	  198698	      6018 ns/op	1361.31 MB/s
BenchmarkDecodeString/2-10              	40708496	        29.16 ns/op	 411.50 MB/s
BenchmarkDecodeString/4-10              	21325150	        56.58 ns/op	 424.15 MB/s
BenchmarkDecodeString/8-10              	11701461	       102.2 ns/op	 352.16 MB/s
BenchmarkDecodeString/64-10             	 1909441	       629.5 ns/op	 419.39 MB/s
BenchmarkDecodeString/8192-10           	   16758	     72094 ns/op	 454.57 MB/s
BenchmarkDecodeString_Base64/2-10       	61730642	        19.45 ns/op	 205.62 MB/s
BenchmarkDecodeString_Base64/4-10       	45182424	        26.45 ns/op	 302.45 MB/s
BenchmarkDecodeString_Base64/8-10       	34497255	        34.73 ns/op	 345.54 MB/s
BenchmarkDecodeString_Base64/64-10      	 4936286	       243.0 ns/op	 362.08 MB/s
BenchmarkDecodeString_Base64/8192-10    	   48498	     24746 ns/op	 441.44 MB/s
BenchmarkDecodeString_StdBase64/2-10    	56134659	        21.49 ns/op	 186.12 MB/s
BenchmarkDecodeString_StdBase64/4-10    	52898973	        21.89 ns/op	 365.46 MB/s
BenchmarkDecodeString_StdBase64/8-10    	46836578	        25.48 ns/op	 470.97 MB/s
BenchmarkDecodeString_StdBase64/64-10   	15156817	        79.14 ns/op	1111.96 MB/s
BenchmarkDecodeString_StdBase64/8192-10 	  231625	      5229 ns/op	2089.07 MB/s
BenchmarkDecoder/2-10                   	 2862613	       432.3 ns/op	  27.76 MB/s
BenchmarkDecoder/4-10                   	 2617545	       459.5 ns/op	  52.23 MB/s
BenchmarkDecoder/8-10                   	 2479767	       484.1 ns/op	  74.37 MB/s
BenchmarkDecoder/64-10                  	 1000000	      1058 ns/op	 249.46 MB/s
BenchmarkDecoder/8192-10                	   16506	     71903 ns/op	 455.78 MB/s
BenchmarkDecoder_Base64/2-10            	 2906109	       419.8 ns/op	   9.53 MB/s
BenchmarkDecoder_Base64/4-10            	 2779658	       431.5 ns/op	  18.54 MB/s
BenchmarkDecoder_Base64/8-10            	 2681973	       445.8 ns/op	  26.92 MB/s
BenchmarkDecoder_Base64/64-10           	 1686495	       689.1 ns/op	 127.71 MB/s
BenchmarkDecoder_Base64/8192-10         	   39691	     30254 ns/op	 361.07 MB/s
BenchmarkDecoder_StdBase64/2-10         	 4166818	       285.2 ns/op	  14.02 MB/s
BenchmarkDecoder_StdBase64/4-10         	 4008444	       301.1 ns/op	  26.57 MB/s
BenchmarkDecoder_StdBase64/8-10         	 3961225	       284.2 ns/op	  42.22 MB/s
BenchmarkDecoder_StdBase64/64-10        	 3022238	       402.5 ns/op	 218.64 MB/s
BenchmarkDecoder_StdBase64/8192-10      	  106390	     11288 ns/op	 967.77 MB/s
PASS
ok  	base64dq	48.600s
```

バッファサイズにもよりますが、エンコード・デコードともに[encoding/base64]の1/2〜1/5倍といったところでしょうか。

## 応用

まったく役に立たないエンコード方式ですが、実は裏の利用目的があります。
「秘密の質問」です。

いまだに「母親の旧姓は？」と聞いてくるサイトがあるのですが、そんなサイトに正直に回答したくはありません。
ランダムな文字列で適当に埋めようとも考えるのですが、日本のサイトだと全角文字に絞っていることも多く、
普通のパスワードジェネレーターは使えません。

そこでbase64dqの出番です。以下のコマンドでランダムなひらがな文字列を生成できます。

```
$ head -c 15 /dev/random | base64dq
ほべちどでづはめちでがゆたろぎへびぶりし
```

そういうわけで、僕の母の旧姓は「ほべちどでづはめちでがゆたろぎへびぶりし」です。よろしくお願いします。

## 実装によるパディングの扱いの差について

実装の参考に[encoding/base64]のコードを読んで、実装によってパディングの扱いに差があることに気が付きました。
たとえば、[encoding/base64]はパディング文字のあとに英数字が現れることを禁止しています。

```go
package main

import (
	"encoding/base64"
	"fmt"
)

func main() {
	// Error: illegal base64 data at input byte 8
	fmt.Println(base64.StdEncoding.DecodeString("aGVsbG8=IHdvcmxkIQ=="))
}
```

しかしBase64の実装によっては、これを許可しているものもあります。
Coreutilsの`base64`コマンドは、途中にパディング文字が入ってもデコードに成功します。

```
$ echo 'aGVsbG8=IHdvcmxkIQ==' | base64 --decode
hello world!
```

この挙動の何がうれしいかというと、これが許可されていると「Base64エンコードされた結果」を**デコードせずに**結合できるんですね。

```
$ echo -n 'hello' | base64 >> foo.txt
$ echo -n ' world!' | base64 >> foo.txt
$ cat foo.txt | base64 --decode
hello world!
```

まあ、今となっては誰もこんな使い方しないのでしょうね。

## まとめ

「ふっかつのじゅもん」っぽいBase64亜種を書いてみました。

## 参考

- [復活の呪文 - ピクシブ百科事典](https://dic.pixiv.net/a/%E5%BE%A9%E6%B4%BB%E3%81%AE%E5%91%AA%E6%96%87)
- [復活の呪文 - ニコニコ大百科](https://dic.nicovideo.jp/a/%E5%BE%A9%E6%B4%BB%E3%81%AE%E5%91%AA%E6%96%87)
- [yoshi389111/dq1pswd] [https://yoshi389111.github.io/dq1pswd/](ふっかつのじゅもんジェネレーター)
- [DQ1 復活の呪文解析日記]
- [shogo82148/base64dq]
- [encoding/base64]

[ドラゴンクエスト]: https://www.dragonquest.jp/
[ドラクエI]: https://ja.wikipedia.org/wiki/%E3%83%89%E3%83%A9%E3%82%B4%E3%83%B3%E3%82%AF%E3%82%A8%E3%82%B9%E3%83%88
[ファミコン]: https://ja.wikipedia.org/wiki/%E3%83%95%E3%82%A1%E3%83%9F%E3%83%AA%E3%83%BC%E3%82%B3%E3%83%B3%E3%83%94%E3%83%A5%E3%83%BC%E3%82%BF
[yoshi389111/dq1pswd]: https://github.com/yoshi389111/dq1pswd
[DQ1 復活の呪文解析日記]: https://github.com/yoshi389111/dq1pswd/blob/main/dq1ana.md
[shogo82148/base64dq]: https://github.com/shogo82148/base64dq
[encoding/base64]: https://pkg.go.dev/encoding/base64
