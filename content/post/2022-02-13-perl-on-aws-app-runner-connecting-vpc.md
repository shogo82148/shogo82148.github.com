---
layout: post
title: "AWS App Runner に Perl をデプロイして RDS につなげてみた"
slug: 2022-02-13-perl-on-aws-app-runner-connecting-vpc
date: 2022-02-13 08:08:00 +0900
comments: true
categories: [perl, aws]
---

[AWS App Runner](https://aws.amazon.com/jp/apprunner/) に！VPC との接続機能がやってきました！！

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">📣『VPC 内の RDBMS 使いたいから App Runner じゃなく ECS/Fargate 使ってますわ〜』という皆さまお待たせしました！！<br><br>本日から既存の App Runner サービスを含め、直接 VPC 内リソースにアクセスできるようになります！🎉🎉🎉<a href="https://t.co/SGDTD1kPCb">https://t.co/SGDTD1kPCb</a> 1/4 <a href="https://t.co/tbVt47ORSI">pic.twitter.com/tbVt47ORSI</a></p>&mdash; Tori Hara (@toricls) <a href="https://twitter.com/toricls/status/1491202012209623040?ref_src=twsrc%5Etfw">February 9, 2022</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

[Amazon RDS](https://aws.amazon.com/jp/rds/)や[Amazon ElastiCache](https://aws.amazon.com/jp/elasticache/)のような一部のサービスは
VPCからの利用を前提としています。
VPCを利用することによりセキュリティーを担保しているのですが、
[AWS App Runner](https://aws.amazon.com/jp/apprunner/) のようなマネージドサービスと連携が難しいという欠点がありました。

しかし、今回の VPC connector サポートにより簡単に連携ができるようになりました。
というわけで、お試しで MySQL (on Amazon RDS) との連携を試してみました。

使う言語はもちろん**Perl**！

作るのはやっぱり**アクセスカウンター**！!

## アクセスカウンターを用意する

MySQL を使ったアクセスカウンターを知らないのでテキトーに作ります。
ファイルを直接操作するよりはずっと簡単ですね。
[AWS App Runner に Perl をデプロイしてみた](https://shogo82148.github.io/blog/2021/06/06/perl-on-aws-app-runner/) のときと同様、
ソースコードは [shogo82148/perl-on-aws-app-runner](https://github.com/shogo82148/perl-on-aws-app-runner) に置いてあります。

こんな感じになりました。

```perl
# app.psgi
use DBI;
use 5.34.0;
use feature qw(try);
no warnings "experimental::try";

my $database = $ENV{MYSQL_DATABASE};
my $host = $ENV{MYSQL_HOST};
my $port = $ENV{MYSQL_PORT};
my $user = $ENV{MYSQL_USER};
my $password = $ENV{MYSQL_PASSWORD};

# initialize the database
try {
    my $dbh = DBI->connect(
        "DBI:mysql:;host=$host;port=$port",
        $user, $password,
        {'RaiseError' => 1});
    $dbh->do("CREATE DATABASE IF NOT EXISTS `$database`");
    $dbh->do("CREATE TABLE IF NOT EXISTS `$database`.`access_count` (`id` INT PRIMARY KEY, `number` BIGINT)");
    $dbh->disconnect();
} catch ($e) {
    say STDERR $e;
}

my $app = sub {
    my $dbh = DBI->connect(
        "DBI:mysql:database=$database;host=$host;port=$port",
        $user, $password,
        {'RaiseError' => 1});

    # begin a transaction
    $dbh->{AutoCommit} = 0;

    # fetch the access count
    my $sth = $dbh->prepare("SELECT * FROM `access_count` WHERE `id` = 1 FOR UPDATE");
    $sth->execute();
    my $row = $sth->fetchrow_hashref();

    my $number = 0;
    if ($row) {
        # increment
        $number = $row->{number};
        $number++;
        $dbh->do("UPDATE `access_count` SET `number` = ?", undef, $number);
    } else {
        # create a new row
        $number++;
        $dbh->do("INSERT INTO `access_count` (`id`, `number`) VALUES (?, ?)", undef, 1, $number);
    }

    # commit
    $dbh->{AutoCommit} = 1;
    $dbh->disconnect();
    return [200, ['Content-Type' => 'text/plain'], ["$number\n"]];
};
```

## Dockerfile を用意する

PSGI アプリを起動するのに [Plack](https://metacpan.org/pod/Plack)、MySQL へ接続するのに [DBD::mysql](https://metacpan.org/pod/DBD::mysql) を利用するので、
cpanfile にこれらのパッケージへの依存を書いておきます。

```perl
# cpanfile
requires 'Plack';
requires 'DBD::mysql';
```

Perl の公式イメージをベースに依存モジュールをインストールして[plackup](https://metacpan.org/pod/distribution/Plack/script/plackup)するだけの
簡単な Dockerfile を書きます。

```dockerfile
# Dockerfile
FROM perl:5.34.0

WORKDIR /usr/src/myapp
COPY cpanfile .
RUN cpanm --notest --installdeps .
COPY app.psgi .

CMD [ "plackup", "app.psgi" ]
```

## 手元で動作確認

さて、一応ちゃんと動作するか手元で確認しておきましょう。
今回のアプリは単体では動作せず MySQL が必要です。全部まとめて起動してくれる docker compose の設定を用意しました。

```yaml
version: "3.8"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "5000:5000"
    environment:
      - MYSQL_USER=root
      - MYSQL_PASSWORD=hello-perl
      - MYSQL_DATABASE=hello-perl
      - MYSQL_HOST=db
      - MYSQL_PORT=3306
  db:
    image: mysql:8.0
    ports:
      - "3306:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=hello-perl
    healthcheck:
      test: "mysqladmin ping"
      interval: 30s
      start_period: 30s
      retries: 3
```

`docker-compose up` で起動します。

```console
$ docker-compose up
[+] Running 3/2
 ⠿ Network rds_default  Created 0.0s
 ⠿ Container rds-db-1   Created 0.1s
 ⠿ Container rds-app-1  Created 0.1s
Attaching to rds-app-1, rds-db-1
rds-db-1   | 2022-02-13 04:10:08+00:00 [Note] [Entrypoint]: Entrypoint script for MySQL Server 8.0.27-1debian10 started.
rds-db-1   | 2022-02-13 04:10:08+00:00 [Note] [Entrypoint]: Switching to dedicated user 'mysql'
rds-db-1   | 2022-02-13 04:10:08+00:00 [Note] [Entrypoint]: Entrypoint script for MySQL Server 8.0.27-1debian10 started.
rds-db-1   | 2022-02-13 04:10:08+00:00 [Note] [Entrypoint]: Initializing database files
rds-db-1   | 2022-02-13T04:10:08.843268Z 0 [System] [MY-013169] [Server] /usr/sbin/mysqld (mysqld 8.0.27) initializing of server in progress as process 43
rds-db-1   | 2022-02-13T04:10:08.851799Z 1 [System] [MY-013576] [InnoDB] InnoDB initialization has started.
rds-db-1   | 2022-02-13T04:10:09.281619Z 1 [System] [MY-013577] [InnoDB] InnoDB initialization has ended.
rds-db-1   | 2022-02-13T04:10:10.378466Z 0 [Warning] [MY-013746] [Server] A deprecated TLS version TLSv1 is enabled for channel mysql_main
rds-db-1   | 2022-02-13T04:10:10.378525Z 0 [Warning] [MY-013746] [Server] A deprecated TLS version TLSv1.1 is enabled for channel mysql_main
rds-db-1   | 2022-02-13T04:10:10.418179Z 6 [Warning] [MY-010453] [Server] root@localhost is created with an empty password ! Please consider switching off the --initialize-insecure option.
rds-db-1   | 2022-02-13 04:10:13+00:00 [Note] [Entrypoint]: Database files initialized
rds-db-1   | 2022-02-13 04:10:13+00:00 [Note] [Entrypoint]: Starting temporary server
rds-db-1   | 2022-02-13T04:10:14.018163Z 0 [System] [MY-010116] [Server] /usr/sbin/mysqld (mysqld 8.0.27) starting as process 92
rds-db-1   | 2022-02-13T04:10:14.038481Z 1 [System] [MY-013576] [InnoDB] InnoDB initialization has started.
rds-db-1   | 2022-02-13T04:10:14.197654Z 1 [System] [MY-013577] [InnoDB] InnoDB initialization has ended.
rds-db-1   | 2022-02-13T04:10:14.507648Z 0 [Warning] [MY-013746] [Server] A deprecated TLS version TLSv1 is enabled for channel mysql_main
rds-db-1   | 2022-02-13T04:10:14.507763Z 0 [Warning] [MY-013746] [Server] A deprecated TLS version TLSv1.1 is enabled for channel mysql_main
rds-db-1   | 2022-02-13T04:10:14.509226Z 0 [Warning] [MY-010068] [Server] CA certificate ca.pem is self signed.
rds-db-1   | 2022-02-13T04:10:14.509350Z 0 [System] [MY-013602] [Server] Channel mysql_main configured to support TLS. Encrypted connections are now supported for this channel.
rds-db-1   | 2022-02-13T04:10:14.513320Z 0 [Warning] [MY-011810] [Server] Insecure configuration for --pid-file: Location '/var/run/mysqld' in the path is accessible to all OS users. Consider choosing a different directory.
rds-db-1   | 2022-02-13T04:10:14.558724Z 0 [System] [MY-011323] [Server] X Plugin ready for connections. Socket: /var/run/mysqld/mysqlx.sock
rds-db-1   | 2022-02-13T04:10:14.559169Z 0 [System] [MY-010931] [Server] /usr/sbin/mysqld: ready for connections. Version: '8.0.27'  socket: '/var/run/mysqld/mysqld.sock'  port: 0  MySQL Community Server - GPL.
rds-db-1   | 2022-02-13 04:10:14+00:00 [Note] [Entrypoint]: Temporary server started.
rds-db-1   | Warning: Unable to load '/usr/share/zoneinfo/iso3166.tab' as time zone. Skipping it.
rds-db-1   | Warning: Unable to load '/usr/share/zoneinfo/leap-seconds.list' as time zone. Skipping it.
rds-db-1   | Warning: Unable to load '/usr/share/zoneinfo/zone.tab' as time zone. Skipping it.
rds-db-1   | Warning: Unable to load '/usr/share/zoneinfo/zone1970.tab' as time zone. Skipping it.
rds-db-1   | 
rds-db-1   | 2022-02-13 04:10:17+00:00 [Note] [Entrypoint]: Stopping temporary server
rds-db-1   | 2022-02-13T04:10:17.875669Z 10 [System] [MY-013172] [Server] Received SHUTDOWN from user root. Shutting down mysqld (Version: 8.0.27).
rds-db-1   | 2022-02-13T04:10:19.165492Z 0 [System] [MY-010910] [Server] /usr/sbin/mysqld: Shutdown complete (mysqld 8.0.27)  MySQL Community Server - GPL.
rds-db-1   | 2022-02-13 04:10:19+00:00 [Note] [Entrypoint]: Temporary server stopped
rds-db-1   | 
rds-db-1   | 2022-02-13 04:10:19+00:00 [Note] [Entrypoint]: MySQL init process done. Ready for start up.
rds-db-1   | 
rds-db-1   | 2022-02-13T04:10:20.142809Z 0 [System] [MY-010116] [Server] /usr/sbin/mysqld (mysqld 8.0.27) starting as process 1
rds-db-1   | 2022-02-13T04:10:20.157983Z 1 [System] [MY-013576] [InnoDB] InnoDB initialization has started.
rds-db-1   | 2022-02-13T04:10:20.315130Z 1 [System] [MY-013577] [InnoDB] InnoDB initialization has ended.
rds-db-1   | 2022-02-13T04:10:20.566846Z 0 [Warning] [MY-013746] [Server] A deprecated TLS version TLSv1 is enabled for channel mysql_main
rds-db-1   | 2022-02-13T04:10:20.567039Z 0 [Warning] [MY-013746] [Server] A deprecated TLS version TLSv1.1 is enabled for channel mysql_main
rds-db-1   | 2022-02-13T04:10:20.567886Z 0 [Warning] [MY-010068] [Server] CA certificate ca.pem is self signed.
rds-db-1   | 2022-02-13T04:10:20.568117Z 0 [System] [MY-013602] [Server] Channel mysql_main configured to support TLS. Encrypted connections are now supported for this channel.
rds-db-1   | 2022-02-13T04:10:20.576602Z 0 [Warning] [MY-011810] [Server] Insecure configuration for --pid-file: Location '/var/run/mysqld' in the path is accessible to all OS users. Consider choosing a different directory.
rds-db-1   | 2022-02-13T04:10:20.619418Z 0 [System] [MY-011323] [Server] X Plugin ready for connections. Bind-address: '::' port: 33060, socket: /var/run/mysqld/mysqlx.sock
rds-db-1   | 2022-02-13T04:10:20.619469Z 0 [System] [MY-010931] [Server] /usr/sbin/mysqld: ready for connections. Version: '8.0.27'  socket: '/var/run/mysqld/mysqld.sock'  port: 3306  MySQL Community Server - GPL.
rds-app-1  | HTTP::Server::PSGI: Accepting connections at http://0:5000/
```

"http://localhost:5000" にアクセスすると "1" と表示され、アクセスするごとにカウントが増えていきます。

```console
$ curl http://localhost:5000
1
$ curl http://localhost:5000
2
$ curl http://localhost:5000
3
```

## ECR に Push する

[マネージメントコンソールで Amazon ECR を開いて](https://console.aws.amazon.com/ecr/home) 新規レポジトリを作成、イメージをプッシュします。
レポジトリを作成するとプッシュの手順が表示されるので、それにしたがいましょう。

```console
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.ap-northeast-1.amazonaws.com
$ docker build -t perl-test .
docker tag perl-test:latest 123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/perl-test:latest
docker push 123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/perl-test:latest
```

## Amazon RDS Aurora MySQL 互換クラスターを作成する

[マネージメントコンソールで Amazon RDS を開いて](https://console.aws.amazon.com/rds/home) 新規クラスターを作成します。
いつの間にかパスワードの自動生成ができるようになってますね？ 🤔
後で使うので大事にメモっておきましょう。

## AWS App Runner でサービスを作成する

[マネージメントコンソールで AWS App Runner を開いて](https://console.aws.amazon.com/apprunner/home) 新しいサービスを作成します。
特に Container image URI に先程作成したイメージを指定するのと、ポート番号に 5000 番を指定するのを忘れずに。

Networking は Public access と Custom VPC が選べます。
今回は VPC 接続の検証が目的なので、 Custom VPC を選択しましょう。
VPC connector を作成するさいにサブネットとセキュリティーグループを指定する必要があるので、
RDSに接続可能な設定を入力します。
セキュリティーグループにはVPCのデフォルトセキュリティーグループを使用すれば十分だと思います。

- Source
  - **Repository type**: Container registry
  - **Provider**: Amazon ECR
  - **Container image URI**: `123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/perl-test:latest`
- Deployment settings
  - **Deployment trigger**: Automatic
  - **ECR access role**: Create new service role (or "Use existing service role" if you have already created it)
- Service settings:
    - **Service name**: perl-basic-test
    - **Virtual CPU & memory**: 1vCPU & 2GB
    - **Environment variables**
        - `MYSQL_USER`: `admin`
        - `MYSQL_PASSWORD`: メモっておいたパスワード
        - `MYSQL_DATABASE`: `hello-perl`
        - `MYSQL_HOST`: `database-1.cluster-xxxxxxxxxx.ap-northeast-1.rds.amazonaws.com`
        - `MYSQL_PORT`: `3306`
    - **Port**: 5000
- Networking:
    - **Custom VPC** を選んで **the VPC connector** を設定

5 分ほど待っていると `https://xxxxxxxx.ap-northeast-1.awsapprunner.com/` のような URL が利用可能になります。
ローカルで動かしたときと同じように curl で叩いてみると、
叩いた回数を返してくれるはずです。

## まとめ

今回も特にハマることもなく簡単にできました。
一番最初の Perl のプログラムを組むところと、docker compose の設定でちょっと悩んだくらい。
App Runner 自体はドキュメントに頼らずともテキトーにポチポチするだけで直ぐにできました。

これは便利。

ひとつ気になったのがシークレットの保存方法。
今回お試しなのでパスワードを直接入れましたが、設定から丸見えで怖いですね。
このまとめセクションを書きながらようやく [New for App Runner – VPC Support](https://aws.amazon.com/jp/blogs/aws/new-for-app-runner-vpc-support/) を見ているんですが、
どうやらこちらでは RDS の接続に IAM 認証を使っているようです。
シークレットは環境変数にいれずに、IAM Role で解決できないか考えたほうが良さそうです。

## 参考

- [AWS App Runner](https://aws.amazon.com/jp/apprunner/)
- [AWS App Runner に Perl をデプロイしてみた](https://shogo82148.github.io/blog/2021/06/06/perl-on-aws-app-runner/)
- [New for App Runner – VPC Support](https://aws.amazon.com/jp/blogs/aws/new-for-app-runner-vpc-support/)
- [Plack](https://metacpan.org/pod/Plack)
- [DBD::mysql](https://metacpan.org/pod/DBD::mysql)
