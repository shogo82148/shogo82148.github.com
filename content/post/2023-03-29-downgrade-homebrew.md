---
layout: post
title: "Homebrewで過去のバージョンのMySQLクライアントをインストールしたい"
slug: 2023-03-29-downgrade-homebrew
date: 2023-03-29 17:45:00 +0900
comments: true
categories: [ homebrew, mysql ]
---

## 背景

Amazon Aurora（MySQL互換）のダンプを取ろうとしたところ、以下のメッセージが表示されてうまくいきませんでした。

```
% mysqldump hogehoge --skip-column-statistics --single-transaction --default-character-set=utf8mb4
mysqldump: Couldn't execute 'FLUSH TABLES WITH READ LOCK': Access denied for user 'root'@'%' (using password: YES) (1045)
```

AWS RDSとMySQL 8.0.32の組み合わせが悪いらしく、同じ症状の人がいました。

- [AWS RDSにmysqldump: Couldn't execute 'FLUSH TABLES WITH READ LOCK': Access denied for userが出て接続できなくなった](https://mattintosh.hatenablog.com/entry/20230207/1675759783)
- [mysqldump has incompatibile change in MySQL 8.0.32](https://bugs.mysql.com/bug.php?id=109685)

手元のmysqldumpのバージョンを確かめてみると、思いっきり影響を受けるバージョンですね。

```
mysqldump  Ver 8.0.32 for macos13.0 on x86_64 (Homebrew)
```

MySQL 8.0.33で修正される見込みのようですが、2023年3月29日現在未リリースです。
リリースサイクルをよく把握してないですが、[MySQL 8.0 Release Notes](https://dev.mysql.com/doc/relnotes/mysql/8.0/en/)を見る限り、
1, 4, 7, 10月のリリースのようですね。
4月まで待てば解決・・・なんですが、そこまで待っていられないので、MySQL 8.0.31へダウングレードすることにしました。

## 手順

[Homebrewで過去のバージョンを使いたい【tap版】 - Carpe Diem](https://christina04.hatenablog.com/entry/install-old-version-with-homebrew)を参考に古いバージョンのMySQLクライアントをインストールします。
Homebrewのバージョンは4.0.10-39-g222ef50です。

```
% brew --version
Homebrew 4.0.10-39-g222ef50
```

### tap用レポジトリを用意する

```
% brew tap-new shogo82148/taps
Initialized empty Git repository in /usr/local/Homebrew/Library/Taps/shogo82148/homebrew-taps/.git/
[main (root-commit) bb8fe39] Create shogo82148/taps tap
 3 files changed, 90 insertions(+)
 create mode 100644 .github/workflows/publish.yml
 create mode 100644 .github/workflows/tests.yml
 create mode 100644 README.md
==> Created shogo82148/taps
/usr/local/Homebrew/Library/Taps/shogo82148/homebrew-taps

When a pull request making changes to a formula (or formulae) becomes green
(all checks passed), then you can publish the built bottles.
To do so, label your PR as `pr-pull` and the workflow will be triggered.
```

### 古いformulaをtapに展開

古いバージョンのformulaを展開します。

[Homebrew 4.0.0リリース](https://rcmdnk.com/blog/2023/02/17/computer-homebrew/)に「現在タップしてあるhomebrew/core、homebrew/caskは不要になる」とあったのでアンタップしてしまいましたが、
古いバージョンのformula展開には必要みたいです。
僕のようにアンタップしてしまった場合には再度タップしておきましょう。

```
% brew tap homebrew/core
==> Tapping homebrew/core
Cloning into '/usr/local/Homebrew/Library/Taps/homebrew/homebrew-core'...
remote: Enumerating objects: 1446810, done.
remote: Counting objects: 100% (47/47), done.
remote: Compressing objects: 100% (30/30), done.
remote: Total 1446810 (delta 23), reused 36 (delta 17), pack-reused 1446763
Receiving objects: 100% (1446810/1446810), 560.71 MiB | 11.24 MiB/s, done.
Resolving deltas: 100% (1010448/1010448), done.
Updating files: 100% (6950/6950), done.
Tapped 2 commands and 6607 formulae (6,961 files, 616.1MB).
```

戻したいバージョンを指定し、formulaを展開します。

```
% brew extract mysql-client shogo82148/taps --version 8.0.31
==> Searching repository history
==> Writing formula for mysql-client from revision fbb7081 to:
/usr/local/Homebrew/Library/Taps/shogo82148/homebrew-taps/Formula/mysql-client@8.0.31.rb
```

### tapからインストール

展開したformulaを使ってMySQLクライアントをインストールします。
ご丁寧にソースコードからビルドしてくれるので、そこそこ時間がかかります。

```
% brew install mysql-client@8.0.31
==> Downloading https://formulae.brew.sh/api/formula.jws.json
#=#=#
==> Fetching shogo82148/taps/mysql-client@8.0.31
==> Downloading https://cdn.mysql.com/Downloads/MySQL-8.0/mysql-boost-8.0.31.tar.gz
Already downloaded: /Users/shogo.ichinose/Library/Caches/Homebrew/downloads/567f5fd3d4ba8ca595fac5749b8a929eebdc92eb957ba1878608ffc28bda567a--mysql-boost-8.0.31.tar.gz
==> Installing mysql-client@8.0.31 from shogo82148/taps
==> cmake . -DFORCE_INSOURCE_BUILD=1 -DCOMPILATION_COMMENT=Homebrew -DDEFAULT_CHARSET=utf8mb4 -DDEFAULT_COLLATION=utf8mb4_general_ci -DINSTALL_DOCDIR=share/doc/mysql-client@8.0.31 -DINSTALL_INCLUDEDIR=include/mysql -DINSTALL_INFODIR=share/info -DINSTALL_MANDIR=share/man -
==> make install
==> Caveats
mysql-client@8.0.31 is keg-only, which means it was not symlinked into /usr/local,
because it conflicts with mysql (which contains client libraries).

If you need to have mysql-client@8.0.31 first in your PATH, run:
  echo 'export PATH="/usr/local/opt/mysql-client@8.0.31/bin:$PATH"' >> ~/.zshrc

For compilers to find mysql-client@8.0.31 you may need to set:
  export LDFLAGS="-L/usr/local/opt/mysql-client@8.0.31/lib"
  export CPPFLAGS="-I/usr/local/opt/mysql-client@8.0.31/include"

For pkg-config to find mysql-client@8.0.31 you may need to set:
  export PKG_CONFIG_PATH="/usr/local/opt/mysql-client@8.0.31/lib/pkgconfig"
==> Summary
🍺  /usr/local/Cellar/mysql-client@8.0.31/8.0.31: 129 files, 148.6MB, built in 4 minutes 24 seconds
==> Running `brew cleanup mysql-client@8.0.31`...
Disable this behaviour by setting HOMEBREW_NO_INSTALL_CLEANUP.
Hide these hints with HOMEBREW_NO_ENV_HINTS (see `man brew`).
```

無事古いバージョンがインストールされました。めでたしめでたし。

```
% mysqldump --version
mysqldump  Ver 8.0.31 for macos13.3 on x86_64 (Homebrew)
```

## まとめ

以下のステップでインストールできます。

```
brew tap-new shogo82148/taps
brew extract mysql-client shogo82148/taps --version 8.0.31
brew install mysql-client@8.0.31
```

## 参考

- [AWS RDSにmysqldump: Couldn't execute 'FLUSH TABLES WITH READ LOCK': Access denied for userが出て接続できなくなった](https://mattintosh.hatenablog.com/entry/20230207/1675759783)
- [mysqldump has incompatibile change in MySQL 8.0.32](https://bugs.mysql.com/bug.php?id=109685)
- [MySQL 8.0 Release Notes](https://dev.mysql.com/doc/relnotes/mysql/8.0/en/)
- [Homebrew 4.0.0リリース](https://rcmdnk.com/blog/2023/02/17/computer-homebrew/)
- [Homebrewで過去のバージョンを使いたい【tap版】 - Carpe Diem](https://christina04.hatenablog.com/entry/install-old-version-with-homebrew)
