---
layout: post
title: "GitHub Actionsの利用量をまとめる"
slug: 2023-06-22-github-actions-usage-report
date: 2023-06-22 11:45:00 +0900
comments: true
categories: [ github ]
---

[GitHub Actions](https://github.com/features/actions)の利用量は[settings/billing](https://github.com/settings/billing)から確認できます。

![今月分のGitHub Actions利用量、今月はあと3000分使える](/images/2023-06-22-github-actions-billing.png)

それはいいんですが、問題は**今月分しか確認できないこと！**

「先月は〇〇分使ったから上限いくらに設定しておくか〜〜」ということができません。
APIは見つけたので、取得スクリプトを組んでみました。

- [Get GitHub Actions billing for an organization](https://docs.github.com/en/rest/billing?apiVersion=2022-11-28#get-github-actions-billing-for-an-organization)


## 集計スクリプト

GitHub REST APIをたたいて、結果をGoogle Spreadsheetにまとめます。
GitHub REST APIを叩く部分はGitHub CLIを使えばすぐにできるんですが、
Google Spreadsheetへの書き込みをシェルスクリプトで組むのはちょっと大変です。

今回はGoで書いてみました。

```go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"google.golang.org/api/sheets/v4"
)

func main() {
	ctx := context.Background()
	token := os.Getenv("GITHUB_TOKEN")
	if token == "" {
		log.Fatal("GITHUB_TOKEN is required")
	}
	sheetID := os.Getenv("SHEET_ID")
	if sheetID == "" {
		log.Fatal("SHEET_ID is required")
	}
	org := os.Getenv("GITHUB_REPOSITORY_OWNER")
	if org == "" {
		log.Fatal("GITHUB_REPOSITORY_OWNER is required")
	}

	now := time.Now()
	usage, err := GetGitHubActionsBilling(ctx, token, org)
	if err != nil {
		log.Fatal(err)
	}

	svc, err := sheets.NewService(ctx)
	if err != nil {
		log.Fatal(err)
	}

	tableRange := "report!A1"
	var reportData sheets.ValueRange
	reportData.Values = append(reportData.Values, []any{
		now,
		usage.TotalMinutesUsed,
		usage.TotalPaidMinutesUsed,
		usage.IncludedMinutes,
		usage.MinutesUsedBreakdown["UBUNTU"],
		usage.MinutesUsedBreakdown["MACOS"],
		usage.MinutesUsedBreakdown["WINDOWS"],
	})
	_, err = svc.Spreadsheets.Values.Append(sheetID, tableRange, &reportData).
		ValueInputOption("USER_ENTERED").
		InsertDataOption("INSERT_ROWS").
		Context(ctx).
		Do()
	if err != nil {
		log.Fatal(err)
	}
}

type GitHubActionsBilling struct {
	TotalMinutesUsed     float64            `json:"total_minutes_used"`
	TotalPaidMinutesUsed float64            `json:"total_paid_minutes_used"`
	IncludedMinutes      float64            `json:"included_minutes"`
	MinutesUsedBreakdown map[string]float64 `json:"minutes_used_breakdown"`
}

func GetGitHubActionsBilling(ctx context.Context, token, org string) (*GitHubActionsBilling, error) {
	// build the request
	u := "https://api.github.com/orgs/" + org + "/settings/billing/actions"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	// send the request
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	// parse the response
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var usage *GitHubActionsBilling
	if err := json.Unmarshal(data, &usage); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}
	return usage, nil
}
```

## 認証設定

実行にはGitHubとGoogleへの認証情報が必要です。

GitHubは[settings/tokens](https://github.com/settings/tokens)からPAT(Personal access token)を取得し、
環境変数に設定します。

```console
export GITHUB_TOKEN=YOUR_GITHUB_TOKEN
```

Googleは`gcloud`コマンドを使います。
デフォルトの権限ではスプレッドシートへの書き込みができないので、スプレッドシートを書き込み権限をスコープに追加してログインします。

```console
gcloud auth application-default login \
    --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/spreadsheets
```

## 実行

他の必要なパラメーターは環境変数で設定します。

```console
export SHEET_ID=hogehoge
export GITHUB_REPOSITORY_OWNER=org
go run main.go
```

あとでGitHub Actionsで自動化することを想定して、オーガニゼーション名は`GITHUB_REPOSITORY_OWNER`から取得するようにしました。
実際にGitHub Actionsを使って動かすのはまた今度。

## まとめ

GitHub Actionsの利用量を記録するスクリプトを書きました。

---

ここまで書いたところで[GitHub public roadmap](https://github.com/orgs/github/projects/4247)に載っているのでは？と思ったら、
なんかそれっぽいのがありました。

- [Updated billing overview page #217](https://github.com/github/roadmap/issues/217)

![Billing Overview](https://user-images.githubusercontent.com/11078662/123352101-780aca00-d513-11eb-82ca-d83023adbbcd.png)

予定では「Q2 2023 – Apr-Jun」とありますが、最初公開されたときの予定はQ4 2021 – Oct-Dec。
そしてこの文章を書いているのは2023-06-22。
さて、僕のスクリプトが動き出すのとどっちが早いでしょう・・・？

## 参考

- [Get GitHub Actions billing for an organization](https://docs.github.com/en/rest/billing?apiVersion=2022-11-28#get-github-actions-billing-for-an-organization)
- [document - google.golang.org/api@v0.128.0/sheets/v4](https://pkg.go.dev/google.golang.org/api@v0.128.0/sheets/v4)
- [gcloud auth application-default login](https://cloud.google.com/sdk/gcloud/reference/auth/application-default/login)
- [OAuth 2.0 Scopes for Google APIs](https://developers.google.com/identity/protocols/oauth2/scopes)
- [Updated billing overview page #217](https://github.com/github/roadmap/issues/217)
