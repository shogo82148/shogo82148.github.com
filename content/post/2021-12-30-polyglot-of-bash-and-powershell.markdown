---
layout: post
title: "Bash と PowerShell の Polyglot を作る"
slug: polyglot-of-bash-and-powershell
date: 2021-12-30 21:12:00 +0900
comments: true
categories: [bash, powershell]
---

以前 Bash と PowerShell の Polyglot を書いたことがあったんですが、
「そういえば、どこにもメモってないな〜」と思い出したので、記録として残しておきます。

## 背景・目的

GitHub Actions には [`run`](https://docs.github.com/en/actions/learn-github-actions/workflow-syntax-for-github-actions#jobsjob_idstepsrun) というステップがあります。
任意のシェルスクリプトをかける便利なステップなんですが、
マトリックスビルドでマルチプラットフォームなワークフローを書いていると罠があります。

例えば以下のワークフローは 「Hello GitHub Actions!」とログに表示するだけの簡単なものです。

```yaml
on:
  push:
  pull_request:

jobs:
  job:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - name: Ubuntu, macOS, Windows で実行する
        # shell: bash # Ubuntu, macOS でのデフォルト
        # shell: pwsh # Windows でのデフォルト
        run: |
          echo "Hello GitHub Actions!"
```

コメントに書いたとおり Ubuntu, macOS では bash、Windows では PowerShell Core と
デフォルトのシェルが環境によって異なります。
bash にも PowerShell にも `echo` コマンドが存在するので、この例はなぜか動いてしまうのですが、
もっと複雑な処理ではこうも行きません。

これを一般化すると **なるほど！ Bash と PowerShell の Polyglot だ！** と気がついたので、やってみたというお話です。

## 最終案

気の短い人のための最終案。
試行錯誤の末たどり着いたのが以下のスクリプトです。

```plain
echo " \`" > /dev/null # " <#
echo "Hello Bash!"

exit #> > $null
Write-Output "Hello PowerShell!"
```

以下はこれにたどり着くまでのメモです。

## 初期案

最初に思いついたのは以下のようなものです。

```plain
echo `# <#` > /dev/null
echo "Hello Bash!"

exit #> > $null
Write-Output "Hello PowerShell!"
```

ポイントは bash と PowerShell におけるバッククオート(``` ` ```)の扱いの違いです。

### bash として解釈した場合

bash でのバッククオートの役割は、バッククオートで囲まれた文字列をコマンドとして解釈し、展開することです。

```bash
echo `# <#` > /dev/null
echo "Hello Bash!"

exit #> > $null
Write-Output "Hello PowerShell!"
```

`#` は行末までコメントアウトする記法ですが、バッククオートで囲われている場合影響範囲はバッククオートの中に閉じるようです。
普通やらない変な記法を使ってシンタックスハイライトが混乱しているかもしれませんが、
`# <#` がコメント、 ` > /dev/null` はコメント外と認識されます。
つまり bash のコメントを取り除くとこうなります。

```bash
echo `` > /dev/null
echo "Hello Bash!"

exit
Write-Output "Hello PowerShell!"
```

一行目は虚無(``` `` ```)を実行して、出力結果を `/dev/null` に捨てています。
つまり「何もしない」ということです。

bash の実行が終わった後は `exit` コマンドで実行を終了し、その後の PowerShell のスクリプトの解釈をスキップします。

### PowerShell として解釈した場合

PowerShell でのバッククオートの役割はエスケープです。
bash におけるバックスラッシュですね。

```powershell
echo `# <#` > /dev/null
echo "Hello Bash!"

exit #> > $null
Write-Output "Hello PowerShell!"
```

`#` は PowerShell でも行コメントの意味を持ちますが、
バッククオートによってエスケープされて通常の文字として解釈されます。

その後の `<#` は PowerShell の複数行コメントの開始です。
対応する `#>` までをコメントアウトします。
ちょっと見づらいのでコメントを削除してみましょう。

```powershell
echo `# > $null
Write-Output "Hello PowerShell!"
```

その結果一行目は「`#`を出力するコマンド」として解釈されます。
結果は `$null` に捨てるので、行全体では何もしません。

その後の行は通常の PowerShell スクリプトとして解釈されます。

## 別解その1

もともと GitHub Actions デフォルトのシェルがOSによって違うのが問題なんだら、
シェルを明示的に指定すれば良くないかって？

```yaml
on:
  push:
  pull_request:

jobs:
  job:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - name: Ubuntu, macOS, Windows で実行する
        shell: bash # 明示的にシェルを指定する
        run: |
          echo "Hello GitHub Actions!"
```

いや、それはそうなんですが、 PowerShell のほうが楽にかける処理もあるんですよ。
Windowsの bash は Git for Windows に付属する bash なので、 git を使うのに最低限必要なコマンドしか入っていません。
例えば `df -h` でディスク容量を調べようと思ってもそんなコマンドはありません。
PowerShell なら `Get-PSDrive` コマンドレットで一発です。

## 別解その2

`if` を使って環境毎に実行するステップを変えるのは？

```yaml
on:
  push:
  pull_request:

jobs:
  job:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - name: Ubuntu, macOS で実行する
        if: runner.os != 'Windows'
        run: |
          echo "Hello GitHub Actions!"
      - name: Windows で実行する
        if: runner.os == 'Windows'
        run: |
          echo "Hello GitHub Actions!"
```

