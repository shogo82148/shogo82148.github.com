---
layout: post
title: "Setup Perl Environment Action のストレージを Azure Blob Storage に移行しました"
slug: setup-perl-uses-azure-blob-storage
date: 2021-02-03 21:33:00 +0900
comments: true
categories: [github, perl]
---

GitHub Actions が一般公開された際に Perl をセットアップするアクションを書きました。

- [Setup Perl GitHub Action を公開しました](https://shogo82148.github.io/blog/2019/09/18/actions-setup-perl/)

セットアップのたびに毎回コンパイルすると遅いので、コンパイル済みのバイナリを事前に Amazon S3 にアップロードしていました。
アップロード先に S3 を選んだのは単に自分が AWS に慣れているからなのですが、最近になってちょっとした問題に直面してます。
解決へ向けて S3 から Azure Blob Storage へ移行した、というお話です。

利用する分には全く影響ないはずなんですが、Azure Blob Storage を使ってみたメモも兼ねてやったことを書いておきます。

## S3 の問題点

もちろん S3 自体が悪いわけじゃなくって、単に自分の見積もりが甘かっただけなんですが、 **ネットワークのアウト向きのデーター転送料が高い！！！！**

これまでの僕のユースケースではせいぜい数 MB のバイナリをアップロードするだけだったのが、perl のバイナリは 1 バージョン当たり 100MB 以上あります。
Perl Monger の方々は互換性に気を使うので、いろんな OS、バージョン、コンパイルオプションでテストを実行します。
各 OS(Linux, Windows, macOS)、Perl 5.6〜5.32、multi-thread オプションありなし、という条件でマトリックスのワークフローを組むと 84 ジョブ。
単純計算で 1 ワークフローを実行するだけで、約 8GB の転送が発生するわけです。
2021-02-05 現在のアウトデーター転送料は 0.09USD/GB なので、1 ワークフローあたり 0.72USD です。

去年の秋あたりから使ってくれる人が増えたようで、転送量だけで 100USD/mo を超えるようになってきました。
趣味の範囲でやってるので、ちょっと許容できる範囲を超えてきたかな・・・ということでコスト削減に乗り出しました。

## Azure Blob Storage

というわけで目をつけたのが Azure Blob Storage です。
[GitHub Actions の仮想環境のドキュメント](https://github.com/actions/virtual-environments#github-actions-virtual-environments) にもあるとおり、
Azure Pipeline 上で動いています。

その証拠に Azure 上で動いているインスタンスからは、インスタンスのメタデータを確認が確認できて

```yaml
run: |
  curl -H "Metadata: true" http://169.254.169.254/metadata/instance?api-version=2020-09-01 | jq .
```

以下のような結果が返ってきます。このインスタンスは AzurePublicCloud の eastus2 リージョンで動いているようです。

```json
{
  "compute": {
    "azEnvironment": "AzurePublicCloud",
    "customData": "",
    "isHostCompatibilityLayerVm": "false",
    "licenseType": "",
    "location": "eastus2",
    "name": "EUS2-EUS21GHUBT18EUS21-0288",
    "offer": "",
    "osProfile": {
      "adminUsername": "",
      "computerName": ""
    },
    "osType": "Linux",
    "placementGroupId": "",
    "plan": {
      "name": "",
      "product": "",
      "publisher": ""
    },
    "platformFaultDomain": "0",
    "platformUpdateDomain": "0",
    "provider": "Microsoft.Compute",
    "publicKeys": [],
    "publisher": "",
    "resourceGroupName": "eus21ghubt18eus21",
    "resourceId": "/subscriptions/22283944-deaa-4840-812f-81c9120070eb/resourceGroups/eus21ghubt18eus21/providers/Microsoft.Compute/virtualMachines/EUS2-EUS21GHUBT18EUS21-0288",
    "securityProfile": {
      "secureBootEnabled": "false",
      "virtualTpmEnabled": "false"
    },
    "sku": "",
    "storageProfile": {
      "dataDisks": [],
      "imageReference": {
        "id": "/subscriptions/22283944-deaa-4840-812f-81c9120070eb/resourceGroups/eus21ghubt18eus21/providers/Microsoft.Compute/galleries/eus21ghubt18eus21/images/factory/versions/0.0.31206120",
        "offer": "",
        "publisher": "",
        "sku": "",
        "version": ""
      },
      "osDisk": {
        "caching": "ReadOnly",
        "createOption": "FromImage",
        "diffDiskSettings": {
          "option": "Local"
        },
        "diskSizeGB": "86",
        "encryptionSettings": {
          "enabled": "false"
        },
        "image": {
          "uri": ""
        },
        "managedDisk": {
          "id": "/subscriptions/22283944-deaa-4840-812f-81c9120070eb/resourceGroups/eus21ghubt18eus21/providers/Microsoft.Compute/disks/EUS2-EUS21GHUBT18EUS21-0288-af0e7c49",
          "storageAccountType": "Standard_LRS"
        },
        "name": "EUS2-EUS21GHUBT18EUS21-0288-af0e7c49",
        "osType": "Linux",
        "vhd": {
          "uri": ""
        },
        "writeAcceleratorEnabled": "false"
      }
    },
    "subscriptionId": "22283944-deaa-4840-812f-81c9120070eb",
    "tags": "",
    "tagsList": [],
    "version": "",
    "vmId": "1fbeca5e-6c91-4207-af0d-66af453dddf0",
    "vmScaleSetName": "",
    "vmSize": "Standard_DS2_v2",
    "zone": ""
  },
  "network": {
    "interface": [
      {
        "ipv4": {
          "ipAddress": [
            {
              "privateIpAddress": "10.1.0.4",
              "publicIpAddress": ""
            }
          ],
          "subnet": [
            {
              "address": "10.1.0.0",
              "prefix": "16"
            }
          ]
        },
        "ipv6": {
          "ipAddress": []
        },
        "macAddress": "000D3AE27125"
      }
    ]
  }
}
```

インターネットへ出るための通信料は AWS と大差無いものの、 Azure のリージョン間では割安です。
GitHub Actions のパイプラインが存在する北米内のリージョン間で $0.02/GB (2021-02-05 現在) と AWS の 22% の価格で済みます。

- [帯域幅の料金詳細](https://azure.microsoft.com/ja-jp/pricing/details/bandwidth/)

Azure Blob Storage に移行すればこの料金が適用されるのでは？と考えて移行してみることにしました。

## はじめての Azure Blob Storage

Azure 自体が始めてなので Portal も始めて利用したわけですが、さすが Microsoft。きれいな UI ですね。

![Azure Portal](/images/2021-02-05-azure-portal.png)

UI 自体はわかりやすくて便利だなーと思ったんですが、AWS, GCP とはまったく違う概念が登場するので戸惑いました。

### ストレージアカウントを作成する

AWS, GCP で言うところのバケットに相当するもの・・・だと勝手に解釈しています。
他のユーザーと同じ名前はつけられず、作成時にリージョン指定が必要です。

### コンテナーを作成する

ストレージアカウントはオブジェクトストレージ以外にもデーターを保存するサービスを利用できます。

- [Blob storage](https://azure.microsoft.com/en-us/services/storage/blobs/)
- [Azure Files](https://azure.microsoft.com/en-us/services/storage/files/)
- [Table storage](https://azure.microsoft.com/en-us/services/storage/tables/)
- [Queue Storage](https://azure.microsoft.com/en-us/services/storage/queues/)

それぞれ AWS でいうところの[S3](https://aws.amazon.com/jp/s3/), [EFS](https://aws.amazon.com/jp/efs/),
[DynamoDB](https://aws.amazon.com/jp/dynamodb/), [SQS](https://aws.amazon.com/jp/sqs/) といったところでしょうか？
(今回 Blob storage 以外は使ってないので間違ってるかも)

Blob storage ではコンテナーという単位で Blob オブジェクトをグルーピングできるようです。
コンテナー毎にアクセス制御ができます。

### アプリを登録する

Blob ストレージへアクセスするにはいくつか方法がありますが、 Azure AD (Azure Active Directly) を使うのがおすすめと書いてあったので、
この方法を選択しました。
Active Directly はコンピューターにアクセスするユーザーを一元管理するための仕組みですね。
名前だけは聞いたことある。

今回は CI からアクセスしたいので、「サービスプリンシパル承認する」のセクションを参考に、
アプリを登録して、認証用のクライアントシークレットを発行します。

- [AzCopy と Azure Active Directory (Azure AD) を使用して BLOB へのアクセスを承認する](https://docs.microsoft.com/ja-jp/azure/storage/common/storage-use-azcopy-authorize-azure-active-directory#authorize-a-service-principal)

### GitHub Actions からアップロードするための設定をする

CI 環境からのアップロードには `azcopy` コマンドを使います。
GitHub Actions には `azcopy` コマンドがプリインストールされているから楽ちん！と思っていたのですが、
Ubuntu 18.04 にインストールされているのは v7 と古いバージョンだという罠を踏みました。
v10 が最新で他の環境にはこのバージョンがインストールされています。
v7 は .NET による実装、 v10 は Go による実装で、この２つは同じ `azcopy` でも全くの別物です。

環境毎にバージョンが違うことを意識したくなかったので、 [install azcopy GitHub Action](https://github.com/marketplace/actions/install-azcopy)
を使って v10 を明示的にインストールしました。

Azure AD を使用するには [azcopy login](https://docs.microsoft.com/ja-jp/azure/storage/common/storage-ref-azcopy-login) コマンドを使用します。

```
export AZCOPY_SPA_CLIENT_SECRET=クライアントシークレット
azcopy_v10 login --service-principal --application-id "アプリ登録時に発行されるID" --tenant-id "規定のディレクトリから確認できるテナントID"
```

### アップロードする

アップロードするのは [azcopy copy](https://docs.microsoft.com/ja-jp/azure/storage/common/storage-ref-azcopy-copy?toc=/azure/storage/blobs/toc.json) コマンドです。
アップロード先の指定は https スキームの URL を使います。

```
azcopy cp perl.zip https://${ストレージアカウント名}.blob.core.windows.net/${コンテナー名}/${オブジェクト名}
```

コンテナー作成時に匿名アクセスを許可しておけば、アップロードに使ったのと同じ URL でダウンロードもできます。

## まとめ

コスト削減のために Setup Perl Environment Action で利用しているストレージを S3 から Azure Blob Storage に移行しました。
とはいえ、Azure のリージョン間転送料が適用されるかは確証がないんですよね。
まだ Azure 登録したばかりで無料期間中なので、無料期間の 1 ヶ月様子を見たいと思います。

コスト削減したからといって転送料が 0 になるわけではないので、スポンサーもお待ちしてます。 🥺

<iframe src="https://github.com/sponsors/shogo82148/card" title="Sponsor shogo82148" height="225" width="600" style="border: 0;"></iframe>

## 参考

- [GitHub Actions Virtual Environments](https://github.com/actions/virtual-environments#github-actions-virtual-environments)
- [MicrosoftAzure](https://azure.microsoft.com/)
- [帯域幅の料金詳細](https://azure.microsoft.com/ja-jp/pricing/details/bandwidth/)
- [Azure Instance Metadata Service (IMDS)](https://docs.microsoft.com/ja-jp/azure///virtual-machines/linux/instance-metadata-service?tabs=windows)
- [Azure Blob Storage](https://azure.microsoft.com/ja-jp/services/storage/blobs/)
- [Upload files to Azure Blob storage by using AzCopy v10](https://docs.microsoft.com/en-us/azure/storage/common/storage-use-azcopy-blobs-upload?toc=/azure/storage/blobs/toc.json)
- [AzCopy と Azure Active Directory (Azure AD) を使用して BLOB へのアクセスを承認する](https://docs.microsoft.com/ja-jp/azure/storage/common/storage-use-azcopy-authorize-azure-active-directory#authorize-a-service-principal)
- [Copy data from Amazon S3 to Azure Storage by using AzCopy](https://docs.microsoft.com/en-us/azure/storage/common/storage-use-azcopy-s3)
- [azcopy login](https://docs.microsoft.com/ja-jp/azure/storage/common/storage-ref-azcopy-login)
- [install azcopy GitHub Action](https://github.com/marketplace/actions/install-azcopy)
