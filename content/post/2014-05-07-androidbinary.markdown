---
layout: post
title: "Androidのバイナリファイルを解析するgoのライブラリ"
slug: androidbinary
date: 2014-05-07T13:29:00+09:00
comments: true
categories: [android, go, golang]
---

Androidのアプリの実態はzipファイルなのでunzipすれば簡単に中身を見ることができるわけですが、
開いてもバイナリファイルが入っているだけでよくわかりません。
AndroidSDKに付属しているaaptというツールを使えば読めるんだけどインストールが大変で苦しんでいる人がいたので、
お手軽に解析できるgolangのライブラリを書いてみました。

<!-- More -->

## 使い方

### go getしてくる

[githubのレポジトリ](https://github.com/shogo82148/androidbinary) からダウンロードしてきます。

``` bash
go get github.com/shogo82148/androidbinary
```

### AndroidManifest.xmlを解析する

`io.ReaderAt`インターフェースを満たすオブジェクトを`androidbinary.NewXMLFile`に渡すと解析してくれます。

``` go
f, _ := os.Open("AndroidManifest.xml")
xmlFile, _ := androidbinary.NewXMLFile(f)
reader := xmlFile.Reader()
// reader を読むと普通のXMLファイルとして読める
```

### resources.arscを解析する

アプリ名などの設定はAndroidManifest.xmlには直接書かれておらず、
リソースファイルに書いてあることがほとんどです(開発者がよほどものぐさでなければ)。
リソースの情報はapk内のresources.arscに書かれているので、
このファイルを読む機能もついてます。

``` go
f, _ := os.Open("resources.arsc")
tableFile, _ := androidbinary.NewTableFile(f)

// ID 0x7F040000 に対応するリソースを読む
config := &androidbinary.ResTableConfig{}
val, _ := tableFile.GetResource(androidbinary.ResId(0x7f040000), config)
```

アプリ名はロケールによって変わったりするので、
`config`で設定できます。
例えば日本語の名前を取得したい場合はこんな感じ。

``` go
// ID 0x7F040000 に対応するリソース(日本語)を読む
config := &androidbinary.ResTableConfig{}
config.Language[0] = 'j'
config.Language[1] = 'a'
val, _ := tableFile.GetResource(androidbinary.ResId(0x7f040000), config)
```

### サンプルコード
apkを解析してアプリの日本語名を取得する例。

``` go
package main

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"github.com/shogo82148/androidbinary"
	"io/ioutil"
	"strconv"
)

type XMLManifest struct {
	XMLName      xml.Name          `xml:"manifest"`
	Applications []*XMLApplication `xml:"application"`
}

type XMLApplication struct {
	XMLName xml.Name `xml:"application"`
	Label   string   `xml:"http://schemas.android.com/apk/res/android label,attr"`
}

func main() {
	r, _ := zip.OpenReader("sample.apk")
	defer r.Close()

	// read manifest and resource
	var xmlFile *androidbinary.XMLFile
	var tableFile *androidbinary.TableFile
	for _, f := range r.File {
		switch f.Name {
		case "AndroidManifest.xml":
			rc, _ := f.Open()
			buf, _ := ioutil.ReadAll(rc)
			xmlFile, _ = androidbinary.NewXMLFile(bytes.NewReader(buf))
			rc.Close()
		case "resources.arsc":
			rc, _ := f.Open()
			buf, _ := ioutil.ReadAll(rc)
			tableFile, _ = androidbinary.NewTableFile(bytes.NewReader(buf))
			rc.Close()
		}
	}

	// parse xml
	decoder := xml.NewDecoder(xmlFile.Reader())
	xmlManifest := &XMLManifest{}
	decoder.Decode(xmlManifest)

	// get application label
	labelId, _ := strconv.ParseInt(xmlManifest.Applications[0].Label[3:], 16, 32)
	config := &androidbinary.ResTableConfig{}
	config.Language[0] = 'j'
	config.Language[1] = 'a'
	label, _ := tableFile.GetResource(androidbinary.ResId(labelId), config)
	fmt.Println("Application Name:", label)
}
```

エラー処理とか完全に省いているので上手く補ってください。


## 制限事項

GW中頑張ったけど途中で力尽きたので、今のところ以下のような制限があります。

- リソース名を扱えない
  - 普通AndroidManifest.xmlにリソースを埋め込むときは`@string/app_name`みたいな名前を埋め込みますが、リソースファイルとの連携機能がないため`@0x7F04000000`のような数値を返します
  - resources.arsc からリソース名を読み取ったり、リソース名からリソースを取得する機能はありません
- configの設定が一部しか対応していない
  - ロケール、画面サイズ、SDKバージョン等にしか対応してません
  - IMEの設定や画面の細かいオプションとかも指定はできるけど、`GetResource`が解釈してくれないので誤った結果を返すかも
- リソースタイプ
  - 文字列、整数、ブーリアン値にしか対応してません
  - string-array とかいうのとかあったりするけど、そんなの知らない

いろいろ制限はありますが、アプリ名を読み取ったり、パーミッションを解析するくらいはできるんじゃないですかね。
golang初心者なのでイケてないところがあったら教えて下さい。

## 参考

- [エンコードされた AndroidManifest.xml を読む](http://dsas.blog.klab.org/archives/52011424.html)
- [ruby_apk Android::Resource can relate string pool (partially)](https://gist.github.com/cielavenir/4365521)
