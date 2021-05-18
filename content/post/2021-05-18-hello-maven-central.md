---
layout: post
title: "Gradle Ribbonizer Plugin を Maven Central へ移行してみた"
slug: hello-maven-central
date: 2021-05-18 08:17:00 +0900
comments: true
categories: [gradle, java]
---

全国の Android エンジニアの皆さんこんにちは。
弊社では過去に [maskarade/gradle-android-ribbonizer-plugin](https://github.com/maskarade/gradle-android-ribbonizer-plugin) という Gradle Plugin を使っていたのですが、
メンテナンスされている様子がないので、フォークして自前のパッチを当て [shogo82148/gradle-android-ribbonizer-plugin](https://github.com/shogo82148/gradle-android-ribbonizer-plugin) で開発を続けていました。
(何をするプラグインなのかは本題ではないのでまた今度)
コンパイルした jar ファイルは jcenter で公開していたのですが、皆さんご存知の通り 5/1 を持って閉鎖してしまいました。

- [Into the Sunset on May 1st: Bintray, GoCenter, and ChartCenter](https://jfrog.com/blog/into-the-sunset-bintray-jcenter-gocenter-and-chartcenter/)

猶予期間として 1 年はダウンロード可能ですが、既に新規のアップロードはできなくなっています。
そういうわけで、重い腰を上げて [Maven Central](https://search.maven.org/) へ移行することにしました。

## リリース作業

[Maven Central Repository への公開手順(Gradle 版)](https://blog1.mammb.com/entry/2020/02/19/090000) の記事を参考に以下の手順でリリースを進めます

- sonatype の JIRA で issue を通してリポジトリ作成を依頼
- GnuPG で jar を署名できる環境を作成
- Gradle プラグインでリポジトリへ登録
- Repository Manager で Maven Central Repository へリリース

### sonatype の JIRA で issue を通してリポジトリ作成を依頼

リポジトリ作成を依頼は JIRA で行います。
JIRA を使うにはアカウントが必要なので、以下のリンクから新規アカウントを発行します。

- [https://issues.sonatype.org/secure/Signup!default.jspa](https://issues.sonatype.org/secure/Signup!default.jspa)

| 項目                      | 入力                                                       |
| ------------------------- | ---------------------------------------------------------- |
| プロジェクト              | Community Support - Open Source Project Repository Hosting |
| 課題タイプ                | New Project                                                |
| 要約(Summary)             | GitHub のプロジェクト名など                                |
| 説明(Description)         | GitHub の README の内容など                                |
| Group Id                  | 保有ドメインなどから Group Id を指定                       |
| Project URL               | GitHub のプロジェクト URL                                  |
| SCM url                   | GitHub の Clone URL                                        |
| Username(s)               | 空                                                         |
| Already Synced to Central | No                                                         |

GroupID は ドメイン名を指定するのが慣例ですが、JIRA チケットの ID を DNS の TXT レコードに登録することで、ドメインの所有権を示す必要があるそうです。
(アレってただの慣例で、所有権の確認があるとは知らなかった)

無事レポジトリの作成が終わると、ボットさんが知らせてくれます。
僕が依頼した Issue はこちら。

- [https://issues.sonatype.org/browse/OSSRH-69001](https://issues.sonatype.org/browse/OSSRH-69001)

### GnuPG で jar を署名できる環境を作成

僕の場合は、GitHub のコミットに Verified マーク付けてみたり、 [yum レポジトリを作る](/blog/2021/02/21/private-yum-repo-on-s3/) ために、署名用の鍵は既に作ってあったのでそれをそのまま使用。
持っていない人は以下のコマンドで新しい鍵を作ろう

```
$ brew install gnupg
$ gpg --full-gen-key
```

公開鍵サーバーへの登録も [keys.openpgp.org](https://keys.openpgp.org/upload) でやっていたのでスキップ。

Gradle から秘密鍵にアクセスできるようエクスポートしておきます。

```
$ gpg --export-secret-keys -o ~/.gnupg/secring.gpg
```

どの秘密鍵で署名するかの設定にショート形式の鍵 ID が必要なので、以下のコマンドで確認します。

```
$ gpg --list-secret-keys --keyid-format short
/Users/xxxxxx/.gnupg/pubring.kbx
---------------------------------------
sec   rsa4096/4AA47BA4 2019-06-06 [SC]
      346778FA3341B42937DA58058CB38F4B4AA47BA4
uid         [  究極  ] Ichinose Shogo <shogo82148@gmail.com>
ssb   rsa4096/5FD14088 2019-06-06 [E]
```

僕の場合は `4AA47BA4` です。

### Gradle プラグインでリポジトリへ登録

鍵の設定、認証情報の設定等を `~/.gradle/gradle.properties` に設定しておきます。

```
signing.keyId=4AA47BA4
signing.password=xxxxxxxx
signing.secretKeyRingFile=/Users/xxxxxxx/.gnupg/secring.gpg

sonatypeUsername=shogo82148
sonatypePassword=********
```

`build.gradle` は以下のように設定。
参考にしたサイトのものをそのままコピペしたら公開に失敗したので、ちょっと修正を加えています。

```groovy
buildscript {
    repositories {
        google()
        mavenCentral()
    }
}

plugins {
    id('org.jetbrains.kotlin.jvm')
    id('java-gradle-plugin')
    id('signing') // これを追加！
    id('maven-publish') // これを追加！
}

dependencies {
    compileOnly gradleApi()
    implementation localGroovy()
    implementation 'com.android.tools.build:gradle:4.2.0'
    implementation "org.jetbrains.kotlin:kotlin-stdlib-jdk8:$kotlin_version"
}

group = 'com.shogo82148.ribbonizer'
version = '3.0.2'

publishing {
    publications {
        // mavenJava(MavenPublication) となっていたけど、
        // 公開するのは Gradle Plugin なので pluginMaven に変更
        pluginMaven(MavenPublication) {
            artifactId = 'ribbonizer-plugin'
            pom {
                name = 'ribbonizer-plugin'
                description = 'Modifies launcher icons on debug build'
                url = 'https://github.com/shogo82148/gradle-android-ribbonizer-plugin'
                licenses {
                    license {
                        name = 'The Apache License, Version 2.0'
                        url = 'http://www.apache.org/licenses/LICENSE-2.0.txt'
                    }
                }
                developers {
                    developer {
                        id = 'shogo82148'
                        name = 'Ichinose Shogo'
                        email = 'shogo82148@gmail.com'
                    }
                }
                scm {
                    connection = 'git@github.com:shogo82148/gradle-android-ribbonizer-plugin.git'
                    developerConnection = 'git@github.com:shogo82148/gradle-android-ribbonizer-plugin.git'
                    url = 'https://github.com/shogo82148/gradle-android-ribbonizer-plugin'
                }
            }
        }
    }
    repositories {
        maven {
            // 2021年2月に oss.sonatype.org から s01.oss.sonatype.org に変わったらしい
            // by https://central.sonatype.org/publish/publish-guide/#deployment
            def releasesRepoUrl = "https://s01.oss.sonatype.org/service/local/staging/deploy/maven2/"
            def snapshotsRepoUrl = "https://s01.oss.sonatype.org/content/repositories/snapshots/"
            url = version.endsWith('SNAPSHOT') ? snapshotsRepoUrl : releasesRepoUrl
            credentials {
                // CI 環境でテストを回すと sonatypeUsername, sonatypePassword が設定されていなくてコケるので、
                // とりあえずテキトーな値を設定
                username = "${hasProperty('sonatypeUsername') ? sonatypeUsername : 'anonymous'}"
                password = "${hasProperty('sonatypePassword') ? sonatypePassword : 'anonymous'}"
            }
        }
    }
}

signing {
    sign publishing.publications.pluginMaven
}
```

設定がうまく行っていれば `gradlew publish` でアップロードできます。

```
$ ./gradlew publish
```

### Repository Manager で Maven Central Repository へリリース

ローカルのコマンド操作でアップロードしたものは Staging 状態で実際には公開されていません。
[nexus repository manager](https://s01.oss.sonatype.org/) からレポジトリを Close して公開内容を確定したあと、Release ボタンを押してようやく公開です。

ちなみに Close のときに正しく署名されているかのチェックや、POM にメタ情報が正しく書かれているかのチェックが走ります。

## まとめ

と、言うわけで無事公開できました！

- [com.shogo82148.ribbonizer:ribbonizer-plugin:3.0.2](https://search.maven.org/artifact/com.shogo82148.ribbonizer/ribbonizer-plugin/3.0.2/jar)

ただ、SVG 対応していないという理由で、このプラグイン最近使われてないんですよね。
SVG 対応・・・

## 参考

- [Into the Sunset on May 1st: Bintray, GoCenter, and ChartCenter](https://jfrog.com/blog/into-the-sunset-bintray-jcenter-gocenter-and-chartcenter/)
- [Maven Central Repository への公開手順(Gradle 版)](https://blog1.mammb.com/entry/2020/02/19/090000)
- [The Signing Plugin](https://docs.gradle.org/current/userguide/signing_plugin.html)
- [Maven Publish Plugin](https://docs.gradle.org/current/userguide/publishing_maven.html)
- [nexus repository manager](https://s01.oss.sonatype.org/)
