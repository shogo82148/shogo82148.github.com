---
layout: post
title: "GitHub Artifact Attestations を試してみた"
slug: 2024-06-30-try-artifact-attestations
date: 2024-06-30 14:36:00 +0900
comments: true
categories: [github]
---

GitHub Artifact Attestations が正式リリースされました。

- [GitHub Artifact Attestations is generally available](https://github.blog/changelog/2024-06-25-artifact-attestations-is-generally-available/)

[ベータ公開](https://github.blog/2024-05-02-introducing-artifact-attestations-now-in-public-beta/) から2カ月足らずでの正式リリースです。
早いですね。それだけ力を入れているということでしょうか。

なんか難しい単語（attestations とか provenanceとか）が並んでいて正直良くわからんのですが、とりあえず試してみましょう。

## 署名してみる

「[S3からファイルを落とすだけのツールを作った](https://shogo82148.github.io/blog/2018/06/20/s3cli-mini/)」で作成した、
 [s3cli-mini](https://github.com/shogo82148/s3cli-mini) で試してみます。

s3cli-miniのリリース処理は GitHub Actions 上で実行しています。
ビルドしたバイナリーは以下のリンクからダウンロード可能です。

- [v0.0.15 - GitHub Releases](https://github.com/shogo82148/s3cli-mini/releases/tag/v0.0.15)

しかしこのバイナリーは本当に GitHub Actions 上でビルドしたものでしょうか？
リリースバイナリーはあとから差し替えも可能です。僕が悪意のあるコードを密かに忍ばせ、再ビルドし、上書きしているかもしれません。
僕に悪意がなくとも、僕がうっかりクレデンシャルを流出させてしまい、悪意のある第三者によって上書きされるかもしれません。

そんな心配を解決するのが Artifact Attestations です。

使い方は簡単で、リリースのワークフローに [actions/attest-build-provenance](https://github.com/actions/attest-build-provenance) を呼ぶステップを追加するだけです。

```diff
diff --git a/.github/workflows/release.yml b/.github/workflows/release.yml
index b5b65f4..31f2d6c 100644
--- a/.github/workflows/release.yml
+++ b/.github/workflows/release.yml
@@ -10,6 +10,7 @@ jobs:
     permissions:
       contents: write
       id-token: write
+      attestations: write
 
     runs-on: ubuntu-latest
     steps:
@@ -35,3 +36,14 @@ jobs:
           args: release --clean
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+
+      - name: Generate artifact attestation
+        uses: actions/attest-build-provenance@v1
+        with:
+          subject-path: |
+            dist/*.tar.gz
+            dist/*.apk
+            dist/*.deb
+            dist/*.rpm
+            dist/*.zip
+            dist/checksums.txt
```

s3cli-miniのビルドには [GoReleaser](https://goreleaser.com/) を使っています。
GoReleaser が `./dist/` に実行バイナリーを吐くので、それらを `subject-path` に指定します。

また、`attestations: write` と `id-token: write` の権限が必要なので、忘れずに付与しておきましょう。

## 検証してみる

検証は [GitHub CLI](https://cli.github.com/) で行います。
まずは実行バイナリーをダウンロードしてきましょう。

```plain
% curl -sSL -O https://github.com/shogo82148/s3cli-mini/releases/download/v0.0.15/s3cli-mini_0.0.15_darwin_arm64.tar.gz
```

`gh attestation verify` サブコマンドを使って検証を行います。

```plain
% gh attestation verify s3cli-mini_0.0.15_darwin_arm64.tar.gz -R shogo82148/s3cli-mini
Loaded digest sha256:7452a6cd31d8a5588919c8806f425e37ad95752a4c148f2247e91d4451a91021 for file://s3cli-mini_0.0.15_darwin_arm64.tar.gz
Loaded 1 attestation from GitHub API
✓ Verification succeeded!

sha256:7452a6cd31d8a5588919c8806f425e37ad95752a4c148f2247e91d4451a91021 was attested by:
REPO                   PREDICATE_TYPE                  WORKFLOW
shogo82148/s3cli-mini  https://slsa.dev/provenance/v1  .github/workflows/release.yml@refs/tags/v0.0.15
```

検証に成功しました！
これでダウンロードしてきたバイナリーは、GitHub Actions上でビルドされたものだと証明できました。

署名された記録は GitHub や Sigstore にも記録されており、以下のリンクから確認可能です。

- [s3cli-mini_0.0.15_darwin_arm64.tar.gz - Attestations](https://github.com/shogo82148/s3cli-mini/attestations/1180249)
- [Rekor transparency log - Rekor Search](https://search.sigstore.dev/?logIndex=106381065)

## 注意

`gh attestation verify` サブコマンドで検証できるのは、あくまでも **「リリースがGitHub Actions上で行われた」という事実確認** です。
バイナリーが安全であることの保証にはなりません。
レポジトリに悪意のあるコードが混入していれば、当然ながらそのバイナリーを使うのは危険です。
検証結果を盲目的に信じないよう注意してください。

## まとめ

GitHub Artifact Attestations を試してみました。
この機能を使うと、バイナリーがGitHub Actions上でビルドされたことの証明が簡単にできます。
導入は簡単なので、ツールの開発者はぜひ利用してみてください。

## 参考

- [GitHub Artifact Attestations is generally available](https://github.blog/changelog/2024-06-25-artifact-attestations-is-generally-available/)
- [Introducing Artifact Attestations–now in public beta](https://github.blog/2024-05-02-introducing-artifact-attestations-now-in-public-beta/)
- [actions/attest-build-provenance](https://github.com/actions/attest-build-provenance)
- [S3からファイルを落とすだけのツールを作った](https://shogo82148.github.io/blog/2018/06/20/s3cli-mini/)
- [shogo82148/s3cli-mini](https://github.com/shogo82148/s3cli-mini)
- [GoReleaser](https://goreleaser.com/)
- [GitHub CLI](https://cli.github.com/)
- [s3cli-mini_0.0.15_darwin_arm64.tar.gz - Attestations](https://github.com/shogo82148/s3cli-mini/attestations/1180249)
- [Rekor transparency log - Rekor Search](https://search.sigstore.dev/?logIndex=106381065)
