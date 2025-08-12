---
layout: post
title: "GitHubがJWTのb64ヘッダーパラメーターを認識するようになった"
slug: github-now-checks-b64-header-parameter
date: 2025-08-12 23:11:00 +0900
comments: true
categories: [github]
---

こんな罠に引っかかるのは僕だけだと思うんですが、一応記録として残しておきます・・・。

## TL;DR

- 2025-08-09あたりから、GitHubがJWTのb64ヘッダーパラメーターを認識するようになった
- 具体的にはJWTのヘッダーに `{"b64": false}` が含まれている場合に、"A JSON web token could not be decoded, documentation_url: https://docs.github.com/rest" というエラーメッセージが返ってくる

## 原因

GitHub Appsにアクセスするのに、お勉強も兼ねて自前実装のJWTエンコーダーを使っていました。

- <https://github.com/shogo82148/goat>

JWSのペイロードは普通base64エンコードされていますが、base64エンコードをスキップする拡張が提案されています。

- [RFC 7797: JSON Web Signature (JWS) Unencoded Payload Option](https://www.rfc-editor.org/rfc/rfc7797.html)

もちろん時前実装のJWTエンコーダーでも対応しました。

しかし、そこにバグがあったのです！
payloadをbase64エンコードしているのにもかかわらず、`{"b64": false}` が設定された状態になっていました。

JWTのヘッダーの中身:

{
  "cty": "JWT",
  "alg": "RS256",
  "b64": false
}

実際のペイロードの内容と、ヘッダーの情報が食い違っており、要するにもとから壊れたJWTを送っていたのです。
今まではたまたまGitHubが受け入れてくれる状態でした。

## GitHub 側の改修

おそらく `b64` ヘッダーパラメーターをチェックするようになったのだと思います。
この改修により、今までは許容されていた `{"b64": false}` 付きのJWTが使えなくなりました。

## 対応

そもそも `{"b64": false}` のJWTは使用してはならない (MUST NOT) とRFC 7797で定められています。
そのため "b64" の設定を削除してしまえば解決です。

JWTのヘッダーの中身:


## まとめ

GitHub側の仕様変更により、今まで使っていたJWTのアクセストークンが使えなくなってしました。
もともと壊れたトークンを送っていたので、自業自得ですね・・・。

みんなは、多くの人が使っている枯れた実装を使いましょう！

## 参考

- <https://github.com/shogo82148/goat>
- [RFC 7797: JSON Web Signature (JWS) Unencoded Payload Option](https://www.rfc-editor.org/rfc/rfc7797.html)
