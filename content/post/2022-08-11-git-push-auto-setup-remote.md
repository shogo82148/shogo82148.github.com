---
layout: post
title: "git push のときに自動的にリモートブランチを作成する設定"
slug: 2022-08-11-git-push-auto-setup-remote
date: 2022-08-11 16:08:00 +0900
comments: true
categories: [ git ]
---

Git 2.37.0 から `git push` に `--set-upstream origin` が要らなくなったという話。
出典はこちらのツイート:

<blockquote class="twitter-tweet"><p lang="en" dir="ltr">With the newest version of Git 2.37.0, you can run just &quot;git push&quot; to push new branches. No more &quot;--set-upstream origin&quot;. Enable with:<br><br>git config --global --add --bool push.autoSetupRemote true <a href="https://t.co/1SzIqzvEFR">pic.twitter.com/1SzIqzvEFR</a></p>&mdash; James Ide (@JI) <a href="https://twitter.com/JI/status/1546948817462800384?ref_src=twsrc%5Etfw">July 12, 2022</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script> 

-----

ツイッターだけだと忘れてしまうので、検索用のメモ。

Git のデフォルトの設定では、
`git push` のときに upstream が設定されていないと「`--set-upstream origin` をつけて再実行してくれ」と
怒られます。
v2.37.0 から、これを自動的に行うオプションが追加されたらしいです。

```
$ git config --global --add --bool push.autoSetupRemote true
```

有効化すると自動的にリモートブランチを設定してくれます。

```
$ git push
Total 0 (delta 0), reused 0 (delta 0), pack-reused 0
remote:
remote: Create a pull request for 'example' on GitHub by visiting:
remote:      https://github.com/shogo82148/shogo82148.github.com/pull/new/example
remote:
To ssh://github.com/shogo82148/shogo82148.github.com.git
 * [new branch]          example -> example
branch 'example' set up to track 'origin/example'.
```

ちなみに `push.autoSetupRemote` を設定せずに `git push` を実行した場合、
エラーメッセージに
「`push.autoSetupRemote` オプションのヘルプを見てくれ」
という一文が追加されたようです。
設定名を教えてくれるのは親切ですね。

```
$ git push
fatal: The current branch example has no upstream branch.
To push the current branch and set the remote as upstream, use

    git push --set-upstream origin example

To have this happen automatically for branches without a tracking
upstream, see 'push.autoSetupRemote' in 'git help config'.
```

該当する項は以下の通りです。

> If set to "true" assume --set-upstream on default push when no upstream tracking exists for the current branch; this option takes effect with push.default options simple, upstream,
> and current. It is useful if by default you want new branches to be pushed to the default remote (like the behavior of push.default=current) and you also want the upstream tracking
> to be set. Workflows most likely to benefit from this option are simple central workflows where all branches are expected to have the same name on the remote.
