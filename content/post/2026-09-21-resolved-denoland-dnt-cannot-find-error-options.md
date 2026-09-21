---
layout: post
title: "【解決】denoland/dntがerror TS2304: Cannot find name 'ErrorOptions'で失敗する"
slug: resolved-denoland-dnt-cannot-find-error-options
date: 2026-09-21 21:37:00 +0900
comments: true
categories: [typescript, javascript, deno]
---

## 背景

Deno で書いた TypeScript を npm にアップロードするために [denoland/dnt](https://github.com/denoland/dnt) を利用しています。
しかし、 `error TS2304: Cannot find name 'ErrorOptions'` をいうエラーメッセージで失敗するので困っていました。

- [denoland/dntがerror TS2304: Cannot find name 'ErrorOptions'で失敗する](https://shogo82148.github.io/blog/2024/08/13/denoland-dnt-cannot-find-error-options/)

解決方法を見つけた（Claude先生が）ので共有しておきます。

## 解決方法

原因は [@std/assert](https://jsr.io/@std/assert) が ECMAScript の新機能を使っているためでした。
TypeScriptが認識している標準ライブラリーのバージョンが古いので、明示的に新しいバージョン `ESNext` を指定すればOKです。
また、`globalThis.addEventListener` の型情報が解決できずに失敗するので `DOM` も追加します。

```typescript
import { build, emptyDir } from "@deno/dnt";

await emptyDir("./npm");

await build({
  entryPoints: ["./limit-concurrency.ts"],
  outDir: "./npm",
  shims: {
    deno: true,
  },

  // コンパイラーオプションを追加する。
  compilerOptions: {
    lib: ["ESNext", "DOM"],
  },

  // 以下略
});
```

これでも解決しない場合、[denoland/dnt](https://github.com/denoland/dnt) が古いことが考えられます。
最新のバージョンにアップデートしましょう。

これで以前行ったワークアラウンドは不要になりました。

## まとめ

denoland/dntがerror TS2304: Cannot find name 'ErrorOptions'で失敗する問題を解決しました。

- コンパイラーオプションで `ESNext`, `DOM` を標準ライブラリーに指定する
- [denoland/dnt](https://github.com/denoland/dnt) をアップデートする

AIに聞けば何でも解決できちゃう時代ですが、一応記録として残しておきます。

## 参考

- [denoland/dnt](https://github.com/denoland/dnt)
- [denoland/dntがerror TS2304: Cannot find name 'ErrorOptions'で失敗する](https://shogo82148.github.io/blog/2024/08/13/denoland-dnt-cannot-find-error-options/)
