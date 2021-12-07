---
layout: post
title: "AWS ClockBound で遊んでみた"
slug: aws-cloud-bound
date: 2021-12-11 00:00:00 +0900
comments: true
categories: [aws, go, golang, time]
---

この記事は、[フラー株式会社 Advent Calendar 2021](https://qiita.com/advent-calendar/2021/fuller-inc) の11日目の記事です。
10日目は [@nobux42](https://qiita.com/nobux42) で「なんか書くか」でした。

もう一ヶ月前になりますが、AWS から [ClockBound](https://github.com/aws/clock-bound) という時間を扱うとても ~~地味な~~ 有益なソフトウェアがリリースされました。

- [Amazon Time Sync Service now makes it easier to generate and compare timestamps](https://aws.amazon.com/about-aws/whats-new/2021/11/amazon-time-sync-service-generate-compare-timestamps/)

~~地味過ぎてネタかぶりしなさそうなので~~
時間は現代の情報通信の基盤なので、しっかりと検証していきましょう！
日本ではNICTの [時空標準研究室](https://www2.nict.go.jp/sts/lab/index.html) が標準時を定めています。
名前からしてかっこいい。

## ClockBound とは

一言でいうとGoogleの [TrueTime](https://cloud.google.com/spanner/docs/true-time-external-consistency) のAWS版です。
TrueTime は Google が自社のサーバーセンターに設置している非常に正確な時計です。
Google が提供しているリレーショナルデータベースである [Cloud Spanner](https://cloud.google.com/spanner) は、
リージョンをまたいだ一貫性を保証するために TrueTime から生成されたタイムスタンプを利用しています。

ようするに ClockBound を使えば、 AWSのインフラ上に Google Cloud Spanner Clone を構築できる！(？)、というわけですね。
すごい！

## ClockBoundD のインストール

なんかすごそうなことがわかったので、とりあえず動かしてみましょう。

ClockBound はタイムスタンプを提供するデーモン「ClockBoundD」と、ClockBoundD からタイムスタンプを取得するためのライブラリ「ClockBoundC」に分かれています。
タイムスタンプの提供元がないと始まらないので、まずは ClockBoundD をインストールしていきましょう。

現時点(2021-12-11現在)ではビルド済みのバイナリは提供されていないようなので、ソースコードからビルドします。
READMEの手順にしたがってやっていきます。

- [ClockBoundD/README.md](https://github.com/aws/clock-bound/blob/18c15d3f86be01fc64c76b82dbfb782c0a4abe03/clock-bound-d/README.md)

今回は Amazon EC2 上のインスタンスで、 OSは Amazon Linux 2 を使ってやってみます。

### Chrony の動作確認

ClockBoundDを動かす前提条件として、[Chrony](https://chrony.tuxfamily.org/) が同じコンピュータで動いている必要があります。
Amazon Linux 2 にはデフォルトでインストールされているので、同期状態を確認してみましょう。

```
$ chronyc sources
MS Name/IP address         Stratum Poll Reach LastRx Last sample
===============================================================================
^* 169.254.169.123               3   4   377     3  -1145ns[-3152ns] +/-  420us
^- 103.202.216.35                3   6   377     4  +3283us[+3281us] +/-  132ms
^- ipv4.ntp2.rbauman.com         2   6   377    13   -631us[ -633us] +/- 3130us
^- i172-105-204-167.poolntp>     3   6   377    11   +118us[ +116us] +/- 3201us
^- time.cloudflare.com           3   6   377    10    +10ms[  +10ms] +/-   84ms
```

`169.254.169.123` と同期しているようです。このIPアドレスは [Amazon Time Sync Service](https://aws.amazon.com/jp/blogs/news/keeping-time-with-amazon-time-sync-service/) のものですね。
Chrony が立ち上がっており時刻同期も取れているので良さそうです。

### Rust, Cargo のインストール

ClockBoundD は Rust で書かれています。
コンパイルするために Rust のコンパイラと、 Rust のパッケージマネージャーである Cargo をインストールします。
The Cargo Book を参照しながらインストールコマンドを実行します。

- [Install Rust and Cargo - The Cargo Book](https://doc.rust-lang.org/cargo/getting-started/installation.html)

また、ビルドに gcc も必要らしいので併せてインストールしておきます。

```console
curl https://sh.rustup.rs -sSf | sh
sudo yum install gcc
```

### ClockBoundD のビルド

Cargo を使って依存関係の解決とビルドを行います。

```console
cargo install clock-bound-d
```

### ClockBoundD サービスの追加

ClockBoundD はデーモンとして稼働するので、 systemd の管理下に置きましょう。

```console
# バイナリをインストール
sudo mv $HOME/.cargo/bin/clockboundd /usr/local/bin/clockboundd

# デーモン起動用のユーザー追加
sudo useradd -r clockbound
```

`/usr/lib/systemd/system/clockboundd.service` という名前でユニットファイルを作成し、
以下の設定を書き込みます。

```
[Unit]
Description=ClockBoundD

[Service]
Type=simple
Restart=always
RestartSec=10
ExecStart=/usr/local/bin/clockboundd
RuntimeDirectory=clockboundd
WorkingDirectory=/run/clockboundd
User=clockbound

[Install]
WantedBy=multi-user.target
```

### ClockBoundD サービスの起動

ユニットファイルを systemd に読み込ませ、サービスを有効化します。

```console
sudo systemctl daemon-reload
sudo systemctl enable clockboundd
sudo systemctl start clockboundd
```

正常に起動したかステータスを確認してみましょう。

```
$ systemctl status clockboundd
● clockboundd.service - ClockBoundD
   Loaded: loaded (/usr/lib/systemd/system/clockboundd.service; enabled; vendor preset: disabled)
   Active: active (running) since 日 2021-11-14 08:04:33 UTC; 22s ago
 Main PID: 3922 (clockboundd)
   CGroup: /system.slice/clockboundd.service
           └─3922 /usr/local/bin/clockboundd

11月 14 08:04:33 ip-10-0-2-225.ap-northeast-1.compute.internal systemd[1]: Started ClockBoundD.
11月 14 08:04:33 ip-10-0-2-225.ap-northeast-1.compute.internal clockboundd[3922]: Initialized ClockBoundD
11月 14 08:04:33 ip-10-0-2-225.ap-northeast-1.compute.internal clockboundd[3922]: Local unix socket at path clockboundd.sock does not exist, skipping remove
11月 14 08:04:33 ip-10-0-2-225.ap-northeast-1.compute.internal clockboundd[3922]: Created unix socket at path clockboundd.sock
11月 14 08:04:33 ip-10-0-2-225.ap-northeast-1.compute.internal clockboundd[3922]: Connected to local unix socket at path clockboundd.sock
11月 14 08:04:33 ip-10-0-2-225.ap-northeast-1.compute.internal clockboundd[3922]: Initialized Chrony Poller thread
```

良さそうですね。

## 付属の Example で遊んで見る

デーモンの準備が整ったので、クライアントを試してみましょう。
ClockBoundC はライブラリなので実際に使用するにはアプリケーションに組み込む必要がありますが、
付属の Example で試すだけならすぐに出来ます。

ClockBoundC から ClockBoundD に送信できるコマンドには Now, Before, After の3つがあります。
それぞれ試してみましょう。

### Now

Now は現在時刻を取得するためのコマンドです。

```
$ cargo run --example now /run/clockboundd/clockboundd.sock
    Finished dev [unoptimized + debuginfo] target(s) in 0.01s
     Running `target/debug/examples/now /run/clockboundd/clockboundd.sock`
The UTC timestamp 2021-11-14 12:23:43.089578323 has the following error bounds.
In nanoseconds since the Unix epoch: (1636892623089459280,1636892623089697366)
In UTC in date/time format: (2021-11-14 12:23:43.089459280, 2021-11-14 12:23:43.089697366)
```

大抵のプログラミング言語には現在時刻の取得関数がありますが、 Now がそれらと違うのは error bounds を同時に取得できる点です。

例えば上の例では `2021-11-14 12:23:43.089578323` という時刻を得られましたが、
実際の時刻は `2021-11-14 12:23:43.089578323` ちょうどなわけではありません。
コンピューターに内蔵されている時計が刻む時刻は、様々な要因で実際の時刻との間に差があります。
Chrony はこの差をなるべく補正しようとしますが、完全に0にすることはできません。

誤差を完全に0にすることは不可能ですが、NTPプロトコルの通信結果から誤差の上限を見積もることなら可能です。
上の実行結果では 「`2021-11-14 12:23:43.089459280` から `2021-11-14 12:23:43.089697366` の間に本当の時刻があるはず」
ということを意味しています。
ClockBound の Bound は、現在時刻をある程度の「範囲」をもって計算するという意味なのです。

### Before

Before は「あるタイムスタンプが現在時刻より前のものか」を判定するコマンドです。

```
$ cargo run --example before /run/clockboundd/clockboundd.sock
    Finished dev [unoptimized + debuginfo] target(s) in 0.01s
     Running `target/debug/examples/before /run/clockboundd/clockboundd.sock`
1636892655198601329 nanoseconds since the Unix Epoch is not before the current time's error bounds.
Waiting 1 second...
1636892655198601329 nanoseconds since the Unix Epoch is before the current time's error bounds.
```

この出力だけだと `1636892655198601329` という数字が何を意味しているのかよくわからないので、
[ソースコードのコメント](https://github.com/aws/clock-bound/blob/18c15d3f86be01fc64c76b82dbfb782c0a4abe03/clock-bound-c/examples/before.rs) とあわせて見ると良いと思います。
大雑把にこんなデモを実行しています。

1. Rust の時間関数を使って現在時刻を取得。 `timestamp` 変数に代入
2. `timestamp` を ClockBoundD の Before コマンドを使って判定
3. 1秒待つ
4. `timestamp` を ClockBoundD の Before コマンドを使って判定

注目すべきは 2 のステップで `timestamp is not before now` と判定されている点ですね。
ステップ1 → ステップ2 の順番で実行しているので、普通に考えれば ステップ2 の段階では 「`timestamp` は現在時刻より前」
`timestamp is before now` になるはずです。

これは ステップ1 → ステップ2 の実行速度が早すぎるために `timestamp` が "error bounds" の中に入ってしまうからです。
この状態では 「`timestamp` は現在時刻より**確実に**前」とは言い切ることができないので、
`timestamp is not before now` という判定になります。

Now の実行結果をみると分かるんですが、
ClockBoundD が正常稼働していれば "error bounds" の幅は200マイクロ秒前後に収まります。
そのためステップ4の時点では `timestamp` はほぼ確実に "error bounds" の外にでます。
この状態であれば「`timestamp` は現在時刻より**確実に**前」と言い切ることができます。

### After

After は「あるタイムスタンプが現在時刻より後のものか」を判定するコマンドです。

```
$ cargo run --example after /run/clockboundd/clockboundd.sock
    Finished dev [unoptimized + debuginfo] target(s) in 0.01s
     Running `target/debug/examples/after /run/clockboundd/clockboundd.sock`
1636892672641514016 nanoseconds since the Unix Epoch is after the current time's error bounds.
Waiting 2 seconds...
1636892672641514016 nanoseconds since the Unix Epoch is not after the current time's error bounds.
```

こちらも[ソースコードのコメント](https://github.com/aws/clock-bound/blob/18c15d3f86be01fc64c76b82dbfb782c0a4abe03/clock-bound-c/examples/after.rs)とあわせて見ると理解しやすいと思います。

1. Rust の時間関数を使って現在時刻を取得。 現在時刻+1秒を `timestamp` 変数に代入
2. `timestamp` を ClockBoundD の After コマンドを使って判定
3. 2秒待つ
4. `timestamp` を ClockBoundD の After コマンドを使って判定

## Go版クライアントを作ってみた

これだけだと少しさみしいかなと思って、ClockBoundC の Go ポートを作ってみました。

- [shogo82148/go-clockboundc](https://github.com/shogo82148/go-clockboundc)

サンプルとして Now コマンドを発行する `go-clockboundc-now` コマンドを作っておきました。
以下のようにして ClockBoundD から時刻情報を取得することができます。

```
$ go install github.com/shogo82148/go-clockboundc/cmd/go-clockboundc-now
$ go-clockboundc-now
2021/11/27 10:43:52 Synchronized
2021/11/27 10:43:52 Current:  2021-11-27 10:43:52.95958806 +0000 UTC
2021/11/27 10:43:52 Earliest: 2021-11-27 10:43:52.959488228 +0000 UTC
2021/11/27 10:43:52 Latest:   2021-11-27 10:43:52.959687892 +0000 UTC
2021/11/27 10:43:52 Range:    199.664µs
```

プロトコル自体は非常に簡単なので、他の言語でも容易に実装できると思います。

## まとめ

Googleの [TrueTime](https://cloud.google.com/spanner/docs/true-time-external-consistency) のAWS版とも言える
ClockBound を試してみました。

実際のところ ClockBound 単体ではあまり役に立ちません。
この記事を読んで興味を持った方は ClockBound の応用にチャレンジしてみてはいかがでしょうか？

----

明日12日は [@seto_inugami](https://qiita.com/seto_inugami)で「なんか書くよ」です。お楽しみに！

## 参考

- [フラー株式会社 Advent Calendar 2021](https://qiita.com/advent-calendar/2021/fuller-inc)
- [Amazon Time Sync Service now makes it easier to generate and compare timestamps](https://aws.amazon.com/about-aws/whats-new/2021/11/amazon-time-sync-service-generate-compare-timestamps/)
- [aws/clock-bound](https://github.com/aws/clock-bound)
- [Cloud Spanner: TrueTime and external consistency](https://cloud.google.com/spanner/docs/true-time-external-consistency)
- [Manage Amazon EC2 instance clock accuracy using Amazon Time Sync Service and Amazon CloudWatch – Part 1](https://aws.amazon.com/blogs/mt/manage-amazon-ec2-instance-clock-accuracy-using-amazon-time-sync-service-and-amazon-cloudwatch-part-1/)
- [Manage Amazon EC2 instance clock accuracy using Amazon Time Sync Service and Amazon CloudWatch – Part 2](https://aws.amazon.com/blogs/mt/manage-amazon-ec2-instance-clock-accuracy-using-amazon-time-sync-service-and-amazon-cloudwatch-part-2/)
- [ClockBound Protocol Version 1](https://github.com/aws/clock-bound/blob/18c15d3f86be01fc64c76b82dbfb782c0a4abe03/PROTOCOL.md)
- [shogo82148/go-clockboundc](https://github.com/shogo82148/go-clockboundc)
