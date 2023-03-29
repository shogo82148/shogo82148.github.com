---
layout: post
title: "GitHubに接続したらWARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!と怒られる件"
slug: 2023-03-24-github-identification-has-changed
date: 2023-03-24 17:13:00 +0900
comments: true
categories: [ git, github ]
---

## TL;DR

SSH経由でGitHubに接続したら、以下のメッセージが表示されました。

```plain
% ssh -T github.com
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
IT IS POSSIBLE THAT SOMEONE IS DOING SOMETHING NASTY!
Someone could be eavesdropping on you right now (man-in-the-middle attack)!
It is also possible that a host key has just been changed.
The fingerprint for the RSA key sent by the remote host is
SHA256:uNiVztksCsDhcc0u9e8BujQXVUpKZIDTMczCvj3tD2s.
Please contact your system administrator.
Add correct host key in /Users/shogo.ichinose/.ssh/known_hosts to get rid of this message.
Offending RSA key in /Users/shogo.ichinose/.ssh/known_hosts:1
Host key for github.com has changed and you have requested strict checking.
Host key verification failed.
```

どうやら、GitHubのSSHサーバーの公開鍵が変更されたようです。

- [We updated our RSA SSH host key | The GitHub Blog](https://github.blog/2023-03-23-we-updated-our-rsa-ssh-host-key/)

ブログ記事にしたがって、以下のコマンドを実行すると治ります。

```
$ ssh-keygen -R github.com
$ curl -L https://api.github.com/meta | jq -r '.ssh_keys | .[]' | sed -e 's/^/github.com /' >> ~/.ssh/known_hosts
```

「ssh-keygenでいけました」と言って安心している **そこのあなた** 。
そう、あなたです。
重要なのは2つ目のコマンドです。

`~/.ssh/known_hosts` に追加された内容が、 **以下のテキストと一字一句同じか確認** してください。

```
github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl
github.com ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSENjQEezOmxkZMy7opKgwFB9nkt5YRrYMjNuG5N87uRgg6CLrbo5wAdT/y6v0mKV0U2w0WZ2YB/++Tpockg=
github.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCj7ndNxQowgcQnjshcLrqPEiiphnt+VTTvDP6mHBL9j1aNUkY4Ue1gvwnGLVlOhGeYrnZaMgRK6+PKCUXaDbC7qtbW8gIkhL7aGCsOr/C56SJMy/BCZfxd1nWzAOxSDPgVsmerOBYfNqltV9/hWCqBywINIR+5dIg6JTJ72pcEpEjcYgXkE2YEFXV1JHnsKgbLWNlhScqb2UmyRkQyytRLtL+38TGxkxCflmO+5Z8CSSNY7GidjMIZ7Q4zMjA2n1nGrlTDkzwDCsw+wqFPGQA179cnfGWOWRVruj16z6XyvxvjJwbz0wQZ75XK5tKSb7FNyeIEs4TT4jk+S4dhPeAUC5y+bDYirYgM4GC7uEnztnZyaVWQ7B381AK4Qdrwt51ZqExKbQpTUNn+EjqoTwvqNj4kqx5QUCI0ThS/YkOxJCXmPUWZbhjpCg56i+2aB6CmK2JGhn57K5mj0MNdBXA4/WnwH6XoPWJzK5Nyu2zB3nAZp+S5hpQs+p1vN1/wsjk=
```

`~/.ssh/known_hosts` に追加された内容が、 **以下のテキストと一字一句同じか確認** してください。

```
github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl
github.com ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSENjQEezOmxkZMy7opKgwFB9nkt5YRrYMjNuG5N87uRgg6CLrbo5wAdT/y6v0mKV0U2w0WZ2YB/++Tpockg=
github.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCj7ndNxQowgcQnjshcLrqPEiiphnt+VTTvDP6mHBL9j1aNUkY4Ue1gvwnGLVlOhGeYrnZaMgRK6+PKCUXaDbC7qtbW8gIkhL7aGCsOr/C56SJMy/BCZfxd1nWzAOxSDPgVsmerOBYfNqltV9/hWCqBywINIR+5dIg6JTJ72pcEpEjcYgXkE2YEFXV1JHnsKgbLWNlhScqb2UmyRkQyytRLtL+38TGxkxCflmO+5Z8CSSNY7GidjMIZ7Q4zMjA2n1nGrlTDkzwDCsw+wqFPGQA179cnfGWOWRVruj16z6XyvxvjJwbz0wQZ75XK5tKSb7FNyeIEs4TT4jk+S4dhPeAUC5y+bDYirYgM4GC7uEnztnZyaVWQ7B381AK4Qdrwt51ZqExKbQpTUNn+EjqoTwvqNj4kqx5QUCI0ThS/YkOxJCXmPUWZbhjpCg56i+2aB6CmK2JGhn57K5mj0MNdBXA4/WnwH6XoPWJzK5Nyu2zB3nAZp+S5hpQs+p1vN1/wsjk=
```

大事なので2回いいました。

-----

コピペで済まそうと思ったあなた！

ちゃんとGitHubが公開している情報を参照しましょう。
一次情報をチェックしましたか？
https://api.github.com/meta からコピーしてきてください。

## 解説

(2023-03-29追記)

より詳しく解説してくれている人を見つけました。この件についてもっと知りたい人はこちらを参照しましょう。

- [GitHubからfetch/pullできなくなった場合の対処（2023/03/24秘密鍵公開）](https://qiita.com/ktateish/items/c986891e429469c7105c)

(追記ここまで)

WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!というメッセージは
**中間者攻撃を受けている可能性がある** という警告です。
今回の場合は「今接続しているサーバーはGitHubではないぞ！！」という意味です。
この警告が表示されるということは、 **別の誰かが情報を盗もうとしている** かもしれません。

このブログの最初に貼った警告メッセージを読むと、このことについてしっかり書いてあります。
英語で書いてあるからと読み飛ばしてしまったひとはいませんか？
一応和訳（by [DeepL](https://www.deepl.com/translator)）も貼っておきますね。

> 誰かが何か悪さをしている可能性があります！
> 誰かが今まさにあなたのことを盗聴している可能性があります（中間者攻撃）！
> また、ホストの鍵が変更されたばかりである可能性もあります。
> リモートホストから送信されたRSA鍵のフィンガープリントは以下の通りです。
> SHA256:uNiVztksCsDhcc0u9e8BujQXVUpKZIDTMczCvj3tD2s。
> システム管理者にお問い合わせください。
> このメッセージを消すには、/Users/shogo.ichinose/.ssh/known_hostsに正しいホスト鍵を追加してください。
> /Users/shogo.ichinose/.ssh/known_hostsにある問題のあるRSAキー：1
> github.comのホスト鍵が変更されたため、厳密なチェックを要求しています。
> ホスト鍵の検証に失敗しました。

## 原因

もっとも、この警告が表示されただけでは可能性があるというだけで、これだけは中間者攻撃だと言い切ることはできません。
さいわい今回のケースは中間者攻撃ではなく、GitHubのミスだったようです。

- [We updated our RSA SSH host key | The GitHub Blog](https://github.blog/2023-03-23-we-updated-our-rsa-ssh-host-key/)

> This week, we discovered that GitHub.com’s RSA SSH private key was briefly exposed in a public GitHub repository.

> 今週、GitHub.comのRSA SSH秘密鍵が一時的にパブリックなGitHubリポジトリで公開されていたことがわかりました。(ChatGPTに「和訳して」ってお願いした)

GitHubでもこんな初歩的なミスをするんですね・・・。
SSH秘密鍵が第三者に流出した可能性があるので、GitHubが秘密鍵を変更したようです。

ここで注意してほしいのは、「GitHubのミスだから警告は無視してOK」ではないという点です。
単に無視するだけでは駄目で、「接続先が正しいか」を確認するまでがセットです。
@kazuhoさんもつぶやいているように、fingerprintを確認しましょう。

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">「公式アナウンスを確認せずに、known_hostsアップデートした人いませんよね？」<br>「アナウンス確認するだけじゃダメでは？」<br>「どういうこと？」<br>「アナウンスに含まれる鍵と、自分がsshで受け取る鍵のfingerprintを確認しないとダメ。攻撃者目線だと、今は中間者攻撃のチャンスなんやで」 <a href="https://t.co/GYxgfYWkyv">https://t.co/GYxgfYWkyv</a></p>&mdash; Kazuho Oku (@kazuho) <a href="https://twitter.com/kazuho/status/1639141406387359747?ref_src=twsrc%5Etfw">March 24, 2023</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script> 

確認済みの公開鍵を `~/.ssh/known_hosts` に追加しておくと、次回から自動的にチェックしてくれます。
追加の方法は最初のセクションに書いたとおりです。

## まとめ

GitHubの公開鍵が変更されました。
`known_hosts` の変更で対応できます。

`~/.ssh/known_hosts` に追加された内容が、 **以下のテキストと一字一句同じか確認** してください。

```
github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl
github.com ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSENjQEezOmxkZMy7opKgwFB9nkt5YRrYMjNuG5N87uRgg6CLrbo5wAdT/y6v0mKV0U2w0WZ2YB/++Tpockg=
github.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCj7ndNxQowgcQnjshcLrqPEiiphnt+VTTvDP6mHBL9j1aNUkY4Ue1gvwnGLVlOhGeYrnZaMgRK6+PKCUXaDbC7qtbW8gIkhL7aGCsOr/C56SJMy/BCZfxd1nWzAOxSDPgVsmerOBYfNqltV9/hWCqBywINIR+5dIg6JTJ72pcEpEjcYgXkE2YEFXV1JHnsKgbLWNlhScqb2UmyRkQyytRLtL+38TGxkxCflmO+5Z8CSSNY7GidjMIZ7Q4zMjA2n1nGrlTDkzwDCsw+wqFPGQA179cnfGWOWRVruj16z6XyvxvjJwbz0wQZ75XK5tKSb7FNyeIEs4TT4jk+S4dhPeAUC5y+bDYirYgM4GC7uEnztnZyaVWQ7B381AK4Qdrwt51ZqExKbQpTUNn+EjqoTwvqNj4kqx5QUCI0ThS/YkOxJCXmPUWZbhjpCg56i+2aB6CmK2JGhn57K5mj0MNdBXA4/WnwH6XoPWJzK5Nyu2zB3nAZp+S5hpQs+p1vN1/wsjk=
```

-----

コピペで済まそうと思ったあなた！

ちゃんとGitHubが公開している情報を参照しましょう。
一次情報をチェックしましたか？
https://api.github.com/meta からコピーしてきてください。

## 参考

- [We updated our RSA SSH host key | The GitHub Blog](https://github.blog/2023-03-23-we-updated-our-rsa-ssh-host-key/)
- [Add new public key for known_hosts #1237](https://github.com/actions/checkout/pull/1237)
- [GitHubからfetch/pullできなくなった場合の対処（2023/03/24秘密鍵公開）](https://qiita.com/ktateish/items/c986891e429469c7105c)
