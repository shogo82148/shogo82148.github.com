---
layout: post
title: "スーパー楕円をベジェ曲線で近似してみる"
slug:
date: 2021-01-29 22:01:00 +0900
comments: true
categories: []
---

最近アプリの UI で角丸アイコンを見ることが多くなりました。
この角は完全な円ではなく、スーパー楕円というものだという情報を入手しました。

- [スーパー楕円 UI を iOS+Swift で実装する](https://spinners.work/posts/swift-superellipse/)
- [丸よりも丸みを感じる!? スーパー楕円の魅力とデザイン](https://www.spinners.work/posts/kudakurage-superellipse-desgin/)

記事の中ではベジェ曲線で近似する方法が書かれています。
なるほど、こうすれば描けるのか！と関心したので、自分でもベジェ曲線で描いてみることにしました。

## スーパー楕円

スーパー楕円というのは円の方程式を以下のように拡張したものです。

{% math %}
\left|\frac{x}{a}\right|^n + \left|\frac{y}{b}\right|^n = 1
{% endmath %}

n は曲線を制御するパラメーターで n=2 は円となり、n>2 の場合は円と四角形のあいだのような形になります。
n が大きいほど四角形に近づいていきます。

## 3 次のベジェ曲線

Illustrator のようなベクターツールではおなじみのベジェ曲線です。
ベジェ曲線は任意の次数に拡張することができますが、コンピューターグラフィックスで多く用いられるのは 3 次ベジェ曲線です。

制御点を {% m %} \boldsymbol{B}\_0, \boldsymbol{B}\_1, \boldsymbol{B}\_2, \boldsymbol{B}\_3 {% em %} とした場合の
3 次ベジェ曲線の数式を具体的に書き下すと以下のようになります。

{% math %}
\boldsymbol{P}(t) = \boldsymbol{B}\_0(1-t)^3 + \boldsymbol{B}\_1 3t(1-t)^2 + \boldsymbol{B}\_2 3t^2(1-t) + \boldsymbol{B}\_3 t^3
{% endmath %}

## 近似してみる

以下の記事と同じ戦略で近似してみます。

- [ベジェ曲線による円の描画の制御点の位置はなぜ 0.55228…なのか?](https://cat-in-136.github.io/2014/03/bezier-1-kappa.html)

スーパー楕円は左右対称・上下対象なので、第一象限の形だけ求めれば十分です (x > 0, y > 0 )。
またアフィン変換に対して不変なので a = b = 1 の場合のみを考えます。

{% math %}
x^n + y^n = 1 (x > 0, y > 0)
{% endmath %}

ベジェ曲線の制御点は両端でスーパー楕円に接するよう、以下のように定めます。

- B0: (0, 1)
- B1: (k, 1)
- B2: (1, k)
- B3: (1, 0)

k はベジェ曲線の制御ハンドルの長さです。
曲線の中間点でスーパー楕円とベジェ曲線が一致するような k を求めます。

ベジェ曲線の中間点は、ベジェ曲線の式で t = 0.5 とすれば、

{% math %}
\boldsymbol{P}(0.5) = \frac{1}{8}(\boldsymbol{B}\_0 + 3\boldsymbol{B}\_1 + 3\boldsymbol{B}\_2 + \boldsymbol{B}\_3)
{% endmath %}

スーパー楕円の中間点は x = y となる点なので、

{% math %}
x = y = \frac{1}{{}^n\sqrt{2}}
{% endmath %}

x 成分について比較すると

{% math %}
\frac{1}{{}^n\sqrt{2}} = \frac{1}{8}(0 + 3k + 3 + 1)
{% endmath %}

{% math %}
k = \frac{8}{3}\left(\frac{1}{{}^n\sqrt{2}}-\frac{1}{2}\right)
{% endmath %}

n = 2 の場合は k = 0.5522847498307932... となります。
これは円を近似した場合の制御点の位置と一致するので、合っていそうです。

参考にした記事では n = 2.5 のスーパー楕円を描くのに「1.25 倍の円を描いてアンカーポイントを移動する」という方法が紹介されています。
n = 2.5 の場合 k = 0.6876220886805309... となり、これは円の場合の約 1.245 倍です。
1.25 に近い数字が出てきましたね。

## やってみた

SVG で簡単なアニメーションを作ってみました。
赤い線がスーパー楕円、黒がベジェ曲線での近似です。 n = 2 〜 5 の範囲でパラメーターをいじっています。

![](/images/2021-01-29-super-ecllipse.svg)

n が 2 に近いときはそこそこ近いですが、大きくなると結構差が出ます。
半径 200px, 線の太さ 3px で描画したところ、大きいところでは線一本分くらいズレる感じです。
半径に対してだいたい誤差 1〜2% というところでしょうか。

## まとめ

スーパー楕円をベジェ曲線で近似してみました。
以下のように k を計算して、制御点の位置を計算するとだいたいそれっぽくなります。

{% math %}
k = \frac{8}{3}\left(\frac{1}{{}^n\sqrt{2}}-\frac{1}{2}\right)
{% endmath %}

「真ん中で一致する」という雑な近似方法なので本物とは少しズレますが、
大体の目安にどうぞ。

まあ、そもそもベジェ曲線一本での近似は限界があるし、
スーパー楕円は手段であって目的ではないので、これ以上こだわっても意味ない気がしてきた。

## 参考

- [ベジェ曲線による円の描画の制御点の位置はなぜ 0.55228…なのか?](https://cat-in-136.github.io/2014/03/bezier-1-kappa.html)
- [スーパー楕円 UI を iOS+Swift で実装する](https://spinners.work/posts/swift-superellipse/)
- [丸よりも丸みを感じる!? スーパー楕円の魅力とデザイン](https://www.spinners.work/posts/kudakurage-superellipse-desgin/)
- [Superellipse](https://en.wikipedia.org/wiki/Superellipse)
- [Bézier curve](https://en.wikipedia.org/wiki/B%C3%A9zier_curve)
- [Desperately seeking squircles](https://www.figma.com/blog/desperately-seeking-squircles/)
  - Figma による iOS7 から導入された Continuous Corner Curve の解析記事
  - (まだちゃんと読めていない、英語難しい)
