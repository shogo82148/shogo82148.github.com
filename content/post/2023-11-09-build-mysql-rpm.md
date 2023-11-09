---
layout: post
title: "Amazon Linux 2023でMySQLをパッケージングする"
slug: 2023-11-09-build-mysql-rpm
date: 2023-11-09 21:00:00 +0900
comments: true
categories: [mysql, aws]
---

Amazon Linux 2023でMySQLをビルドして、RPMとしてパッケージングしたというお話です。

- [shogo82148/mysql-rpm-for-amazonlinux2023](https://github.com/shogo82148/mysql-rpm-for-amazonlinux2023)

## 背景

普段僕はAWS上での開発をメインにしているため、いろいろな場面でAmazon Linux 2023のお世話になります。
「サーバーレス」「NoSQL」なんて言葉を聞くようになって久しいですが、なんだかんだ言って踏み台サーバーのLinux環境からMySQLに接続することが多いです。

さて、そうなると問題になってくるのが「どうやってAmazon Linux 2023にMySQLをインストールするか」です。

MySQLのビルド済みのバイナリは[MySQL Community Downloads](https://dev.mysql.com/downloads/mysql/)でYUMレポジトリが提供されています。
しかし、2023-11-09現在提供されているのはOracle Linux 9, 8, 7, 6、Fedora 39, 38, 37 です。
Amazon Linux向けには提供されていません。

Amazon Linux 2 では[EPEL(Extra Packages for Enterprise Linux)](https://docs.fedoraproject.org/en-US/epel/)パッケージが提供されており、
MySQLはEPELがインストールできました。
しかしAmazon Linux 2023ではEPELのサポートはありません。

Amazon Linux 2023はFedoraベースであることが明言されていますが、
その一方で「特定のFedoraのリリースと互換性がある、というわけではない」とも説明されています。

- [Relationship to Fedora](https://docs.aws.amazon.com/ja_jp/linux/al2023/ug/relationship-to-fedora.html)

> The Generally Available (GA) version of AL2023 isn't directly comparable to any specific Fedora release. The AL2023 GA version includes components from Fedora 34, 35, and 36.

まとめるとこういうわけです。

- Oracleからの公式バイナリはない
- EPELも利用できない
- Fedora用のバイナリはあるが、FedoraとAmazon Linuxとの互換性はない

さて、どうやってインストールしましょう？

## MySQLをソースRPMからビルドする

MySQLのソースコードはすべて公開されています。
ならばソースコードからビルドすればいいだけの話ですね！！！！

### specファイルを落としてくる

RPMパッケージを作るには、インストールの手順をスクリプト化し、.specという拡張子のファイルにまとめる必要があります。
イチから作るのは大変なので、Oracle Linux 9 向けの .spec ファイルを流用します。

Oracle Linux 9はRHEL（Red Hat Enterprise Linux）とのバイナリー互換性があるそうです。
さらにRHELはFedoraの成果物を利用しています。
RHEL、Oracle Linux、Amazon LinuxはすべてFedoraをベースとしているので、同時期のリリースは互いに似ている部分が多いです。
実際にOracle Linux 9向けのRPMをAmazon Linux 2023にインストールして、MySQL Clientが動作したとの報告があります。

- [[小ネタ]Amazon Linux 2023にMySQL Clientをインストールする](https://dev.classmethod.jp/articles/install-mysql-client-to-amazon-linux-2023/)

そういうわけでOracle Linux 9向けの .spec ファイルから出発すれば、楽にビルドできると予想できます。
まずはdnfレポジトリをインストールしましょう。

EC2でテキトウにインスタンスを立ち上げ以下のコマンドを実行します。

```
sudo dnf install https://dev.mysql.com/get/mysql80-community-release-el9-5.noarch.rpm
```

以下のコマンドでspecファイルをダウンロードできます。

```
dnf download --source mysql-community-server
```

`~/rpmbuild/` 以下にパッケージに必要なファイルが保存されます。

### Amazon Linux 2023向けに修正する

そのままビルドするとMySQLサーバーのデーモン化に init.d を使おうとして、ビルドに失敗します。
Amazon Linux 2023は Systemd を利用するので、Systemd を有効化しましょう。

```diff
From 3e6425892117fad9a875a4f47717354cd17e9b81 Mon Sep 17 00:00:00 2001
From: ICHINOSE Shogo <shogo82148@gmail.com>
Date: Sat, 28 Oct 2023 08:44:21 +0900
Subject: [PATCH] Amazon Linux 2023 requires systemd

---
 rpmbuild/SPECS/mysql.spec | 1 +
 1 file changed, 1 insertion(+)

diff --git a/rpmbuild/SPECS/mysql.spec b/rpmbuild/SPECS/mysql.spec
index e379d07..42b9464 100644
--- a/rpmbuild/SPECS/mysql.spec
+++ b/rpmbuild/SPECS/mysql.spec
@@ -69,6 +69,7 @@
 %{?el7:                          %global systemd 1}
 %{?el8:                          %global systemd 1}
 %{?el9:                          %global systemd 1}
+%{?amzn2023:                     %global systemd 1}
 
 %if 0%{?rhel} >= 8
 %global add_fido_plugins 1
```

### ビルド

ビルドには `rpmbuild` コマンドを使用します。
標準では入っていないので、`dnf` コマンドでインストールしましょう。
ついでにビルドに必要な依存ライブラリもインストールします。

```
dnf install \
    openssl-devel ncurses-devel libtirpc-devel \
    rpcgen krb5-devel libudev-devel libcurl-devel \
    libtirpc-devel libfido2-devel \
    cyrus-sasl-devel libaio-devel numactl-devel openldap-devel \
    perl "perl(English)" "perl(JSON)" "perl(Memoize)" "perl(Sys::Hostname)" "perl(Time::HiRes)" "perl(Time::localtime)" \
    time \
    rpm-build cmake
```

`rpmbuild` コマンドにダウンロードしたspecファイルを渡せばビルドしてくれます。

```
cd ~/rpmbuild/SPECS
rpmbuild -ba mysql.spec
```

うまく行けば `~/rpmbuild/RPMS` 以下にビルド済のrpmができているはずです。
あとはS3に保存するなり、[自前でyumレポジトリを構築する](https://shogo82148.github.io/blog/2021/02/21/private-yum-repo-on-s3/)なりして、対象のインスタンスに配布しましょう。

ちなみにMySQLのビルドはそれなりにCPUを食います。
GitHub Actionsの無料枠（CPU2コア、メモリー7GB）では1時間から1時間半かかります。
16コアぐらいあるインスタンスを借りて短時間で済ませるのが楽だと思います。

## まとめ

Amazon Linux 2023でMySQLをビルドして、RPMとしてパッケージングしてみました。
Oracle Linux 9向けのspecファイルを使うと割と簡単でした。

-----

それはそうと、最近は `./configure` して `make` する記事も少なくなってきましたね。
まあ令和にもなってそんな記事書いても・・・という気もしますが、僕らが `dnf install` でインストールしている裏では、rpmファイルをビルドしてくれる誰かがいるわけです。
そういう人は相変わらず `./configure` して `make` しているわけで、パッケージングのテクニックが不要になったわけではありません。

なにが言いたいかというと、ソースコードからのビルド楽しいですよ。闇がいっぱいです。

## 参考

- [shogo82148/mysql-rpm-for-amazonlinux2023](https://github.com/shogo82148/mysql-rpm-for-amazonlinux2023)
- [[小ネタ]Amazon Linux 2023にMySQL Clientをインストールする](https://dev.classmethod.jp/articles/install-mysql-client-to-amazon-linux-2023/)
- [Build MySQL 8 from the source rpm in OL9](https://blogs.oracle.com/mysql/post/build-mysql-8-from-the-source-rpm-in-ol9)
- [Relationship to Fedora](https://docs.aws.amazon.com/ja_jp/linux/al2023/ug/relationship-to-fedora.html)
- [Amazon Linux 2023用追加パッケージを作ろう(立志編)](https://blog.serverworks.co.jp/create-package-for-al2023-01)
