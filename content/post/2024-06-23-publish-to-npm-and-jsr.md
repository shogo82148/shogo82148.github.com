---
layout: post
title: "npmとjsrにパッケージを公開してみた (認証バッジ付)"
slug: 2024-06-23-publish-to-npm-and-jsr
date: 2024-06-23 16:12:00 +0900
comments: true
categories: [ typescript ]
---

先日、同時実行数を制限しながら並行実行する関数を書きました。

- [TypeScriptで同時実行数を制限しながら並行実行する](https://shogo82148.github.io/blog/2024/06/22/2024-06-22-limit-concurrency-in-typescript/)

便利関数を作ったら他のプロジェクトから参照したいですよね。
そこでパッケージレジストリに登録してみました。

正直コピペで実装で十分なのでは？という分量ですが、パッケージ公開の練習です。

## ソースコードを準備する

まずは公開するソースコードを準備していきましょう。
ソースコードはGitHubで公開しました。

- [shogo82148/limit-concurrency - GitHub](https://github.com/shogo82148/limit-concurrency)

### Denoの開発環境を整える

TypeScriptの開発環境を整えたいのですが、Node+TypeScriptの組み合わせはプロジェクトの立ち上げは意外と面倒です。
そこで今回は [Deno](https://deno.com) を使ってみることにしました。
DenoはTypeScriptの実行ランタイムとして開発されており、特別な設定なしでTypeScriptを実行できます。
Brewでインストールしました。

```bash
brew install deno
```

僕は最近エディターには VS Code を使っているので、Deno用の拡張機能をインストールしました。

- [denoland/vscode_deno](https://github.com/denoland/vscode_deno)

インストールしただけでは有効化されません。
ワークスペースの設定ファイル `.vscode/settings.json` を編集して、明示的に有効化します。

```javascript
{
  "deno.enable": true,
  "deno.lint": true,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "denoland.vscode-deno",
  "[typescript]": {
    "editor.defaultFormatter": "denoland.vscode-deno"
  },
}
```

開発環境が整ったらパッケージ本体のソースコードを書いていきます。

### GitHub Actionsでテストを実行する

パッケージとして公開するのであれば、テストを書いて、CIを回しておきたいですよね。
Deno公式がセットアップするためのアクションを公開しているので、これを利用します。

- [denoland/setup-deno](https://github.com/denoland/setup-deno)

あとは `deno test` コマンドを実行するだけです。

```yaml
on:
  push:
  pull_request:

jobs:
  deno:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v1
        with:
          deno-version: v1.x
      - name: test
        run: |
          deno test
```


### カバレッジを計測する

`--coverage` オプションをつけてテストを実行すると `coverage` ディレクトリにカバレッジが出力されます。
カバレッジはJSONファイルで出力されるのですが、これは Deno 独自のものらしく、そのままでは他のサービスと連携できません。
以下のコマンドで、一般的な lcov 形式に変換できます。

```bash
deno coverage --lcov > coverage.lcov
```

カバレッジは [Codecov](https://about.codecov.io/) にアップロードすることにしました。

テスト関連のワークフローをまとめると、次のようになります。

- [.github/workflows/test.yaml#L1-L21](https://github.com/shogo82148/limit-concurrency/blob/27807ffaf50f1863b0f2a691ce3bb6b0b67f7c7f/.github/workflows/test.yaml#L1-L21)

```yaml
on:
  push:
  pull_request:

jobs:
  deno:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v1
        with:
          deno-version: v1.x
      - name: test
        run: |
          deno test --coverage
          deno coverage --lcov > coverage.lcov
      - name: upload coverage
        uses: codecov/codecov-action@v4
        with:
          file: coverage.lcov
          token: ${{ secrets.CODECOV_TOKEN }}
```

## JSRにパッケージを公開する

今回は Deno のパッケージとして作成したので、 [JSR](https://jsr.io/) に公開するのがお手軽です。
ここにアップロードしてみましょう。

### Denoのパッケージを作成する

JSRはGitHubアカウントでサインアップ可能です。
サインアップしたら [jsr.io/new](https://jsr.io/new) からパッケージを作成しましょう。

### Denoのパッケージをアップロードする

パッケージのメタ情報を `deno.json` に記載します。

```json
{
  "name": "@shogo82148/limit-concurrency",
  "version": "0.1.6",
  "exports": {
    ".": "./limit-concurrency.ts"
  }
}
```

あとは `deno publish` を実行するだけです。

```bash
deno publish
```

ここでブラウザーが起動するので、案内にしたがって公開許可を行います。

- [@shogo82148/limit-concurrency - jsr](https://jsr.io/@shogo82148/limit-concurrency)

-----

一度ログインしていればパスワードの入力は必要ありません。
今まで `.hogerc` にパスワードを書く方式しか知らなかったので、「時代は進化しているんだなぁ」と感動しました。

## npmにパッケージを公開する

新興のレジストリも登場してきましたが、JavaScriptのレジストリと言ったら今も npm でしょう。
そういうわけで、 npm にも登録してみます。

### Deno のパッケージを npm パッケージに変換する

npmはあくまでもJavaScriptのレジストリなので、TypeScriptのモジュールをアップロードするにはビルドが必要です。
[denoland/dnt](https://github.com/denoland/dnt) を使ってビルドしてみました。

- [Deno + dntでCJS・ESMに対応したnpmパッケージを作ろう](https://zenn.dev/cybozu_frontend/articles/deno-npm-pacakge-dnt)
- [dnt — the easiest way to publish a hybrid npm module for ESM and CommonJS](https://deno.com/blog/publish-esm-cjs-module-dnt)
- [denoland/dnt](https://github.com/denoland/dnt)

dnt用の設定ファイルを用意します。

- [scripts/build_npm.ts](https://github.com/shogo82148/limit-concurrency/blob/27807ffaf50f1863b0f2a691ce3bb6b0b67f7c7f/scripts/build_npm.ts)

```typescript
// ex. scripts/build_npm.ts
import { build, emptyDir } from "@deno/dnt";

await emptyDir("./npm");

await build({
  entryPoints: ["./limit-concurrency.ts"],
  outDir: "./npm",
  shims: {
    deno: true,
  },
  package: {
    // package.json properties
    name: "@shogo82148/limit-concurrency",
    version: Deno.args[0],
    description: "Limit the concurrency of tasks.",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/shogo82148/limit-concurrency.git",
    },
    bugs: {
      url: "https://github.com/shogo82148/limit-concurrency/issues",
    },
  },
  postBuild() {
    // steps to run after building and before running the tests
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("README.md", "npm/README.md");
  },
});
```

このスクリプトを実行すると `npm/` ディレクトリに npm パッケージが出力されます。

```bash
deno run -A scripts/build_npm.ts 0.1.0
```

### npmのパッケージをアップロードする

あとは `npm publish` を実行するだけです。

```bash
cd npm
npm publish --access public
```

ブラウザーが起動するので、案内にしたがって公開許可を行います。

- [@shogo82148/limit-concurrency - npm](https://www.npmjs.com/package/@shogo82148/limit-concurrency)

## GitHub Actionsでリリースを自動化する

せっかくなのでリリースも自動化しましょう。
タグを打ったら、自動的にJSRとnpmに公開するよう設定します。

### GitHub Actionsでリリースを自動化する利点

もちろん、リリースの手間が減るというメリットはありますが、それだけではありません。

パッケージのページに

> Built and signed on GitHub Actions

と書かれた **バッジを表示できます** 。

- [@shogo82148/limit-concurrency - jsr](https://jsr.io/@shogo82148/limit-concurrency)
- [@shogo82148/limit-concurrency - npm](https://www.npmjs.com/package/@shogo82148/limit-concurrency)

なんかカッコイイ！欲しい！

### npmのアクセストークンを取得

npmの場合、公開のためにアクセストークンが必要です。
npmの設定から Access Token を発行し、GitHub の Secretsに保存しておきましょう。

### GitHubからJSRへのアクセス許可を設定

JSRの場合、アクセストークンは不要です。
代わりに GitHub Actions からのアクセス許可が必要です。
パッケージの設定から許可を出しておきます。

### GitHub Actions のOIDCを有効化する

パッケージのリリースにはOIDCが有効化されている必要があります。
リリースワークフローに以下の行を追加します。

```yaml
permissions:
  contents: read
  id-token: write
```

### publishスクリプトを書く

あとは GitHub Actions ワークフローの中で `deno publish && npm publish` するだけです。

- [scripts/publish.sh](https://github.com/shogo82148/limit-concurrency/blob/27807ffaf50f1863b0f2a691ce3bb6b0b67f7c7f/scripts/publish.sh)

```bash
#!/bin/bash

ROOT=$(git rev-parse --show-toplevel)

set -euxo pipefail
cd "$ROOT"

# publish to jsr
deno publish

# npm publish
deno run -A scripts/build_npm.ts "$(jq -r .version deno.json)"
cd npm
npm publish --access public --provenance ## --provenance オプションがついているのがポイント
```

## まとめ

npmとjsrに簡単なパッケージを公開してみました。
さらに、リリースフローの一部を GitHub Actions で自動化しました。

皆さんもぜひ「Built and signed on GitHub Actions」のバッジをゲットしてください。

## 余談

Denoについて調べていたら、Denoの標準ライブラリに [pooledMap](https://jsr.io/@std/async/doc/~/pooledMap) という関数を見つけました。
AsyncIterableを受け取り、並列度を制限しながら並行実行するというもの。
これはまさに求めていたもの！

まあ、今回はパッケージ公開のお勉強だったのでﾖｼ!

## 参考

- [Deno](https://deno.com/)
- [denoland/vscode_deno](https://github.com/denoland/vscode_deno)
- [denoland/setup-deno](https://github.com/denoland/setup-deno)
- [【GitHub Actions】DenoのカバレッジをCodecovで出す](https://qiita.com/access3151fq/items/ac2d92ff5f2b7b0619e5)
- [npmに公開していたパッケージをjsrにもpublishしてみた](https://zenn.dev/kesin11/articles/20240530_publish_jsr)
- [マルチランタイム時代のモダン JavaScript レジストリ JSR を使ってみる](https://developer.mamezou-tech.com/blogs/2024/05/09/jsr/)
- [Deno + dntでCJS・ESMに対応したnpmパッケージを作ろう](https://zenn.dev/cybozu_frontend/articles/deno-npm-pacakge-dnt)
- [dnt — the easiest way to publish a hybrid npm module for ESM and CommonJS](https://deno.com/blog/publish-esm-cjs-module-dnt)
- [denoland/dnt](https://github.com/denoland/dnt)
- [npm パッケージに認証バッジを付けてもらった話 (npm Provenance を試す)](https://zenn.dev/bicstone/articles/npm-provenance)
- [Introducing npm package provenance](https://github.blog/2023-04-19-introducing-npm-package-provenance/)
- [TypeScriptで同時実行数を制限しながら並行実行する](https://shogo82148.github.io/blog/2024/06/22/2024-06-22-limit-concurrency-in-typescript/)
- [shogo82148/limit-concurrency - GitHub](https://github.com/shogo82148/limit-concurrency)
- [@shogo82148/limit-concurrency - jsr](https://jsr.io/@shogo82148/limit-concurrency)
- [@shogo82148/limit-concurrency - npm](https://www.npmjs.com/package/@shogo82148/limit-concurrency)
- [@std/async > pooledMap](https://jsr.io/@std/async/doc/~/pooledMap)
