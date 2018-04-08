---
layout: post
title: "半自動トゥギャりスクリプトを書いてみた"
slug: semiauto-togetter
date: 2012-10-13T17:35:00+09:00
comments: true
categories: [togetter, bookmarklet]
---

## togetterでたくさんツイートをまとめたい

[Twitter][]は手軽に情報収集ができ他人とのコミニュケーションができる楽しいSNSですが、
古いツイートはしばらく経つとタイムラインや検索結果からはたどれなくなってしまいます。
過去のイベントに関するつぶやきを後から見たい、といった場合に不便です。

そこで登場するのが[togetter][]というサービス。
[Twitter][]のツイートを引用して、「まとめ」を作ることができます。
[Twitter][]上での議論やイベントに対するみんなの反応がわかりやすく見れるので便利です。
僕も[JO\_RI\_botのツイート](http://togetter.com/li/331948)をまとめたりといろいろとお世話になってます。

簡単なまとめを作るのには非常に便利な[togetter][]。
しかし、ツイート数が多くなると少し大変です。
例えば何かのイベントのハッシュタグのついたツイートをまとめたい場合、
検索に現れるツイートの数には上限があるので、
漏れ無くツイートを集めるにはイベントの最中にまとめを作る必要があります。
[togetter][]には自動更新機能がないので、数分毎に「検索」ボタンを押さなければなりません。
これは面倒だ・・・

## ブックマークレットを書いてみたよ

面倒なので、自動的に検索ボタンを押すブックマークレットを書いてみた。

** [ユーザスクリプトで書き直してみたよ！](/blog/2012/10/28/togetter-helper/) **

<!-- more -->

<script>
// 直接書くとなぜかうまくいかない・・・
document.write("<a href=\"javascript:(function(){function%20g(){$(&quot;#num_select_search&quot;).val(100);$(&quot;#results&quot;).html(&quot;&quot;);a.click();setTimeout(function%20b(){var%20a=[];$(&quot;#results%20.action_item&quot;).map(function(){a.push($(this))});if(a.length==0){setTimeout(b,1e3);return}var%20c=$(&quot;#choices&quot;);a.reverse();$.each(a,function(){var%20a=this.attr(&quot;id&quot;);if(f[a])return;c.append(this);f[a]=1});cre.update()},1e3)}var%20a=$(&quot;.search_button&quot;);var%20b=$(&quot;<div></div>&quot;).insertAfter(a);var%20c=$('<input%20type=&quot;text&quot;%20value=&quot;60&quot;>').appendTo(b);var%20d=$('<input%20type=&quot;button&quot;%20value=&quot;開始&quot;>').appendTo(b);var%20e;d.click(function(){if(e){clearInterval(e);d.attr(&quot;value&quot;,&quot;開始&quot;)}else{e=setInterval(g,c.val()*1e3);d.attr(&quot;value&quot;,&quot;停止&quot;);g()}});var%20f={}})()\">半自動トゥギャりスクリプト(このリンクをブックマーク！)</a>");
</script>

上のリンクをブックマークに登録しておき、[togetter][]のまとめ作成ページを開くと、
検索ボックスのしたにテキストボックスとボタンが追加されます。
テキストボックスに検索ボタンを押す間隔(秒単位)を入れ、開始ボタンを押すと、
自動的に検索・移動・重複ツイートの削除・ソートをしてくれます。

## スクリプト

元のスクリプトをgistにあげておきます。

{% gist 3883841 %}

ブラウザ拡張のほうが便利だろうけどブックマークレットとして実装しているのは、[togetter][]のスクリプトやjQueryを自前のスクリプトから呼びたかったから。
ブラウザ拡張でも実現する方法はあるんだろうけど、調べるの面倒だからやってない。
DOMの操作だけでもなんとかなりそうだから、余力があれば書きなおすかも。

これ作るにあたって、[togetter][]のソース見てたけど、重複削除やソートアルゴリズムがなんだか残念な感じ。
ツイート数に比例した回数だけjQueryのセレクタを呼び出している。
jQueryのセレクタって結構重い処理だし、オーダーが O( n^2 ) になるわけで・・・。
単なるソートにしては重すぎだろ、とは思ってはいたんだ。まさかこんな中身だとは。

[Twitter]: https://twitter.com/
[togetter]: http://togetter.com/

