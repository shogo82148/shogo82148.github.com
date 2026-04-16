---
layout: post
title: "GitHub Appの秘密鍵をAWS KMSにインポートする"
slug: import-github-app-private-key-to-aws-kms
date: 2026-04-15 23:21:00 +0900
comments: true
categories: [github, aws]
---

## 背景・目的

以下の記事を読んで GitHub App の秘密鍵を AWS KMS に閉じ込められることを知りました。

- [GitHub App の秘密鍵を AWS KMS に閉じ込める](https://zenn.dev/aws_japan/articles/b311c3710826a6)

AWS KMS は食わず嫌いしていたので、この機会に仲良くなろうとちょっと触ってみることにしました。

触ってはみたものの秘密鍵をAWS KMSにインポートする手順が難しすぎる！
正直挫折しそうなりました。これからチャレンジする人が挫折しないよう、簡単に手順をまとめておきます。

## GitHub Appの秘密鍵のインポート手順

GitHub Appの設定は終わっているものとし、秘密鍵はすでに入手しているものとします。
入手した秘密鍵のことをKMSの用語では「キーマテリアル（鍵素材）」と呼ぶので、以下そのように記載します。

以下のような手順でキーマテリアルをインポートします。

- キーマテリアル無しでKMS Keyを作成する
- ラッピングパブリックキーとインポートトークンを取得する
- キーマテリアルの暗号化
- MSにキーマテリアルをインポートする
- エイリアスを割り当てる（Optional）

### キーマテリアル無しでKMS Keyを作成する

AWS KMSにはキーマテリアルを自動生成してくれる機能がありますが、
今回は手元にあるキーマテリアルをインポートしたいです。
そのためには `--origin EXTERNAL` オプションをつけてキーを作成します。

```bash
aws kms create-key \
    --key-spec RSA_2048 \
    --key-usage SIGN_VERIFY \
    --origin EXTERNAL \
    --description "GitHub App JWT signing key"
```

作成に成功すると「KeyId」が発行されます。
後で使うので覚えておきましょう。

### ラッピングパブリックキーとインポートトークンを取得する

KMSにキーマテリアルをインポートするには、
キーマテリアルを暗号化する必要があります。
暗号化に必要な公開鍵を取得します。

```bash
aws kms get-parameters-for-import \
    --key-id "$KEY_ID" \
    --wrapping-algorithm RSA_AES_KEY_WRAP_SHA_256 \
    --wrapping-key-spec RSA_4096
```

以下のようなJSONが出力されます。
`PublicKey` と `ImportToken` をそれぞれ `publickey.b64`、`importtoken.b64` という名前で保存します。

```json
{
    "KeyId": "arn:aws:kms:us-east-1:123456789012:key/$KEY_ID",
    "ImportToken": "import token (base64 encoded)",
    "PublicKey": "public key (base64 encoded)",
    "ParametersValidTo": "2026-04-14T22:45:46.755000+09:00"
}
```

Base64でエンコードされているので、デコードしておきます。

```bash
openssl enc -d -base64 -A -in publickey.b64 -out WrappingPublicKey.bin
openssl enc -d -base64 -A -in importtoken.b64 -out ImportToken.bin
```

### キーマテリアルの暗号化

GitHubからダウンロードできるプライベートキーはBase64エンコードされた形式（PEM形式）です。
KMSが受け入れてくれるのはバイナリー形式（DER形式）なので、
PEM形式からDER形式へ変換しておきます。

```bash
openssl pkcs8 -topk8 -inform PEM -outform DER \
    -in github-app-private-key.pem -out private-key.der -nocrypt
```

キーマテリアルの暗号化に使用する秘密鍵を作成します。

```bash
openssl rand -out aes-key.bin 32
```

この秘密鍵を使ってキーマテリアルを暗号化します。

```bash
openssl enc -id-aes256-wrap-pad \
        -K "$(xxd -p < aes-key.bin | tr -d '\n')" \
        -iv A65959A6 \
        -in private-key.der \
        -out key-material-wrapped.bin
```

秘密鍵はKMSの公開鍵を使って暗号化してます。

```bash
openssl pkeyutl \
    -encrypt \
    -in aes-key.bin \
    -out aes-key-wrapped.bin \
    -inkey WrappingPublicKey.bin \
    -keyform DER \
    -pubin \
    -pkeyopt rsa_padding_mode:oaep \
    -pkeyopt rsa_oaep_md:sha256 \
    -pkeyopt rsa_mgf1_md:sha256
```

暗号化した秘密鍵と暗号化したキーマテリアルとをひとつのファイルにまとめます。

```bash
cat aes-key-wrapped.bin key-material-wrapped.bin > EncryptedKeyMaterial.bin
```

### KMSにキーマテリアルをインポートする

KMSに暗号化したキーマテリアルをインポートします。
キーマテリアルの有効期限も設定できます。以下は有効期限を無期限に設定する場合のコマンド例です。

```bash
aws kms import-key-material \
    --key-id "$KEY_ID" \
    --encrypted-key-material fileb://EncryptedKeyMaterial.bin \
    --import-token fileb://ImportToken.bin \
    --expiration-model KEY_MATERIAL_DOES_NOT_EXPIRE
```

### エイリアスを割り当てる（Optional）

Key IDの形式はUUIDv4です。
そのままでは覚えにくいので、必要に応じてエイリアスを割り当てましょう。

```bash
aws kms create-alias \
    --alias-name alias/github-app \
    --target-key-id "$KEY_ID"
```

このように設定しておくと、Key IDが必要な場面でKeyIDの代わりに `alias/github-app` を使用できます。

## まとめ

GitHub Appの秘密鍵をAWS KMSにインポートする手順を紹介しました。
キーマテリアルを直接KMSへインポートすることはできず、
共通鍵暗号と公開鍵暗号を組み合わせて自分で暗号化する必要があります。
鍵がたくさん出てきてややこしいですね。

しかしよく考えてみると、今回紹介した暗号化の流れはTLSが裏でやっていることそのものです。
TLSのありがたさがよくわかりました。

## 参考

- [GitHub App の秘密鍵を AWS KMS に閉じ込める](https://zenn.dev/aws_japan/articles/b311c3710826a6)
- [konippi/create-github-app-token-aws-kms](https://github.com/konippi/create-github-app-token-aws-kms)
- [Create a KMS key with imported key material](https://docs.aws.amazon.com/kms/latest/developerguide/importing-keys-conceptual.html)
