---
layout: post
title: "ExifToolがすごいという話"
slug: 2023-12-11-introduce-exiftool
date: 2023-12-11 21:20:00 +0900
comments: true
categories: [perl]
---

この記事は、[Perl Advent Calendar 2023](https://qiita.com/advent-calendar/2023/perl) 11日目の記事です。
10日目は[id:papix](https://profile.hatena.ne.jp/papix/)で「[Perlの｢後置if｣について](https://papix.hatenablog.com/entry/2023/12/10/120000)」でした。

-----

ふと「[Exif](https://ja.wikipedia.org/wiki/Exchangeable_image_file_format)の中身を確認したいな」と思ったときに
[ExifTool](https://exiftool.org/)というツールの存在を知りました。
これがなかなか便利だったので紹介します。

## Exif

[Exif](https://ja.wikipedia.org/wiki/Exchangeable_image_file_format)は画像のメタデータのデファクトスタンダードです。
みなさんがスマホで撮った写真にはたいていExifが埋め込まれています。
「何時何分に撮ったか」という情報はもちろん、F値やシャッタースピードなどの細かい撮影条件などが含まれています。

一番注意が必要なのは「位置情報」ですね。今どきのスマホにはGPSが積まれているので、かなり正確な位置情報がExifに記録されます。
SNSなどに公開するときは要注意です。
事前にどんな情報が書き込まれているかチェックするべきでしょう。

そんなとき活躍するのが[ExifTool](https://exiftool.org/)。
Exifを確認したり編集したりするためのツールです。

## ExifToolはPerl製！！

なぜPerlアドベントカレンダーでExifToolを取り上げるかというと、**ExifToolはPerl製** なんですね。

CPANにも上がっているので、[cpanm](https://metacpan.org/dist/App-cpanminus/view/lib/App/cpanminus/fatscript.pm) でインストール可能です。

```
cpanm Image::ExifTool
```

`exiftool` というコマンドがインストールされるので、適当な画像ファイルを渡すとメタデータを解析してくれます。
試しに [今年もアドベントカレンダー（物理）買いました](https://shogo82148.github.io/blog/2023/12/06/2023-12-06-advent-calendar/) で撮影した画像を読み込ませてみます。

```
$ exiftool 2023-12-06-advent-calendar1.jpeg
ExifTool Version Number         : 12.70
File Name                       : 2023-12-06-advent-calendar1.jpeg
Directory                       : .
File Size                       : 191 kB
File Modification Date/Time     : 2023:12:06 21:56:11+09:00
File Access Date/Time           : 2023:12:06 21:56:18+09:00
File Inode Change Date/Time     : 2023:12:06 21:56:17+09:00
File Permissions                : -rw-------
File Type                       : JPEG
File Type Extension             : jpg
MIME Type                       : image/jpeg
JFIF Version                    : 1.01
Exif Byte Order                 : Big-endian (Motorola, MM)
Photometric Interpretation      : RGB
Orientation                     : Horizontal (normal)
X Resolution                    : 72
Y Resolution                    : 72
Resolution Unit                 : inches
Exposure Time                   : 1/120
F Number                        : 1.8
Exposure Program                : Program AE
ISO                             : 100
Exif Version                    : 0232
Date/Time Original              : 2023:12:05 12:55:27
Create Date                     : 2023:12:05 12:55:27
Offset Time                     : +09:00
Offset Time Original            : +09:00
Offset Time Digitized           : +09:00
Shutter Speed Value             : 1/120
Aperture Value                  : 1.8
Brightness Value                : 4.372311574
Exposure Compensation           : 0
Metering Mode                   : Spot
Flash                           : Off, Did not fire
Focal Length                    : 6.9 mm
Subject Area                    : 2349 1553 371 374
Maker Note Version              : 14
Run Time Flags                  : Valid
Run Time Value                  : 144330610059958
Run Time Scale                  : 1000000000
Run Time Epoch                  : 0
AE Stable                       : Yes
AE Target                       : 195
AE Average                      : 198
AF Stable                       : Yes
Acceleration Vector             : -0.9842818985 0.005856786394 -0.1576361208
Focus Distance Range            : 0.55 - 0.82 m
Image Capture Type              : Unknown (12)
Warning                         : [minor] Bad format (16) for MakerNotes entry 13
Luminance Noise Amplitude       : 0.01099999994
HDR Headroom                    : 1.00999999
Signal To Noise Ratio           : 40.86616897
Photo Identifier                : ED3BCC04-CBFA-419A-82CE-A48A049C3755
Focus Position                  : 98
HDR Gain                        : 0.008332318627
AF Measured Depth               : 63
AF Confidence                   : 100
Semantic Style                  : {_0=1,_1=0,_2=0,_3=0}
Front Facing Camera             : No
Sub Sec Time                    : 118
Sub Sec Time Original           : 118
Sub Sec Time Digitized          : 118
Color Space                     : sRGB
Exif Image Width                : 1024
Exif Image Height               : 768
Sensing Method                  : One-chip color area
Scene Type                      : Directly photographed
Custom Rendered                 : Normal
Exposure Mode                   : Auto
White Balance                   : Auto
Focal Length In 35mm Format     : 48 mm
Lens Info                       : 2.220000029-9mm f/1.779999971-2.8
Lens Make                       : Apple
Lens Model                      : iPhone 15 Pro back triple camera 6.86mm f/1.78
Composite Image                 : General Composite Image
XMP Toolkit                     : XMP Core 6.0.0
Subject                         : 
Current IPTC Digest             : 0cbad6beaba2add1db62fe4a588c88b0
Coded Character Set             : UTF8
Application Record Version      : 2
Digital Creation Time           : 12:55:27
Digital Creation Date           : 2023:12:05
Date Created                    : 2023:12:05
Time Created                    : 12:55:27+09:00
IPTC Digest                     : 0cbad6beaba2add1db62fe4a588c88b0
Image Width                     : 1024
Image Height                    : 768
Encoding Process                : Baseline DCT, Huffman coding
Bits Per Sample                 : 8
Color Components                : 3
Y Cb Cr Sub Sampling            : YCbCr4:2:0 (2 2)
Run Time Since Power Up         : 1 days 16:05:31
Aperture                        : 1.8
Image Size                      : 1024x768
Megapixels                      : 0.786
Scale Factor To 35 mm Equivalent: 7.0
Shutter Speed                   : 1/120
Create Date                     : 2023:12:05 12:55:27.118+09:00
Date/Time Original              : 2023:12:05 12:55:27.118+09:00
Date/Time Created               : 2023:12:05 12:55:27+09:00
Digital Creation Date/Time      : 2023:12:05 12:55:27
Circle Of Confusion             : 0.004 mm
Field Of View                   : 41.1 deg
Focal Length                    : 6.9 mm (35 mm equivalent: 48.0 mm)
Hyperfocal Distance             : 6.16 m
Light Value                     : 8.6
Lens ID                         : iPhone 15 Pro back triple camera 6.86mm f/1.78
```

~~（カメラのことはよく知らないので書いてある意味はさっぱりですが）~~
iPhone 15 Proで撮影したことなどが読み取れますね。
リサイズするときに位置情報は削除されたようです。これで一安心。

## Perlスクリプトから呼び出す

ExifToolはPerl製なので、Perlのモジュールとして呼び出すことも可能です。
たとえば「撮影に使ったレンズのモデルを知りたい」という場合は、以下のようなプログラムを書くと取得できます。

```perl
use 5.038;
use Image::ExifTool qw(:Public);

my $info = ImageInfo('2023-12-06-advent-calendar1.jpeg');
say $info->{"LensModel"}; # iPhone 15 Pro back triple camera 6.86mm f/1.78
```

## htmlDumpオプション

個人的に一番のお気に入りが `-htmlDump` オプションです。
このオプションを指定すると、標準出力にHTMLファイルが出力されます。

```
exiftool -htmlDump 2023-12-06-advent-calendar1.jpeg > dump.html
```

HTMLの中身はちょっとリッチな16進数ダンプです。
マウスオーバーすると該当データの意味や値を教えてくれます。
Exifのデコーダーを自作したくなったときとかに便利ですね。

![2023年アドベントカレンダーの16進数ダンプ](/images/2023-12-11-dump.png)

HTMLの実物はこちら→[dump.html](/files/2023-12-11-dump.html)

個人的にうれしいポイントは **ちょっと壊れたExifを入力してもそこそこ動くこと** 。
Exifデータを操作するプログラムを作っていると、
どうしても自作プログラムが壊れたExifを出力することがあります。
`-htmlDump` オプションを使うと、壊れた箇所が一発でわかるので、
プログラムの修正がとても楽でした。

## ExifTool Meta Information Repository

さらにExifToolがすごいのは対応しているメタデータの種類。
Exifは元々デジタルカメラのメタデータを保存する規格で、メーカーごとに独自拡張があります。
ExifToolは一部の独自拡張も解釈してくれます。

それを支えているのが [ExifTool Meta Information Repository](https://exiftool.org/sample_images.html)。
各メーカーのExifのサンプルを収集しているページです。
今日（2023-12-11）現在で **106メーカー、7005機種** のExifが収録されています。
これだけのサンプルを集める執念には感服です。

## まとめ

Exifデータを読み書きする[ExifTool](https://exiftool.org/)の紹介をしました。
Perlから簡単に扱うことができるので、Exifを扱うスクリプトを書くのにぜひ活用してください。

-----

明日12日目はTBDで「TBD」です。
お楽しみに！

## 参考

- [Exchangeable image file format - Wikipedia](https://ja.wikipedia.org/wiki/Exchangeable_image_file_format)
- [ExifTool by Phil Harvey](https://exiftool.org/)
- [ExifTool - Wikipedia](https://ja.wikipedia.org/wiki/ExifTool)
- [ExifTool Meta Information Repository](https://exiftool.org/sample_images.html)
