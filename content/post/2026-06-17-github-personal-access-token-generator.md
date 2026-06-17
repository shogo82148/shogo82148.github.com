---
layout: post
title: "GitHub Personal Access Token を大量生成するプログラムを書いた"
slug: github-personal-access-token-generator
date: 2026-06-16 16:53:00 +0900
comments: true
categories: [go, golang, github]
---

## 背景・目的

APIトークンは他者に知られると悪用される可能性があるので、GitHub などにプッシュするのは厳禁です。
とはいえ人間が注意するのではうっかり混入する場合もあります。
これを機械的に防ごうというサービスが [GitHub Secret Protection](https://github.com/security/advanced-security/secret-protection?locale=ja) です。
公開レポジトリーならデフォルトで有効になっているので、普段気が付かずにお世話になっているサービスだと思います。

さて、GitHub Secret Protection でシークレットが検出された場合のフローを検証しているのですが、そのためには実際にシークレットをプッシュする必要があります。
実際に GitHub などのサービスでトークンを発行してプッシュするのが楽ですが、本物のトークンを使うのは怖いですよね？

じゃあ、ダミーデータを作ってみよう！というわけでやってみました。

## PAT生成機

GitHub の Personal Access Token (PAT) のジェネレーターを作ってみました。
そんな長くないので、ここにペタリと貼っておきます。
手元にコピペしてお使いください。

```go
// SPDX-FileCopyrightText: 2026 ICHINOSE Shogo <shogo82148@gmail.com>
// SPDX-License-Identifier: MIT

package main

import (
	"bufio"
	"crypto/rand"
	"encoding/base64"
	"hash/crc32"
	"os"
)

func base62(in uint32) []byte {
	const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
	var result [6]byte
	for i := 5; i >= 0; i-- {
		result[i] = chars[in%62]
		in /= 62
	}
	return result[:]
}

func randomString(length int) []byte {
	ret := make([]byte, 0, length)
	var buf1 [30]byte
	var buf2 [40]byte
	for {
		rand.Read(buf1[:])
		base64.RawStdEncoding.Encode(buf2[:], buf1[:])
		for _, ch := range buf2[:] {
			if (ch >= '0' && ch <= '9') || (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') {
				ret = append(ret, ch)
				if len(ret) == length {
					return ret
				}
			}
		}
	}
}

func main() {
	w := bufio.NewWriter(os.Stdout)
	for {
		random := randomString(30)
		checksum := crc32.ChecksumIEEE(random)
		w.WriteString("ghp_")
		w.Write(random)
		w.Write(base62(checksum))
		w.WriteByte('\n')
	}
}
```

実行すると永遠とPATを吐き続けるので、適宜 `head` コマンドなどで制限してください。

```plain
go run main.go | head -n 10
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
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
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
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
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
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
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
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
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
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
signal: broken pipe
```

手元のマシン（MacBook Pro 2021, Apple M1 Pro）では 100M個（1億個）のトークン生成に49.89秒かかりました。
1秒間に約2M個（200万個）生成できる計算です。

```plain
% time go run generate/main.go | head -n 100000000 > /dev/null
signal: broken pipe
go run generate/main.go  48.89s user 1.45s system 100% cpu 49.961 total
head -n 100000000 > /dev/null  5.58s user 2.66s system 16% cpu 49.957 total
```

これだけあれば検証仕放題ですね！

このブログは GitHub Pages でホストしているのですが、上に書いた実行例がさっそく引っかかりました。
期待通り動作していそうです。

```plain
$ git push
Enumerating objects: 8, done.
Counting objects: 100% (8/8), done.
Delta compression using up to 8 threads
Compressing objects: 100% (4/4), done.
Writing objects: 100% (5/5), 4.84 KiB | 4.84 MiB/s, done.
Total 5 (delta 2), reused 0 (delta 0), pack-reused 0 (from 0)
remote: Resolving deltas: 100% (2/2), completed with 2 local objects.
remote: error: GH013: Repository rule violations found for refs/heads/github-personal-access-token-generator.
remote:
remote: - GITHUB PUSH PROTECTION
remote:   —————————————————————————————————————————
remote:     Resolve the following violations before pushing again
remote:
remote:     - Push cannot contain secrets
remote:
remote:
remote:      (?) Learn how to resolve a blocked push
remote:      https://docs.github.com/code-security/secret-scanning/working-with-secret-scanning-and-push-protection/working-with-push-protection-from-the-command-line#resolving-a-blocked-push
remote:
remote:
remote:       —— GitHub Personal Access Token ——————————————————————
remote:        locations:
remote:          - commit:
remote:            path: :95
remote:
remote:        (?) To push, remove secret from commit(s) or follow this URL to allow the secret.
remote:        https://github.com/shogo82148/shogo82148.github.com/security/secret-scanning/unblock-secret/3FGSQxE1hq4JPtZZRtZEVlm3PNI
remote:
remote:
remote:
To ssh://github.com/shogo82148/shogo82148.github.com.git
```

## 仕組み

PATは `ghp_` から始まる40文字の文字列ですが、テキトーな文字列だと Secret Protection では検出してくれません。
誤検出を防ぐためにPATにはチェックサムが含まれているため、チェックサムまで一致しないとシークレットとしては扱われません。
このことは以下のブログで説明されています。

- [Behind GitHub’s new authentication token formats](https://github.blog/engineering/platform-security/behind-githubs-new-authentication-token-formats/)

要点だけまとめると、

- PAT は `ghp_` から始まる
- 30文字は `[a-zA-Z0-9]` の範囲のランダムな文字列
- 末尾の6桁は CRC32 を base62 エンコードしたもの

さて問題は **「CRC32 と言ってもいくつか種類がある」** という点と、 **「よく知られたbase62の規格は存在しない」** の二点です。

### CRC32

Wikipedia の [巡回冗長検査](https://ja.wikipedia.org/wiki/%E5%B7%A1%E5%9B%9E%E5%86%97%E9%95%B7%E6%A4%9C%E6%9F%BB) の項に書いてあるのですが、
CRC32に統一規格はなく、よく使われているものだけでも3種類あります。

> 巡回冗長検査は唯一の標準規格があるわけではなく、例えば CRC-12 では3種類の多項式が使われている。また、CRC-16 にはよく使われているものが8種類、CRC-32 は3種類存在する。

どれだ？！ってなったのですが、結論から言うと Wikipediaの記事にある `CRC-32`（gzip、zip、png等に使われているやつ）でした。

とりあえず一番使われていそうなやつ・・・と選んだらあたりでした。

### base62

base64やbase32であればRFCがあるので、そのとおりに実装すればよいですが、
base62にRFCのような規格はありません。

仕方がないので「入力が32ビット」「出力は6桁の英数字」という点から「自分だったらこう書くだろうなあ」を実装してみました。

```go
func base62(in uint32) string {
	const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
	var result [6]byte
	for i := 5; i >= 0; i-- {
		result[i] = chars[in%62]
		in /= 62
	}
	return string(result[:])
}
```

これが見事に当たりました。いやGitHubの中の人、素朴な実装をしてくれて助かった。

## チェッカー

PATを入力するとチェックサムが正しいかチェックしてくれるチェッカーも作ってみました。

```go
// SPDX-FileCopyrightText: 2026 ICHINOSE Shogo <shogo82148@gmail.com>
// SPDX-License-Identifier: MIT

package main

import (
	"bufio"
	"fmt"
	"hash/crc32"
	"log"
	"os"
	"strings"
)

func base62(in uint32) string {
	const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
	var result [6]byte
	for i := 5; i >= 0; i-- {
		result[i] = chars[in%62]
		in /= 62
	}
	return string(result[:])
}

func main() {
	s := bufio.NewScanner(os.Stdin)
	for s.Scan() {
		token := s.Text()
		if validateToken(token) {
			fmt.Printf("%s\tok\n", token)
		} else {
			fmt.Printf("%s\tng\n", token)
		}
	}
	if err := s.Err(); err != nil {
		log.Fatalf("reading standard input: %s", err)
	}
}

func validateToken(token string) bool {
	if !strings.HasPrefix(token, "ghp_") {
		return false
	}
	token = token[4:] // remove "ghp_"
	if len(token) != 36 {
		return false
	}
	token, checksum := token[:30], token[30:]
	expected := base62(crc32.ChecksumIEEE([]byte(token)))
	return checksum == expected
}
```

## まとめ

GitHub Secret Protection の検証のために、 GitHub Personal Access Token（PAT）のジェネレーターを作ってみました。
PATをプッシュするとどうなるのか検証したい方はぜひご活用ください。

また、ジェネレーターを作る過程でPATの設計の詳細も明らかになりました。
自分のサービスでアクセストークンを設計する場合の参考になりそうですね。

## 参考文献

- [GitHub Secret Protection](https://github.com/security/advanced-security/secret-protection?locale=ja)
- [Behind GitHub’s new authentication token formats](https://github.blog/engineering/platform-security/behind-githubs-new-authentication-token-formats/)
- [巡回冗長検査](https://ja.wikipedia.org/wiki/%E5%B7%A1%E5%9B%9E%E5%86%97%E9%95%B7%E6%A4%9C%E6%9F%BB)
