---
layout: post
title: "URL圧縮サイトを作ってみた"
slug: 2023-11-18-url-compressor-for-qr-code
date: 2023-11-18 17:11:00 +0900
comments: true
categories: [qrcode, go, golang]
---

QRコードへの埋め込みを前提としたURLの圧縮サービスを作ってみました。

- https://c.shogo82148.com/

ソースコードはこちら。

- https://github.com/shogo82148/url-compressor

## 背景

短縮URLを利用している企業から「短縮URLから不正サイトへ誘導される」として注意喚起のお知らせがありました。

- [「いなげや」QRコードから不正サイトに誘導、カード情報抜き取られる被害](https://www.itmedia.co.jp/news/articles/2311/10/news120.html)
- [原因は「短縮URL」か？　QRコードから不正サイトへ誘導される事例が相次ぐ　オートバックスセブン、学習院大学も](https://www.itmedia.co.jp/news/articles/2311/15/news194.html)
- [短縮URLサービス利用時に表示された悪質な広告についてまとめてみた](https://piyolog.hatenadiary.jp/entry/2023/11/12/014635)

QRコードに短縮URLが使われるのは、以下のような理由からバージョン（QRコードの大きさの）の小さいQRコードの需要があるためです。

- QRコードの印刷品質や読み取り性能が低くても、確実に読み取れるようにしたい
- 流入元計測のための情報をURLに載せるため、URLは長くなりがち

一方で短縮URLには以下のような問題が指摘されています。

- 短縮URLだけではどこに飛ぶかわからない
- 短縮URLのサービス終了してしまうと、リンク切れになる

## 目的

「元のURLの情報を圧縮してURLに詰め込めばすべて解決するのでは？」と考えて作ってみました。

名付けて **「圧縮URL」** 。
以下の特徴を持ったURLの作成を目的とします。

- QRコードでの共有に特化する
- 短縮URL自体から情報を取り出せる
    - 短縮URLのサービスが終了しても、元のURLがわかるので安心

## デモ

僕のブログ記事の中でももっとも長い、以下のURLを圧縮してみます。

- https://shogo82148.github.io/blog/2023/07/02/2023-07-02-update-aws-sdk-v2-with-grouped-version-updates-for-dependabot/

圧縮すると以下のようになります。

- HTTPS://C.SHOGO82148.COM/0-SLNDB9IQ9IIU.HOR1NB0QGEF7$F2QD2$9V8ONQ9V:U.D-NQ.EVYALL.H74.HID9DLHT2QV5RHV-5P-CFW7.H.DF5NU1U5M30C.AF.CP7.C.A1QXA4-DU5

Google Chart APIを使って、それぞれURLをQRコードに変換してみます。

圧縮前：
![https://shogo82148.github.io/blog/2023/07/02/2023-07-02-update-aws-sdk-v2-with-grouped-version-updates-for-dependabot/](/images/2023-11-18-raw.png)

圧縮後：
![HTTPS://C.SHOGO82148.COM/0-SLNDB9IQ9IIU.HOR1NB0QGEF7$F2QD2$9V8ONQ9V:U.D-NQ.EVYALL.H74.HID9DLHT2QV5RHV-5P-CFW7.H.DF5NU1U5M30C.AF.CP7.C.A1QXA4-DU5](/images/2023-11-18-compress.png)

小さなバージョン（QRコードの大きさ）のQRコードが生成されたのがわかると思います。

## 変換方法

変換方法を見ていきましょう。この手順にしたがって変換すれば、オフラインでも圧縮URLを作成できます。

例として `https://example.com` を圧縮します。

### プロトコル部分を取り除く

URLにはかならず `https://` か `http://` が付きます。
7〜8バイトを使うのは大きなオーバーヘッドです。

今どきHTTPS通信は当たり前なので `https://` 以外は対応しないこととし、
先頭の `https://` は削除します。

- `https://example.com` → `example.com`

### ハフマン符号化を行う

ハフマン符号化を使って、ビット列に符号化します。
ハフマン符号化のテーブルはちょっと長いので、付録Aとして記事の末尾に記載しました。

- `e`: `0011`
- `x`: `100001101`
- `a`: `0000`
- `m`: `00100`
- `p`: `100110`
- `l`: `01011`
- `e`: `0011`
- `.`: `10001`
- `c`: `11100`
- `o`: `1100`
- `m`: `00100`

```
0011 100001101 0000 00100 100110 01011 0011 10001 11100 1100 00100
```

1バイト（8bit）毎に区切ります。
8bitに満たない分は `1` で埋めます。

```
00111000
01101000
00010010
01100101
10011100
01111001
10000100
```

### Base45符号化を行う

[RFC 9285](https://www.rfc-editor.org/info/rfc9285) にしたがってBase45でエンコーディングします。

```
[[56 104] [18 101] [156 121] [132]]   Decimal value
[14440 4709 40057 132]                Value in base 16
[[40 5 7] [29 14 2] [7 35 19] [42 2]] Value in base 45
+57TE27ZJ.2                           Encoded string
```

### 特殊文字のエスケープ

特殊文字をエスケープします。

|    元の文字    | エスケープ後 |
|---------------|------------|
| ` ` (スペース) | `.A` |
| `%`           | `.C` |
| `*`           | `.D` |
| `+`           | `.E` |
| `.`           | `.G` |
| `/`           | `.H` |

今回の例では `+` と `.` が特殊文字なので、それぞれ `.E` と `.G` に置換します。

```
.E57TE27ZJ.G2
```

### バージョン番号をつける

あとで仕様を変更したくなったときのためにバージョン番号を振っておきます。
バージョン `0` が現在のバージョンです。

```
0.E57TE27ZJ.G2
```

### URLの形式に整形する

圧縮URLを知らない読み取り機のために、URLの形に整形します。

```
HTTPS://C.SHOGO82148.COM/0.E57TE27ZJ.G2
```

## FAQ

誰から聞かれたわけでもないけど、たぶん聞かれそうな質問に答えておきます。

### 「圧縮」と言っておきながら、URL長くなってるよね？

はい。

ASCII文字列で表現したときの文字数は長くなります。
しかしQRコードには「英数字モード」が存在し、一文字をより短いビット数で表現できます。
ASCII文字列をQRコードに変換するには8ビット必要ですが、英数字モードでは一文字あたり5.5ビットになります。

QRコードに変換したときの一文字あたりのビット数が短いため、圧縮URLは文字数が長くても、コンパクトなQRコードを生成できるのです。

### QRコード小さくならなかったんだけど・・・

変換のオーバーヘッドがあるので、必ず短くなるわけではありません。
その点はファイルの圧縮と一緒です。

具体的にオーバーヘッドを挙げておくと「`HTTPS://C.SHOGO82148.COM/`」の部分ですね。
もっと短いドメイン（`t.co` とか）取れば解決するんですが、そこまでのやる気はなかった。

### なぜ圧縮URLのドメイン名は大文字なの？

これはQRコードの仕様による制限です。
圧縮URLはQRコードの「英数字モード」を利用することでコンパクトなQRコードを実現していますが、英数字モードの **英字に含まれるのは大文字のみ** です。

ドメイン名は大文字小文字を区別しない仕様なので、QRコードへの変換効率を優先して大文字になっています。

### zlibやzstdのような既存の圧縮方式を使わなかったのはなぜ？

zlib、zstd、brotli を使った予備実験を行った結果、逆にURLが長くなってしまったからです。

[このブログに含まれるリンクをすべて抽出](https://gist.github.com/shogo82148/cf99c6e8067c81ff4d99092e8635d70b)し、それらのURLを圧縮する予備実験を行いました。
その結果圧縮の効果がまったくなかったため、これらの方式は採用しませんでした。

これらの圧縮方式は、圧縮後のデータに、ハフマン符号化のテーブルを出力します。
このテーブルがオーバーヘッドになっているのだと予想しました。

圧縮URLに関しては圧縮対象がURLだとわかっているので、圧縮の仕様にハフマン符号化のテーブルを含めてしまうことでオーバーヘッドを解消します。
このアイディアは[HPACK](https://www.rfc-editor.org/info/rfc7541)を参考にしました。

### 特殊文字のエスケースはパーセントエンコーディングではだめだったの？

URL上の特殊文字は、一般的にはパーセントエンコーディングを使用することが多いと思います。
これは実装上の都合で諦めました。

インフラの管理をしたくなかったので、AWS Lambda+なにか、で実現しようと思ったんですが、パスに`%`を使うとうまく動作せず・・・。
他のプラットフォームで実装するときにも問題になりそうなので、`%`を使わない仕様にしました。

## まとめ

QRコードへの埋め込みを前提としたURLの圧縮サービスを作ってみました。

- https://c.shogo82148.com/

以下のような特徴があります。

- QRコードに変換するとコンパクトになる
- 圧縮後のURLに元のURLの情報がすべて含まれる

将来性がありそう！と思った人は、ぜひ僕にドメイン買ってください。

## 参考

- [「いなげや」QRコードから不正サイトに誘導、カード情報抜き取られる被害](https://www.itmedia.co.jp/news/articles/2311/10/news120.html)
- [原因は「短縮URL」か？　QRコードから不正サイトへ誘導される事例が相次ぐ　オートバックスセブン、学習院大学も](https://www.itmedia.co.jp/news/articles/2311/15/news194.html)
- [短縮URLサービス利用時に表示された悪質な広告についてまとめてみた](https://piyolog.hatenadiary.jp/entry/2023/11/12/014635)
- [RFC 9285 The Base45 Data Encoding](https://www.rfc-editor.org/info/rfc9285)
- [RFC 7541 HPACK: Header Compression for HTTP/2](https://www.rfc-editor.org/info/rfc7541)
- [ハフマン符号化テーブル作成に使ったリンク一覧](https://gist.github.com/shogo82148/cf99c6e8067c81ff4d99092e8635d70b)

### Twitter上での反応

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">しかし短縮URLどこに飛ぶかわからんし、QRコード多少大きくてもいいし、Twitterも自前で短縮するので2重に短縮する意味はないし、たとえ善意のURL短縮サービスでもいつサ終するかわからないし、何で皆さん短縮URLが好きなの？（htn​.toも含めて）</p>&mdash; Haruhiko Okumura (@h_okumura) <a href="https://twitter.com/h_okumura/status/1723479029389664278?ref_src=twsrc%5Etfw">November 11, 2023</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script> 

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">私はレジの会社でレジやオーダーシステムを作っているソフトウェアエンジニアです。QRコードに短縮URLを使う理由ですが、印刷の品質やお客様のご利用になられる携帯電話のカメラの読取性能はこっちから制御できないので、なるべく短いURLにして粗いQRコードが生成されるようにしたほうがよいのです。</p>&mdash; 女性声優 (@ssig33) <a href="https://twitter.com/ssig33/status/1723594062689886543?ref_src=twsrc%5Etfw">November 12, 2023</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script> 

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">URL (QRコードに記録する文字列) が長くなるとQRコードが大きく複雑になるので限られたスペースへの印字が難しくなります。マーケティング担当者が流入元を計測するためにURLにタグ (utm_source=とか) を入れることもあり、QRコードをつくる際に短縮URLが使われることは多いです。 <a href="https://t.co/LZeQengIAz">https://t.co/LZeQengIAz</a> <a href="https://t.co/gSoSORwzDs">pic.twitter.com/gSoSORwzDs</a></p>&mdash; shao as a service (@shao1555) <a href="https://twitter.com/shao1555/status/1723643996638179510?ref_src=twsrc%5Etfw">November 12, 2023</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script> 

## 付録

### 付録A ハフマン符号化表

```
0x00:  {0b11111111_11111111_11111000, 24},
0x01:  {0b11111111_11111111_11111001, 24},
0x02:  {0b11111111_11111111_11111010, 24},
0x03:  {0b11111111_11111111_11111011, 24},
0x04:  {0b11111111_11111111_11000000, 24},
0x05:  {0b11111111_11111111_11000001, 24},
0x06:  {0b11111111_11111111_11000010, 24},
0x07:  {0b11111111_11111111_11000011, 24},
0x08:  {0b11111111_11111111_11000100, 24},
0x09:  {0b11111111_11111111_11000101, 24},
0x0a:  {0b11111111_11111111_11000110, 24},
0x0b:  {0b11111111_11111111_11000111, 24},
0x0c:  {0b11111111_11111111_11001000, 24},
0x0d:  {0b11111111_11111111_11001001, 24},
0x0e:  {0b11111111_11111111_11001010, 24},
0x0f:  {0b11111111_11111111_11001011, 24},
0x10:  {0b11111111_11111111_11001100, 24},
0x11:  {0b11111111_11111111_11001101, 24},
0x12:  {0b11111111_11111111_11001110, 24},
0x13:  {0b11111111_11111111_11001111, 24},
0x14:  {0b11111111_11111111_11010000, 24},
0x15:  {0b11111111_11111111_11010001, 24},
0x16:  {0b11111111_11111111_11010010, 24},
0x17:  {0b11111111_11111111_11010011, 24},
0x18:  {0b11111111_11111111_11010100, 24},
0x19:  {0b11111111_11111111_11010101, 24},
0x1a:  {0b11111111_11111111_11010110, 24},
0x1b:  {0b11111111_11111111_11010111, 24},
0x1c:  {0b11111111_11111111_11011000, 24},
0x1d:  {0b11111111_11111111_11011001, 24},
0x1e:  {0b11111111_11111111_11011010, 24},
0x1f:  {0b11111111_11111111_11011011, 24},
0x20:  {0b11111111_11111111_11011100, 24},
0x21:  {0b11111111_111110, 14},
0x22:  {0b11111111_11111111_11011101, 24},
0x23:  {0b01001011, 8},
0x24:  {0b11111111_11111111_11011110, 24},
0x25:  {0b111110, 6},
0x26:  {0b10000110_0010, 12},
0x27:  {0b01001010_010100, 14},
0x28:  {0b11111111_11111110, 16},
0x29:  {0b11111111_1111110, 15},
0x2a:  {0b11111111_11111111_11011111, 24},
0x2b:  {0b01001010_01011, 13},
0x2c:  {0b11111111_11111111_10000000, 24},
0x2d:  {0b11110, 5},
0x2e:  {0b10001, 5},
0x2f:  {0b1101, 4},
0x30:  {0b101001, 6},
0x31:  {0b01000, 5},
0x32:  {0b01111, 5},
0x33:  {0b011010, 6},
0x34:  {0b011011, 6},
0x35:  {0b1000010, 7},
0x36:  {0b1111110, 7},
0x37:  {0b0100110, 7},
0x38:  {0b101100, 6},
0x39:  {0b1000000, 7},
0x3a:  {0b11111111_01, 10},
0x3b:  {0b11111111_11111111_10000001, 24},
0x3c:  {0b11111111_11111111_10000010, 24},
0x3d:  {0b10011110_00, 10},
0x3e:  {0b11111111_11111111_10000011, 24},
0x3f:  {0b01001111_10, 10},
0x40:  {0b01001010_010101, 14},
0x41:  {0b01001110, 8},
0x42:  {0b10011110_1, 9},
0x43:  {0b10011111_10, 10},
0x44:  {0b11111111_10, 10},
0x45:  {0b0100100, 7},
0x46:  {0b11111111_00, 10},
0x47:  {0b10011110_010, 11},
0x48:  {0b01001111_010, 11},
0x49:  {0b10011110_011, 11},
0x4a:  {0b10000110_0011, 12},
0x4b:  {0b10000110_0100, 12},
0x4c:  {0b01001111_11, 10},
0x4d:  {0b01001010_10, 10},
0x4e:  {0b01001010_011, 11},
0x4f:  {0b10000110_000, 11},
0x50:  {0b01001010_00, 10},
0x51:  {0b10000110_0101, 12},
0x52:  {0b01001111_00, 10},
0x53:  {0b10011111_11, 10},
0x54:  {0b01001010_11, 10},
0x55:  {0b10000110_011, 11},
0x56:  {0b01001111_0110, 12},
0x57:  {0b11111111_110, 11},
0x58:  {0b01001111_0111, 12},
0x59:  {0b11111111_1110, 12},
0x5a:  {0b11111111_11110, 13},
0x5b:  {0b11111111_11111111_10000100, 24},
0x5c:  {0b11111111_11111111_10000101, 24},
0x5d:  {0b11111111_11111111_10000110, 24},
0x5e:  {0b11111111_11111111_10000111, 24},
0x5f:  {0b10011100, 8},
0x60:  {0b11111111_11111111_10001000, 24},
0x61:  {0b0000, 4},
0x62:  {0b101101, 6},
0x63:  {0b11100, 5},
0x64:  {0b101000, 6},
0x65:  {0b0011, 4},
0x66:  {0b1000001, 7},
0x67:  {0b10010, 5},
0x68:  {0b01100, 5},
0x69:  {0b10111, 5},
0x6a:  {0b10011101, 8},
0x6b:  {0b0111011, 7},
0x6c:  {0b01011, 5},
0x6d:  {0b00100, 5},
0x6e:  {0b01010, 5},
0x6f:  {0b1100, 4},
0x70:  {0b100110, 6},
0x71:  {0b11111110, 8},
0x72:  {0b11101, 5},
0x73:  {0b10101, 5},
0x74:  {0b0001, 4},
0x75:  {0b00101, 5},
0x76:  {0b10000111, 8},
0x77:  {0b011100, 6},
0x78:  {0b10000110_1, 9},
0x79:  {0b0111010, 7},
0x7a:  {0b10011111_0, 9},
0x7b:  {0b11111111_11111111_10001001, 24},
0x7c:  {0b11111111_11111111_10001010, 24},
0x7d:  {0b11111111_11111111_10001011, 24},
0x7e:  {0b01001010_0100, 12},
0x7f:  {0b11111111_11111111_10001100, 24},
0x80:  {0b11111111_11111111_10001101, 24},
0x81:  {0b11111111_11111111_10001110, 24},
0x82:  {0b11111111_11111111_10001111, 24},
0x83:  {0b11111111_11111111_10010000, 24},
0x84:  {0b11111111_11111111_10010001, 24},
0x85:  {0b11111111_11111111_10010010, 24},
0x86:  {0b11111111_11111111_10010011, 24},
0x87:  {0b11111111_11111111_10010100, 24},
0x88:  {0b11111111_11111111_10010101, 24},
0x89:  {0b11111111_11111111_10010110, 24},
0x8a:  {0b11111111_11111111_10010111, 24},
0x8b:  {0b11111111_11111111_10011000, 24},
0x8c:  {0b11111111_11111111_10011001, 24},
0x8d:  {0b11111111_11111111_10011010, 24},
0x8e:  {0b11111111_11111111_10011011, 24},
0x8f:  {0b11111111_11111111_10011100, 24},
0x90:  {0b11111111_11111111_10011101, 24},
0x91:  {0b11111111_11111111_10011110, 24},
0x92:  {0b11111111_11111111_10011111, 24},
0x93:  {0b11111111_11111111_10100000, 24},
0x94:  {0b11111111_11111111_10100001, 24},
0x95:  {0b11111111_11111111_10100010, 24},
0x96:  {0b11111111_11111111_10100011, 24},
0x97:  {0b11111111_11111111_10100100, 24},
0x98:  {0b11111111_11111111_10100101, 24},
0x99:  {0b11111111_11111111_10100110, 24},
0x9a:  {0b11111111_11111111_10100111, 24},
0x9b:  {0b11111111_11111111_10101000, 24},
0x9c:  {0b11111111_11111111_10101001, 24},
0x9d:  {0b11111111_11111111_10101010, 24},
0x9e:  {0b11111111_11111111_10101011, 24},
0x9f:  {0b11111111_11111111_10101100, 24},
0xa0:  {0b11111111_11111111_10101101, 24},
0xa1:  {0b11111111_11111111_10101110, 24},
0xa2:  {0b11111111_11111111_10101111, 24},
0xa3:  {0b11111111_11111111_10110000, 24},
0xa4:  {0b11111111_11111111_10110001, 24},
0xa5:  {0b11111111_11111111_10110010, 24},
0xa6:  {0b11111111_11111111_10110011, 24},
0xa7:  {0b11111111_11111111_10110100, 24},
0xa8:  {0b11111111_11111111_10110101, 24},
0xa9:  {0b11111111_11111111_10110110, 24},
0xaa:  {0b11111111_11111111_10110111, 24},
0xab:  {0b11111111_11111111_10111000, 24},
0xac:  {0b11111111_11111111_10111001, 24},
0xad:  {0b11111111_11111111_10111010, 24},
0xae:  {0b11111111_11111111_10111011, 24},
0xaf:  {0b11111111_11111111_10111100, 24},
0xb0:  {0b11111111_11111111_10111101, 24},
0xb1:  {0b11111111_11111111_10111110, 24},
0xb2:  {0b11111111_11111111_10111111, 24},
0xb3:  {0b11111111_11111111_0000000, 23},
0xb4:  {0b11111111_11111111_0000001, 23},
0xb5:  {0b11111111_11111111_0000010, 23},
0xb6:  {0b11111111_11111111_0000011, 23},
0xb7:  {0b11111111_11111111_0000100, 23},
0xb8:  {0b11111111_11111111_0000101, 23},
0xb9:  {0b11111111_11111111_0000110, 23},
0xba:  {0b11111111_11111111_0000111, 23},
0xbb:  {0b11111111_11111111_0001000, 23},
0xbc:  {0b11111111_11111111_0001001, 23},
0xbd:  {0b11111111_11111111_0001010, 23},
0xbe:  {0b11111111_11111111_0001011, 23},
0xbf:  {0b11111111_11111111_0001100, 23},
0xc0:  {0b11111111_11111111_0001101, 23},
0xc1:  {0b11111111_11111111_0001110, 23},
0xc2:  {0b11111111_11111111_0001111, 23},
0xc3:  {0b11111111_11111111_0010000, 23},
0xc4:  {0b11111111_11111111_0010001, 23},
0xc5:  {0b11111111_11111111_0010010, 23},
0xc6:  {0b11111111_11111111_0010011, 23},
0xc7:  {0b11111111_11111111_0010100, 23},
0xc8:  {0b11111111_11111111_0010101, 23},
0xc9:  {0b11111111_11111111_0010110, 23},
0xca:  {0b11111111_11111111_0010111, 23},
0xcb:  {0b11111111_11111111_0011000, 23},
0xcc:  {0b11111111_11111111_0011001, 23},
0xcd:  {0b11111111_11111111_0011010, 23},
0xce:  {0b11111111_11111111_0011011, 23},
0xcf:  {0b11111111_11111111_0011100, 23},
0xd0:  {0b11111111_11111111_0011101, 23},
0xd1:  {0b11111111_11111111_0011110, 23},
0xd2:  {0b11111111_11111111_0011111, 23},
0xd3:  {0b11111111_11111111_0100000, 23},
0xd4:  {0b11111111_11111111_0100001, 23},
0xd5:  {0b11111111_11111111_0100010, 23},
0xd6:  {0b11111111_11111111_0100011, 23},
0xd7:  {0b11111111_11111111_0100100, 23},
0xd8:  {0b11111111_11111111_0100101, 23},
0xd9:  {0b11111111_11111111_0100110, 23},
0xda:  {0b11111111_11111111_0100111, 23},
0xdb:  {0b11111111_11111111_0101000, 23},
0xdc:  {0b11111111_11111111_0101001, 23},
0xdd:  {0b11111111_11111111_0101010, 23},
0xde:  {0b11111111_11111111_0101011, 23},
0xdf:  {0b11111111_11111111_0101100, 23},
0xe0:  {0b11111111_11111111_0101101, 23},
0xe1:  {0b11111111_11111111_0101110, 23},
0xe2:  {0b11111111_11111111_0101111, 23},
0xe3:  {0b11111111_11111111_0110000, 23},
0xe4:  {0b11111111_11111111_0110001, 23},
0xe5:  {0b11111111_11111111_0110010, 23},
0xe6:  {0b11111111_11111111_0110011, 23},
0xe7:  {0b11111111_11111111_0110100, 23},
0xe8:  {0b11111111_11111111_0110101, 23},
0xe9:  {0b11111111_11111111_0110110, 23},
0xea:  {0b11111111_11111111_0110111, 23},
0xeb:  {0b11111111_11111111_0111000, 23},
0xec:  {0b11111111_11111111_0111001, 23},
0xed:  {0b11111111_11111111_0111010, 23},
0xee:  {0b11111111_11111111_0111011, 23},
0xef:  {0b11111111_11111111_0111100, 23},
0xf0:  {0b11111111_11111111_0111101, 23},
0xf1:  {0b11111111_11111111_0111110, 23},
0xf2:  {0b11111111_11111111_0111111, 23},
0xf3:  {0b11111111_11111111_1110000, 23},
0xf4:  {0b11111111_11111111_1110001, 23},
0xf5:  {0b11111111_11111111_1110010, 23},
0xf6:  {0b11111111_11111111_1110011, 23},
0xf7:  {0b11111111_11111111_1110100, 23},
0xf8:  {0b11111111_11111111_1110101, 23},
0xf9:  {0b11111111_11111111_1110110, 23},
0xfa:  {0b11111111_11111111_1110111, 23},
0xfb:  {0b11111111_11111111_1111000, 23},
0xfc:  {0b11111111_11111111_1111001, 23},
0xfd:  {0b11111111_11111111_1111010, 23},
0xfe:  {0b11111111_11111111_1111011, 23},
0xff:  {0b11111111_11111111_1111110, 23},
0x100: {0b11111111_11111111_1111111, 23},
```