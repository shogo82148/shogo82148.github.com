---
layout: post
title: "C#のconditional Attributeのコンパイル結果を見てみる"
date: 2014-05-29 19:20
comments: true
categories: [ csharp ]
---

C#で「ある環境では関数の定義ごと消したい」みたいな要件があって、
そういう用途にconditinal attributeが使えるのかなーと話題のあがったので、実際に確認してみました。

結論から言えばできないのですが、せっかく調べたのでメモとして残しておきます。

<!-- More -->

## conditional attribute

「デバッグ時のみにしか実行して欲しくない関数」みたいなものを定義するための機能です。

``` csharp
using System;
using System.IO;
using System.Diagnostics;

namespace ConditionalAttributeTest
{
    class MainClass
    {
        public static void Main (string[] args)
        {
            Log("fugu");
        }

        [ConditionalAttribute("DEBUG")]
        public static void Log(string message)
        {
            Console.WriteLine(message);
        }
    }
}
```

こんなふうに書いておくと `DEBUG` シンボルが定義されている時にだけ`Log`の呼び出しが行われます。

``` bash
> mcs -d:DEBUG ConditionalAttributeTest.cs
> mono ConditionalAttributeTest
fugu
> mcs ConditionalAttributeTest.cs
> mono ConditionalAttributeTest
```

## 逆アセンブルしてみる

DEBUG付きでコンパイルした結果を逆アセンブルしてみます。

``` plain
// ...前略
// method line 2
.method public static hidebysig
    default void Main (string[] args)  cil managed
{
    // Method begins at RVA 0x2058
    .entrypoint
    // Code size 11 (0xb)
    .maxstack 8
    IL_0000:  ldstr "fugu"
    IL_0005:  call void class ConditionalAttributeTest.MainClass::Log(string)
    IL_000a:  ret
} // end of method MainClass::Main

// method line 3
.method public static hidebysig
    default void Log (string message)  cil managed
{
    .custom instance void class [mscorlib]System.Diagnostics.ConditionalAttribute::'.ctor'(string) =  (01 00 05 44 45 42 55 47 00 00 ) // ...DEBUG..

    // Method begins at RVA 0x2064
    // Code size 7 (0x7)
    .maxstack 8
    IL_0000:  ldarg.0
    IL_0001:  call void class [mscorlib]System.Console::WriteLine(string)
    IL_0006:  ret
}
```

DEBUGを付けなかったときとのDIFFをとってみます。

``` diff
15c15
< .module ConditionalAttributeTest.exe // GUID = {A54F3644-5083-4EC7-B846-8A354DD113AA}
---
> .module ConditionalAttributeTest.exe // GUID = {436FE462-17D6-4FDB-9AA7-15DA92658168}
42c42
<  // Code size 11 (0xb)
---
>  // Code size 1 (0x1)
44,46c44
<  IL_0000:  ldstr "fugu"
<  IL_0005:  call void class ConditionalAttributeTest.MainClass::Log(string)
<  IL_000a:  ret
---
>  IL_0000:  ret
55c53
<         // Method begins at RVA 0x2064
---
>         // Method begins at RVA 0x205a
```

変わったのは呼び出し側であるmain関数だけで、ConditionalAttributeがついたメソッド自体はDEBUGの有無に関係なく同じコードが吐かれます。


## SEE ALSO

例によってこのことはドキュメントにバッチリ載っております。

- [ConditionalAttribute クラス](http://msdn.microsoft.com/ja-jp/library/system.diagnostics.conditionalattribute.aspx)

> 指定した条件付きコンパイルのシンボルが定義されていない限り、メソッド呼び出しまたは属性を無視するようにコンパイラに指示します。

ドキュメントには「呼び出しを無視する」としか書かれてないので、定義がなくなるわけではないですね。
そもそも関数定義がなくなったら、リンク時に Conditional Attribute があるかないか確認する方法がないじゃないですか・・・。
