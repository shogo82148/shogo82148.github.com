---
layout: post
title: "名前付き引数とオプション引数とオーバーロードを同時に使うとUnityが死ぬ"
date: 2015-03-29 12:13
comments: true
categories: [unity, csharp]
---

オーバーロードの優先順位付けが少しおかしくて、
名前付き引数とオプション引数と一緒に使うと死ぬ場合があるというお話。
ぴーちんが昨日言ってたやつ。
いんたーねっつにも乗っけておく。

<!-- More -->

問題となるのは以下のようなコード。

``` csharp
class MainClass
{
    void Foo (int fuga)
    {
    }

    void Foo (string hoge, int fuga = 10)
    {
    }

    void Bar()
    {
        Foo (fuga: 20);
    }
}
```

このコードは以下のような例外を吐いて死ぬ。

``` plain
Internal compiler error. See the console log for more information. output was:
Unhandled Exception: Mono.CSharp.InternalErrorException: Internal error
  at Mono.CSharp.MethodGroupExpr.IsApplicable (Mono.CSharp.ResolveContext ec, Mono.CSharp.Arguments& arguments, Int32 arg_count, System.Reflection.MethodBase& method, System.Boolean& params_expanded_form) [0x00000] in <filename unknown>:0 
  at Mono.CSharp.MethodGroupExpr.OverloadResolve (Mono.CSharp.ResolveContext ec, Mono.CSharp.Arguments& Arguments, Boolean may_fail, Location loc) [0x00000] in <filename unknown>:0 
  at Mono.CSharp.Invocation.DoResolveOverload (Mono.CSharp.ResolveContext ec) [0x00000] in <filename unknown>:0 
  at Mono.CSharp.Invocation.DoResolve (Mono.CSharp.ResolveContext ec) [0x00000] in <filename unknown>:0 
  at Mono.CSharp.Expression.Resolve (Mono.CSharp.ResolveContext ec, ResolveFlags flags) [0x00000] in <filename unknown>:0 
  at Mono.CSharp.Expression.Resolve (Mono.CSharp.ResolveContext ec) [0x00000] in <filename unknown>:0 
  at Mono.CSharp.ExpressionStatement.ResolveStatement (Mono.CSharp.BlockContext ec) [0x00000] in <filename unknown>:0 
  at Mono.CSharp.StatementExpression.Resolve (Mono.CSharp.BlockContext ec) [0x00000] in <filename unknown>:0 
  at Mono.CSharp.Block.Resolve (Mono.CSharp.BlockContext ec) [0x00000] in <filename unknown>:0 
  at Mono.CSharp.ToplevelBlock.Resolve (Mono.CSharp.FlowBranching parent, Mono.CSharp.BlockContext rc, Mono.CSharp.ParametersCompiled ip, IMethodData md) [0x00000] in <filename unknown>:0 


All compiler errors have to be fixed before you can enter playmode!
UnityEditor.SceneView:ShowCompileErrorNotification()
```

内部エラーだからどこが間違っているのか全くわからないという・・・。

このエラーに遭遇したのはUnity4.5.3だけど、
Unity5.0.0f4でも同じように死んだ。

`Foo (fuga: 20);` は `void Foo (int fuga)` を読んで欲しいけど、
Unityがなぜか `void Foo (string hoge, int fuga = 10)` を呼び出してしまい、
コード生成時にエラーで落ちたんじゃないかと予想している。

- 引数でオプションを取るのをやめる `void Foo (string hoge, int fuga)`
- 引数の名前を変える `void Foo (string hoge, int fugaa = 10)`

という対処をすると大丈夫っぽい。

メソッド名自体を変えるべきではって気もするけど、
どうしてもインターフェースを変えたくなったら以下のようにオプション引数を使わずに、すべてオーバーロードで解決するとかかなあ。

``` csharp
class MainClass
{
    void Foo (int fuga)
    {
    }

    void Foo (string hoge)
    {
	    Foo (hoge, 10);
    }

    void Foo (string hoge, int fuga)
    {
    }

    void Bar()
    {
        Foo (fuga: 20);
    }
}
```
