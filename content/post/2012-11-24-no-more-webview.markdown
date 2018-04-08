---
layout: post
title: "OAuthの認証にWebViewを使うのはやめよう"
slug: no-more-webview
date: 2012-11-24T23:06:00+09:00
comments: true
categories: [Android, Twitter]
---

AndroidからTwitterへアクセスするためのライブラリとして，[Twitter4J][]が有名です．
これを使ってみようと，「Android Twitter4J」と検索すると
認証にWebViewを使った例がたくさん出てきます．

・・・いや，ちょっとまて．
それはちょっとまずいだろう．

そういうわけでもうちょっと賢い方法を探してみました．

<!-- More -->


## 何がまずいのさ

「Android Twitter4J」と検索すると，上位にこんなページが出てきます．

- [Twitter4jを使ってOAuth認証をアプリ内で行う方法](http://andante.in/i/android%E3%82%A2%E3%83%97%E3%83%AAtips/twitter4j%E3%82%92%E4%BD%BF%E3%81%A3%E3%81%A6oauth%E8%AA%8D%E8%A8%BC%E3%82%92%E3%82%A2%E3%83%97%E3%83%AA%E5%86%85%E3%81%A7%E8%A1%8C%E3%81%86%E6%96%B9%E6%B3%95/)
- [Twitter4j-2.2.xを使ったOAuth認証のコーディング例](http://blog.kyosuke25.com/2011/12/twitter4j-22xoauth.html)
- [twitter4jでツイートする](http://init0.net/wp/archives/171)
- [Android+Twitter4JでOAuthするためのソースコード](http://wada811.blog.fc2.com/blog-entry-103.html)

上のサイトでは次の様は方法をとっています．

- アプリ内にWebViewを貼り付け
- WebViewでTwitterの認証画面を表示
- onPageStarted や onPageFinished をオーバーライドして callback URL へのアクセスを検出
- URL に入っている認証コードで認証

アプリ内でWebViewを使うとURLが表示されません．
つまり ** 本当にツイッターにアクセスしているかわからない ** のです．
もし，表示されるのが偽の認証画面だったら，アプリから簡単にパスワードがわかってしまいます．

じゃあ，URL を表示させればいいかというとそういうわけでもありません．
画面上のURL表示なんて簡単に偽装できてしまいます．
どんな工夫をしても ** アプリがパスワードの要求をしていることには変わりありません ** ．
アプリはパスワードを簡単に取得できます．

アプリのユーザはTwitterに限らずSNSへのログイン時にブラウザを開かないアプリは信用しないようにしましょう．
どこかでパスワードの抜かれている可能性があります．
(ただし，公式アプリは除く．公式アプリが信用できないならそもそもサービスを利用できないもんね．)


## じゃあどうするのさ

じゃあ，開発者はどうするのかって話ですが，もう少し詳しく検索してみましょう．
他の方法を使っているページもでてきます．

- PINコードを利用
  - [TwitterでPIN番号認証を行う](http://techbooster.org/android/mashup/14064/)
- Intent Fileterを利用しコールバック
  - [twitter4jを使用したAndroid Twitterアプリケーション作成](http://d.hatena.ne.jp/yujimny/20110204/1296805905)
  - [Twitter4Jを使ってAndroidアプリでStreamingAPIのUserTimelineを取得する](http://d.hatena.ne.jp/itog/20120214/1329193954)
  - TwitterでOAuth認証を行う
    1. [Twitterへのアプリケーション登録](http://techbooster.org/android/mashup/4525/)
    2. [Twitterの認証ページをブラウザで開く](http://techbooster.org/android/5040/)
    3. [Access Tokenを取得する](http://techbooster.org/android/mashup/5301/)


### PIN コードを利用

一つ目の方法はPC版クライアントでよく使われる方法．
認証後にPINコードと呼ばれる数字が表示されるので，それをアプリに入力します．
twiccaなんかでも使われてますね．
Twitter へのアプリケーション登録のときにコールバックURLを入力しないとこの認証方式になります．

認証画面に，ブラウザを開くボタン，PINコードの入力ボックス，ログインボタンを用意しておきます．

``` xml activity_oauth.xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical" >

    <Button
        android:id="@+id/button_start_login"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Twitterへアクセス" />

   <EditText
      android:id="@+id/edit_pin_code"
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:ems="10"
      android:inputType="number" />

   <Button
      android:id="@+id/button_login"
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:layout_below="@+id/edit_pin_code"
      android:text="ログイン" />

</LinearLayout>
```

あとはボタンが押されたときにブラウザを呼ぶだけです．
認証したらPINコードを入力してもらいます．

``` java OAuthActivity.java
package net.sorablue.shogo82148.yuire;

import twitter4j.AsyncTwitter;
import twitter4j.AsyncTwitterFactory;
import twitter4j.TwitterAdapter;
import twitter4j.TwitterException;
import twitter4j.TwitterListener;
import twitter4j.TwitterMethod;
import twitter4j.auth.AccessToken;
import twitter4j.auth.RequestToken;
import android.net.Uri;
import android.os.Bundle;
import android.app.Activity;
import android.content.Intent;
import android.view.View.OnClickListener;
import android.widget.EditText;

public class OAuthActivity extends Activity implements OnClickListener {
    public final static String EXTRA_CONSUMER_KEY = "consumer_key";
    public final static String EXTRA_CONSUMER_SECRET = "consumer_secret";
    public final static String EXTRA_ACCESS_TOKEN = "access_token";
    public final static String EXTRA_ACCESS_TOKEN_SECRET = "access_token_secret";

    private RequestToken mRequestToken;
    final AsyncTwitterFactory factory = new AsyncTwitterFactory();
    final AsyncTwitter twitter = factory.getInstance();
    
    // 非同期版 Twitter4J のリスナ
    private final TwitterListener listener = new TwitterAdapter() {
            @Override
            public void gotOAuthRequestToken(RequestToken token) {
                mRequestToken = token;
            }

            @Override
            public void gotOAuthAccessToken(AccessToken token) {
                // Access Token 取得成功
                // 呼び出し元に Access Token を返す
                final Intent intent = new Intent();
                intent.putExtra(EXTRA_ACCESS_TOKEN, token.getToken());
                intent.putExtra(EXTRA_ACCESS_TOKEN_SECRET, token.getTokenSecret());
                setResult(Activity.RESULT_OK, intent);
                finish();
            }
        };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_oauth);

        // Request Token をリクエスト
        final Intent intent = getIntent();
        final String consumer_key = intent.getStringExtra(EXTRA_CONSUMER_KEY);
        final String consumer_secret = intent.getStringExtra(EXTRA_CONSUMER_SECRET);
        twitter.addListener(listener);
        twitter.setOAuthConsumer(consumer_key, consumer_secret);
        twitter.getOAuthRequestTokenAsync();
        
        // EventListener をセット
        final View start_login = findViewById(R.id.button_start_login);
        start_login.setOnClickListener(this);
        final View login = findViewById(R.id.button_login);
        login.setOnClickListener(this);
    }

    @Override
    public void onClick(View v) {
        switch(v.getId()) {
        case R.id.button_start_login:
            {
                // 認証画面をブラウザで開く
                final Intent intent = new Intent(Intent.ACTION_VIEW,
                                                 Uri.parse(mRequestToken.getAuthorizationURL()));
                startActivity(intent);
            }
            break;
        case R.id.button_login:
            {
                // PINコードを取得
                final String pin = editPin.getText().toString();
                
                // Access Token をリクエスト
                twitter.getOAuthAccessTokenAsync(mRequestToken, pin);
            }
            break;
        }
    }
}
```

Token の取得にはインターネットアクセスが必要なので，
Twitter4J に含まれている非同期版のライブラリを使っています．

Consumer Key と Consumer Secret はアクティビティの呼び出し時にインテントに設定します．

``` java MainActivity.java
final int REQUEST_ACCESS_TOKEN = 0;
final Intent intent = new Intent(this, OAuthActivity.class);
intent.setExtraString(OAuthActivity.EXTRA_CONSUMER_KEY, "Your Cosumer Key");
intent.setExtraString(OAuthActivity.EXTRA_CONSUMER_SECRET, "Your Consumer Secret");
startActivityForResult(intent, REQUEST_ACCESS_TOKEN);
```

認証が完了すると `onAcivityResult` が呼び出されるので，
Access Token を保存するなり，つぶやくのに使うだけです．

``` java MainActivity.java
@Override
public void onActivityResult(int requestCode, int resultCode, Intent data) {
    if(requestCode == REQUEST_ACCESS_TOKEN && resultCode == Activity.RESULT_OK) {
        final String token = data.getStringExtra(OAuthActivity.EXTRA_ACCESS_TOKEN);
        final String token_secret = data.getStringExtra(OAuthActivity.EXTRA_ACCESS_TOKEN_SECRET);
        twitter.setOAuthAccessToken(new AccessToken(token, token_secret));
    }
}
```


### Intent Filterを利用

二つ目の方法は Intent Fileter を使って
callback URL へアクセスしたときに，ブラウザにインテントを発行してもらう方法です．
ユーザがPINコードを覚える必要がないので楽ちんです．

** (2013-03-09追記) **
この記事を公開したらギルティ言われてしまいました．
([TwitterのOAuthの問題まとめ](https://gist.github.com/mala/5062931)・[TwitterのOAuthの問題の補足とか](https://gist.github.com/mala/5107120))
「Consumer Key が漏れる可能性を否定できないクライアントアプリでは，Callback URL をつかべきではない」とのご指摘です．
ごもっとなご意見です．
この方法は** 非推奨 **です．
PINコードを使った認証を使いましょう．

その分開発は面倒ですが．
ポイントは以下の点です．

- Twitter へのアプリケーション登録時に Callback URL にテキトーなURLを入れておく
- 独自スキーマを定義して，受け取れるようにしておく
- `getOAuthRequestToken` 呼び出し時に，Callback URL を明示的に渡す
- アクティビティの多重起動を防止しておく

Intent Filter に http:// で始まるURLでも設定してしまうと，
アプリケーションの選択画面が開いてしまったり，
ブラウザによってはリダイレクト時にインテントを飛ばしてくれなかったりします．
そのため， myapplication:// のような独自スキーマを使う必要があるのですが，
Twitterへアプリケーション登録時に設定する Callback URL は http:// で始まっていないと受け付けてくれません．
かと言って空にしておくとうまく動かないので callback URL にはテキトーな URL を入れておいて，
`getOAuthRequestToken` 呼び出し時に Callback URL を指定します(なぜかこっちは独自スキーマが使える)．

具体的なプログラムは以下のような感じ．

``` java MainActivity.java
package net.sorablue.shogo82148.yuire;

import twitter4j.AsyncTwitter;
import twitter4j.AsyncTwitterFactory;
import twitter4j.TwitterAdapter;
import twitter4j.TwitterException;
import twitter4j.TwitterListener;
import twitter4j.TwitterMethod;
import twitter4j.auth.AccessToken;
import twitter4j.auth.RequestToken;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.app.Activity;
import android.content.Intent;

public class MainActivity extends Activity {
    public final static String CALLBACK = "myappsheme://callback/";
    public final static String CONSUMER_KEY = "Your consumer_key";
    public final static String CONSUMER_SECRET = "Your consumer secret";

    private RequestToken mRequestToken;
    final AsyncTwitterFactory factory = new AsyncTwitterFactory();
    final AsyncTwitter twitter = factory.getInstance();

    private final TwitterListener listener = new TwitterAdapter() {
            @Override
            public void gotOAuthRequestToken(RequestToken token) {
                // ブラウザを開く
                mRequestToken = token;
                final Intent intent = new Intent(Intent.ACTION_VIEW,
                                                 Uri.parse(mRequestToken.getAuthorizationURL()));
                startActivity(intent);
            }

            @Override
            public void gotOAuthAccessToken(AccessToken token) {
                // 永続化とかする
            }
        };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_oauth);

        twitter.addListener(listener);
        twitter.setOAuthConsumer(CONSUMER_KEY, CONSUMER_SECRET);

        // 認証開始
        // Request Token を取得する
        twitter.getOAuthRequestTokenAsync(CALLBACK); // ここで CALLBACK URL を渡す！
    }

    @Override
    public void onNewIntent(Intent intent) {
        // callback してきた
        final Uri uri = intent.getData();
        if(uri == null) return ;
        final String verifier = uri.getQueryParameter("oauth_verifier");
        twitter.getOAuthAccessTokenAsync(mRequestToken, verifier);
    }
}
```

多重起動防止と独自スキーマの定義はマニフェストに記述します．

``` xml Manifest.xml
<activity
    android:name=".MainActivity"
    android:label="@string/title_activity_main"
    android:launchMode="singleTask" > <!-- 多重起動防止 -->

    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>
    
    <!-- 独自スキーマの定義 -->
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE"/>
        <data android:scheme="myappsheme" />
    </intent-filter>
</activity>
```

`launchMode` に `singleTask` を指定すると，
多重起動のときに新しいアクティビティを起動する代わりに，すでに起動していたアクティビティの `onNewIntent` が実行されます．

PINコードを同じインターフェース(`startActivityForResult` で認証用アクティビティを呼び出すと，戻り値に Access Token が入っている)にしたかったけど，
認証用アクティビティが `singleTask` だと，ブラウザを開いた時に呼び出し元の`onActivityResult`が呼び出されてしまう．
誰かいい案ありません？


## まとめ

WebViewはアプリからブラウザの機能を扱うのに非常に便利ですが，
あくまでもアプリの管理下にあるもので，ブラウザとは少し性質が違うものということに注意．
[WebViewの脆弱性](http://ierae.co.jp/uploads/webview.pdf)に関する資料を見つけてビクビクしています．
認証画面にかぎらず WebView を使うときはセキュリティに注意しましょう．

今回調べたことを使って，
じょりぼっとにお湯入れたとつぶやくだけのアプリ[「お湯入れた」](https://github.com/shogo82148/yuire)を
作りました．
3分間計りたいときにどうぞ．

<a href="https://twitter.com/JO_RI_bot" class="twitter-follow-button" data-show-count="false" data-lang="ja">@JO_RI_botさんをフォロー</a>
<script>!function(d,s,id){var js,fjs=d.getElementsByTagName(s)[0];if(!d.getElementById(id)){js=d.createElement(s);js.id=id;js.src="//platform.twitter.com/widgets.js";fjs.parentNode.insertBefore(js,fjs);}}(document,"script","twitter-wjs");</script>

## おへんじ

たくさんシェアしてもらったのでお返事書いておきます．

<blockquote class="twitter-tweet" lang="ja"><p>たしかにそうなんだけど、PIN形式は実装が手間だし、PINコピペするのも手間だし、IntentFilter形式は空のブラウザー窓が残るのがものすごく気になるんだよなぁ… / “OAuthの認証にWebViewを使うのはやめよう - S…” <a href="http://t.co/NS0kyGg2" title="http://htn.to/hZZLhx">htn.to/hZZLhx</a></p>&mdash; たくじさん (@takuji31) <a href="https://twitter.com/takuji31/status/272987171202424833" data-datetime="2012-11-26T08:56:28+00:00">11月 26, 2012</a></blockquote>
<script src="//platform.twitter.com/widgets.js" charset="utf-8"></script>

WebViewでURLフックを入れるよりは，PINコードのほうがコードもわかりやすく簡単かと．
ただPINコードのコピペが面倒なのはそのとおりなので，Android アプリの場合採用は難しいかもしれません．

Intent Filterはマニフェストに手を入れる必要がある分面倒．ブラウザにタブが残るのも厄介です．
ここは利便性とセキュリティとのトレードオフと割り切るしか無いでしょう．
Web上での本人確認の方法がパスワードくらいしかない以上，パスワード流出の危険性はかなり重大な欠陥だと言えます．
手間なのは最初の一回だけですし，Intent Filter を使うのが賢い方法だと思います．


<blockquote class="twitter-tweet" lang="ja"><p>追記。あと標準ブラウザも絶対ダメ。。→そもそもWebViewを使っちゃダメなのよ。。Android版のChromeだけ使いましょう。。 / “OAuthの認証にWebViewを使うのはやめよう - Shogo's Blog” <a href="http://t.co/jjo1o4Gb" title="http://htn.to/ybxt7Y">htn.to/ybxt7Y</a></p>&mdash; Kietaさん (@typex20) <a href="https://twitter.com/typex20/status/273001101798813696" data-datetime="2012-11-26T09:51:49+00:00">11月 26, 2012</a></blockquote>
<script src="//platform.twitter.com/widgets.js" charset="utf-8"></script>

はい．おっしゃるとおりです．
わざわざ反論してまで WebView を使う理由が思い浮かびません．
代替手法を考えるべきだと思います．


<blockquote class="twitter-tweet" lang="ja"><p>安全に実装できるんならこしたことはないけど、悪意のある実装を前提にするのならWebViewでも他のコンポーネントでもかわらないかな。どっちかというと外部サイトビューワーの役割を持つWebViewでフィッシング開くじょとの方がリスク高そう<a href="http://t.co/QB2HoJSc" title="http://shogo82148.github.com/blog/2012/11/24/no-more-webview/">shogo82148.github.com/blog/2012/11/2…</a></p>&mdash; laiso(レイソー)さん (@laiso) <a href="https://twitter.com/laiso/status/273027828126187520" data-datetime="2012-11-26T11:38:01+00:00">11月 26, 2012</a></blockquote>
<script src="//platform.twitter.com/widgets.js" charset="utf-8"></script>

<blockquote class="twitter-tweet" data-in-reply-to="273027828126187520" lang="ja"><p>@<a href="https://twitter.com/laiso">laiso</a> 普段使ってるブラウザでログイン済みの場合なら、少なくともパスワード取られないことが保証できるので、WebViewだろうとブラウザっぽいものだろうとパスワード聞かれたタイミングで警戒すべき、という方が分かりやすいんじゃないかと思う。</p>&mdash; malaさん (@bulkneets) <a href="https://twitter.com/bulkneets/status/273029308254154753" data-datetime="2012-11-26T11:43:54+00:00">11月 26, 2012</a></blockquote>
<script src="//platform.twitter.com/widgets.js" charset="utf-8"></script>

このポストで取り上げているのは「認証画面を偽装してパスワードを盗む」ことが可能という，まさしくフィッシングの話題です．
開発者は，自前で「** ブラウザっぽいもの ** 」を実装するのではなく，「 ** 本物のブラウザ ** 」を使いましょう，という紹介でした．

問題なのは「パスワードを聞かれる or 聞かれない」ではなく，「どのアプリがパスワードを聞いているか」です．
ログインしていなければ当然Webブラウザでもパスワードは聞かれます．
認証を求めているアプリとは別の，** 信用のできるアプリ ** がパスワードを聞いてくるということが重要なのです．
Webブラウザを信用出来ないというのであれば，そもそもWebサービスを使うべきではありません．


<blockquote class="twitter-tweet" lang="ja"><p>OAuthの認証にWebViewを使うのはやめよう - Shogo's Blog<a href="http://t.co/EQElowcq" title="http://bit.ly/S75tRa">bit.ly/S75tRa</a> WebView使って怪し気な事してたらどうせパケットキャプチャでばれない？ まぁ、PINの方が確実に安全だと思うのでそこは賛成だけど</p>&mdash; nakamura001さん (@nakamura001) <a href="https://twitter.com/nakamura001/status/273012182357266432" data-datetime="2012-11-26T10:35:51+00:00">11月 26, 2012</a></blockquote>
<script src="//platform.twitter.com/widgets.js" charset="utf-8"></script>

パケットキャプチャだけでは見抜けないと思います．
認証画面のDOM要素を直接見れば，通信にまったく介入しなくてもパスワードなんて簡単に抜けます．
実際には WebView からDOM要素を見ることはできないようですが，
DOM 操作が可能な WebView を自前実装することだって技術的には可能です．
そのため，パスワードを盗みとっているかどうかを外からみた動作だけで判断することは非常に難しく，
内部構造を解析する必要があると思います．

パケットキャプチャやらリバースエンジニアリングを駆使すれば理論的はすべての不正は防げるとは思いますが，
それをすべてのアプリでやるのは非常に面倒ですし，一般ユーザが実践するのは困難です．
こういうことをやらなくてもある程度安全にサービスを使えるようにするのが OAuth の役割．
積極的に利用していくべきでしょう．

[Twitter4J]: http://twitter4j.org/ja/index.html

