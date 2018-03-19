---
layout: post
title: "初期化なしのusing文ってOK？"
date: 2014-05-27T13:48:00+09:00
comments: true
categories: [ C# ]
---

C# の using ステートメント、普通は変数の初期化とか new とかをまとめてやるものだと思ってたんですが、
某プロジェクトでusing文をこんな感じで使っているのを見かけました。

``` csharp
var hoge = new Hoge();
using(hoge) { // using( var hoge = new Hoge() ) { ならよく見る
    ...
}
```

見慣れない書き方だったので、本当にリソース解放が行われているのか不安・・・。
リソース解放が行われているのか調べてみました。

<!-- More -->

## まずは結論

- リソース解放自体は行われているので、ちゃんと書いてあれば問題なし
- しかしエラーをコンパイル時に見つけられない場合があるので非推奨

## 逆アセンブルして調べてみた

コンパイル結果見ればちゃんとリソース解放されているかわかるよね！
ってことでバイナリを逆アセンブルして調べてみました。

### サンプルコード

検証に使ったのはこんなコード。

``` csharp
using System;
using System.IO;

namespace UsingTest
{
    class MainClass
    {
        public static void Main (string[] args)
        {
            var sr = new StreamReader ("hoge.txt");
            Console.WriteLine ("Hoge: {0}", sr.ReadLine ());
        }
    }
}
```

僕はMac使いに転向したので、Monoを使います。
`mcs`を使ってコンパイル、`monodis` ってのを使うとILを見れるらしいです。
Windowsだったら .NET Framework SDK に `ildasm` ってのが付属してるので、それで見れるはず。

``` bash
mcs UsingTest.cs
monodis UsingTest.exe
```

標準出力にILが吐かれます。

``` plain
.assembly extern mscorlib
// ... 中略 ...
.namespace UsingTest
{
  .class private auto ansi beforefieldinit MainClass
  	 extends [mscorlib]System.Object
  {

    // method line 1
    .method public hidebysig specialname rtspecialname
           instance default void '.ctor' ()  cil managed
    {
        // Method begins at RVA 0x2050
	// Code size 7 (0x7)
	.maxstack 8
	IL_0000:  ldarg.0
	IL_0001:  call instance void object::'.ctor'()
	IL_0006:  ret
    } // end of method MainClass::.ctor

    // method line 2
    .method public static hidebysig
           default void Main (string[] args)  cil managed
    {
        // Method begins at RVA 0x2058
	.entrypoint
	// Code size 29 (0x1d)
	.maxstack 2
	.locals init (
		class [mscorlib]System.IO.StreamReader	V_0)
		IL_0000:  nop
		IL_0001:  ldstr "hoge.txt"
		IL_0006:  newobj instance void class [mscorlib]System.IO.StreamReader::'.ctor'(string)
		IL_000b:  stloc.0
		IL_000c:  ldstr "Hoge: {0}"
		IL_0011:  ldloc.0
		IL_0012:  callvirt instance string class [mscorlib]System.IO.TextReader::ReadLine()
		IL_0017:  call void class [mscorlib]System.Console::WriteLine(string, object)
		IL_001c:  ret
    } // end of method MainClass::Main

  } // end of class UsingTest.MainClass
}
```

Disposeが呼ばれてない！
リソース解放されてないぞ！！

### usingと一緒に初期化してみる

usingステートメントを使って解放処理をしてみます。

``` csharp
using (var sr = new StreamReader ("hoge.txt")) {
    Console.WriteLine ("Hoge: {0}", sr.ReadLine ());
}
```

``` plain
// Code size 49 (0x31)
.maxstack 2
.locals init (
    class [mscorlib]System.IO.StreamReader	V_0)
IL_0000:  nop
IL_0001:  ldstr "hoge.txt"
IL_0006:  newobj instance void class [mscorlib]System.IO.StreamReader::'.ctor'(string)
IL_000b:  stloc.0
.try { // 0
  L_000c:  nop
  IL_000d:  ldstr "Hoge: {0}"
  IL_0012:  ldloc.0
  IL_0013:  callvirt instance string class [mscorlib]System.IO.TextReader::ReadLine()
  IL_0018:  call void class [mscorlib]System.Console::WriteLine(string, object)
  IL_001d:  nop
  IL_001e:  leave IL_0030

} // end .try 0
finally { // 0
  IL_0023:  ldloc.0
  IL_0024:  brfalse IL_002f

  IL_0029:  ldloc.0
  IL_002a:  callvirt instance void class [mscorlib]System.IDisposable::Dispose()
  IL_002f:  endfinally
} // end handler 0
IL_0030:  ret
} // end of method MainClass::Main
```

自動的に try-finall節が作られ、その中でDisposeが呼ばれています。(たぶん。ILよくわかんないけど)


### usingでは初期化しない

次にusingの外で初期化

``` csharp
var sr = new StreamReader ("hoge.txt");
using (sr) {
    Console.WriteLine ("Hoge: {0}", sr.ReadLine ());
}
```

``` plain
// Code size 51 (0x33)
.locals init (
    class [mscorlib]System.IO.StreamReader V_0,
    class [mscorlib]System.IO.StreamReader V_1)
IL_0000:  nop
IL_0001:  ldstr "hoge.txt"
IL_0006:  newobj instance void class [mscorlib]System.IO.StreamReader::'.ctor'(string)
IL_000b:  stloc.0
IL_000c:  ldloc.0
IL_000d:  stloc.1
.try { // 0
  IL_000e:  nop
  IL_000f:  ldstr "Hoge: {0}"
  IL_0014:  ldloc.0
  IL_0015:  callvirt instance string class [mscorlib]System.IO.TextReader::ReadLine()
  IL_001a:  call void class [mscorlib]System.Console::WriteLine(string, object)
  IL_001f:  nop
  IL_0020:  leave IL_0032

} // end .try 0
finally  { // 0
  IL_0025:  ldloc.1
  IL_0026:  brfalse IL_0031

  IL_002b:  ldloc.1
  IL_002c:  callvirt instance void class [mscorlib]System.IDisposable::Dispose()
  IL_0031:  endfinally
} // end handler 0
IL_0032:  ret
```

お、ちゃんとDispose呼ばれてるみたい！
リソース解放はされてますね。

上のILをよく見ると、ローカル変数が２つ定義されています。
どうやらusingの中と外では同じ`sr`を指定しても別変数として扱われているようです。
そのためにコピーするコードが追加されているので、コードサイズが2byteほど増えてます。


### ブロックの外でインタンスを使う

`sr` のスコープは`Main`メソッドの中全体なので、usingのあとに`sr` をいじってもコンパイルは通ります。

``` csharp
var sr = new StreamReader ("hoge.txt");
using (sr) {
    Console.WriteLine ("Hoge: {0}", sr.ReadLine ());
}
Console.WriteLine ("Hoge: {0}", sr.ReadLine ()); // 例外を吐いて死ぬ
```

しかし、最後の行で例外を吐いて死にます。
使えるけど使うと死ぬインスタンスが残ってるの気持ち悪いですね・・・。


## 再び結論

ちゃんと Dispose は呼ばれるので、usingを抜けたところでリソース解放は行われます。
(たった2byteだけど)意味の無いILが生成されたり、コンパイル時のチェックがされなかったり、
あんまりいいことが無いので積極的に使う理由はないですね。


## SEE ALSO

ちゃんとドキュメントに書いてあった。

- [using ステートメント (C# リファレンス)](http://msdn.microsoft.com/ja-jp/library/yh598w02.aspx)

> リソース オブジェクトをインスタンス化して、変数を using ステートメントに渡すことは可能ですが、これはベスト プラクティスではありません。
> You can instantiate the resource object and then pass the variable to the using statement, but this is not a best practice.
