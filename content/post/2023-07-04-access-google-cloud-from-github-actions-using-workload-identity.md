---
layout: post
title: "GitHub ActionsからWorkload Identityを使ってGCPにアクセスする"
slug: 2023-07-04-access-google-cloud-from-github-actions-using-workload-identity
date: 2023-07-04 11:45:00 +0900
comments: true
categories: [github]
---

[GitHub Actionsの利用量をまとめる]ではGitHub Actionsの使用量をGoogle Spreadsheetにまとめるスクリプトを書きました。
このときは動作確認ができればよかったので、自分のGoogleアカウントで認証して書き込みを行いました。
しかし、このスクリプトを定期的に実行するのも面倒です。

そこでGitHub Actionsのスケジュール実行機能を使い、毎日使用量を記録する設定を行いました。
イマドキAPIキーを使うのはリスクが高いので、Google Cloudの[Workload Identity連携]を使ってアクセスします。

## Workload Identity 連携の構成

[GitHub Actions からのキーなしの認証の有効化]を参考にGoogle Cloud側の設定を行います。
設定内容をバージョン管理したいので、設定にはTerraformを使用します。
意外と作成するリソースが多くて大変なので、[GitHub OIDC Terraform Module]と[Project API Activation Terraform Module]を利用してみましょう。

```hcl
provider "google" {
  batching {
    enable_batching = false
  }
}

# Google Cloudのプロジェクト
resource "google_project" "my_project" {
  name            = "my-project"
  project_id      = "my-project"
}

# サービスアカウント
resource "google_service_account" "github_actions" {
  project    = google_project.my_project.id
  account_id = "github-actions"
}

# サービスAPIの有効化設定
module "project_services" {
  source  = "terraform-google-modules/project-factory/google//modules/project_services"
  version = "14.2.0"

  project_id = google_project.my_project.project_id

  activate_apis = [
    # GitHub Actions OIDC tokensを使ってGitHubからのアクセスを許可するために必要
    # https://github.com/terraform-google-modules/terraform-google-github-actions-runners/tree/005bd0220a2ba38768b90b43751fa2e6e6a84f45/modules/gh-oidc#requirements
    "iam.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",

    # スプレッドシートへの書き込みに必要
    "sheets.googleapis.com",
  ]
}

# GitHub OIDCの設定
module "gh_oidc" {
  source      = "terraform-google-modules/github-actions-runners/google//modules/gh-oidc"
  version     = "3.1.1"
  project_id  = var.project_id
  pool_id     = "gh-pool"
  provider_id = "gh-provider"
  sa_mapping = {
    # <user>/<repo> GitHubレポジトリからサービスアカウントへの委任を許可する設定
    (google_service_account.github_actions.account_id) = {
      sa_name   = google_service_account.github_actions.name
      attribute = "attribute.repository/<user>/<repo>"
    }
  }
}
```

Google Cloudの設定をひととおり終えたら、サービスアカウントからGoogle Spreadsheetにアクセスできるよう、
共同編集者にサービスアカウントを追加してあげましょう。

## GitHub Actionsの設定

IDトークンを取得してGoogle Cloudへのアクセス設定するには[google-github-actions/auth]アクションを使います。

```yaml
on:
  schedule:
    - cron: "0 15 * * *" # every day at 00:00 JST
  workflow_dispatch:

permissions:
  contents: "read"
  id-token: "write"

jobs:
  billing-actions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-go@v4

      - id: "auth"
        name: "Authenticate to Google Cloud"
        uses: "google-github-actions/auth@v1"
        with:
          workload_identity_provider: "projects/<project_number>/locations/global/workloadIdentityPools/gh-pool/providers/gh-provider"
          service_account: "github-actions@<project_id>.iam.gserviceaccount.com"

      - name: run billing-actions
        env:
          GITHUB_TOKEN: ${{ secrets.YOUR_PAT }}
          SHEET_ID: "YOUR_SHEET_ID"
        run: |
          go run main.go
```

GitHub Actions標準の権限ではオーガニゼーションの設定にアクセスできないので、SecretにPAT(Personal Access Token)の登録が必要です。

これで日本時間の0時ごろにGitHub Actionsの使用量が記録されます。

## まとめ

[Workload Identity連携]を使ってGitHub ActionsからGoogle Cloudへアクセスしてみました。

---

完全に余談なんですが、GitHub OIDCのSubject claimは以下のようなパターンがあり、だいぶ複雑です（参考: [Example subject claims]）。

- `repo:octo-org/octo-repo:environment:Production`: Environment
- `repo:octo-org/octo-repo:pull_request`: Pull Request
- `repo:octo-org/octo-repo:ref:refs/heads/demo-branch`: Push Branches
- `repo:octo-org/octo-repo:ref:refs/tags/demo-tag`: Push Tags

連携先によっては「`repo:octo-org/octo-repo:*`でパターンマッチせよ」とドキュメントに書いてあります。
僕は「**これ非常に危うい方法だな**」と常々思っています。
ユーザー名やレポジトリ名を慎重にバリデーションしておかないとインジェクション攻撃できる危険性があったり、
`repo:octo-org/octo-repo*`のような設定ミス（`*`の前に`:`が抜けている）に気が付かなかったりするからです。
インジェクション攻撃に関してはGitHub側で対策済みですが（~~もちろん試した~~）、設定ミスは自分たちで気をつけないとダメです。

そういうわけで、本来は「**claimと完全一致するか**」をチェックするべきだと思ってます。

## 参考

- [GitHub Actionsの利用量をまとめる]
- [Workload Identity連携]
- [GitHub Actions からのキーなしの認証の有効化]
- [GitHub OIDC Terraform Module]
- [Project API Activation Terraform Module]
- [google-github-actions/auth]
- [Example subject claims]

[GitHub Actionsの利用量をまとめる]: https://shogo82148.github.io/blog/2023/06/22/2023-06-22-github-actions-usage-report/
[Workload Identity連携]: https://cloud.google.com/iam/docs/configuring-workload-identity-federation?hl=ja
[GitHub Actions からのキーなしの認証の有効化]: https://cloud.google.com/blog/ja/products/identity-security/enabling-keyless-authentication-from-github-actions
[GitHub OIDC Terraform Module]: https://github.com/terraform-google-modules/terraform-google-github-actions-runners/tree/master/modules/gh-oidc
[Project API Activation Terraform Module]: https://github.com/terraform-google-modules/terraform-google-project-factory/tree/master/modules/project_services
[google-github-actions/auth]: https://github.com/google-github-actions/auth
[Example subject claims]: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect#example-subject-claims
