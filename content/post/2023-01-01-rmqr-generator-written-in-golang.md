---
layout: post
title: "GolangでQRコード、マイクロQRコード、rMQRコードのジェネレーターを作った"
slug: 2023-01-01-rmqr-generator-written-in-golang
date: 2023-01-01 23:45:00 +0900
comments: true
categories: [ go, golang ]
---

GolangでQRコード、マイクロQRコード、rMQRコードのジェネレーターを作りました。

- [shogo82148/qrcode](https://github.com/shogo82148/qrcode)

作った理由は、「QRコードの復元能力はどういうマジックなんだろう？」と昔から気になっていたからです。
エンコードの方法は分かったものの、なぜ復元できるのかはわからぬままですが・・・。

また、2022年5月に発表されたrMQRコードにも対応しています。

- [デンソーウェーブ、細長く狭いスペースにも印字できる 長方形型の新しいQRコード「rMQRコード」を開発](https://www.denso-wave.com/ja/adcd/info/detail__220525.html)

## 使い方

[qrcode.Encode](https://pkg.go.dev/github.com/shogo82148/qrcode#Encode)にバイト列を渡すと、
QRコードの画像を[image.Image](https://pkg.go.dev/image#Image)として返します。
あと通常の画像と同じように扱えるので、[image/png](https://pkg.go.dev/image/png)などで書き出してください。

```go
package main

import (
	"bytes"
	"image/png"
	"log"
	"os"

	"github.com/shogo82148/qrcode"
)

func main() {
	img, err := qrcode.Encode([]byte("Hello QR Code!"))
	if err != nil {
		log.Fatal(err)
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		log.Fatal(err)
	}
	if err := os.WriteFile(filename, buf.Bytes(), 0o644); err != nil {
		log.Fatal(err)
	}
}
```

QRコードは日本生まれの規格なので、漢字を効率的に格納するモードがあります。
JIS X 0208の範囲内にある文字は自動的に漢字モードになります。

```go
package main

import (
	"bytes"
	"image/png"
	"log"
	"os"

	"github.com/shogo82148/qrcode"
)

func main() {
	img, err := qrcode.Encode([]byte("漢字"))
	if err != nil {
		log.Fatal(err)
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		log.Fatal(err)
	}
	if err := os.WriteFile(filename, buf.Bytes(), 0o644); err != nil {
		log.Fatal(err)
	}
}
```

多くのQRコードエンコーダーは海外の人が作っているため、漢字モードに対応したエンコーダーは意外とレアです（たぶん）。

## 所感

### JIS規格入手のハードルが高い

さて、QRコードはJIS（**日本産業規格**）で標準化されており、
「JIS X 0510 : 2018 技術情報 - 自動認識及びデータ取得技術 - QRコード バーコードシンボル体系仕様」で仕様が決まっています。
**日本産業規格**？**日本工業規格**じゃなかったっけ？と思ったけど、[2019年7月1日から変わってたらしい](https://web.archive.org/web/20181202102836/http://www.meti.go.jp/policy/economy/hyojun/JISho.html)です。
知らなかったよ。
どうもIT業界も標準化の対象にしたいけど、IT業界は「工業」ではない、との理由からのようです。

> 第四次産業革命の下、IoTやAIなどの情報技術の革新が進み、企業の競争力は、データやその活用に移り変わってきています。
> こうした中、ビッグデータ等と産業とのつながりにより新たな付加価値が創出される産業社会（コネクテッド・インダストリーズ）への対応が、我が国産業の喫緊の課題となっています。
>
> また、近年では、モノだけではなく、マネジメント分野、サービス分野等の規格が制定されるようになったほか、第 4 次産業革命の中で自動走行、スマートマニュファクチャリングなど業種を越えた国際標準化が進みつつあり、標準化の対象やプロセスにも変化が現れています。
> 様々な環境変化に対応するため、日本における標準化活動の基盤となっている工業標準化法について、①データ、サービス等への対象拡大、②JISの制定・改正の迅速化、③ＪＩＳマークによる企業間取引の信頼性確保、④官民の国際標準化活動の促進を図る改正を行います。

さて、JISで規格化されているため、実装にあたりまずはJIS X 0510を参照するのが一番確実です。
しかし入手にはちょっとしたハードルがあります。
[日本産業標準調査会](https://www.jisc.go.jp/index.html)のWebページから閲覧はできるのですが、閲覧のみで保存や印刷はできません。
「著作権保護のため」という名目で謎の専用ビューアーでの閲覧を強制されます。
数年前はAcrobat Readerでしか閲覧できない謎PDFだった気がするのですが、そこから悪化するとは思わなかった。

もちろん入手方法は他にもあって、印刷物やPDFを利用したい場合は[日本規格協会](https://webdesk.jsa.or.jp/)から5000円ほどで購入できます。

でもRFCが一般に公開されているのになれてしまうと、「なんでもっと気軽に入手できないの？」と思ってしまいますよね。
「ビッグデータ等と産業とのつながりにより新たな付加価値が創出される産業社会（コネクテッド・インダストリーズ）への対応が、我が国産業の喫緊の課題となっています」とか言ってますが、
規格書みたいな基本的なデーター共有もできていないのに、ビッグデーターの活用ができるわけないでしょう。
「ビッグデータ」なんてものにうつつを抜かす前に、やるべきことがあるのでは？？？

### 特性表の入力がつらい

QRコードは印刷面積をなるべく削るために、ビット単位で調整が入っています。
データーの長さを符号化するのに何ビット使うか、モード切り替えに何ビット使うのか、誤り訂正コードに何ビット割り当てるのかetc.
バージョン（QRコードの大きさ）ごとに細やかに調整されています。
これは計算によって求めることができないので、規格に載っている特性表を引くしかありません。

問題はこの特性表が印刷物かPDFでしか入手できないという点！
QRコードの種類は大きさ40バージョン×誤り訂正レベル4レベル＝160パターンあるので、160パターンそれぞれについて特性値の入力が必要です。
なぜ機械可読なデーターを用意しないのか！
この特性表の入力で心が折れそうになりました。

### rMQRについて

QRコードに使われている[リード・ソロモン符号](https://ja.wikipedia.org/wiki/%E3%83%AA%E3%83%BC%E3%83%89%E3%83%BB%E3%82%BD%E3%83%AD%E3%83%A2%E3%83%B3%E7%AC%A6%E5%8F%B7)は非常に効率が良いため、
符号化領域のエンコードにこれ以上の改善は見込めません。
そのため、QRコードの改良は機能パターン（データー以外のパターン、QRコードを見つけるための位置検出パターンや、歪みを補正するためのアライメントパターンなど）の改良がメインになります。
rMQRでは以下のような点が改良されているようです。

- 位置検出パターンが3つあったのを、位置検出パターン1つとサブ位置検出パターン1つに削減
- 誤り訂正レベルを4レベル（L、M、Q、H）から2レベル（M、H）に限定。1bit削減
- マスクパターンが8種類あったものを、1種類に限定。マスクパターンの情報省略で、3bitsの削減

ビット単位で地道な改良が施されています。

## まとめ

GolangでQRコード、マイクロQRコード、rMQRコードのジェネレーターを作りました。
ところでrMQRコードってどうやって読むんですかね？誰かリーダー作って！！

## 参考

- [デンソーウェーブ、細長く狭いスペースにも印字できる 長方形型の新しいQRコード「rMQRコード」を開発](https://www.denso-wave.com/ja/adcd/info/detail__220525.html)
- [http://en.wikipedia.org/wiki/QR_code](http://en.wikipedia.org/wiki/QR_code)
- JIS X 0510 : 2018 技術情報 - 自動認識及びデータ取得技術 - QRコード バーコードシンボル体系仕様
- [日本産業標準調査会](https://www.jisc.go.jp/index.html)
- [日本規格協会](https://webdesk.jsa.or.jp/)
- [JIS法改正（産業標準化法）](https://web.archive.org/web/20181202102836/http://www.meti.go.jp/policy/economy/hyojun/JISho.html)
- [Rectangular Micro QR Code (rMQR) bar code symbology specification: ISO/IEC 23941](https://www.iso.org/standard/77404.html)
- [rMQR Code | QRcode.com | DENSO WAVE](https://www.qrcode.com/en/codes/rmqr.html)
- [skip2/go-qrcode](github.com/skip2/go-qrcode)
- [OUDON/rmqrcode-python](https://github.com/OUDON/rmqrcode-python)
