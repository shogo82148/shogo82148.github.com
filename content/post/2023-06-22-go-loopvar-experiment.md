---
layout: post
title: "Go 1.22で導入されるforループ変数の変更"
slug: 2023-06-22-go-loopvar-experiment
date: 2023-06-22 11:45:00 +0900
comments: true
categories: [ go, golang ]
---

[Go 1.21 Release Candidate](https://go.dev/blog/go1.21rc)で、
forループ変数のセマンティクス変更の予定をしりました。
導入の背景や影響について、Wikiの[LoopvarExperiment](https://github.com/golang/go/wiki/LoopvarExperiment)で説明されています。

地味にインパクトが大きそうだったので、内容を理解するために和訳しました。
といっても訳の大半はChatGPT ChatGPT May 24 Versionのものです。便利。
多少僕の修正も入ってます。

以下[LoopvarExperimentのリビジョンdce06fb](https://github.com/golang/go/wiki/LoopvarExperiment/dce06fba618410bc10d158c41f5a6199e8f5d409)の和訳です。

---

Go 1.22では、Goチームはforループ変数のセマンティクスを変更し、繰り返し毎のクロージャやゴルーチンにおける意図しない共有を防止することを検討しています。
Go 1.21には、この変更の予備的な実装が含まれており、プログラムをビルドする際に`GOEXPERIMENT=loopvar`を設定することで有効になります。
変更の影響を理解するのに協力していただける方々には、`GOEXPERIMENT=loopvar`を使用して試してみていただき、遭遇した問題や成功した点についてご報告いただけると幸いです。

このページでは、変更に関するよくある質問にお答えします。

## この変更を試すにはどうすればいいですか？

Go 1.21を使用して、以下のように`GOEXPERIMENT=loopvar`を設定してプログラムをビルドします。

```bash
GOEXPERIMENT=loopvar go install my/program
GOEXPERIMENT=loopvar go build my/program
GOEXPERIMENT=loopvar go test my/program
GOEXPERIMENT=loopvar go test my/program -bench=.
...
```

## この問題はどのようなものですか？

以下のようなループを考えてみましょう：

```go
	func TestAllEvenBuggy(t *testing.T) {
		testCases := []int{1, 2, 4, 6}
		for _, v := range testCases {
			t.Run("sub", func(t *testing.T) {
				t.Parallel()
				if v&1 != 0 {
					t.Fatal("odd v", v)
				}
			})
		}
	}
```

このテストは、すべてのテストケースが偶数であるかを確認することを目的としていますが、`GOEXPERIMENT=loopvar`を使用しなくてもパスします。
問題は、`t.Parallel`がクロージャを停止させ、ループを継続させ、そして`TestAllEven`が戻るときにすべてのクロージャを並列で実行することです。
クロージャ内のif文が実行される時点でループは終了しており、vは最終的なイテレーションの値である6になっています。
その結果、4つのサブテストはすべて並列で実行され、テストケースごとに確認する代わりに、すべてが6が偶数であるかどうかをチェックしてしまいます。

この問題の別のバリエーションは以下のようなものです。

```go
	func TestAllEven(t *testing.T) {
		testCases := []int{0, 2, 4, 6}
		for _, v := range testCases {
			t.Run("sub", func(t *testing.T) {
				t.Parallel()
				if v&1 != 0 {
					t.Fatal("odd v", v)
				}
			})
		}
	}
```

このテストは、0、2、4、6がすべて偶数であるかどうかを確認するものですが、0、2、4が正しく処理されているかどうかをテストしていません。`TestAllEvenBuggy`と同様に、6を4回テストしてしまいます。

このバグのもう1つの一般的な形式は、3つの節を持つforループでループ変数をキャプチャする場合です。

```go
	func Print123() {
		var prints []func()
		for i := 1; i <= 3; i++ {
			prints = append(prints, func() { fmt.Println(i) })
		}
		for _, print := range prints {
			print()
		}
	}
```

このプログラムは1、2、3を表示するように見えますが、実際には4、4、4と表示されます。

このような意図しない共有のバグは、Goを学び始めたばかりの人から10年間使用している人まで、すべてのGoプログラマに影響を与えます。
この問題の議論は、Go FAQの[最初のエントリーの1つ](https://go.dev/doc/faq#closures_and_goroutines)です。

こちらは、この種のバグによって引き起こされた[実際のプロダクション問題の公開例](https://bugzilla.mozilla.org/show_bug.cgi?id=1619047)です。
これはLet's Encryptからのものです。関連するコードは次のようになっています：

```go
// authz2ModelMapToPB converts a mapping of domain name to authz2Models into a
// protobuf authorizations map
func authz2ModelMapToPB(m map[string]authz2Model) (*sapb.Authorizations, error) {
	resp := &sapb.Authorizations{}
	for k, v := range m {
		// Make a copy of k because it will be reassigned with each loop.
		kCopy := k
		authzPB, err := modelToAuthzPB(&v)
		if err != nil {
			return nil, err
		}
		resp.Authz = append(resp.Authz, &sapb.Authorizations_MapElement{Domain: &kCopy, Authz: authzPB})
	}
	return resp, nil
}
```

ループの最後で使用されている`&kCopy`に対処するために`kCopy := k`が存在することに注意してください。
残念ながら、`modelToAuthzPB`は`v`のいくつかのフィールドへのポインターを保持していることが判明しましたが、これはループを読んでいる段階では分からないものでした。

このバグの初期の影響は、Let's Encryptが[不正に発行された300万以上の証明書を取り消す必要があった](https://community.letsencrypt.org/t/revoking-certain-certificates-on-march-4/114864)ことでした。
彼らはインターネットのセキュリティに与える負の影響のためにその処置を取らないことにし、代わりに[例外を主張](https://bugzilla.mozilla.org/show_bug.cgi?id=1619179)しましたが、
そのインパクトの大きさがわかると思います。

このコードは作成時に注意深くレビューされており、著者は明らかに潜在的な問題に気づき、`kCopy := k`という行を書いています。
それにもかかわらず、まだ重大なバグがありました。このバグは、`modelToAuthzPB`が正確に何を行っているかを正確に把握しない限りは見えません。

## 提案されている解決策は？

提案されている解決策は、`:=`を使用してforループ内で宣言されたループ変数が、各イテレーションごとに異なるインスタンスになるようにすることです。
これにより、値がクロージャやゴルーチンにキャプチャされたり、イテレーションを超えて存在する場合でも、後の参照ではそのイテレーション中に持っていた値が見えるようになり、後のイテレーションで上書きされた値ではなくなります。

rangeループの場合、各ループの本体が各range変数に対して`k := k`および`v := v`で開始される効果があります。
上記のLet's Encryptの例では、`kCopy := k`は不要になり、`v := v`がないことによって引き起こされるバグも回避されます。

3つの節を持つforループの場合、各ループの本体が`i := i`で始まり、ループ本体の最後で逆の代入が行われ、イテレーションごとの`i`が次のイテレーションの準備に使用されるiにコピーされます。
これは複雑に聞こえるかもしれませんが、実際には一般的なforループのイディオムは従来通りに正確に機能し続けます。
ループの動作が変わるのは、`i`がキャプチャされて他の何かと共有される場合だけです。たとえば、次のコードは従来通りに動作します。

```go
	for i := 0;; i++ {
		if i >= len(s) || s[i] == '"' {
			return s[:i]
		}
		if s[i] == '\\' { // エスケープされた文字（おそらく引用符）をスキップ
			i++
		}
	}
```

詳細については、[設計ドキュメント](https://go.googlesource.com/proposal/+/master/design/60078-loopvar.md)を参照してください。

## この変更でプログラムが壊れる可能性はありますか？

はい、この変更によってプログラムが壊れる可能性があります。たとえば、リスト内の値を単一要素のマップを使用して合計する驚くべき方法があります。

```go
func sum(list []int) int {
	m := make(map[*int]int)
	for _, x := range list {
		m[&x] += x
	}
	for _, sum := range m {
		return sum
	}
	return 0
}
```

この例では、ループ内には1つの`x`しかないため、各イテレーションで`&x`が同じになることを前提としています。
しかし、`GOEXPERIMENT=loopvar`では、`x`がイテレーションからエスケープするため、各イテレーションごとに`&x`が異なる値となります。
マップには単一のエントリーではなく複数のエントリーが含まれるようになります。

以下は、0から9までの値を出力する意外な方法です。

```go
	var f func()
	for i := 0; i < 10; i++ {
		if i == 0 {
			f = func() { print(i) }
		}
		f()
	}
```

この例では、最初のイテレーションで初期化されたfは、呼び出されるたびにiの新しい値を「見る」ということに依存しています。`GOEXPERIMENT=loopvar`を使用すると、0が10回出力されます。

`GOEXPERIMENT=loopvar`を使用して壊れる人工的なプログラムを作成することは可能ですが、まだ実際に誤って実行されるプログラムは見つかっていません。

C#もC# 5.0で同様の変更を行い、[彼らも同様の変更による問題はほとんど報告されなかった](https://github.com/golang/go/discussions/56010#discussioncomment-3788526)と報告しています。

## この変更は、実際のプログラムをどれくらいの頻度で壊すのでしょうか？

実証的には、この変更によって実際のプログラムが壊れることはほとんどありません。
Googleのコードベースでのテストでは、多くのテストが修正されました。
また、ループ変数と`t.Parallel`の間の相互作用の問題により、いくつかのバグのあるテストが誤って合格していることも特定されました。
先ほどの「`TestAllEvenBuggy`」のようなテストを修正するために、それらのテストを書き直しました。

私たちの経験からは、新しいセマンティクスは正しいコードを壊すよりも、バグのあるコードを修正することの方が遥かに多いということが示されています。
新しいセマンティクスは、テストパッケージの約1/8（すべてが誤って合格しているテスト）でのみテストの失敗を引き起こしました。
ただし、更新されたGo 1.20の`loopclosure`vetチェックをコードベース全体に適用すると、テストがはるかに高い割合で検出されました。
約400件のうちの1つ（8,000件の中で20件）です。
この`loopclosure`チェッカーには偽陽性はありません。すべての報告は、ソースツリー内での`t.Parallel`の誤った使用です。
つまり、検出されたテストの約5%が「`TestAllEvenBuggy`」のようなものであり、残りの95%が「`TestAllEven`」のようなものです。
ループ変数のバグが修正されたとしても、意図した動作をテストしていない（まだ）ものの、正しいコードの正しいテストです。

Googleは、2023年5月初旬以来、新しいループセマンティクスを標準のプロダクションツールチェーンのすべてのforループに適用して実行しており、報告された問題はひとつもありません（たくさんの喝采を浴びています）。

Googleでの経験の詳細については、[この記事](https://go.googlesource.com/proposal/+/master/design/60078-loopvar.md#fixes)を参照してください。

また、[Kubernetesでも新しいループセマンティクスを試しました](https://github.com/golang/go/issues/60078#issuecomment-1556058025)。
その結果、基盤となるコードに潜在的なループ変数のスコープ関連したバグにより、新たに2つのテストが失敗することが特定されました。
比較のために、KubernetesをGo 1.20からGo 1.21に更新した場合、Go自体の未公開の振る舞いに依存していたため、3つの新たなテストの失敗が特定されました。
ループ変数の変更による2つのテストの失敗は、通常のリリースの更新に比べて重大な負担とはなりません。

## プログラムの実行を遅くする可能性がありますか？それによってより多くの割り当てが行われるためですか？

可能性があります。いくつかの場合、追加の割り当ては潜在的なバグの修正に固有のものです。
たとえば、`Print123`では、ループが終了した後に異なる値を印刷するために、現在は3つの別々の`int`（クロージャ内部で行われる）を割り当てています。
そのため、1つの代わりに`N`個の異なる変数を割り当てる必要がありますが、共有変数であっても別々の変数であっても、ループは正しい状態です。
非常に頻繁に実行されるループでは、これにより遅延が発生する場合があります。このような問題は、メモリ割り当てプロファイル（`pprof --alloc_objects`を使用）で明らかになるはずです。

公開されている「bent」ベンチマークスイートのベンチマークでは、統計的に有意なパフォーマンスの差は見られなかったため、ほとんどのプログラムに影響はないと予想されます。

## もし提案が承認される場合、変更はどのように展開されますか？

Goの一般的な[互換性のアプローチ](https://tip.golang.org/doc/godebug)に沿って、新しいforループのセマンティクスは、
コンパイルされるパッケージが`go 1.22`や`go 1.23`のようにGo 1.22以降を宣言するgo行を含むモジュールにのみ適用されます。
この保守的なアプローチにより、「新しいGoツールチェーンを単純に採用するだけでプログラムの動作が変わることはありません」。
代わりに、各モジュールの作者がモジュールが新しいセマンティクスに変更されるタイミングを制御します。

`GOEXPERIMENT=loopvar`の試験メカニズムでは、宣言されたGo言語のバージョンは使用されません。
このメカニズムはプログラムのすべてのforループに新しいセマンティクスを条件なく適用します。
これにより、変更の最大の影響を特定するための最悪のケースの振る舞いが提供されます。

## 変更の影響を受けるコードの場所のリストを確認することはできますか？

はい、コマンドラインで`-gcflags=all=-d=loopvar=2`を使用してビルドすることで、変更の影響を受ける各ループに対して警告スタイルの出力が表示されます。以下はその例です。

```
	$ go build -gcflags=all=-d=loopvar=2 cmd/go
	...
	modload/import.go:676:7: loop variable d now per-iteration, stack-allocated
	modload/query.go:742:10: loop variable r now per-iteration, heap-allocated
```

all=はビルド内のすべてのパッケージの変更に関する情報を表示します。
`all=`を省略した場合、`-gcflags=-d=loopvar=2`のように指定すると、コマンドラインで指定したパッケージ（または現在のディレクトリのパッケージ）のみが診断情報を出力します。

## この変更でテストが失敗します。どうすればデバッグできますか？

テストが変更によって失敗する場合、`bisect`という新しいツールを使用して、プログラムの異なるサブセットに対して変更を適用し、どの特定のループがテストの失敗を引き起こしているかを特定できます。
失敗しているテストがある場合、`bisect`は問題を引き起こしている具体的なループを特定します。次のように使用します:

```console
go install golang.org/x/tools/cmd/bisect@latest
bisect -compile=loopvar go test
```

実際の例については、[このコメントのbisect transcriptセクション](https://github.com/golang/go/issues/60078#issuecomment-1556058025)を参照してください。
詳細については、[bisectのドキュメント](https://pkg.go.dev/golang.org/x/tools/cmd/bisect)をご覧ください。

## これは、ループの中で`x := x`と書く必要がなくなったということですか？

まだそうではありません。しかし、将来のバージョンのGoでは、おそらくGo 1.22であるかもしれませんが、その必要がなくなることを期待しています。

## どうすればフィードバックを送れますか？

フィードバックを送る方法は次の通りです。

[提案の問題](https://github.com/golang/go/issues/60078)は提案について議論するための場所です。
ただし、直感的または自然なものは何かについての議論は生産的ではないことに注意してください。
異なる人々は、何が直感的または自然であるかについて合理的に異なる意見を持つことがあります。

代わりに、議論に貢献できるもっとも重要なフィードバックは、 _実際のコードベースでの変更の使用に関する実証データ_ です。

- `GOEXPERIMENT=loopvar` でいくつのテストが失敗するようになったでしょうか？
- `GOEXPERIMENT=loopvar` によって正しいプロダクションコードが壊れたというよりも、バグのあるコードやテストを特定するために使われましたか？
- 重要な実世界のベンチマークのいずれかが大幅に遅くなったり、メモリを大幅に消費するようになったりしましたか？

このような具体的なデータを議論に寄与することが、もっとも重要なフィードバックです。
