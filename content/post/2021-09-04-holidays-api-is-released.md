---
layout: post
title: "祝日APIを公開しました"
slug: holidays-api-is-released
date: 2021-09-04 18:17:00 +0900
comments: true
categories: [aws, github]
---

プログラマーなら誰しも一度は祝日について頭を悩ませたことがあるでしょう(要出典)。

日付が固定ならまだ楽なんですが、「春分の日」「秋分の日」のように天体の運行によって決まる祝日があったり、
ハッピーマンデー制度によって「成人の日(一月の第二月曜日)」のような曜日固定の祝日があったり、
振替休日という概念があったりと、ちゃんと考えるとかなり面倒です。

更に面倒なのが国の施策によってたまに変更になるという点です。
東京オリンピックの延期で祝日が移動したのは記憶に新しいですね。
前年の 12 月 4 日に法律が公布されるという、カレンダーの印刷会社泣かせなスケジュール変更です。

- [2021 年の祝日移動について](https://www.kantei.go.jp/jp/headline/tokyo2020/shukujitsu.html)
- [東京五輪開催で夏の祝日が移動 〜各言語の祝日ライブラリの 2021 年の祝日対応を追ってみる〜](https://qiita.com/takaya1992/items/d1ee0d47795c1116f08d)

プログラムなら更新可能ですが、ライブラリとして組み込まれているとうっかり更新を忘れてしまうこともありますよね。
そういうわけで API として提供されていると嬉しいな、プログラミング言語に縛られることもないし、ということで作りました。

- [github.com/shogo82148/holidays-jp](https://github.com/shogo82148/holidays-jp)
- [holidays-jp.shogo82148.com](https://holidays-jp.shogo82148.com)

## 使い方

パスに日付を入力して GET リクエストを投げるだけのシンプルな API です。

### ある年の祝日一覧を取得する

`GET /{year}` で `year` の祝日一覧を返します。
以下は 2021 年の祝日一覧を返す例です。

```
curl https://holidays-jp.shogo82148.com/2021 | jq .
{
  "holidays": [
    {
      "date": "2021-01-01",
      "name": "元日"
    },
    {
      "date": "2021-01-11",
      "name": "成人の日"
    },
    {
      "date": "2021-02-11",
      "name": "建国記念の日"
    },
(snip)
    {
      "date": "2021-11-23",
      "name": "勤労感謝の日"
    }
  ]
}
```

### ある月の祝日一覧を取得する

`GET /{year}/{month}` で月の祝日一覧を返します。
以下は 2021 年 1 月の祝日一覧を返す例です。

```
curl https://holidays-jp.shogo82148.com/2021/01 | jq .
{
  "holidays": [
    {
      "date": "2021-01-01",
      "name": "元日"
    },
    {
      "date": "2021-01-11",
      "name": "成人の日"
    }
  ]
}
```

### ある日が祝日か調べる

`GET /{year}/{month}/{day}` でその日が祝日か調べることができます。
年・月とレスポンスの形式をあわせるために、必ず配列形式で返ってきます。
配列の件数で祝日・平日を判断してください。

祝日の例:

```
curl https://holidays-jp.shogo82148.com/2021/01/01 | jq .
{
  "holidays": [
    {
      "date": "2021-01-01",
      "name": "元日"
    }
  ]
}
```

平日の例:

```
curl https://holidays-jp.shogo82148.com/2021/02/01 | jq .
{
  "holidays": []
}
```

## 実装

最近マイブームな [Amazon API Gateway](https://aws.amazon.com/jp/api-gateway/) + [AWS Lambda](https://aws.amazon.com/jp/lambda/) による実装です。
AWS の設定管理には [AWS Serverless Application Model](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html)を利用しています。

データーソースには 2017 年の登場時にちょっと話題になった [syukujitsu.csv](https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv) を利用しています。

- [「国民の祝日」について - 内閣府](https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html)
- [祝日オープンデータを巡って](https://oku.edu.mie-u.ac.jp/~okumura/stat/holidays.html)
- [内閣府の「国民の祝日」の CSV がひどい。](https://twitter.com/i/events/834190855137226752)
  - 内閣府はもうちょっとがんばってください。→ その後、だいぶがんばってくれたようです（2017-03-03 追記）

2021-09-04 現在 syukujitsu.csv には昭和 30 年（1955 年）から令和 4 年（2022 年）までの祝日が含まれています。
この期間に関しては CSV から検索して祝日を返しています。
2023 年以降に関しては [国民の祝日に関する法律](https://elaws.e-gov.go.jp/document?lawid=323AC1000000178) をもとに計算して求めています。

さて、真面目に計算しているおかげで法律の改正まではうまく動く想定でいますが、
syukujitsu.csv が更新されたら改正がないかチェックしたいですね。
色々考えた結果 [Amazon EventBridge のスケジュールイベント](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-rule-schedule.html) をトリガーにして、 AWS Lambda → GitHub Repository dispatch → GitHub Actions で更新チェック、という形にしました。
ちょっと複雑ですね。なんでこんな面倒な構成に？とみなさん疑問を持つと思います。

syukujitsu.csv の定期更新はすでに先人がいるのですが、彼らの更新チェッカーを参考にした上でこうしました。

- [github.com/holidays-jp](https://github.com/holidays-jp)
  - travis-ci.org の CRON 機能を使って更新
  - しかし travis-ci.org のシャットダウンとともに更新停止している模様
  - 一応 [issue](https://github.com/holidays-jp/generator/issues/2) は切っておいた
- [github.com/holiday-jp/holiday_jp](https://github.com/holiday-jp/holiday_jp)
  - [GitHub Actions の Schedule Events](https://docs.github.com/en/actions/reference/events-that-trigger-workflows#scheduled-events) を利用
  - 毎日更新チェックが動いている
- [github.com/soh335/shukujitsu](https://github.com/soh335/shukujitsu)
  - [GitHub Actions の Schedule Events](https://docs.github.com/en/actions/reference/events-that-trigger-workflows#scheduled-events) を利用
  - [ワークフローの自動無効化機能](https://docs.github.com/en/actions/reference/usage-limits-billing-and-administration#disabling-and-enabling-workflows) によって最近まで更新停止してた
  - 5 日前に手動実行されてたので、少なくとも 60 日間は更新チェックが走るはず

無料で使える範囲だとサービスの都合で CRON ジョブが止められる可能性があるんですね・・・。
ただより高いものはない、ということで多少お金をかけてでもジョブが止まらないように工夫した結果が先の構成です(とは言っても 1 円/月もかからないと思ってる)。
ただし動かしたばかりなので、いつまでノーメンテで動き続けるかは要観察です。

## まとめ

祝日 API を公開しました。

- [github.com/shogo82148/holidays-jp](https://github.com/shogo82148/holidays-jp)
- [holidays-jp.shogo82148.com](https://holidays-jp.shogo82148.com)

できたてホヤホヤですが、ぜひご利用ください。

## 参考

- [github.com/shogo82148/holidays-jp](https://github.com/shogo82148/holidays-jp)
- [「国民の祝日」について - 内閣府](https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html)
- [暦要項](https://eco.mtk.nao.ac.jp/koyomi/yoko/)
- [2021 年の祝日移動について](https://www.kantei.go.jp/jp/headline/tokyo2020/shukujitsu.html)
- [東京五輪開催で夏の祝日が移動 〜各言語の祝日ライブラリの 2021 年の祝日対応を追ってみる〜](https://qiita.com/takaya1992/items/d1ee0d47795c1116f08d)
- [国民の祝日に関する法律 - e-Gov 法令検索](https://elaws.e-gov.go.jp/document?lawid=323AC1000000178)
- [長沢 工(1999) "日の出・日の入りの計算 天体の出没時刻の求め方" 株式会社地人書館](https://www.amazon.co.jp/%E6%97%A5%E3%81%AE%E5%87%BA%E3%83%BB%E6%97%A5%E3%81%AE%E5%85%A5%E3%82%8A%E3%81%AE%E8%A8%88%E7%AE%97%E2%80%95%E5%A4%A9%E4%BD%93%E3%81%AE%E5%87%BA%E6%B2%A1%E6%99%82%E5%88%BB%E3%81%AE%E6%B1%82%E3%82%81%E6%96%B9-%E9%95%B7%E6%B2%A2-%E5%B7%A5/dp/4805206349)
- [日本の祝日を JSON / CSV 形式で返す API](https://qiita.com/matsuoshi/items/7c19e7dcf404b7d921d6)
- [github.com/holidays-jp](https://github.com/holidays-jp)
- [github.com/holiday-jp](https://github.com/holiday-jp)
- [github.com/soh335/shukujitsu](https://github.com/soh335/shukujitsu)
- [祝日オープンデータを巡って](https://oku.edu.mie-u.ac.jp/~okumura/stat/holidays.html)
- [内閣府の「国民の祝日」の CSV がひどい。](https://twitter.com/i/events/834190855137226752)
  - 内閣府はもうちょっとがんばってください。→ その後、だいぶがんばってくれたようです（2017-03-03 追記）
- [Calendar::Japanese::Holiday](https://metacpan.org/pod/Calendar::Japanese::Holiday)
