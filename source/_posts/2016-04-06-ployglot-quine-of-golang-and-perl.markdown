---
layout: post
title: "PerlでもGoでも実行できるQuine書いた"
date: 2016-04-06 10:07
comments: true
categories: [perl, golang]
---

[昨日のPolyglot](http://shogo82148.github.io/blog/2016/04/05/polyglot-of-perl-and-golang/)を元にPerlでもGoでも実行できるQuine書いた。

<!-- More -->

```
package main;import("fmt");var(q=`printf'package main;import("fmt");var(q%c%c%s%c/*%c);sub import{}sub var{$_%cshift%c~s!%c(.*)%c/\*!$1!gr;eval}%c__END__%c',61,96,$_,96,61,61,61,96,96,10,10;print<DATA>`/*=);sub import{}sub var{$_=shift=~s!`(.*)`/\*!$1!gr;eval}
__END__
*/);func main(){s:=`package main;import("fmt");var(q=%c%s%c/*=);sub import{}sub var{$_=shift=~s!%c(.*)%c/\*!$1!gr;eval}
__END__
*/);func main(){s:=%c%s%c;fmt.Printf(s,96,q,96,96,96,96,s,96)}
`;fmt.Printf(s,96,q,96,96,96,96,s,96)}
```

Perlで実行してもGoで実行しても自分自身を出力します。
