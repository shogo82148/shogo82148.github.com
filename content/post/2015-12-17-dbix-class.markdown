---
layout: post
title: "PerlのDBIx::Class利用上の注意点"
slug: dbix-class
date: 2015-12-17T18:35:00+09:00
comments: true
categories: [perl]
---

この記事は、[Perl 5 Advent Calendar](http://qiita.com/advent-calendar/2015/perl5)の17日目の記事です。

[Redis::Fast の reconnect について](http://tech.kayac.com/archive/reconnect_redisfast.html)の中で
[DBIx::Class](https://metacpan.org/release/DBIx-Class)のreconnectについても触れています。
DBIx::Classの安全にreconnectionが行えるように考慮されていますが、色々と注意点があります。
reconnection周りで調べてみたので、Advent Calendarの枠を借りてまとめたいと思います。

## DBIx::Classとは

[DBIx::Class](https://metacpan.org/release/DBIx-Class)はPerlのO/Rマッピングモジュールです。
テーブル間のリレーションを定義でき、JOIN句の入ったクエリもサポートする等、かなり高機能なモジュールです。
もう僕はJOIN句をDBIx::Class以外で書ける気がしません。
詳しくはtypester先生の解説記事をどうぞ。

- [Perl Hackers Hub](http://gihyo.jp/dev/serial/01/perl-hackers-hub)
  - [第3回　DBIx::Classでデータベース操作（1）](http://gihyo.jp/dev/serial/01/perl-hackers-hub/000301)
  - [第3回　DBIx::Classでデータベース操作（2）](http://gihyo.jp/dev/serial/01/perl-hackers-hub/000302)
  - [第3回　DBIx::Classでデータベース操作（3）](http://gihyo.jp/dev/serial/01/perl-hackers-hub/000303)

## サンプル

サンプルとしてユーザの所持金を管理する簡単なアプリを作ってみます。
Webアプリとか作るの面倒だったので、コンソールアプリです。

``` perl
package My::Schema::User {
    use base 'DBIx::Class::Core';

    __PACKAGE__->table('user');

    __PACKAGE__->add_columns(
        id => {
            data_type         => 'INTEGER',
            is_nullable       => 0,
            is_auto_increment => 1,
        },
        username => {
            data_type   => 'VARCHAR',
            size        => 255,
            is_nullable => 0,
        },
    );

    __PACKAGE__->set_primary_key('id');

    # userとmoneyは1対1の関係で、userに対応するmoneyが必ず存在しなければならない
    __PACKAGE__->has_one(
        'money' => 'My::Schema::Money',
        { 'foreign.user_id' => 'self.id' },
    );

    1;
};

package My::Schema::Money {
    use base 'DBIx::Class::Core';

    __PACKAGE__->table('money');

    __PACKAGE__->add_columns(
        user_id => {
            data_type   => 'INTEGER',
            is_nullable => 0,
        },
        yen => {
            data_type   => 'INTEGER',
            is_nullable => 0,
        },
    );

    __PACKAGE__->set_primary_key('user_id');

    __PACKAGE__->belongs_to(
        'user' => 'My::Schema::User',
        { 'foreign.id' => 'self.user_id' },
    );

    1;
};

package My::Schema {
    use base 'DBIx::Class::Schema';

    __PACKAGE__->load_classes(qw/User Money/);

    1;
};

use feature 'say';

my $schema = My::Schema->connect('dbi:mysql:host=127.0.0.1;port=3306;database=test;mysql_write_timeout=1;mysql_read_timeout=1', 'root', '');
$schema->storage->dbh->do('DROP TABLE IF EXISTS money, user');
$schema->deploy;
```

実行するとMySQLのデータベースに以下のようなテーブルが作成されます。
userテーブルはユーザの名前を管理するテーブル、moneyはユーザの所持金を管理するテーブルです。

```
mysql> desc user;
+----------+--------------+------+-----+---------+----------------+
| Field    | Type         | Null | Key | Default | Extra          |
+----------+--------------+------+-----+---------+----------------+
| id       | int(11)      | NO   | PRI | NULL    | auto_increment |
| username | varchar(255) | NO   |     | NULL    |                |
+----------+--------------+------+-----+---------+----------------+
2 rows in set (0.00 sec)

mysql> desc money;
+---------+---------+------+-----+---------+-------+
| Field   | Type    | Null | Key | Default | Extra |
+---------+---------+------+-----+---------+-------+
| user_id | int(11) | NO   | PRI | NULL    |       |
| yen     | int(11) | NO   |     | NULL    |       |
+---------+---------+------+-----+---------+-------+
2 rows in set (0.00 sec)
```

## タイムアウトとロールバックの微妙な関係

### ユーザの初期化プログラムを実装してみる

テーブル作っただけではつまらないので、データを入れてみます。

``` perl
# スキーマ定義等略

# ユーザ作成
my $user_rs = $schema->resultset('User');
eval {
    my $user = $user_rs->create({
        id       => 1,
        username => 'ok_macopy',
    });

    # ユーザを初期化するためクエリ(ちょっと時間がかかる)
    $user_rs->search({}, {select => \'SLEEP(1)'})->all;
    $user->create_related(money => { yen => 1000 });
};
if (my $err = $@) {
    warn $err;
}

my $user = $user_rs->search({ id => 1 })->single;
if ($user) {
    say "名前: ", $user->username;
    say "所持金: ", $user->money->yen;
} else {
    say "ユーザが見つかりませんでした";
}
```

実行してみると、1000円持ったユーザが作成されます。

``` plain
$ perl dbic-test.pl
名前: ok_macopy
所持金: 1000
```

### タイムアウトと戦う

一件上手く動いていそうに見えますが、上記コードを何回か実行すると、ときたま以下のように失敗します。

```
$ perl dbic-test.pl
DBIx::Class::Storage::DBI::_dbh_execute(): DBI Exception: DBD::mysql::st execute failed: Lost connection to MySQL server during query [for Statement "SELECT SLEEP(1) FROM user me"] at dbic-test.pl line 80
名前: ok_macopy
所持金: 0
```

所持金が0円になってしまいました。
`SELECT SLEEP(1) FROM user me` という時間のかかるクエリを投げたので、コネクションがタイムアウトしてしまったようです。
データベースの状態を確認すると、userに行はあるけど、moneyは空っぽの状態です。
「userに対応するmoneyが必ず存在しなければならない」とスキーマで定義したのに、その条件を満たしていませんね。
たとえタイムアウトしたとしても、このような状態にはならないで欲しいです。

```
mysql> SELECT * FROM user;
+----+-----------+
| id | username  |
+----+-----------+
|  1 | ok_macopy |
+----+-----------+
1 row in set (0.00 sec)

mysql> SELECT * FROM money;
Empty set (0.00 sec)
```

### トランザクションを使ってみる

リレーショナルデータベースにはこれを実現するためにトランザクションという便利なものがあります。
DBIx::Classから扱うにはいくつか方法がありますが、例えばガードオブジェクトを使って以下のように書けます。

``` perl
# ユーザ作成
my $user_rs = $schema->resultset('User');
eval {
    my $txn = $schema->txn_scope_guard;
    my $user = $user_rs->create({
        id       => 1,
        username => 'ok_macopy',
    });

    # ユーザを初期化するためクエリ(ちょっと時間がかかる)
    $user_rs->search({}, {select => \'SLEEP(1)'})->all;
    $user->create_related(money => { yen => 1000 });

    $txn->commit;
};
if (my $err = $@) {
    warn $err;
}

my $user = $user_rs->search({ id => 1 })->single;
if ($user) {
    say "名前: ", $user->username;
    say "所持金: ", $user->money ? $user->money->yen : 0;
} else {
    say "ユーザが見つかりませんでした";
}
```

これで片一方だけ更新されるのが防げるはず！
ところが、片一方だけ更新自体は防げはするのですが、
今度は所持金を表示するところでコケてしまいます。
トランザクションを使っていないときは正常に表示できていたし、
表示部分は一切いじってないのに不思議ですね。

``` plain
$ perl dbic-test.pl
Transaction aborted: DBIx::Class::Storage::DBI::_dbh_execute(): DBI Exception: DBD::mysql::st execute failed: Lost connection to MySQL server during query [for Statement "SELECT SLEEP(1) FROM user me"] at dbic-test.pl line 80
 Rollback failed: DBIx::Class::Storage::DBI::_exec_txn_rollback(): DBI Exception: DBD::mysql::db rollback failed: Turning on AutoCommit failed at dbic-test.pl line 72
DBIx::Class::Storage::DBI::_dbh_execute(): DBI Exception: DBD::mysql::st execute failed: MySQL server has gone away [for Statement "SELECT me.id, me.username FROM user me WHERE ( id = ? )" with ParamValues: 0=1] at dbic-test.pl line 89
# ※「ユーザが見つかりませんでした」と表示されて欲しいがされない
```

実はコネクションがタイムアウトしたとはMySQLとの再接続をする必要があるのですが、
DBIx::Classが裏で再接続処理を自動的にやってくれるので、普段は意識する必要はありません。
ただし例外があって、 **トランザクションの中では再接続処理を行ってくれません** 。

トランザクション内で勝手に再接続が行われると逆に困るので、この挙動自体は正しいのですが、
これにロールバックが絡むと少し不思議なことが起こります。
**ロールバックしてトランザクションを抜けても、DBIx::Classはトランザクションの中にいると判断してしまうのです。**
このことは`transaction_depth`を見ることで確認できます。

``` perl
# ユーザ作成
my $user_rs = $schema->resultset('User');
say 'transaction_depth = ', $schema->storage->{transaction_depth};
eval {
    my $txn = $schema->txn_scope_guard;
    say 'transaction_depth = ', $schema->storage->{transaction_depth};
    my $user = $user_rs->create({
        id       => 1,
        username => 'ok_macopy',
    });

    # ユーザを初期化するためクエリ(ちょっと時間がかかる)
    $user_rs->search({}, {select => \'SLEEP(1)'})->all;
    $user->create_related(money => { yen => 1000 });

    $txn->commit;
};
if (my $err = $@) {
    warn $err;
}
say 'transaction_depth = ', $schema->storage->{transaction_depth};

my $user = $user_rs->search({ id => 1 })->single;
if ($user) {
    say "名前: ", $user->username;
    say "所持金: ", $user->money ? $user->money->yen : 0;
} else {
    say "ユーザが見つかりませんでした";
}
```

``` plain
$ perl dbic-test.pl
transaction_depth = 0
transaction_depth = 1
Transaction aborted: DBIx::Class::Storage::DBI::_dbh_execute(): DBI Exception: DBD::mysql::st execute failed: Lost connection to MySQL server during query [for Statement "SELECT SLEEP(1) FROM user me"] at dbic-test.pl line 82
 Rollback failed: DBIx::Class::Storage::DBI::_exec_txn_rollback(): DBI Exception: DBD::mysql::db rollback failed: Turning on AutoCommit failed at dbic-test.pl line 73
transaction_depth = 1 # ※トランザクションの外なのに1になってる
DBIx::Class::Storage::DBI::_dbh_execute(): DBI Exception: DBD::mysql::st execute failed: MySQL server has gone away [for Statement "SELECT me.id, me.username FROM user me WHERE ( id = ? )" with ParamValues: 0=1] at dbic-test.pl line 92
```

この状態になるといつまで経っても再接続は行われません。
都度接続なら大きな問題にはならないのですが、Webアプリでコネクションの永続化を行っている場合は深刻です。
一度タイムアウトすると以後のリクエストがすべて失敗してしまいます。

### 確実に再接続を行う

これを防ぐには確実に再接続をおこなって欲しいところで `$schema->storage->ensure_connected;` を実行します。

``` perl
# ユーザ作成
my $user_rs = $schema->resultset('User');
eval {
    my $txn = $schema->txn_scope_guard;
    my $user = $user_rs->create({
        id       => 1,
        username => 'ok_macopy',
    });

    # ユーザを初期化するためクエリ(ちょっと時間がかかる)
    $user_rs->search({}, {select => \'SLEEP(1)'})->all;
    $user->create_related(money => { yen => 1000 });

    $txn->commit;
};
if (my $err = $@) {
    warn $err;
}

$schema->storage->ensure_connected; 

my $user = $user_rs->search({ id => 1 })->single;
if ($user) {
    say "名前: ", $user->username;
    say "所持金: ", $user->money ? $user->money->yen : 0;
} else {
    say "ユーザが見つかりませんでした";
}
```

こうすることで、何度実行しても「所持金1000のユーザが作られる」or「ユーザが見つかりませんでした」の状態になり、
中途半端な状態のユーザが作られたり、再接続に失敗したりということはなくなります。

``` plain
$ perl dbic-test.pl
Transaction aborted: DBIx::Class::Storage::DBI::_dbh_execute(): DBI Exception: DBD::mysql::st execute failed: Lost connection to MySQL server during query [for Statement "SELECT SLEEP(1) FROM user me"] at dbic-test.pl line 80
 Rollback failed: DBIx::Class::Storage::DBI::_exec_txn_rollback(): DBI Exception: DBD::mysql::db rollback failed: Turning on AutoCommit failed at dbic-test.pl line 72
        (in cleanup) {UNKNOWN}: DBI Exception: DBD::mysql::db DESTROY failed: MySQL server has gone away  at /home/ichinose/.plenv/versions/5.20.2/lib/perl5/site_perl/5.20.2/DBIx/Class/Schema.pm line 1077.
        DBIx::Class::Schema::throw_exception(My::Schema=HASH(0x118d088), "DBI Exception: DBD::mysql::db DESTROY failed: MySQL server ha"...) called at /home/ichinose/.plenv/versions/5.20.2/lib/perl5/site_perl/5.20.2/DBIx/Class/Storage.pm line 113
        DBIx::Class::Storage::throw_exception(DBIx::Class::Storage::DBI::mysql=HASH(0x118d718), "DBI Exception: DBD::mysql::db DESTROY failed: MySQL server ha"...) called at /home/ichinose/.plenv/versions/5.20.2/lib/perl5/site_perl/5.20.2/DBIx/Class/Storage/DBI.pm line 1473
        DBIx::Class::Storage::DBI::__ANON__("DBD::mysql::db DESTROY failed: MySQL server has gone away", DBI::db=HASH(0x16efbb8), undef) called at dbic-test.pl line 91
        eval {...} called at dbic-test.pl line 91

ユーザが見つかりませんでした
```

## ネストしたトランザクションとロールバックの微妙な関係

### トランザクションをネストする

キャンペーン期間中なので通常1000円のところ2000円で初期化してあげることになりました。
**2000円への更新処理の途中で何かエラーが起こった場合は1000円で初期化して欲しい** ので、
以下のようにトランザクションをネストしてみました。

``` perl
eval {
    my $txn = $schema->txn_scope_guard;
    my $user = $user_rs->create({
        id       => 1,
        username => 'ok_macopy',
    });

    # ユーザを初期化するためクエリ
    my $money = $user->create_related(money => { yen => 1000 });

    # キャンペーン期間中なので2000円で初期化してげよう
    {
        my $txn2 = $schema->txn_scope_guard;
        $money->update({yen => 2000});
        undef $txn2; # エラーが起こったのでロールバックして欲しい！1000円にもどって!!
    }

    $txn->commit;
};
if (my $err = $@) {
    warn $err;
}

$schema->storage->ensure_connected;

my $user = $user_rs->search({ id => 1 })->single;
if ($user) {
    say "名前: ", $user->username;
    say "所持金: ", $user->money->yen;
} else {
    say "ユーザが見つかりませんでした";
}
```

わざとエラーが起こるようにして実行してみましょう。

``` plain
$ perl dbic-test.pl
DBIx::Class::Storage::TxnScopeGuard::DESTROY(): A DBIx::Class::Storage::TxnScopeGuard went out of scope without explicit commit or error. Rolling back. at dbic-test.pl line 88
名前: ok_macopy
所持金: 2000
```

2000円！

**「Rolling back」って出てるのに全然ロールバックされてない！**

### SAVE POINTを使う

接続時に`auto_savepoint`オプションを有効にすると、`SAVE POINT`を使った部分的なロールバックが使用可能になります。

``` perl
my $schema = My::Schema->connect('dbi:mysql:host=127.0.0.1;port=3306;database=test;mysql_write_timeout=1;mysql_read_timeout=1', 'root', '', {
    auto_savepoint => 1,
});
```

``` plain
$ perl dbic-test.pl
DBIx::Class::Storage::TxnScopeGuard::DESTROY(): A DBIx::Class::Storage::TxnScopeGuard went out of scope without explicit commit or error. Rolling back. at dbic-test.pl line 90
名前: ok_macopy
所持金: 1000
```

### 大人しく全部ロールバックする

MySQLにはSAVE POINTという便利機能があるとはいえ、どこまでロールバックするべきかを管理するのはすごく大変です。
現実的には ALL or NOTHING、失敗したら全部ロールバックで十分なのではと思ってます。
このサンプルではdieしてしまえばいいですね。

``` perl
eval {
    my $txn = $schema->txn_scope_guard;
    my $user = $user_rs->create({
        id       => 1,
        username => 'ok_macopy',
    });

    # ユーザを初期化するためクエリ
    my $money = $user->create_related(money => { yen => 1000 });

    # キャンペーン期間中なので2000円で初期化してげよう
    {
        my $txn2 = $schema->txn_scope_guard;
        $money->update({yen => 2000});
        die 'something error!'; # エラーが起こったのでロールバックして欲しい！1000円にもどって!!
    }

    $txn->commit;
};
if (my $err = $@) {
    warn $err;
}

$schema->storage->ensure_connected;

my $user = $user_rs->search({ id => 1 })->single;
if ($user) {
    say "名前: ", $user->username;
    say "所持金: ", $user->money->yen;
} else {
    say "ユーザが見つかりませんでした";
}
```

``` plain
something error! at dbic-test.pl line 85.
ユーザが見つかりませんでした
```

途中で`eval`して例外キャッチしているとロールバックしたのにコミットされる現象が起こる
(その場合警告すら出ないっぽいので更に怖い)ので、例外握り潰していたら要注意です。

部分的なロールバックができない場合は、
「子トランザクションがロールバックされていたら親トランザクションのコミットが失敗する」
が安全だと思うんですが、なぜこんな挙動になっているんでしょうね。
誰か経緯についてご存知のかたは教えていただきたいです。

## まとめ

- トランザクション外では自動的に再接続してくれるが、トランザクション内では行われない
- 必ず再接続して欲しいところで `$schema->storage->ensure_connected;`
- 部分的なロールバックはやらないのが吉
