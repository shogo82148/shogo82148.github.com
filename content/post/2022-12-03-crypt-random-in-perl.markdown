---
layout: post
title: "Perlで暗号論的乱数を生成する"
slug: 2022-12-01-crypt-random-in-perl
date: 2022-12-01 00:00:00 +0900
comments: true
categories: [ perl ]
---

この記事は、[Perl Advent Calendar 2022](https://qiita.com/advent-calendar/2022/perl) のn日目の記事です。

----

とつぜんPerlで暗号論的乱数を作りたくなったことはありませんか？
僕はあります。
というわけで実現方法を調べてみました。

## 背景

ことの発端はGitHub Actionsの`save-state`と`set-output`が非推奨になったことです。

- [GitHub Actions: Deprecating save-state and set-output commands](https://github.blog/changelog/2022-10-11-github-actions-deprecating-save-state-and-set-output-commands/)

[actions-setup-perl](https://github.com/marketplace/actions/setup-perl-environment)でこのコマンドを使っているので、この変更に対応する必要があります。
代わりの方法として`$GITHUB_STATE`, `$GITHUB_OUTPUT`環境変数が用意されました。
ここにファイルパスが指定されるので、指定されたファイルへ所定のフォーマットで書き出せ、とのことです。
この「所定のフォーマット」の要件のひとつに暗号論的乱数があり、Perlで暗号的乱数を生成することになったのです。

単なる乱数で良ければ組み込み関数に`rand`関数があります。
しかしこれはperldocにも書いてあるとおり、セキュリティが重要な場面では使うべきではありません。

- [rand - perldoc.jp](https://perldoc.jp/func/rand)

> rand は暗号学的に安全ではありません。 セキュリティ的に重要な状況でこれに頼るべきではありません。

残念なことに今回はセキュリティ的に重要な状況なのです。

## 暗号論的乱数を作る

あまり依存モジュールを増やしたくなかったので、OSの機能を直接呼び出す方針で考えました。

- `/dev/urandom` を使う
- Windows APIを呼び出す
- `syscall` を使う
- OpenSSLを使う

### `/dev/urandom` を使う

Linuxをちょっとかじった最初に思い浮かぶ方法でしょう。
Linuxには`/dev/urandom`という特殊ファイルが用意されており、このファイルを読むことで暗号論的乱数が手に入ります。

```perl
use v5.36;

my $n = 32;
my $buf;
open my $fh, '<', '/dev/urandom' or die "failed to open /dev/urandom: $!";
read $fh, $buf, $n or die "failed to read /dev/urandom: $!";
close $fh or die "failed to close /dev/urandom: $!";

say unpack 'H*', $buf;
```

利点は移植性の高さ。UNIX-Likeな環境ならたいてい`/dev/urandom`をサポートしているので、幅広いOSで使えます。
macOSでも利用可能です。

欠点はWindowsでは動かないということです。

### Windows APIを呼び出す

[Crypt::Random::Source::Strong::Win32](https://metacpan.org/pod/Crypt::Random::Source::Strong::Win32)を参考にして`CryptGenRandom` Windows APIを直接叩いてみます。
Windows 2000以前では動作しないらしいですが、さすがにもう使っているひとはいないよね？

```perl
use v5.36;
use Win32::API;

my $func = Win32::API->new('advapi32', <<EOF) or die "Could not import SystemFunction036: $^E";
INT SytemFunction036(
    PVOID RandomBuffer,
    ULONG RandomBufferLength
)
EOF

my $n = 32;
my $buf = "\0" x $n;
$func->Call($buf, $n) or die "RtlGenRand failed: $^E";
say unpack 'H*', $buf;
```

しかし困ったことに[actions-setup-perl](https://github.com/marketplace/actions/setup-perl-environment)でセットアップしたPerlには`Win32::API`が含まれておらず、
この環境では動作しません。

### `syscall` を使う

OSのAPIを呼び出す他の手法として`syscall`関数があります。

```perl
use v5.36;
use Config;

my $getrandom;
if ($Config{d_syscall}) {
    if (($Config{archname}) =~ /^aarch64-linux/) {
        $getrandom = 278;
    } elsif (($Config{archname}) =~ /^x86_64-linux/) {
        $getrandom = 318;
    } elsif (($Config{archname}) =~ /^i686-linux/) {
        $getrandom = 355;
    } elsif (($Config{archname}) =~ /^arm-linux/) {
        $getrandom = 384;
    } elsif (($Config{archname}) =~ /^mips64el-linux/) {
        $getrandom = 5313;
    } elsif ($Config{archname} =~ /^powerpc64le-linux/) {
        $getrandom = 359;
    } elsif ($Config{archname} =~ /^s390x-linux/) {
        $getrandom = 349;
    }
}

if (!$getrandom) {
    die "getrandom is not available";
}

my $n = 32;
my $buf = "\0" x $n;

$! = 0;
while(1) {
    if (syscall($getrandom, $buf, $n, 0) < $n) {
        if ($!{EINTR}) {
            next;
        }
        die $!;
    }
    last;
}
say unpack 'H*', $buf;
```

しかし肝心のWindowsは非対応です。

### OpenSSLを使う

ここまで調査したところでハッと気が付きました。
APIひとつ叩くのにもTLS通信による暗号化が必要で、イマドキのプログラミングにおいて暗号はほぼ必須機能です。
そこで[actions-setup-perl](https://github.com/marketplace/actions/setup-perl-environment)にはOpenSSLを同梱してあります。

暗号化において暗号論的乱数は欠かせない要素です。
きっとOpenSSLにも暗号論的乱数生成のAPIがあるはずだ、と探してみたらビンゴ！

```perl
use v5.36;

use Net::SSLeay;

my $n = 32;
my $buf;
if (Net::SSLeay::RAND_bytes($buf, $n) != 1) {
    my $rv = Net::SSLeay::ERR_get_error();
    die "failed to RAND_bytes: $rv";
}

say unpack 'H*', $buf;
```

この方法であればほぼすべてのプラットフォームをカバーできます。

## まとめ

Perlで暗号論的乱数を生成する方法を調査しました。
actions-setup-perlでは、プラットフォームのカバー率を考え、以下の優先順位で使えるものを使う実装にしました。

1. OpenSSLを使う
2. Windows APIを呼び出す
3. `syscall` を使う
4. `/dev/urandom` を使う

---

明日n+1日はfooで「bar」です。お楽しみに！

## 参考

- [GitHub Actions: Deprecating save-state and set-output commands](https://github.blog/changelog/2022-10-11-github-actions-deprecating-save-state-and-set-output-commands/)
- [Crypt::Random::Source::Strong::Win32](https://metacpan.org/pod/Crypt::Random::Source::Strong::Win32)
- [actions-setup-perl](https://github.com/marketplace/actions/setup-perl-environment)
- [rand - perldoc.jp](https://perldoc.jp/func/rand)
- [Net::SSLeay](https://metacpan.org/dist/Net-SSLeay/view/lib/Net/SSLeay.pod)
