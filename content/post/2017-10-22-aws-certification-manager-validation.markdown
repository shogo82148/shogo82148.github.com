---
layout: post
title: "ACMのドメイン検証をシミュレートするやつ書いた"
slug: aws-certification-manager-validation
date: 2017-10-22 15:45:02 +0900
comments: true
categories: [go, golang]
---

始まりは一件のメールから。

> Title: Action Required - Your certificate renewal
> 
> Greetings from Amazon Web Services,
> 
> You have an AWS Certificate Manager (ACM) provided SSL/TLS certificate in your AWS account that expires on Nov 04, 2017 at 12:00:00 UTC. That certificate has the following domains:
> example.com, *.example.com
> 
> AWS account ID: xxxxxx
> AWS Region name: us-east-1
> Certificate identifier: arn:aws:acm:us-east-1:xxxxxx:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
> 
> Therefore, ACM has initiated the process to renew this certificate. You must take the action below before Nov 04, 2017 at 12:00:00 UTC to avoid certificate expiration, which might cause your website to become unreachable.
> To complete the renewal of this certificate, the domain owners must use the approval link that was sent in separate validation request emails. Those emails were last sent on Sep 20, 2017 at 12:11:48 UTC.
> 以下略

要約すると、AWS Certificate Manager (以下ACM)で管理している証明書の自動更新に失敗したので、
手動更新をしてくれとのこと。

このメールの対応方法についてのメモと、次回から自動更新に成功するようおこなった設定について書きます。
ついでに確認用のツールも作ったので、その紹介も。

- [shogo82148/go-acm-checker](https://github.com/shogo82148/go-acm-checker)

<!-- More -->

## 手動での対応方法

メール以下のページへのリンクが貼られているので、これに従えば基本的にはOK。

- [I didn't receive a validation email for the SSL certificate I requested through AWS Certificate Manager](https://aws.amazon.com/jp/premiumsupport/knowledge-center/resend-email-ssl/)

日本語だと Developers.IO さんの記事が詳しいです。

- [ACMで管理されているSSL/TLS証明書の自動更新失敗について](https://dev.classmethod.jp/etc/acm-expire-cation/)

> 1. AWSマネジメントコンソールにログイン
> 2. Certificate Managerを選択
> 3. 更新対象の証明書チェックボタンを選択
> 4. [アクション]-[検証Eメールの再送信]を選択
> 5. 検証メールアドレスに送信された「Certificate approval for <ドメイン名>」に記載されている「Amazon Certificate Approvals」を選択
> 6. 承認ページが表示されますので、ドメイン名・AWSアカウントID・証明書識別子に相違がないことを確認して「I Approve」を選択
> 7. 「Success」が表示されることを確認
> 8. Certificate Managerに戻って頂き、証明書の更新ステータスが「成功」になっていることを確認


## 頑張って自動更新を有効にする

しかしまあ、更新作業が面倒でACMを使っているというのに、
13ヶ月ごとに更新作業をするのは面倒です。

以下のドキュメントを参考に、自動更新が有効になるよう設定しましょう。

- [自動検証のためにドメインを設定する](http://docs.aws.amazon.com/ja_jp/acm/latest/userguide/configure-domain-for-automatic-validation.html)

> - ACM によって証明書の各ドメインと HTTPS 接続を確立できる必要があります。
> - 各接続では、返される証明書が ACM が更新している証明書と一致する必要があります。

## 証明書のシリアル番号チェッカーを書いてみた

HTTPS接続の確立は `curl` を使って一発ですが、
「返される証明書が ACM が更新している証明書と一致する」のを確認するのはなかなか骨です。
一応、Chromeのデベロッパーコンソール→Securityタブ→View Certificate→詳細な情報→シリアル番号と辿っていけば、
ACMに表示されているシリアル番号との一致を確認できます。
コンソールから確認できないものかと少しググったのですが、見つけられませんでした。

ということで、Go言語でシリアル番号を表示するツールをサクッと書いてみました。
`go run main.go https://example.com` で実行できます。
こういうのがすぐに書けるのがGoのいいところですね。

``` go
package main

import (
	"fmt"
	"net/http"
	"os"
	"strings"
)

func main() {
	http.DefaultClient.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		return http.ErrUseLastResponse
	}

	resp, err := http.Get(os.Args[1])
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	serial := resp.TLS.PeerCertificates[0].SerialNumber.Bytes()
	s := make([]string, 0, len(serial))
	for _, b := range serial {
		s = append(s, fmt.Sprintf("%02x", b))
	}
	fmt.Println(strings.Join(s, ":"))
}
```

## 自動検証シミュレーター

複数のドメインを管理しているとシリアル番号の確認をするのも面倒になってきたので、
ACMに登録されている証明書を検証するシミュレーターを書いてみました。

- [shogo82148/go-acm-checker](https://github.com/shogo82148/go-acm-checker)

Go製のツールなので、おなじみの`go get`でインストールできます。

``` plain
go get -u github.com/shogo82148/go-acm-checker
```

実行するとACMで管理されている証明書の情報を全リージョンから取ってきて、
検証を試みます。
検証に成功すると以下のようなメッセージが表示されます。

```
$ go-acm-checker
2017/10/21 14:30:04 success to validate example.com(arn:aws:acm:us-east-1:1234567890:certificate/00000000-0000-0000-0000-000000000000)
```

検証に失敗すると、どのドメインの検証に失敗したかを教えてくれます。

```
$ go-acm-checker
2017/10/21 14:30:05 failed to validate example.com
2017/10/21 14:30:05 failed to validate *.example.com
2017/10/21 14:30:05 failed to validate example.com(arn:aws:acm:us-east-1:1234567890:certificate/00000000-0000-0000-0000-000000000000)
```

検証に失敗した場合、「[自動検証のためにドメインを設定する](http://docs.aws.amazon.com/ja_jp/acm/latest/userguide/configure-domain-for-automatic-validation.html)」を参考に、
`https://example.com/` や `https://www.example.com/` に正常にアクセスできる状態にしてください。


## まとめ

AMCの手動更新の方法と、自動更新を有効化するための方法を簡単にまとめてみました。
なお、 [shogo82148/go-acm-checker](https://github.com/shogo82148/go-acm-checker) で検証成功したからといって、
ACMの検証が必ず成功するとは限りません。
自動更新だからと油断せずに、こまめにメールはチェックしましょうね。

(ちなみに今回メールが来たドメインは自動更新できるように設定し直したけど、自動更新のタイミングがよくわからないので、いつ手動更新をやるかチキンレースの真っ最中です・・・)
