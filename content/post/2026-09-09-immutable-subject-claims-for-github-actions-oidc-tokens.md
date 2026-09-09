---
layout: post
title: "新規レポジトリーで GitHub Actions のOIDCフェデレーションが動かなくなった件"
slug: immutable-subject-claims-for-github-actions-oidc-tokens
date: 2026-09-09 19:42:00 +0900
comments: true
categories: [github, github-actions]
---

## 背景

新しいウェブサイトを立ち上げようと、GitHubのレポジトリーを新規作成して、GitHub Actions から Amazon S3 へデプロイするワークフローを組みました。
いつものように AWS OIDC フェデレーションを設定したのですが、認証に失敗してしまいました。

## 原因

（Codex先生に訪ねたところ）原因は ID トークンの Subject クレームの形式が変更になったことでした。

- [Immutable subject claims for GitHub Actions OIDC tokens](https://github.blog/changelog/2026-04-23-immutable-subject-claims-for-github-actions-oidc-tokens/)
- [変更できないサブジェクト要求](https://docs.github.com/ja/actions/reference/security/oidc#immutable-subject-claims)

以前までは `repo:octocat/my-repo:ref:refs/heads/main` のような形式だったのが、
`repo:octocat@123456/my-repo@456789:ref:refs/heads/main` のようなユーザーID・レポジトリーIDが入った形式に変更になりました。
7月15日以降に新規作成したレポジトリーでは新形式が使用されます。
古いレポジトリーに関しては新形式の利用はオプトインで、引き続き古い Subject クレームが使用されます。

CloudTrail のログを Codex先生に渡したら、Web検索してすぐに原因を突き止めてくれました。
賢いですね。

## 対応

今回のケースでは IAM ロールを CloudFormation のテンプレートで管理していました。

```yaml
Resources:
  GitHubActionsWebntpDeployRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: GitHubActionsWebntpDeploy
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Effect: Allow
            Principal:
              Federated: !Sub arn:${AWS::Partition}:iam::${AWS::AccountId}:oidc-provider/token.actions.githubusercontent.com
            Action: sts:AssumeRoleWithWebIdentity
            Condition:
              StringEquals:
                "token.actions.githubusercontent.com:aud": sts.amazonaws.com
                "token.actions.githubusercontent.com:sub": repo:shogo82148/webntp.shogo82148.com:ref:refs/heads/main
        Policies:
          # 略
```

CloudFormationのレンプレートの信頼ポリシーを、新形式のSubjectクレームに設定し直せばOKです。

```diff
             Condition:
               StringEquals:
-                "token.actions.githubusercontent.com:sub": repo:shogo82148/webntp.shogo82148.com:ref:refs/heads/main
+                "token.actions.githubusercontent.com:sub": repo:shogo82148@1157344/webntp.shogo82148.com@1360340997:ref:refs/heads/main
```

## ユーザーIDとかレポジトリーIDとかどこに書いてあるの？

自分のユーザーIDとかレポジトリーIDとか言われても知らない人がほとんどだと思います。
ウェブ画面のわかりやすいところに表示されていませんからね。

REST APIから確認できるほか、じつはウェブの設定画面からも確認可能です。

### ウェブ画面

レポジトリーの Settings > Actions > OIDC と辿っていくと確認できます。

![古いレポジトリーのOIDC設定画面。Default subject claim prefixにSubjectクレームのPrefixが書かれている](/images/2026-09-09-old-repository.png)

古いレポジトリーに関してはここから新形式へのオプトインも可能です。
Use immutable subject claim にチェックを入れることで、新形式のSubjectクレームを利用できます。

ちなみに新しいレポジトリーでは Use immutable subject claim がグレーアウトしており、変更することはできませんでした。

![新しいレポジトリーのOIDC設定画面。Use immutable subject claim がグレーアウトしており変更できない](/images/2026-09-09-new-repository.png)

### REST API

レポジトリーの詳細APIを叩けばユーザーIDやレポジトリーIDの確認はできますが、
一番確実なのはOIDCの設定APIを叩いて Default subject claim prefix を確認することでしょう。

```shell
gh api \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  /repos/{owner}/{repo}/actions/oidc/customization/sub
```

`"sub_claim_prefix"` でウェブの設定画面と同等の情報が得られます。
古いレポジトリーでは古いSubjectクレーム形式で表示されるので、
「このレポジトリーは新旧どっちのSubjectクレームを使っているんだ？」と迷わずにすみます。

```json
{
  "use_default": true,
  "use_immutable_subject": true,
  "sub_claim_prefix": "repo:shogo82148@1157344/webntp.shogo82148.com@1360340997"
}
```

REST API 経由でオプトインも可能です。

```shell
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  /repos/{owner}/{repo}/actions/oidc/customization/sub \
  --input - <<< '{
  "use_default": true,
  "use_immutable_subject": true
}'
```

## まとめ

2026年7月15日以降に作成されたレポジトリーでは、 GitHub Actions OIDCフェデレーション時のSubjectクレームが変更になりました。
OIDCフェデレーションがうまく動かないときは、設定画面から現在の Subjectクレームの形式を確認してみてください。

> 白うさぎ、OIDCの道を跳ねる\
> Subjectの形をそっと照らす\
> IAMの扉に新しい鍵\
> CLIで設定を確かめて\
> 安全なトークンを月へ運ぶ
>
> by [CodeRabbit](https://www.coderabbit.ai/)

## 参考

- [Immutable subject claims for GitHub Actions OIDC tokens](https://github.blog/changelog/2026-04-23-immutable-subject-claims-for-github-actions-oidc-tokens/)
- [変更できないサブジェクト要求](https://docs.github.com/ja/actions/reference/security/oidc#immutable-subject-claims)
- [Github ActionsのIDトークンでsubクレームの形式が変わってた](https://dev.classmethod.jp/articles/immutable-subject-claims-for-github-actions-oidc-tokens/)
- [GitHub Actions × AWS OIDC で急に `Not authorized to perform sts:AssumeRoleWithWebIdentity` になった話(原因は Immutable Subject Claim)](https://qiita.com/issy929/items/bb30ea95d8b7bbf71fd1)
- [Get the customization template for an OIDC subject claim for a repository](https://docs.github.com/en/rest/actions/oidc?apiVersion=2026-03-10#get-the-customization-template-for-an-oidc-subject-claim-for-a-repository)
