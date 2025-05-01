---
layout: post
title: "Akamai x UNIQLOコラボTシャツに書かれたプログラムを解読してみる (第二回戦)"
slug: akamai-peace-for-all-2nd
date: 2025-05-02 00:12:00 +0900
comments: true
categories: []
---

[Akamai](https://www.akamai.com/ja) とユニクロのコラボTシャツに新しいデザインが登場しました。

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">[プレスリリース] <a href="https://twitter.com/UNIQLO_JP?ref_src=twsrc%5Etfw">@UNIQLO_JP</a> のチャリティTシャツプロジェクト「PEACE FOR ALL」に Akamai Tシャツ第2弾のデザインが加わります❤️ 6月20日(金)より世界各国で発売されます❤️今回のカラーはレトロホワイト❤️<a href="https://t.co/YsWPPmgkZS">https://t.co/YsWPPmgkZS</a><a href="https://twitter.com/hashtag/AkamaiPeaceForAll?src=hash&amp;ref_src=twsrc%5Etfw">#AkamaiPeaceForAll</a> <a href="https://twitter.com/hashtag/%E3%83%A6%E3%83%8B%E3%82%AF%E3%83%AD?src=hash&amp;ref_src=twsrc%5Etfw">#ユニクロ</a> <a href="https://twitter.com/hashtag/%E3%82%A2%E3%82%AB%E3%83%9E%E3%82%A4?src=hash&amp;ref_src=twsrc%5Etfw">#アカマイ</a> <a href="https://t.co/FkH5PmXzJL">pic.twitter.com/FkH5PmXzJL</a></p>&mdash; アカマイ･テクノロジーズ (@akamai_jp) <a href="https://twitter.com/akamai_jp/status/1915601732169585001?ref_src=twsrc%5Etfw">April 25, 2025</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script> 

背中になにかコードのようなものが書いてあります。
これは解読せずにはいられない。

前回の解読記事はこちら:

- [RE: Akamai x UNIQLOコラボTシャツに書かれたプログラムを解読してみる ](https://shogo82148.github.io/blog/2023/04/23/2023-04-23-akamai-peace-for-all/)

## 写経

頑張って写経しました・・・大変でした。
OCRの力もちょっと借りましたが、lと1、0とOをときどき間違える。
通常のOCRの用途ならそれでも十分かもしれませんが、今回は一箇所でもタイポすると動かなくなります。
最後に頼れるのはやはり人間の目でした。

```plain
#!/bin/bash eval "$(base64 -d <<< 'IyEvYmluL2Jhc2gKCiMgQ29uZ3Jhd
HVsYXRpb25zISBZb3UgZm91bmQgdGhlIGVhc3RlciBlZ2chIOKdpO+4jwojIOOBiuO
CgeOBp+OBqOOBhuOBlOOBluOBhOOBvuOBme+8gemaoOOBleOCjOOBn+OCteODl+OD
qeOCpOOCuuOCkuimi+OBpOOBkeOBvuOBl+OBn++8geKdpO+4jwoKIyBEZWZpbmUgd
GhlIHRleHQgdG8gYW5pbWF0ZQp0ZXh0PSLimaVQRUFDReKZpUZPUuKZpUFMTOKZpV
BFQUNF4pmlRk9S4pmlQUxM4pmlUEVBQ0XimaVGT1LimaVBTEzimaVQRUFDReKZpUZ
PUuKZpUFMTOKZpVBFQUNF4pmlRk9S4pmlQUxM4pmlIgoKIyBHZXQgdGVybWluYWwg
ZGltZW5zaW9ucwpjb2xzPSQodHB1dCBjb2xzKQpsaW5lcz0kKHRwdXQgbGluZXMpC
gojIENhbGN1bGF0ZSB0aGUgbGVuZ3RoIG9mIHRoZSB0ZXh0CnRleHRfbGVuZ3RoPS
R7I3RleHR9CgojIEhpZGUgdGhlIGN1cnNvcgp0cHV0IGNpdmlzCgojIFRyYXAgQ1RS
TCtDIHRvIHNob3cgdGhlIGN1cnNvciBiZWZvcmUgZXhpdGluZwp0cmFwICJ0cHV0I
GNub3JtOyBleGl0IiBTSUdJTlQKCiMgU2V0IGZyZXF1ZW5jeSBzY2FsaW5nIGZhY3R
vcgpmcmVxPTAuMgoKIyBJbmZpbml0ZSBsb29wIGZvciBjb250aW51b3VzIGFuaW1hd
Glvbgpmb3IgKCggdD0wOyA7IHQrPTEgKSk7IGRvCiAgICAjIEV4dHJhY3Qgb25lIGN
oYXJhY3RlciBhdCBhIHRpbWUKICAgIGNoYXI9IiR7dGV4dDp0ICUgdGV4dF9sZW5nd
Gg6MX0iCiAgICAKICAgICMgQ2FsY3VsYXRlIHRoZSBhbmdsZSBpbiByYWRpYW5zCiA
gICBhbmdsZT0kKGVjaG8gIigkdCkgKiAkZnJlcSIgfCBiYyAtbCkKCiAgICAjIENhb
GN1bGF0ZSB0aGUgc2luZSBvZiB0aGUgYW5nbGUKICAgIHNpbmVfdmFsdWU9JChlY2
hvICJzKCRhbmdsZSkiIHwgYmMgLWwpCgogICAgIyBDYWxjdWxhdGUgeCBwb3NpdGl
vbiB1c2luZyB0aGUgc2luZSB2YWx1ZQogICAgeD0kKGVjaG8gIigkY29scyAvIDIpIC
sgKCRjb2xzIC8gNCkgKiAkc2luZV92YWx1ZSIgfCBiYyAtbCkKICAgIHg9JChwcmlu
dGYgIiUuMGYiICIkeCIpCgogICAgIyBFbnN1cmUgeCBpcyB3aXRoaW4gdGVybWluY
WwgYm91bmRzCiAgICBpZiAoKCB4IDwgMCApKTsgdGhlbiB4PTA7IGZpCiAgICBpZi
AoKCB4ID49IGNvbHMgKSk7IHRoZW4geD0kKChjb2xzIC0gMSkpOyBmaQoKICAgICM
gQ2FsY3VsYXRlIGNvbG9yIGdyYWRpZW50IGJldHdlZW4gMTIgKGN5YW4pIGFuZCAyM
DggKG9yYW5nZSkKICAgIGNvbG9yX3N0YXJ0PTEyCiAgICBjb2xvcl9lbmQ9MjA4CiA
gICBjb2xvcl9yYW5nZT0kKChjb2xvcl9lbmQgLSBjb2xvcl9zdGFydCkpCiAgICBjb
2xvcj0kKChjb2xvcl9zdGFydCArIChjb2xvcl9yYW5nZSAqIHQgLyBsaW5lcykgJSBj
b2xvcl9yYW5nZSkpCgogICAgIyBQcmludCB0aGUgY2hhcmFjdGVyIHdpdGggMjU2L
WNvbG9yIHN1cHBvcnQKICAgIGVjaG8gLW5lICJcMDMzWzM4OzU7JHtjb2xvcn1tIiQ
odHB1dCBjdXAgJHQgJHgpIiRjaGFyXDAzM1swbSIKCiAgICAjIExpbmUgZmVlZCB0b
yBtb3ZlIGRvd253YXJkCiAgICBlY2hvICIiCgpkb25lCgo= ')" PEACE FOR ALL
```

## 動かしてみる

どうやらBashのコードのようですが、残念ながらそのままでは動きませんでした。
Tシャツにプリントするために適宜改行が入っているようです。
この改行を取り除くと動くようになります。

```bash
#!/bin/bash
eval "$(base64 -d <<< 'IyEvYmluL2Jhc2gKCiMgQ29uZ3JhdHVsYXRpb25zISBZb3UgZm91bmQgdGhlIGVhc3RlciBlZ2chIOKdpO+4jwojIOOBiuOCgeOBp+OBqOOBhuOBlOOBluOBhOOBvuOBme+8gemaoOOBleOCjOOBn+OCteODl+ODqeOCpOOCuuOCkuimi+OBpOOBkeOBvuOBl+OBn++8geKdpO+4jwoKIyBEZWZpbmUgdGhlIHRleHQgdG8gYW5pbWF0ZQp0ZXh0PSLimaVQRUFDReKZpUZPUuKZpUFMTOKZpVBFQUNF4pmlRk9S4pmlQUxM4pmlUEVBQ0XimaVGT1LimaVBTEzimaVQRUFDReKZpUZPUuKZpUFMTOKZpVBFQUNF4pmlRk9S4pmlQUxM4pmlIgoKIyBHZXQgdGVybWluYWwgZGltZW5zaW9ucwpjb2xzPSQodHB1dCBjb2xzKQpsaW5lcz0kKHRwdXQgbGluZXMpCgojIENhbGN1bGF0ZSB0aGUgbGVuZ3RoIG9mIHRoZSB0ZXh0CnRleHRfbGVuZ3RoPSR7I3RleHR9CgojIEhpZGUgdGhlIGN1cnNvcgp0cHV0IGNpdmlzCgojIFRyYXAgQ1RSTCtDIHRvIHNob3cgdGhlIGN1cnNvciBiZWZvcmUgZXhpdGluZwp0cmFwICJ0cHV0IGNub3JtOyBleGl0IiBTSUdJTlQKCiMgU2V0IGZyZXF1ZW5jeSBzY2FsaW5nIGZhY3RvcgpmcmVxPTAuMgoKIyBJbmZpbml0ZSBsb29wIGZvciBjb250aW51b3VzIGFuaW1hdGlvbgpmb3IgKCggdD0wOyA7IHQrPTEgKSk7IGRvCiAgICAjIEV4dHJhY3Qgb25lIGNoYXJhY3RlciBhdCBhIHRpbWUKICAgIGNoYXI9IiR7dGV4dDp0ICUgdGV4dF9sZW5ndGg6MX0iCiAgICAKICAgICMgQ2FsY3VsYXRlIHRoZSBhbmdsZSBpbiByYWRpYW5zCiAgICBhbmdsZT0kKGVjaG8gIigkdCkgKiAkZnJlcSIgfCBiYyAtbCkKCiAgICAjIENhbGN1bGF0ZSB0aGUgc2luZSBvZiB0aGUgYW5nbGUKICAgIHNpbmVfdmFsdWU9JChlY2hvICJzKCRhbmdsZSkiIHwgYmMgLWwpCgogICAgIyBDYWxjdWxhdGUgeCBwb3NpdGlvbiB1c2luZyB0aGUgc2luZSB2YWx1ZQogICAgeD0kKGVjaG8gIigkY29scyAvIDIpICsgKCRjb2xzIC8gNCkgKiAkc2luZV92YWx1ZSIgfCBiYyAtbCkKICAgIHg9JChwcmludGYgIiUuMGYiICIkeCIpCgogICAgIyBFbnN1cmUgeCBpcyB3aXRoaW4gdGVybWluYWwgYm91bmRzCiAgICBpZiAoKCB4IDwgMCApKTsgdGhlbiB4PTA7IGZpCiAgICBpZiAoKCB4ID49IGNvbHMgKSk7IHRoZW4geD0kKChjb2xzIC0gMSkpOyBmaQoKICAgICMgQ2FsY3VsYXRlIGNvbG9yIGdyYWRpZW50IGJldHdlZW4gMTIgKGN5YW4pIGFuZCAyMDggKG9yYW5nZSkKICAgIGNvbG9yX3N0YXJ0PTEyCiAgICBjb2xvcl9lbmQ9MjA4CiAgICBjb2xvcl9yYW5nZT0kKChjb2xvcl9lbmQgLSBjb2xvcl9zdGFydCkpCiAgICBjb2xvcj0kKChjb2xvcl9zdGFydCArIChjb2xvcl9yYW5nZSAqIHQgLyBsaW5lcykgJSBjb2xvcl9yYW5nZSkpCgogICAgIyBQcmludCB0aGUgY2hhcmFjdGVyIHdpdGggMjU2LWNvbG9yIHN1cHBvcnQKICAgIGVjaG8gLW5lICJcMDMzWzM4OzU7JHtjb2xvcn1tIiQodHB1dCBjdXAgJHQgJHgpIiRjaGFyXDAzM1swbSIKCiAgICAjIExpbmUgZmVlZCB0byBtb3ZlIGRvd253YXJkCiAgICBlY2hvICIiCgpkb25lCgo= ')"
PEACE FOR ALL
```

何が起こるかは実行してみてのお楽しみ。

## base64デコードしてみる

スクリプトの本体はbase64でエンコードされています。
デコードして中身を確認してみましょう。

```bash
#!/bin/bash

# Congratulations! You found the easter egg! ❤️
# おめでとうございます！隠されたサプライズを見つけました！❤️

# Define the text to animate
text="♥PEACE♥FOR♥ALL♥PEACE♥FOR♥ALL♥PEACE♥FOR♥ALL♥PEACE♥FOR♥ALL♥PEACE♥FOR♥ALL♥"

# Get terminal dimensions
cols=$(tput cols)
lines=$(tput lines)

# Calculate the length of the text
text_length=${#text}

# Hide the cursor
tput civis

# Trap CTRL+C to show the cursor before exiting
trap "tput cnorm; exit" SIGINT

# Set frequency scaling factor
freq=0.2

# Infinite loop for continuous animation
for (( t=0; ; t+=1 )); do
    # Extract one character at a time
    char="${text:t % text_length:1}"
    
    # Calculate the angle in radians
    angle=$(echo "($t) * $freq" | bc -l)

    # Calculate the sine of the angle
    sine_value=$(echo "s($angle)" | bc -l)

    # Calculate x position using the sine value
    x=$(echo "($cols / 2) + ($cols / 4) * $sine_value" | bc -l)
    x=$(printf "%.0f" "$x")

    # Ensure x is within terminal bounds
    if (( x < 0 )); then x=0; fi
    if (( x >= cols )); then x=$((cols - 1)); fi

    # Calculate color gradient between 12 (cyan) and 208 (orange)
    color_start=12
    color_end=208
    color_range=$((color_end - color_start))
    color=$((color_start + (color_range * t / lines) % color_range))

    # Print the character with 256-color support
    echo -ne "\033[38;5;${color}m"$(tput cup $t $x)"$char\033[0m"

    # Line feed to move downward
    echo ""

done
```

## まとめ

Akamai x UNIQLOコラボTシャツに書かれたプログラムを解読してみました。
実行可能なbashのコードになっていました。
Base64デコードしてみると日本語でメッセージが！

## 参考

- [ユニクロからAkamaiコラボTシャツ再び　前回はGoのコードをプリント、今回は……](https://www.itmedia.co.jp/news/articles/2504/30/news201.html)
- [RE: Akamai x UNIQLOコラボTシャツに書かれたプログラムを解読してみる ](https://shogo82148.github.io/blog/2023/04/23/2023-04-23-akamai-peace-for-all/)
