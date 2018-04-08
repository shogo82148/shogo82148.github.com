---
layout: post
title: "Go言語でPerlのテストを早くする"
slug: faster-perl-test-with-go-lang
date: 2015-09-19T21:49:00+09:00
comments: true
categories: [perl, go, golang]
---

[Test::mysqld::Multiというモジュールを書いてみた](http://shogo82148.github.io/blog/2015/06/20/test-mysqld-multi/)みたいな涙ぐましい努力により5分で終わるようになったテストですが、
プロジェクトのコードも増えて人も増えた影響で、
テスト時間が約7分まで伸び、テストのキューに10個近く並んで順番待ちさせられるという状況になってしまいした。

この状況を解決すべく [go-prove](https://github.com/shogo82148/go-prove) というものを書いてみたので、そのご紹介です。

## proveが遅い理由

proveがテストの結果を読むところがブロッキングI/Oになっているらしく、そのせいで遅くなっているらしいです。

- [Perl-Toolchain-Gang/Test-Harness#30](https://github.com/Perl-Toolchain-Gang/Test-Harness/issues/30)

実際に[結果読んでいるところ](https://github.com/Perl-Toolchain-Gang/Test-Harness/blob/a278e504794c649c61f2c362841eec1a9735a3d0/lib/TAP/Parser/Iterator/Process.pm#L245)はこの辺ですかね。
selectとか使っていてなるべくブロッキングしないような作りにはなっていそうですが、どこかでブロッキングしてしまっているようです。
今のプロジェクトだと32コアのCPUで32並列で動かしてもCPUを100%使い切ることができませんでした。


## Shunme

ググるとShunmeというプロジェクトでproveの問題を解決しようという試みが行われているようです。

- [Shunmeというperl用のテストハーネスモジュールを書き始めました](http://code-stylistics.net/archives/shunme.html)
- [magnolia-k/p5-Shunme](https://github.com/magnolia-k/p5-Shunme)

しかし残念ながらproveのプラグイン機構はサポートしておらず、Formatterの指定オプションもないようです。
今のプロジェクトではプラグインでMySQLを立てたり、JUnitでテスト結果をフォーマットしたりということをしているので、そのままは使えなさそう。
ちょっと改造するにはソースコードの理解が大変そうなので断念。
「(逆に遅くなるときも有ります)」というところも気になりますね・・・。


## go-prove

いろいろテストの実行方法を調べてはみましたが、どの方法も並行処理に苦労している模様。
テストファイル自体はただのPerlのスクリプトなので、実行して集計する部分は別にPerlにこだわる必要ないのでは？
並行処理といえば今ならGolangでしょ！ってことでproveのGo実装を書いてみました。

- [go-prove](https://github.com/shogo82148/go-prove)

例えば以下のようなテストをかいて、

``` perl t/macopy.t
use Test::More;

ok "macopy";

done_testing;
```

go-proveコマンドと実行すると、JUnit形式でテスト結果が出力されます。

```
$ go-prove
2015/09/19 21:45:44 start t/macopy.t
2015/09/19 21:45:44 finish t/macopy.t
<testsuites>
        <testsuite tests="1" failures="0" time="0.225" name="t_macopy_t">
		        <properties></properties>
				<testcase classname="t_macopy_t" name="" time="0.225"></testcase>
		</testsuite>
</testsuites>
```

`go-prove -j 32`とするとgoroutineを32個生成して、32並列でテストを実行してくれます。
I/Oの処理をGolangのランタイムがよしなにやってくれるので、楽ちんです。

また、今のプロジェクトではApp::Prove::Plugin::MySQLPoolを使っているので、それ相当の機能を`go-prove -plugin mysqld`で使えるようにしました。
プラグインを有効にするとMySQLサーバを立ち上げて、その接続先情報を`GO_PROVE_MYSQLD`環境変数に設定してくれます。


実際にプロジェクトのコードで試してみたところ7分かかっていたテストが4分を切るようになりました。
CPUの使用率も100%近くになって、有効活用できているようです。


## まとめ

- Perl製のproveは並列実行に弱い
- Goで書きなおしてCPUをフル活用できるようになった

早くはなるものの、既存のテストコードに手を加える必要があってちょっと怖いかなと思ったので、プロジェクトへの組み込みはやってません。
まあ本番環境で走るものではないので、ある程度動くことが確認できたら置き換えてみたいですね。
