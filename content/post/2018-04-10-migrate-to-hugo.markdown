---
layout: post
title: "OctopressからHugoに乗り換えた"
slug: migrate-to-hugo
date: 2018-04-10 07:49:00 +0900
comments: true
categories: [hugo, go, golang]
---

OctopressからHugoに乗り換えました。
以下のような理由からです。

- Rubyの環境をメンテナンスし続けるのが面倒
- 最近Octopress自体の更新が滞っている
- ビルド時間が長い

一番最初の理由が大きくて、いつもビルドしていた環境を壊してしまって修復が面倒になってしまいました。
そこでようやく重い腰を上げて移行したというわけです。

## 移行手順

OctopressからHugoへの移行は先人たちがたくさんいるので、それを参考にします。

```bash
# 記事のコピー
cp octopress-site/source/_posts/* hugo-site/content/post/

# 画像のコピー
cp -r octopress-site/source/images/* hugo-site/static/images/

# 記事のタイムスタンプの形式を変える
# Hugoでは、"2016-09-25T15:09:57"のような形式のタイムスタンプでないとパースに失敗します
find . -type f -exec sed -i "" -e 's/date: \([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}\) \([0-9]\{2\}:[0-9]\{2\}\)$/date: \1T\2:00+09:00/g' {} \;
```

パーマネントリンクを維持するために [OctopressからHugoへ移行する方法](https://gam0022.net/blog/2016/09/25/migrated-from-octopress-to-hugo/)
のRubyスクリプトを利用させていただきました。

```ruby
dir = 'content/post/'
Dir::foreach(dir) do |filename|
  if filename =~ /\.markdown$/
    slug = filename.gsub(/\d{4}-\d{2}-\d{2}-/, '').sub('.markdown', '')
    puts "#{filename} : #{slug}"

    lines = []
    File::open(dir + filename) do |f|
      f.each do |line|
        lines << line
      end
    end

    File::open(dir + filename, 'w') do |f|
      lines.each_with_index do |line, i|
        f.puts("slug: #{slug}") if i == 3
        f.print(line)
      end
    end
  end
end
```

このスクリプトを利用すると、記事に `slug` 属性が設定されるので、
パーマネントリンクの一部として使うように設定ファイルに以下の設定を追加します。

```toml
[permalinks]
  post = "/blog/:year/:month/:day/:slug"
```

テーマには [hugo-octopress](https://themes.gohugo.io/hugo-octopress/) を採用しました。
なんでも良かったんですが、とりあえずDisqus対応が必要だったので。
Disqus対応のいいテーマが見つかればそっちに移行するかもしれません。


## 独自拡張機能の移行

### シンタックスハイライト

コードスニペットをバッククオート3つで囲む記法(CodeFences)をつかっていたので、
`pygmentsCodeFences` オプションで有効にします。
また、デフォルトではすべて見た目がプレーンテキストになってしまうので、
`pygmentsUseClasses` オプションでシンタックスハイライトを有効化します。

```toml
pygmentsUseClasses = true
pygmentsCodeFences = true
```

`pygmentsUseClasses` オプションが有効な場合、カラースタイルを選ぶ必要があります。
今回は `monokai` を採用しました。

```bash
hugo gen chromastyles --style=monokai > syntax.css
```

### MathJax

このブログでは数式を書くためにOctopressのMathJax拡張を入れてあったので、
[MathJax with Hugo](https://gohugo.io/content-management/formats/#mathjax-with-hugo) を参考に
MathJaxを入れます。

具体的には以下のようなコードをフッターに挿入しました。

```html
<!-- MathJax https://gohugo.io/content-management/formats/#mathjax-with-hugo -->
<script type="text/x-mathjax-config">
MathJax.Hub.Config({
  tex2jax: {
    inlineMath: [['$','$'], ['\\(','\\)']],
    displayMath: [['$$','$$'], ['\[','\]']],
    processEscapes: true,
    processEnvironments: true,
    skipTags: ['script', 'noscript', 'style', 'textarea', 'pre'],
    TeX: { equationNumbers: { autoNumber: "AMS" },
         extensions: ["AMSmath.js", "AMSsymbols.js"] }
  }
})
</script>

<script type="text/x-mathjax-config">
MathJax.Hub.Queue(function() {
  // Fix <code> tags after MathJax finishes running. This is a
  // hack to overcome a shortcoming of Markdown. Discussion at
  // https://github.com/mojombo/jekyll/issues/199
  let all = MathJax.Hub.getAllJax()
  for(let o of all.length) {
      o.SourceElement().parentNode.className += ' has-jax'
  }
})
</script>

<script type="text/javascript" async src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.3/MathJax.js?config=TeX-AMS-MML_HTMLorMML">
</script>
```

ほぼHugoのドキュメントどおりですが、一箇所だけ調整が必要でした。

```diff
-  for(i = 0; i < all.length; i++) {
-    all[i].SourceElement().parentNode.className += ' has-jax';
+  for(let o of all.length) {
+    o.SourceElement().parentNode.className += ' has-jax'
```

なぜこんな書き換えが必要だったかというと、Goのテンプレートエンジンが `<` を `&lt;` に書き換えてしまうからです。
scriptタグの中身は実質JavaScriptなので、本来このようなエスケープは不要です。
Goのテンプレートエンジンは賢いので、コンテキストを考慮してJavaScriptはJavaScript用のエスケープルールを適用してくれるのですが、
`type="text/x-mathjax-config"` になっているからか、HTMLの一部として解釈されてしまったようです。

仕方がないので、 `<` を使わずに同じことを行うスクリプトへ書き換えました。


### OEmbed拡張

数も多くないので、Grepして手作業で全部置き換えました 😇
こういう拡張って追加できるんですかね？

## 参考

- [OctopressからHugoへ移行する方法](https://gam0022.net/blog/2016/09/25/migrated-from-octopress-to-hugo/)
- [Syntax Highlighting](https://gohugo.io/content-management/syntax-highlighting/)
- [MathJax with Hugo](https://gohugo.io/content-management/formats/#mathjax-with-hugo)
- [hugo-octopress](https://themes.gohugo.io/hugo-octopress/)
