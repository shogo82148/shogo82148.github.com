---
layout: post
title: "ランダム抽出アルゴリズムについて考える"
date: 2013-07-13T22:13:00+09:00
comments: true
categories: [perl]
---

数日前に社内IRCで「スマートな非復元抽出の方法はないか」と話題になったので、
ランダムサンプリングのアルゴリズムについて調べたり考えたりしてみた。

<!-- More -->

## 復元抽出
非復元抽出の手法って調べてもなかなか出てこない・・・。
ひとまず、復元抽出についてまとめてみましょう。

### 線形検索

一番簡単な実装方法。
どの区間に入るかを線形検索して求める。
選択肢の個数nとすると計算量はO(n)。

``` perl linear_search_method.pl
use strict;
use warnings;
use List::Util qw(sum);

sub linear_search_method {
    my $weights = shift;
    my $num = shift;
    my $sum = sum @$weights;
    my $length = @$weights;
    my @a;

    for (1..$num) {
        my $r = rand($sum);
        for my $i(0..$length-1) {
            $r -= $weights->[$i];
            if($r < 0) {
                push @a, $i;
                last;
            }
        }
    }
    return \@a;
}

print join ', ', @{linear_search_method [1,2,3], 100};
```

### バイナリサーチ

あらかじめ累積分布表を作っておき、どの区間に入るかをバイナリサーチ。
準備にO(n)、選択に O(log n)かかる。

``` perl binary_search_method.pl
use strict;
use warnings;
use List::Util qw(sum);

sub binary_search_method {
    my $weights = shift;
    my $num = shift;
    my $length = @$weights;
    my @a;
    my @b;

    my $sum = 0;
    for my $i(@$weights) {
        push @a, $sum;
        $sum += $i;
    }
    push @a, $sum;

    for (1..$num) {
        my $r = rand($sum);
        my ($l, $h) = (0, $length + 1);
        while($h - $l > 1) {
            my $i = ($l + $h) >> 1;
            if($r < $a[$i]) {
                $h = $i;
            } else {
                $l = $i;
            }
        }
        push @b, $l;
    }
    return \@b;
}

print join ', ', @{binary_search_method [1,2,3], 100};
```

### Walker's alias method

今回調べて初めて知ったアルゴリズム。
準備にO(n)、ランダム選択はなんと定数時間O(1)でできる。

``` perl walers_alias_method.pl
use strict;
use warnings;
use List::Util qw(sum);

sub walkers_alias_method {
    my $weights = shift;
    my $num = shift;
    my $sum = sum @$weights;
    my $length = @$weights;

    my @p = map { $_ / $sum * $length} @$weights;
    my @a = (0..$length-1);

    my ($h, $l) = (0, $length - 1);
    my @hl;
    for my $i(0..$length-1) {
        if ( $p[$i] >= 1) {
            $hl[$h++] = $i;
        } else {
            $hl[$l--] = $i;
        }
    }

    while($h != 0 && $l != $length - 1) {
        my ($j, $k) = @hl[$l+1, $h-1];
        $a[$j] = $k;
        $p[$k] += $p[$j] - 1;
        $l++;
        if ( $p[$k] < 1 ) {
            $hl[$l--] = $k;
            $h--;
        }
    }

    return [map {
        my $r = rand($length);
        my $k = int($r);
        $r -= $k;
        $r < $p[$k] ? $k : $a[$k];
    } 1..$num];
}

print join ', ', @{walkers_alias_method [1,2,3], 100};
```

## 非復元抽出

復元抽出のアルゴリズムを応用して、非復元抽出について考えてみましょう。
一度出たものが2回でないよう、出たものの重みを0にします。

### 線形検索

線形検索の場合は、重みリストをほぼそのまま使っているので、更新は簡単。
一度出たものの重みを0にして、総和を更新するだけ。

``` perl linear_method.pl
use strict;
use warnings;
use List::Util qw(sum);

sub linear_method {
    my $weights = shift;
    my $num = shift;
    my $sum = sum @$weights;
    my $length = @$weights;
    my @w = @$weights;
    my @a;

    for (1..$num) {
        my $r = rand($sum);
        for my $i(0..$length-1) {
            $r -= $w[$i];
            if($r < 0) {
                push @a, $i;

                 # 一度出たものの重みを0にする
                $sum -= $w[$i];
                $w[$i] = 0;
                last;
            }
        }
    }
    return \@a;
}

print join ',', linear_method([1 .. 100000], 500);
```

### 二分木

バイナリサーチでは累積分布表を作成したけど、
これの更新にはO(n)かかってしまうのでバイナリサーチの意味がなくなってしまう。
そこで重みを二分木を使って管理することで、O(log n)で重みの更新ができる。

``` perl tree.pl
use strict;
use warnings;
use List::Util qw(sum);

sub binary_search_method {
    my $weights = shift;
    my $num = shift;
    my $length = @$weights;

    # 二分木を構築
    my @left_weight = (0) x ($length * 2);
    my @right_weight = ((0) x $length, @$weights);
    for (my $i = $length-1; $i>0; --$i) {
        $left_weight[$i] = $left_weight[$i*2] + $right_weight[$i*2];
        $right_weight[$i] = $left_weight[$i*2+1] + $right_weight[$i*2+1];
    }

    my @a;
    for (1..$num) {
        # 二分木から検索
        my $i = 1;
        my $r = rand($left_weight[$i] + $right_weight[$i]);
        while($i < $length) {
            if($r < $left_weight[$i]) {
                $i = $i * 2;
            } else {
                $r -= $left_weight[$i];
                $i = $i * 2 + 1;
            }
        }
        push @a, $i - $length;

        # 木を更新
        my $w = $weights->[$i-$length];
        while($i > 0) {
            if($i % 2 == 0) {
                $left_weight[$i>>1] -= $w;
            } else {
                $right_weight[$i>>1] -= $w;
            }
            $i >>= 1;
        }
    }

    return \@a;
}

print join ',', binary_search_method([1..100000], 500);
```

## その他

Walker's alias method でも更新法を考えたけど、
テーブルを一から再生成する以外にいい方法が思いつかない。

抽出が高速であるという特徴を利用して、
同じ物が出たらもう一度実行するというのが手っ取り早そう。
Walker's alias method が必要なときは n が十分に大きいはずなので、
重複が起こる確率は小さく、これで十分なきがする。


## まとめ

<table>
<tr>
  <th>手法</th><th>準備</th><th>抽出</th><th>重み更新</th>
</tr>
<tr>
  <td>線形検索</td><td>O(n)</td><td>O(n)</td><td>O(1)</td>
</tr>
<tr>
  <td>バイナリサーチ</td><td>O(n)</td><td>O(log n)</td><td>O(log n)</td>
</tr>
<tr>
  <td>Walker's alias</td><td>O(n)</td><td>O(1)</td><td>O(n)</td>
</tr>
</table>

## 参考

* [比較的高速な復元抽出アルゴリズム](http://d.hatena.ne.jp/koiti_yano/20070826/p1)
* [efficiency of sample() with prob](http://tolstoy.newcastle.edu.au/R/devel/05/06/1403.html)
