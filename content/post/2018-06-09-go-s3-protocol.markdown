---
layout: post
title: "GoでHTTPとS3を透過的に扱う"
slug: go-s3-protocol
date: 2018-06-09 07:29:00 +0900
comments: true
categories: [go, golang]
---

Goの [`http.Transport` には `RegisterProtocol` というメソッドが生えていて](https://golang.org/pkg/net/http/#Transport.RegisterProtocol) これを使うと、
HTTP以外のプロトコルを透過的に扱うことができます。
代表的なのは `http.NewFileTransport` で、これを使うと、`file://path/to/file.txt` みたいなURLでファイルにアクセスすることができます。
([Goオフィシャルの例](https://golang.org/pkg/net/http/#NewFileTransport))
この仕組を使って、S3へのアクセスも透過的にできるようにしてみたので、メモ。

新しいプロトコルを作成するのは非常に簡単です。
`http.RoundTripper`インターフェースを実装し、リクエストに応答するレスポンスを作ってあげればいいだけです。
S3の場合以下のようになります。(エラー時の扱いが雑だけど・・・)

```go
package main

import (
	"net/http"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
)

type s3RoundTripper struct {
	s3 *s3.S3
}

func newS3RoundTripper(session *session.Session) http.RoundTripper {
	return &s3RoundTripper{
		s3: s3.New(session),
	}
}

func (rt *s3RoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	host := req.Host
	if host == "" {
		host = req.URL.Host
	}
	path := req.URL.Path

	ctx := req.Context()
	out, err := rt.s3.GetObjectWithContext(ctx, &s3.GetObjectInput{
		Bucket: aws.String(host),
		Key:    aws.String(path),
	})
	if err != nil {
		return nil, err
	}
	header := make(http.Header)
	header.Set("Content-Type", *out.ContentType)

	return &http.Response{
		Status:        "200 OK",
		StatusCode:    200,
		Proto:         "HTTP/1.0",
		ProtoMajor:    1,
		ProtoMinor:    0,
		Header:        header,
		Body:          out.Body,
		ContentLength: *out.ContentLength,
	}, nil
}
```

あとはRegisterProtocolを呼び出してあげれば、HTTPアクセスと同様にS3のオブジェクトを扱えます。

```go
package main

import (
	"os"
	"net/http"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
)

func main() {
	// s3 scheme の登録
	awsConfig := aws.NewConfig().WithRegion("ap-northeast-1")
	awsSession := session.Must(session.NewSession(awsConfig))
	http.DefaultTransport.(*http.Transport).RegisterProtocol("s3", newS3RoundTripper(awsSession))

	// s3 sheme でアクセス
	resp, err := http.Get("s3://backetname/your/file")
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()
	io.Copy(os.Stdout, resp.Body)
}
```
