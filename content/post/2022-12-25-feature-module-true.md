---
layout: post
title: "Perlのmodule_trueフラグを先取り！"
slug: 2022-12-25-feature-module-true
date: 2022-12-25 04:57:00 +0900
comments: true
categories: [ perl ]
---

[Perl Advent Calendar 2022](https://qiita.com/advent-calendar/2022/perl)に穴が空いてしまったときの
穴埋め用に温めていた記事です。
無事完走したので公開してしまいます。

----

v5.38から`module_true feature pragma`というのが入る予定らしいので試してみました。
v5.38は未リリースなので、開発版のv5.37.5で検証しています。

## 今まで挙動

Perlモジュールの末尾に`1;`という謎の記述を見たことはありませんか？

```perl
# SomeModule.pm
package SomeModule;

sub import {
  warn "You imported a module!\n";
}

1;
```

どこかに代入しているわけでもないので、ムダな一行に見えます。
しかしこの一行がないとモジュールの読み込みに失敗する場合があります。
以下のように`1;`を削除して、このモジュールを読み込んでみましょう。

```perl
# SomeModule.pm
package SomeModule;

sub import {
  warn "You imported a module!\n";
}
```

```perl
# program.pl
use FindBin;
use lib "$FindBin::Bin";
use SomeModule;
```

```
$ perl program.pl
SomeModule.pm did not return a true value at program.pl line 3.
BEGIN failed--compilation aborted at program.pl line 3.
```

"SomeModule.pmが値trueを返しませんでした"というエラーメッセージとともにプログラムが止まってしまいます。
実は`1;`はモジュールの読み込みが成功したかを表すフラグなのです。


## module_true featureフラグ

ただ`1;`を末尾につけるのはよく忘れるんですよね（実際自分も毎回忘れる）。
忘れたとしても直前のコードがたまたま`true`を返してモジュールの読み込みが成功することもあるので、
非常に気が付きにくいです。
そこでこの機能を無効化するフラグが追加されました。

```perl
# SomeModule.pm
package SomeModule;

use feature 'module_true';

sub import {
  warn "You imported a module!\n";
}
```

```
$ perl program.pl
You imported a module!
```

5.37以降の機能を有効化するfeature bundleでデフォルト有効化されるので、
以下のように記述してもOKです。

```perl
# SomeModule.pm
package SomeModule;

use v5.37;

sub import {
  warn "You imported a module!\n";
}
```

## 余談

`true`と判定されてればOKなので、末尾に埋め込むのは文字列でも大丈夫だったりします。

```perl
# SomeModule.pm
package SomeModule;

sub import {
  warn "You imported a module!\n";
}

"ok macopy";
```

## まとめ

Perl v5.38.0に導入予定の `module_true feature pragma` を試してみました。
Perlモジュール末尾の`1;`というおまじないが不要になります。
最近のPerlはこういう罠を防ぐ機能が入って、どんどん便利になってますね！

## 参考

- [perldelta v5.37.6](https://metacpan.org/release/CORION/perl-5.37.6/view/pod/perldelta.pod)
- ~~RFC-18~~ → [PPC-18](https://github.com/Perl/PPCs/blob/8dcea2bc863627a1b2585ef47c263e4ee5e5403d/ppcs/ppc0018-module-true.md)（2023-09-03 リンク先修正、RFCからPPCに名前が変わったらしい）
