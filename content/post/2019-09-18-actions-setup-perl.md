---
layout: post
title: "Setup Perl GitHub Action を公開しました"
slug: actions-setup-perl
date: 2019-08-21 19:53:00 +0900
comments: true
categories: [perl, github]
---

GitHub Actions の公式レポジトリには Perl のセットアップアクションが無いぞ！
ということで三連休+αで書きました。

- [actions-setup-perl on GitHub Marketplace](https://github.com/marketplace/actions/setup-perl-environment)

## 使い方

Marketplaceの設定例は間違えているので以下を参照。(これ書いていて気がついた)
必要な Perl のバージョンを渡すだけです。簡単！

```yaml
steps:
- uses: actions/checkout@master
- uses: shogo82148/actions-setup-perl@v1
  with:
    perl-version: '5.30'
- run: cpanm --installdeps .
- run: prove -lv t
```

Ubuntu, macOS, Windows 各種OSにも対応しています。

```yaml
jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: ['ubuntu-18.04', 'macOS-10.14', 'windows-2019']
        perl: [ '5.30', '5.28' ]
    name: Perl ${{ matrix.perl }} on ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v1
      - name: Setup perl
        uses: shogo82148/actions-setup-perl@v1
        with:
          perl-version: ${{ matrix.perl }}
      - run: perl -V
      - run: cpanm --installdeps .
      - run: prove -lv t
```

動作サンプル

- https://github.com/shogo82148/p5-Acme-OkMacopy/blob/master/.github/workflows/test.yml
- https://github.com/shogo82148/p5-Acme-OkMacopy/commit/15bf2162a26a1ea8bfe748ddc980164f049a1c67/checks

ok macopy をこんな形で使うことになろうとは、あの当時は思っていなかった・・・

## 裏方の話

### Actionでインストールされるperlについて

GitHub Actions の Runner にはキャッシュ領域が用意されていて、こういうバイナリはそこに入れるのがお作法のようです。
perlは付属するCPANモジュールのパスがバイナリに組み込まれているので、パスを変更したい場合は再ビルドが必要です。

そういうわけで、perl 5.8.5 から perl 5.30.0 までの全てのバージョンを再ビルドしました。
**もちろん GitHub Actions で！**

![ビルド中の様子](/images/2019-09-18-actions-setup-perl.png)

調子に乗ってパッチレベルも全部そろえたので、perl46バージョン × OS 3platform + テスト2種 × OS 5platform = 158ジョブです。
(↑のスクショは perl 5.8.0 から perl 5.30.0 ビルド時のもの。後述するようにちょっとサポートバージョンを減らしたので、最終的なジョブ数は111です)

ビルドしたバイナリはS3にあげています。
なぜかmacOSにはawscliが入っていなかったので、[S3からファイルを落とすだけのツールを作った](https://shogo82148.github.io/blog/2018/06/20/s3cli-mini/) で作成した
[s3cli-mini](https://github.com/shogo82148/s3cli-mini) を使っています。
まさかこんな形で再び使うことになるとは。

### perlのバージョン

CIに使うんだから、[cpanm](https://metacpan.org/pod/distribution/App-cpanminus/bin/cpanm) と [Carton](https://metacpan.org/pod/Carton) くらい入れておくか、
というわけでsetup直後から `cpanm` コマンドと `Carton` コマンドが使えます。
Cartonのサポートが perl 5.8.5 からだったので、UbuntuとmacOSは perl 5.8.5 からのサポートです。

Windowsに関しては、 perl 5.24.0 からのサポートです。
GitHub Actions で提供されている Windows には [Strawberry Perl](http://strawberryperl.com/) がプリインストールされています。
そして、Strawberry Perlにはなんとgccがバンドルされているので(最近Windows触ってないので初めて知った)
これを使ったら Perl のビルド自体は割と簡単にできました。
で、調子にのって過去のバージョンも試してみた(上のスクショ参照)のですが、 5.22.x 以前のバージョンでは GNU make が動きません。

```
Makefile:222: *** missing separator. Stop.
```

Visual Studio に付属する Microsoft NMAKE との互換性の問題です。
GNU make はコマンド行の先頭がタブでなければならないんですが、nmakeはなんだかよくわからないけど、いい感じにやってくれます。
GitHub Actions には [Visual Studio 2017 Enterprise](https://help.github.com/en/articles/software-in-virtual-environments-for-github-actions#visual-studio-2017-enterprise)がプリインストールされているらしいので、
探せば見つかる(？)気はするんですが、ちょっと力尽きました。
Windows詳しい人ヘルプ！

### GitHub Actions 所感

これだけのマシンリソースを無料で使わせてもらえるなんていい時代になりました。
しかも Visual Studio 2017 Enterprise も入っているとは・・・。

ただ、ビルド環境の安定性という面では不安が残ります。
ジョブ数が少ないときはまあまあ安定してるんですが、「158ジョブ投入だ！」とか遊んでいるとなかなかジョブが始まりません。
まあ無料で使わせてもらっているので、多少キューが詰まるのは仕方ないかなと思うんですが、
ジョブの初期化中に[エラーを吐いて死んでしまいました](https://github.com/shogo82148/actions-setup-perl/runs/225107741)

```
Current runner version: '2.157.5'
Prepare workflow directory
Prepare all required actions
Download action repository 'actions/checkout@v1'
##[warning]Failed to download action 'https://api.github.com/repos/actions/checkout/tarball/v1'. Error Response status code does not indicate success: 401 (Unauthorized).
##[warning]Back off 14.374 seconds before retry.
##[warning]Failed to download action 'https://api.github.com/repos/actions/checkout/tarball/v1'. Error Response status code does not indicate success: 401 (Unauthorized).
##[warning]Back off 23.811 seconds before retry.
##[error]Response status code does not indicate success: 401 (Unauthorized).
```

もうちょっと粘って欲しい・・・。
結局158ジョブは走り切ることはありませんでした。

なんだかよくわからない対処療法として、ワークフローを分けると多少は改善する(？)みたいです。
158ジョブのときは同じワークフローにジョブを複数かいていましたが、
ubuntu, macOS, windows の3つのワークフローに分けたらうまくいきました。
それでも何回かリビルドを走らせたんですけどね。

## まとめ

GitHub Actions で Perl のビルドが簡単にできるようになりました。

- [actions-setup-perl on GitHub Marketplace](https://github.com/marketplace/actions/setup-perl-environment)

たぶん便利なので、ぜひ使ってみてください。
