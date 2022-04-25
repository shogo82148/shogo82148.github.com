---
layout: post
title: "jq の引数を省略したときの挙動が違う件"
slug: 2022-04-25-jq-program
date: 2022-04-25 20:28:00 +0900
comments: true
categories: [jq]
---

JSONを加工するときに [jq](https://github.com/stedolan/jq) は必須の存在になりました。
[jqハンドブック](www.amazon.co.jp/dp/4877834915) なんてものが発売されるくらいですからね。

そんな jq なんですが、[@Gaku07jp](https://twitter.com/Gaku07jp) が [AWS CloudShell](https://docs.aws.amazon.com/cloudshell/latest/userguide/welcome.html) 上で
期待どおりに動かない、と困ってました。
なんでこんな挙動になるのかなーと気になったので、調査してみたメモです。

## 症状

問題となったのはこんな感じのシェルスクリプトです。

```bash
FOO=$(echo '{}' | jq)
```

普段開発で使用している macOS 上では `FOO={}` と展開されるのですが、 CloudShell 上では jq のヘルプメッセージが表示されます (2022-04-25現在)。

```bash
# CloudShell 上
$ FOO=$(echo '{}' | jq)
jq - commandline JSON processor [version 1.5]
Usage: jq [options] <jq filter> [file...]

(...snip...)
```

## 原因

直接の原因は引数を省略してしまったことです。
jq の第一引数には jq の式が必要です。単に整形したい場合は `jq .` とすればOKです。

```bash
FOO=$(echo '{}' | jq .)
```

## macOS と CloudShell の違い

スクリプトが動かない直接の原因はわかったものの、同じ jq なのに、なぜこのような違いが生まれるのか気になりますよね？
というわけでソースコードを追ってみました。

ヒントは問題のシェルスクリプトを実行したときに表示された、ヘルプメッセージにあります。
CloudShell の jq は version 1.5 と少し古いバージョンです。
一方、弊社では macOS の jq は brew 経由でインストールしているので、最新版の version 1.6 がインストールされています。

```bash
# macOS 上
$ jq
jq - commandline JSON processor [version 1.6]

Usage:	jq [options] <jq filter> [file...]
	jq [options] --args <jq filter> [strings...]
	jq [options] --jsonargs <jq filter> [JSON_TEXTS...]

(...snip...)
```

なるほど、この間になにか修正が入ったんだな？と、差分を確認してみました。

- [jq-1.5...jq-1.6](https://github.com/stedolan/jq/compare/jq-1.5...jq-1.6)

挙動から推測するに「入出力が TTY か」で条件分岐しているんだろうなと当たりをつけ、差分をザーッと眺めてみると、ありました！
usage を表示する部分が以下のように変更されていました。

```diff
@@ -457,18 +558,12 @@ int main(int argc, char* argv[]) {
   else
     jq_set_attr(jq, jv_string("VERSION_DIR"), jv_string_fmt("%.*s-master", (int)(strchr(JQ_VERSION, '-') - JQ_VERSION), JQ_VERSION));
 
-#if (!defined(WIN32) && defined(HAVE_ISATTY)) || defined(HAVE__ISATTY)
-
-#if defined(HAVE__ISATTY) && defined(isatty)
-#undef isatty
-#define isatty _isatty
-#endif
-
-  if (!program && isatty(STDOUT_FILENO) && !isatty(STDIN_FILENO))
+#ifdef USE_ISATTY
+  if (!program && (!isatty(STDOUT_FILENO) || !isatty(STDIN_FILENO)))
     program = ".";
 #endif
 
-  if (!program) usage(2);
+  if (!program) usage(2, 1);
 
   if (options & FROM_FILE) {
     char *program_origin = strdup(program);
```

[git blame して](https://github.com/stedolan/jq/blame/f9afa950e26f5d548d955f92e83e6b8e10cc8438/src/main.c#L608-L613) この変更が入ったコミットを見てみると、
以下のプルリクエストで取り込まれたものでした。

- [Assume . if either stdin/on isatty() (fix #1028) #1030](https://github.com/stedolan/jq/pull/1030)
- [Redirecting or piping output has different behaviour #1028](https://github.com/stedolan/jq/issues/1028)

version 1.5 と version 1.6 の違いをまとめると、こんな感じになります。

- `echo '{}' | jq > foo` → version 1.5 では usage が表示される。version 1.6 では、ファイル `foo` にJSONのパース結果が保存される
- `jq > foo` → version 1.5 では usage が表示される。 version 1.6 では jq が入力待ち状態になり、ファイル `foo` にJSONのパース結果が保存される
- `echo '{}' | jq` → version 1.5, 1.6 ともにJSONのパース結果が出力される
- `jq` → version 1.5, 1.6 ともに usage が表示される

## まとめ

macOS 上と CloudShell 上で jq の挙動が違うのは、 jq のバージョンの違いが原因でした。
jq version 1.5 と version 1.6 では、入出力が TTY の場合の挙動が少し変わっています。

さて、標準で jq version 1.5 がインストールされる主要な Linux ディストリビューションとして、 Ubuntu 18.04 LTS と RHEL7 があります。
Ubuntu 18.04 LTSのサポート期限は2023年4月、RHEL7のサポート期限が2024年6月30日なので、
あと 1〜2年は jq version 1.5 がインストールされた環境が残るわけですね(その後なくなるとは言っていない)。
ちょっとした違いですが注意しましょう。

個人的には `jq .` と必ず引数を渡すのが良いと思います。
「この場合は省略できるんだけっけ・・・？」と考える必要がないので、楽ちんです。

## 参考

- [stedolan/jq](https://github.com/stedolan/jq)
- [jq 1.6](https://github.com/stedolan/jq/releases/tag/jq-1.6)
- [Assume . if either stdin/on isatty() (fix #1028) #1030](https://github.com/stedolan/jq/pull/1030)
- [Redirecting or piping output has different behaviour #1028](https://github.com/stedolan/jq/issues/1028)
- [jqハンドブック](www.amazon.co.jp/dp/4877834915)
