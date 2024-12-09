---
layout: post
title: "denoland/dntがerror TS2304: Cannot find name 'ErrorOptions'で失敗する"
slug: denoland-dnt-cannot-find-error-options
date: 2024-08-13 00:30:00 +0900
comments: true
categories: [typescript, javascript, deno]
---

先日npmへのパッケージ公開にチャレンジしてみました。

- [npmとjsrにパッケージを公開してみた (認証バッジ付) ](https://shogo82148.github.io/blog/2024/06/23/2024-06-23-publish-to-npm-and-jsr/)

しかし2か月も経たないうちにビルドに失敗するようになってしまいました・・・。
何もしていないのに壊れた。

```plain
% deno run -A scripts/build_npm.ts
[dnt] Transforming...
[dnt] Running npm install...

added 7 packages, and audited 8 packages in 4s

found 0 vulnerabilities
[dnt] Building project...
[dnt] Type checking ESM...
src/deps/jsr.io/@std/assert/1.0.2/assertion_error.ts:27:42 - error TS2304: Cannot find name 'ErrorOptions'.

27   constructor(message: string, options?: ErrorOptions) {
                                            ~~~~~~~~~~~~
src/deps/jsr.io/@std/assert/1.0.2/assertion_error.ts:27:42 - error TS4063: Parameter 'options' of constructor from exported class has or is using private name 'ErrorOptions'.

27   constructor(message: string, options?: ErrorOptions) {
                                            ~~~~~~~~~~~~
src/deps/jsr.io/@std/assert/1.0.2/assertion_error.ts:28:20 - error TS2554: Expected 0-1 arguments, but got 2.

28     super(message, options);
                      ~~~~~~~
src/deps/jsr.io/@std/assert/1.0.2/object_match.ts:125:33 - error TS2339: Property 'intersection' does not exist on type 'Set<any>'.

125           filtered[key] = value.intersection(subset);
                                    ~~~~~~~~~~~~
src/deps/jsr.io/@std/assert/1.0.2/object_match.ts:187:31 - error TS2339: Property 'intersection' does not exist on type 'Set<any>'.

187           filtered.push(value.intersection(subset));
                                  ~~~~~~~~~~~~

error: Uncaught (in promise) Error: Had 5 diagnostics.
          throw new Error(`Had ${diagnostics.length} diagnostics.`);
                ^
    at getProgramAndMaybeTypeCheck (https://jsr.io/@deno/dnt/0.41.2/mod.ts:468:17)
    at build (https://jsr.io/@deno/dnt/0.41.2/mod.ts:354:17)
    at eventLoopTick (ext:core/01_core.js:168:7)
    at async file:///Users/shogo/src/github.com/shogo82148/a1notation/scripts/build_npm.ts:6:1
```

適当にググってみても同じ現象に悩んでいる人を見つけられなかったので、自前のワークアラウンドで回避した方法をメモっておきます。

## 原因

直接の原因は[@std/assert](https://jsr.io/@std/assert) がECMAScriptの新機能を使うようになったためです。

`ErrorOptions` は ES2022 からの新機能です。
[Node Green](https://node.green/) によると Node 16.13.2 から対応しています。
手元のNodeはv20.11.0なので対応済みのハズですが、なぜかエラーになってしまいました。

- [TypeScriptのエラー処理（ES2022の新機能を添えて）](https://speakerdeck.com/akeno/typescriptfalseerachu-li-es2022falsexin-ji-neng-wotian-ete)

`Set.prototype.intersection` は ES2025 からの新機能です。
[Node Green](https://node.green/) によると Node 22.6.0 から対応しています。
手元のNodeはv20.11.0なので未対応ですね。

- [【JavaScript】ネイティブで集合演算できるようになった](https://qiita.com/rana_kualu/items/444cbac3a2ca26152d7a)

## ワークアラウンド

とりあえずテストが通ればいいので、雑なワークアラウンドを書きました。

### 自前定義のErrorOptionsを差し込む

`ErrorOptions` が見つからない！と怒られるので、独自実装の `ErrorOptions` を定義します。

```typescript
// custom_error_options.ts
export class ErrorOptions {
  cause?: Error;
}
```

ビルドの設定時にこのファイルを読み込ませると `ErrorOptions` に関するエラーは回避できます。

```diff
--- a/scripts/build_npm.ts
+++ b/scripts/build_npm.ts
@@ -8,6 +8,14 @@ await build({
   outDir: "./npm",
   shims: {
     deno: true,
+
+    // workaround for https://github.com/shogo82148/a1notation/issues/7
+    customDev: [
+      {
+        module: "./custom_error_options.ts",
+        globalNames: ["ErrorOptions"],
+      },
+    ],
   },
   package: {
     // package.json properties
```

### 型チェックを無効化する

`Set.prototype.intersection` が未定義な件は型チェックを無効化することで回避しました。

```diff
--- a/scripts/build_npm.ts
+++ b/scripts/build_npm.ts
@@ -23,6 +31,10 @@ await build({
       url: "https://github.com/shogo82148/a1notation/issues",
     },
   },
+
+  // workaround for https://github.com/shogo82148/a1notation/issues/7
+  typeCheck: false,
+
   postBuild() {
     // steps to run after building and before running the tests
     Deno.copyFileSync("LICENSE", "npm/LICENSE");
```

## まとめ

[denoland/dnt](https://github.com/denoland/dnt) が `error TS2304: Cannot find name 'ErrorOptions'` で失敗するようになってしまったので、
雑なワークアラウンドで対応しました。

- 自前定義のErrorOptionsを差し込む
- 型チェックを無効化する

「もっとスマートな解決方法があるよ」という方は教えてください。

> 小さなウサギが言うには、\
> エラーも解決、喜びの舞。\
> 新しい道を共に歩もう、\
>コードが輝く、未来のために。\
> 🐇✨
>
> by [CodeRabbit](https://coderabbit.ai/)

## 参考

- [denoland/dnt](https://github.com/denoland/dnt)
- [npmとjsrにパッケージを公開してみた (認証バッジ付) ](https://shogo82148.github.io/blog/2024/06/23/2024-06-23-publish-to-npm-and-jsr/)
- [@std/assert](https://jsr.io/@std/assert)
- [TypeScriptのエラー処理（ES2022の新機能を添えて）](https://speakerdeck.com/akeno/typescriptfalseerachu-li-es2022falsexin-ji-neng-wotian-ete)
- [Node Green](https://node.green/)
