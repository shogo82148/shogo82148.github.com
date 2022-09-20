---
layout: post
title: "M1 Apple Silicon 移行記"
slug: hello-apple-silicon-m1
date: 2022-01-29 23:38:00 +0900
comments: true
categories: []
---

[Apple M1](https://ja.wikipedia.org/wiki/Apple_M1) が登場してはや一年。
昨年末にはその強化版の M1 Pro / M1 Max が発表され、 Mac Book Pro / Air のラインナップも全て M1 に置き換わってしまいました。
使用しているツールが未対応だったこともあり、弊社ではインテル版を使い続けていたのですが、
今ではツールの M1 対応も進んできたので、徐々にM1への移行を進めています。

僕の手元にもようやく M1 Mac Book が回ってきたので、
何周か遅れている気はしますが、インテルからM1への移行やってみたよ(2022年1月版)ということで記録を残しておきます。

-----

## Homebrew

[公式ドキュメントのインストール手順](https://docs.brew.sh/Installation) に従って以下のコマンドを実行すればOKです。
インテルもM1も特に変わりはありません。

```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"
```

ただしドキュメントの冒頭に記載がある通り、インテルとM1とではインストール先が異なります。

> This script installs Homebrew to its preferred prefix (`/usr/local` for macOS Intel, `/opt/homebrew` for Apple Silicon and `/home/linuxbrew/.linuxbrew` for Linux) so that you don’t need sudo when you `brew install`.

どうやら `/usr/local` への書き込みに root 権限が必要になったので、 `/opt/homebrew` へ移動したようです(要出典)。
`/usr/local/bin` にはデフォルトでパスが通ってますが、`/opt/homebrew/bin` には通っていないので、明示的に追加する必要があります。

```bash
export PATH=/opt/homebrew/bin:$PATH
```

## GitHub Release からバイナリ落として使うツール

GitHub Release からバイナリ落として使うツール、例えば弊社では [itamae-kitchen/mitamae](https://github.com/itamae-kitchen/mitamae) などがあります。
バイナリをダウンロードするだけで使えて便利なのですが、プロセッサのアーキテクチャに合わせてダウンロードのURLを変えなければいけません。

以下のようなシェルスクリプトを書いて対応しました。
`uname -m` でプロセッサのアーキテクチャを判定して、適切なバイナリを落としてくれます。

- [/bootstrap.sh](https://github.com/shogo82148/dotfiles/blob/c4e75bea088f15751d46eba1f67ea6c3b43e8630/bootstrap.sh)

```bash
#!/bin/bash

# bootstrap script.

set -uxe

TMPDIR=$(mktemp -d)
trap 'rm -rfv "$TMPDIR"' EXIT

case "$(uname)" in
    "Darwin")
        mitamae_os="darwin"
        ;;
    *)
        echo "unknown uname: $(uname)"
        exit 1
        ;;
esac

case "$(uname -m)" in
    "x86_64")
        mitamae_arch="x86_64"
        ;;
    "arm64")
        mitamae_arch="aarch64"
        ;;
    *)
        echo "unsupported architecture: $(uname -m)"
        exit 1
        ;;
esac
MITAMAE="mitamae-${mitamae_arch}-${mitamae_os}"

# install mitamae
VERSION=1.12.8
cd "$TMPDIR"
curl -sSL "https://github.com/itamae-kitchen/mitamae/releases/download/v$VERSION/$MITAMAE.tar.gz" -o mitamae.tar.gz
tar xzvf mitamae.tar.gz
mkdir -p ~/bin/
install -m 0755 "$MITAMAE" ~/bin/mitamae
```

既存のスクリプトの中には `/usr/local/bin` へバイナリをインストールするものがあったのですが、
M1 Mac では `/usr/local` への書き込みにルート権限が必要です。
(プロセッサによってパーミッションが変わる意味とは？)
毎回 `sudo` するのも面倒なので、ログイン済みのユーザーしか使わないツールはインストール先を `~/bin` へ変更しました。

## Docker

2022年1月29日現在 Docker Desktop は M1 に正式対応しています。
Docker 自体は特に問題なく動作しました。

- [Released: Docker Desktop for Mac [Apple Silicon]](https://www.docker.com/blog/released-docker-desktop-for-mac-apple-silicon/)

### MySQL のイメージ動かない問題

しかし Docker が M1 に対応していても、その上で動くイメージが arm64 に対応していないパターンがあります。
例えば [MySQLの公式イメージ](https://hub.docker.com/_/mysql)は arm64 に対応していません。

ワークアラウンドとしては、以下のドキュメントにあるように `--platform linux/amd64` オプションをつけて起動します。

> Not all images are available for ARM64 architecture. You can add `--platform linux/amd64` to run an Intel image under emulation. In particular, the mysql image is not available for ARM64. You can work around this issue by using a mariadb image.

- [Docker Desktop for Apple silicon](https://docs.docker.com/desktop/mac/apple-silicon/)

```
docker run --name some-mysql -e MYSQL_ROOT_PASSWORD=my-secret-pw -d --platform linux/amd64 mysql:5.7
```

この方法は QEMU でのエミュレーションになるのでパフォーマンスはあまり良くありません。
MySQL 8.0 であれば Oracle の MySQL チームがメンテナンスしているイメージを使うのが簡単です。
どちらのイメージでも MySQL 5.7 は arm64 未対応なのでエミュレーションする必要があります。

**2022-09-20追記**

[MySQL 8.0.29(sha256:12cf01a51f803d0ad49ee0dbbb3025a6eef3341e24757c2ed8150b6654c3fb07)](https://hub.docker.com/layers/library/mysql/8.0.29/images/sha256-12cf01a51f803d0ad49ee0dbbb3025a6eef3341e24757c2ed8150b6654c3fb07?context=explore)から、
MySQLの公式イメージも `arm64` に対応しました。
5.7以前はあいかわらず `amd64` のイメージのみです。

**追記ここまで**

```
docker run --name some-mysql -e MYSQL_ROOT_PASSWORD=my-secret-pw -d mysql/mysql-server:8.0
```

Docker Compose を利用している場合でも `platform` を指定すればエミュレーション可能です。

```yaml
# docker-compose.yml

version: "3.8"

services:
  # amd64 エミュレーション
  db1:
    image: mysql:5.7
    environment:
      - MYSQL_ROOT_PASSWORD=secret
    platform: linux/amd64

  # amd64/arm64 両対応
  db2:
    image: mysql/mysql-server:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=secret
```

### マルチアーキテクチャ対応のイメージを作る

デプロイにDockerを使っているけど、デプロイ先は x86_64 ということはまだまだあると思います。
いつも通り `docker build .` でビルドしてしまうと M1 Mac 上では ARM64 のイメージが作成されてしまうため、
デプロイにそのまま使うことはできません。

また、AWSもARM64アーキテクチャを採用した [AWS Graviton プロセッサ](https://aws.amazon.com/jp/ec2/graviton/) の導入に積極的です。
今は x86_64 だけど今後 ARM64 に移行したい、といった要望もあるかも知れません。
というわけでこの機会に x86_64 でも ARM64 でも動くマルチアーキテクチャ対応のイメージを作ってみました。

buildx を使うとマルチアーキテクチャ対応のイメージを簡単に作ることができます。

- [Dockerの「マルチCPUアーキテクチャ」に対応したイメージをビルドする](https://dev.classmethod.jp/articles/docker-multi-architecture-image-build/)
- [Docker Buildx](https://docs.docker.com/buildx/working-with-buildx/)

Classmethodさんのブログでは「実験的機能」を有効化していますが、2022年1月31日現在、buildx は正式にリリースされているので、
デフォルトで使えます。
デフォルトのビルダーインスタンスはエミュレーションに対応していないので、
ビルダーインスタンスの追加は必要みたい(？) (要出典)

```
docker buildx create --name mybuilder
docker buildx use mybuilder
docker buildx inspect --bootstrap
```

`docker build` コマンドの代わりに `docker buildx build` を使えば、マルチアーキテクチャ対応のイメージを作成できます。

```
docker buildx build --platform linux/amd64,linux/arm64 .
```

### DockerでGoのクロスコンパイルを行う

Go はクロスコンパイルが簡単なので、コンパイル時はCPUエミュレーションを行わない、という選択肢も可能です。

```dockerfile
# Go はクロスコンパイルが簡単なので、コンパイルはエミュレーションを行わない
FROM --platform=$BUILDPLATFORM golang:1.17 as builder

ENV ROOT=/go/src/app
WORKDIR ${ROOT}

# ここの順番は割と大事
# 変更頻度の低いものから高いものの順番に並べる
COPY go.mod go.sum ./
RUN go mod download
COPY ./ ${ROOT}

# なくても動いちゃうんだけど、これがないと誤ったアーキテクチャのキャッシュを使ってしまう場合がある
ARG TARGETOS
ARG TARGETARCH

# ターゲットのCPUアーキテクチャを明示してビルド
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -o /go/bin/app .

# 最終的に出力するイメージ
FROM gcr.io/distroless/static-debian11:latest
COPY --from=builder /go/bin/app /
CMD ["/app"]
```

これと同等のことを Docker 無しで実現する [google/ko](https://github.com/google/ko) があるという話を聞いたので、
そっちも試してみたい気持ちもあるけどまた今度。

## まとめ

- 登場から一年経ったこともあり大体のものは動く
- Docker で x86_64 イメージを扱わないといけなくなったときも、 `--platform` オプションを付けておけば大抵どうにかなる

以上、VS Code on M1 Apple からお伝えしました。

## 参考文献

- [Apple M1](https://ja.wikipedia.org/wiki/Apple_M1)
- [Homebrew Documentation](https://docs.brew.sh/Installation)
- [itamae-kitchen/mitamae](https://github.com/itamae-kitchen/mitamae)
- [Released: Docker Desktop for Mac [Apple Silicon]](https://www.docker.com/blog/released-docker-desktop-for-mac-apple-silicon/)
- [Docker Desktop for Apple silicon](https://docs.docker.com/desktop/mac/apple-silicon/)
- [mysql - dockerhub](https://hub.docker.com/_/mysql)
- [mysql/mysql-server - dockerhub](https://hub.docker.com/r/mysql/mysql-server)
- [Dockerの「マルチCPUアーキテクチャ」に対応したイメージをビルドする](https://dev.classmethod.jp/articles/docker-multi-architecture-image-build/)
- [Docker Buildx](https://docs.docker.com/buildx/working-with-buildx/)
- [google/ko](https://github.com/google/ko)
