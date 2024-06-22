---
layout: post
title: "TypeScriptで同時実行数を制限しながら並行実行する"
slug: 2024-06-22-limit-concurrency-in-typescript
date: 2024-06-22 11:01:00 +0900
comments: true
categories: [ typescript ]
---

タスクがたくさんあって並行実行することを考えます。
何も考えずにすべてのタスクを並行実行すると負荷が高すぎるので、
同時実行数を制限したいことがありました。

ググってみるといくつか実装例が見つかりますが、その多くは配列を受け入れるものです。
[AsyncIterator](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/AsyncIterator) を受け入れるバージョンが欲しいなと思い、
他の人の記事を参考に実装してみました。

## IteratorまたはIterableを受け入れる版

いきなりAsyncIterator版を実装するのは大変なので、Iterator版で練習してみました。
以下の関数 `limitConcurrency` は、タスクのIteratorまたはIterableを受け取って、並行実行します。

```typescript
async function limitConcurrency<T>(
  iter: Iterator<() => Promise<T>> | Iterable<() => Promise<T>>,
  limit: number
) {
  const iterator = Symbol.iterator in iter ? iter[Symbol.iterator]() : iter;
  async function runNext(): Promise<void> {
    for (;;) {
      const { value: task, done } = iterator.next();
      if (done) {
        return;
      }
      await task();
    }
  }

  try {
    const initialTasks: Promise<void>[] = [];
    for (let i = 0; i < limit; i++) {
      initialTasks.push(runNext());
    }

    await Promise.all(initialTasks);
  } finally {
    iterator.return?.();
  }
}
```

[Promise.all](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Promise/all) を使うことで、シンプルに書けました。
参考にした例では `new Promise` を使っていましたが、 `async` / `await` だけ使って実現するよう改良しました。
`new Promise` を使うと、例外が発生したときにスタックトレースが途中で途切れてしまうためです。

以下のようにして使います。

```typescript
function* taskGenerator(): Generator<() => Promise<void>> {
  for (let i = 0; i < 10; i++) {
    yield async () => {
      console.log(`Task ${i} started`);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1秒待つ
      console.log(`Task ${i} finished`);
    };
  }
}

const iterator = taskGenerator();
limitConcurrency(iterator, 2);
```

## AsyncIteratorまたはAsyncIterableを受け入れる版

以下の関数 `asyncLimitConcurrency` は `limitConcurrency` の AsyncIterator版です。

```typescript
async function asyncLimitConcurrency<T>(
  iter: AsyncIterator<() => Promise<T>> | AsyncIterable<() => Promise<T>>,
  limit: number
) {
  const iterator =
    Symbol.asyncIterator in iter ? iter[Symbol.asyncIterator]() : iter;
  async function runNext(): Promise<void> {
    for (;;) {
      const { value: task, done } = await iterator.next();
      if (done) {
        return;
      }
      await task();
    }
  }

  try {
    const initialTasks: Promise<void>[] = [];
    for (let i = 0; i < limit; i++) {
      initialTasks.push(runNext());
    }

    await Promise.all(initialTasks);
  } finally {
    iterator.return?.();
  }
}
```

以下は使用例です。

```typescript
async function* asyncTaskGenerator(): AsyncGenerator<() => Promise<void>> {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 100)); // 0.1秒待つ

    yield async () => {
      console.log(`Task ${i} started`);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1秒待つ
      console.log(`Task ${i} finished`);
    };
  }
}

const asyncIterator = asyncTaskGenerator();
asyncLimitConcurrency(asyncIterator, 2);
```

## 想定する用途

- タスクの一覧のネットワーク経由で取ってくるので、非同期処理が必要
- たくさんのタスクがあるので、ページネーションが必要

といった用途を想定しています。

たとえば[祝日API](https://shogo82148.github.io/blog/2021/09/04/holidays-api-is-released/)を使って祝日の一覧を取得し、
それぞれの祝日に対して時間のかかる処理を行う、というケースを考えてみます。
祝日APIで年をまたいで一覧を取得するにはページネーションが必要です。
祝日の処理には時間がかかるので並行実行したい。
でもあまり並列度が高いと困るので、並列度は制限したい。

全部の要件を一度に満たすのは大変ですが、 `asyncLimitConcurrency` を使えば以下のように書けます。

```typescript
async function* holidays(): AsyncGenerator<() => Promise<void>> {
  for (const year of [2024, 2025, 2026]) {
    // API経由で休日の一覧を取得する
    const response = await fetch(`https://holidays-jp.shogo82148.com/${year}`);
    const holidays = await response.json();

    // 各休日に対してなんらかの処理を行う
    for (const holiday of holidays.holidays) {
      yield async () => {
        // 時間のかかる処理がここに入る
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log(`${holiday.date} ${holiday.name}`);
      };
    }
    yield async () => {};
  }
}

asyncLimitConcurrency(holidays(), 3);
```

## まとめ

TypeScriptで同時実行数を制限しながら並行実行するプログラムを書いてみました。
ネットワーク経由のAPIを叩くときに重宝するのではと思ってます。

## 参考

- [JavaScriptで同時実行数を指定しつつ並行実行させる方法](https://www.kwbtblog.com/entry/2020/07/18/052836)
- [【JavaScript】指定した並列数で並列処理を行う関数](https://qiita.com/sdkei/items/6b8dccbc0d462c9eb0bd)
- [【備忘録】Javascriptで非同期処理を効率良くさばく方法](https://qiita.com/tonio0720/items/6f9319e4cce53256b4c9)
- [AsyncIterator](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/AsyncIterator)
- [Promise.all](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Promise/all)
- [祝日APIを公開しました](https://shogo82148.github.io/blog/2021/09/04/holidays-api-is-released/)
