---
layout: post
title: "C# でお手軽にMessagePack解析！"
date: 2014-05-25 01:38
comments: true
categories: [c#, unity, messagepack]
---

[MiniMessagePack.cs](https://github.com/shogo82148/MiniMessagePack)ってのを作った。
C#のプロジェクトにファイルひとつ導入するだけで、お手軽にMessagePackの解析ができます。

<!-- More -->

## なんで作ったの？

[MiniJSON](https://gist.github.com/darktable/1411710) の置き換えが目的です。
とあるUnityプロジェクトでMB単位のJSONをパースする箇所があってですね・・・
パースにはMiniJSONを使っているのですが、さすがに対象がでかすぎて重たい。
そこでMessagePackへの置き換えを検討してみたわけです。

もちろん C# で動く MessagePack のパーサはすでにあって、
[messagepack-cli](https://github.com/msgpack/msgpack-cli)とか[messagepack-unity](https://github.com/southwudang/msgpack-unity)とか見つけました。
しかし、Unityのちょっと古いMonoで動かすためにちょっとゴニョゴニョしないといけなかったり、
MiniJSON との互換性を取るためにもゴニョゴニョしないといけなかったり(実際やってみたらキャストが大量に失敗して辛かった・・・)、
今回の用途にはちょっと高機能かなーと思ったので作っちゃいました！


## つかいかた

### デコードする

`byte`の配列を渡すとパースして返してくれます。
配列は`List<object>`で、マップは`Dictionary<string, object>`になります。

``` csharp
using MiniMessagePack;

// it means {"compact":true,"schema":0} in JSON
var msgpack = new byte[] {
    0x82, 0xa7, 0x63, 0x6f, 0x6d, 0x70, 0x61, 0x63, 0x74, 0xc3,
	0xa6, 0x73, 0x63, 0x68, 0x65, 0x6d, 0x61, 0x00
};

var packer = new MiniMessagePacker ();
object unpacked_data = packer.Unpack (msgpack);
/*
unpacked_data = new Dictionary<string, object> {
    { "compact", true },
    { "schema", 0},
};
*/
```

### エンコードする

オブジェクトを渡すと MessagePack にエンコードして返してくれます。

``` csharp
using MiniMessagePack;

var unpacked_data = new Dictionary<string, object> {
    { "compact", true },
    { "schema", 0},
};

var packer = new MiniMessagePacker ();
bytep[] msgpack = packer.Pack (unpacked_data);
// msgpack = new byte[] { 0x82, 0xa7, ...};
```

## 制限事項

MiniJSON との互換性を取るために、色々と制限事項があります。

- デコード時、整数型は全て`long`型
  - 整数の大きさに関係なく全て`long`型になります
  - 符号なし64bit整数型も`long`として扱われるので、表現できる範囲が狭くなっていることに注意してください
- デコード時、浮動小数点型は全て`double`型
  - `float`も`double`として扱われます(拡張される方向への変換だから問題ないとは思うけど)
- デコード時、マップ型のキーは文字列にキャストされます
  - MessagePackの仕様にはキーの型に制限が無いっぽい(？)けど、扱えるのは文字列の場合のみです
- Extended は今のところ扱えません


## ちょっとだけ使ってみた結果

正確なベンチマークとかはとってないのですが、
実際のプロジェクトに組み込んでみた結果、MiniJSONとくらべて約2倍の速さでパースできました！


MiniJSON を使っているプロジェクトであれば簡単に導入できるはずなので、ぜひ試してみてみてください。
