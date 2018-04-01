---
layout: post
title: "Unity Test Tools を使ってみる"
date: 2013-12-21T21:02:00+09:00
comments: true
categories: [unity, csharp]
---

みなさんこんにちは、
最近つらいことばかりで元気のないいっちーです。
少しでもつらいことを解消できないかと Unity Test Tools ってので遊んでみました。

<!-- More -->

## 背景

最近あったつらいことのひとつに「Unityで作ってるプロジェクトで、機能拡張したときに間違えて一行消しちゃった！！！」
ってのがあります。

もちろん僕が消したわけじゃないですよ！！！
僕サーバサイドエンジニアですから、Unityはいじりません。
でも、一応修正コミットは見ていたはずなので、気がつけなかったのは残念です・・・。

どんなにコード書く人が頑張っても、レビューする人が頑張っても、
人間誰だってミスします。
じゃあ、機械にやらせよう！テストコードだ！って話なんですが、
コードカバレッジが低く、今回のつらい事例でもテストがありませんでした。
一部書いてあるテストも、担当者が代わってからなんか怪しい・・・。

あと、自分も手元でテスト動かしてみたのですが、今のテスト面倒・・・。

- Unityのコンソールにドバッと流れる
  - テストが全部通ったのか、失敗したのかよくわからない
- ユニットテストを1項目だけやりたいとかどうやるんだろう
  - 「テストの実行」が「シーンの再生」なので1項目とかどうすんの？


## Unity Test Tools

つらいので解決方法を探るべくインターネットの海をさまよっていたら Unity Test Tools なるものを発見。

- [Unity Test Tools Released](http://blogs.unity3d.com/2013/12/18/unity-test-tools-released/)

これを書いてる時点で、3日前のリリースです！
タイムリーだ！！

英語でよくわかんないけど、スクリーンショットはわかりやすくてかっこいいぞ！
遊んでみよう！


## 事前準備

まず、Unity Testing Tools をダウンロードしてこよう！
Aseet Store に並んでるので、ダウンロードボタンを押してしばらく待ってれば Unity が勝手に使える状態にしてくれます。


## 簡単なユニットテストを書いてみる

以前れもんさんが書いた「[#24 「Unityでコルーチンも単体テストしよう」 tech.kayac.com Advent Calendar 2012](http://tech.kayac.com/archive/merry_christmas_2012.html)」を
Unity Testing Tools でやってみました。

テストの対象はこんな感じのクラスです(短く書けそうな部分があったのでちょっと変えた)。

``` csharp
namespace MyProject {
    public class Plan {
        public string Title { get; private set; }
        public string Text { get; private set; }

        public Plan(string title, string text) {
            Title = title;
            Text = text;
        }
    }
}
```

れもんさんの記事ではSharpUnitを使っていましたが、
Unity Test Tools は NUnit というテストフレームワークを使うようです。
Plan のテストをNUnitを使って書きなおしてみます。

``` csharp
using System;
using System.Threading;
using NUnit.Framework;

namespace MyProject.Tests
{
    class PlanTest
    {
        [TestCase("Christmas", "Let's play tennis!")]
        [TestCase("Christmas", null)]
        public void Constractor (string title, string text)
        {
            Plan plan = new Plan(title, text);
            Assert.AreEqual(plan.Title, title);
            Assert.AreEqual(plan.Text, text);
        }
    }
}
```

TestCaseのお陰でずいぶんシンプルになりました。
(にわかC#erの僕はアトリビュートが出てきてドキドキです)

気をつけないといけないのは、このテストをEditorというフォルダの中に入れないといけないことです。
Editorってフォルダの中に入っていると、普段のプロジェクトとは別のプロジェクトに所属するようになります。
Unity Editor の動作を変更するようなスクリプトをかけるらしいので、その一つとして実装するってことですかね・・・？
(そのへんよくわかってない)

テストスクリプトを保存したら、あとはメニューから「Unity Test Tools」「Run all unit tests」をクリックするだけ！
テスト用シーンを追加する必要もありません。簡単！

「Unit Test Runner」を使えば、テストを1項目だけテストすることもできるし、
ファイルを右クリックしたときのメニューから「Load tests from this file」を選べばファイルごとにテストもできます。


## 結合テストをやってみる

次にネットワーク周りのテストをやってみます。
テストするのはこのクラスです。

``` csharp
using UnityEngine;
using System.Collections;

namespace MyProject {
    public class InternetPlanFactory {
        public Plan Plan { get; private set; }

        // 特定のURLにアクセスし、1行目をタイトル、2行目をテキストとしてオブジェクトを生成
        public IEnumerator PlanFromUrl(string url) {
            WWW www = new WWW(url);
            yield return www;
            if (www.error != null) {
                // ノープランだ
                this.Plan = null;
            } else {
                // 適当にPlanつくる
                string[] lines = www.text.Split('\n');
                string title = lines[0];
                string text = lines.Length > 1 ? lines[1] : "";
                this.Plan = new Plan(title, text);
            }
        }
    }
}
```

このクラスのテストには `GameObject` が必要みたいです。
`GameObject` って何者？とUnity情弱の僕は思うのですが、なにやらシーンから取ってこないといけないものらしいです。
ユニットテストでも頑張ればとってこれるのかもしれないけど、
結合テストとしてシーンの中で実行してみます。

結合テストを作るには、新しいシーンを追加し、
そのシーンを開いた状態で「Integration Test Runner」を開きます。
ここで緑の「＋」ボタンを押すとシーンに「TestRunner」と新しいテストが現れます。
さらにテストの子として新しい`GameObject`を追加しておきましょう。


次に以下の様なスクリプトを書きます。

``` csharp
using UnityEngine;
using System;
using System.Collections;
using MyProject;

public class Hoge : MonoBehaviour {
    void Start () {
        StartCoroutine(TestPlanFromUrlOk());
    }

    private IEnumerator TestPlanFromUrlOk() {
        InternetPlanFactory factory = new InternetPlanFactory();
        yield return StartCoroutine(factory.PlanFromUrl("http://example.com"));

        if(factory.Plan == null)
            throw new Exception("Plan is null");
        if(factory.Plan.Title == null)
            throw new Exception("Plan.Title is null");
        if(factory.Plan.Text == null)
            throw new Exception("Plan.Text is null");
        IntegrationTest.Pass(gameObject);
        // IntegrationTest.Fail(gameObject); // と書くとテスト失敗できる
    }
}
```

(アサーションの仕方が残念すぎるけど力尽きた)

このスクリプトをさっき作った`GameObject`にアタッチすれば準備完了です。
「Integration Test Runner」からテスト可能になります。


## おわり

今日はここまで。
今までも一応テストあったけど、Unity Testing Tools使うともっと便利に書けそう。
きっとぴーちんとかがもっと便利な機能を見つけてくれる。

ちなみに `Plan("Christmas", null)` なので、
`Text != null` なURLを募集してます。
