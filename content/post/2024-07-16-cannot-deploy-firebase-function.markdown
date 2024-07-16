---
layout: post
title: "Firebase Functionsがデプロイできなくなった話"
slug: 2024-07-16-cannot-deploy-firebase-function
date: 2024-07-16 10:33:00 +0900
comments: true
categories: [firebase]
---

新規に立ち上げたプロジェクトで `firebase deploy` を実行したところ、以下のエラーを吐いて失敗してしまいました。

> `Build failed: failed to Fetch: failed to download archive gs://gcf-sources-PROJECT_NUMBER-asia-northeast1/createUserOnUserCreate-5fd201fd-4b54-42b8-af5c-c3ca68fe3560/version-1/function-source.zip: Access to bucket gcf-sources-PROJECT_NUMBER-asia-northeast1 denied. You must grant Storage Object Viewer permission to PROJECT_NUMBER-compute@developer.gserviceaccount.com.`

## TL;DR

以下の設定を行います。

- サービスアカウント `PROJECT_NUMBER-compute@developer.gserviceaccount.com` に「Cloud Build サービス アカウント（`roles/cloudbuild.builds.builder`）」のロールを付与
- サービスアカウント `PROJECT_NAME@appspot.gserviceaccount.com` に「Firebase 管理者（`roles/firebase.admin`）」「サービス アカウント ユーザー（`roles/iam.serviceAccountUser`）」を付与

## 原因

原因は「Code Buildのサービスアカウントの仕様が変更になった」ことと「デフォルトのサービスアカウントへの自動的なロール付与を無効にする設定になっていた」ことでした。

### Code Buildのサービスアカウントの仕様が変更になった

今まではサービスアカウント `PROJECT_NUMBER@cloudbuild.gserviceaccount.com` の権限を使用してビルドしていたのが、
サービスアカウント `PROJECT_NUMBER-compute@developer.gserviceaccount.com` に変更になりました。

- [Cloud Buildサービスアカウントが仕様変更（2024年4月29日から）](https://blog.g-gen.co.jp/entry/cloud-build-service-account-changes)

### デフォルトのサービスアカウントへの自動的なロール付与を無効にする設定になっていた

一部のGoogle Cloudサービスでは、APIを有効化したときにデフォルトのサービスアカウントが自動的に生成されます。
このとき生成されるサービスアカウントには編集者（`roles/editor`）が付与されます。

しかし、今回問題になったプロジェクトでは、組織ポリシーでロール付与が無効になっていました。

- [デフォルトのサービス アカウントへの自動的なロール付与を無効にする](https://cloud.google.com/resource-manager/docs/organization-policy/restricting-service-accounts?hl=ja#disable_service_account_default_grants)

この設定の影響で、サービスアカウント `PROJECT_NUMBER-compute@developer.gserviceaccount.com` に一切権限がない状態でした。

また、Firebase Functionsを実行するためのサービスアカウントにも一切権限がありませんでした。

## 対策

各サービスアカウントに適切な権限を付与します。

具体的には以下の権限を付与しました。

- サービスアカウント `PROJECT_NUMBER-compute@developer.gserviceaccount.com` に「Cloud Build サービス アカウント（`roles/cloudbuild.builds.builder`）」のロールを付与
  - Firebase Functions のビルドにだけ使用する想定なので、Cloud Buildに関する権限のみを付与
- サービスアカウント `PROJECT_NAME@appspot.gserviceaccount.com` に「Firebase 管理者（`roles/firebase.admin`）」「サービス アカウント ユーザー（`roles/iam.serviceAccountUser`）」を付与
  - Firestoreへの読み書きを行いたかったので、Firebaseに関連する権限を付与
  - 「サービス アカウント ユーザー」は Firebase Functions で利用するために必要

## まとめ

Firebase なんて `firebase init && firebase deploy` でラクラク構築できるものと思ってましたが、
現実はそう甘くはありませんでした。
このエラーで一日溶かしたので、同じ現象にハマっているひとの参考になれば幸いです。

> デプロイ困難、夢の果て、\
> 権限修正、解決の道。\
> サービスアカウント、力を借りて、\
> エラー解消、うさぎも笑顔。 🐇✨
>
> by [CodeRabbit](https://coderabbit.ai/)

## 参考

- [Cloud Buildサービスアカウントが仕様変更（2024年4月29日から）](https://blog.g-gen.co.jp/entry/cloud-build-service-account-changes)([魚拓](https://megalodon.jp/2024-0716-1057-58/https://blog.g-gen.co.jp:443/entry/cloud-build-service-account-changes))
- [デフォルトのサービス アカウントへの自動的なロール付与を無効にする](https://cloud.google.com/resource-manager/docs/organization-policy/restricting-service-accounts?hl=ja#disable_service_account_default_grants)([魚拓](https://megalodon.jp/2024-0716-1059-10/https://cloud.google.com:443/resource-manager/docs/organization-policy/restricting-service-accounts?hl=ja))
- [IAM によるアクセス制御（第 2 世代）](https://cloud.google.com/functions/docs/concepts/iam?hl=ja)([魚拓](https://megalodon.jp/2024-0716-1101-26/https://cloud.google.com:443/functions/docs/concepts/iam?hl=ja))