・・・何も言うことがない・・・

## 別解その3

この記事を書くきっかけになったのが、
今年もアドベントカレンダーを眺めていたときに見つけた「[静的型付きスクリプト言語 Cotowali](https://zenn.dev/zakuro9715/articles/mitou-2021-cotowali)」です。
[cotowali](https://github.com/cotowali/cotowali) は一言で言えば「静的型付け言語からシェルスクリプトへのトランスパイラ」です。

この中で「[Universal バックエンド](https://zenn.dev/zakuro9715/articles/mitou-2021-cotowali#universal-%E3%83%90%E3%83%83%E3%82%AF%E3%82%A8%E3%83%B3%E3%83%89)」
というものが紹介されています。
これは bash でも PowerShell でも実行できるスクリプトを出力するバックエンドです。
まさしく Polyglot ですね！
この記事をよんで、自分も書いていたなと思い出し、今書いているこの記事を書いたのでした。

さて、この Universal バックエンドではちょっと違った手法が使われているので、覗いてみましょう。

```plain
echo " \`" > /dev/null # " @"

hello() {
  echo 'hello'
}

hello

: << '__END_HEREDOC__'
"@ > $null

function hello() {
  'hello' | write-output
}

hello

function __END_HEREDOC__() {}
__END_HEREDOC__
```

### bash として解釈した場合

ここでもバッククオートの扱いが鍵になってきます。
bash として解釈した場合は「バックスラッシュがバッククオートをエスケープ」します。

``` bash
echo " \`" > /dev/null # " @"

hello() {
  echo 'hello'
}

hello

: << '__END_HEREDOC__'
"@ > $null

function hello() {
  'hello' | write-output
}

hello

function __END_HEREDOC__() {}
__END_HEREDOC__
```

結果一行目はバッククオートを出力するコマンドになります。
出力は `/dev/null` に捨てているので、結果何もしません。

PowerShell のスクリプト実行防止にはヒアドキュメントを使っていますね。
コロン(`:`) は「何もしないコマンド」です。標準入力を無視するために使っています。

### PowerShell として解釈した場合

PowerShell として解釈した場合は「バッククオートがダブルクオーテーションをエスケープ」します。

``` powershell
echo " \`" > /dev/null # " @"

hello() {
  echo 'hello'
}

hello

: << '__END_HEREDOC__'
"@ > $null

function hello() {
  'hello' | write-output
}

hello

function __END_HEREDOC__() {}
__END_HEREDOC__
```

結果一行目は 「` \" > /dev/null # `」という文字列になります。
行末の `@"` は PowerShell で複数行文字列を入力する書式です。対応する `"@` までが文字列として解釈されます。
全体を通してみると「bash スクリプトを出力するコマンド(ちょっと先頭にゴミが付いてるけど)」になっていることがわかります。
まあ結局これも `$null` に捨てるので、最終的には何も起きません。

あとは bash のヒアドキュメントの残党がスクリプト末尾にいるので、「何もしない関数」を定義することで無害化しています。

```powershell
function __END_HEREDOC__() {}
__END_HEREDOC__
```

## 最終案

初期案はトリッキーなコメントの使い方をしているので、シンタックスハイライトを混乱させてしまうのが問題です。
別解その3のコメントアウトは行末までコメントアウトしているので、ほとんどのエディタでシンタックスハイライトは問題にならないでしょう。

一方別解その3の `@" ... "@` は PowerShell で文字列として解釈されますが、
文字列内の変数を展開してしまうという機能があります。
変数展開のための記号は `$` なので、 bash のスクリプト中でうっかり使ってしまうこともあるでしょう。

というわけで、初期案と別解その3のハイブリッド案です。
一方別解その3で bash 実行時に `@"` を無視する方法を、初期案に取り込みます。

```plain
echo " \`" > /dev/null # " <#
echo "Hello Bash!"

exit #> > $null
Write-Output "Hello PowerShell!"
```

```bash
echo " \`" > /dev/null # " <#
echo "Hello Bash!"

exit #> > $null
Write-Output "Hello PowerShell!"
```

```powershell
echo " \`" > /dev/null # " <#
echo "Hello Bash!"

exit #> > $null
Write-Output "Hello PowerShell!"
```

きれいにシンタックスハイライト効いているかな？

## まとめ

Bash と PowerShell の Polyglot を作る方法を考えてみました。
最終案はこれです。

```plain
echo " \`" > /dev/null # " <#
echo "Hello Bash!"

exit #> > $null
Write-Output "Hello PowerShell!"
```

是非活用してみてください！
GitHub Actions で使える・・・かもしれない。

## 参考

- [`jobs.<job_id>.steps[*].run`](https://docs.github.com/en/actions/learn-github-actions/workflow-syntax-for-github-actions#jobsjob_idstepsrun)
- [`jobs.<job_id>.steps[*].shell`](https://docs.github.com/en/actions/learn-github-actions/workflow-syntax-for-github-actions#jobsjob_idstepsshell)
- [cotowali](https://github.com/cotowali/cotowali)
- [静的型付きスクリプト言語 Cotowali](https://zenn.dev/zakuro9715/articles/mitou-2021-cotowali)
- [未踏2021採択者アドカレ！ Advent Calendar 2021](https://qiita.com/advent-calendar/2021/mitou-2021)
