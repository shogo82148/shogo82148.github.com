---
layout: page
title: mailtoリンク作成ツール
date: 2012-07-31 18:48
comments: true
sharing: true
footer: true
---

Webページ上でメールクライアントを開くリンクを作成します。

<label>To:
<input name="to" id="mail-to" type="email" placeholder="送信先メールアドレスを入力" size="100">
</label>

<label>CC:
<input name="cc" id="mail-cc" type="email" placeholder="CCメールアドレスを入力" size="100">
</label><br>
<label>BCC:
<input name="bcc" id="mail-bcc" type="email" placeholder="BCCメールアドレスを入力" size="100">
</label>

<label>件名:
<input name="subject" id="mail-subject" type="text" placeholder="件名を入力" size="100">
</label>

<textarea name="body" id="mail-body" cols="100" rows="10" placeholder="メール本文を入力">
</textarea>

<hr>
<p>mailto:<br>
<textarea id="mail-tag" cols="100" rows="10">
</textarea>
<br>
<a id="mail-link" target="_blank" href="">メールを送信</a>
</p>


<script>
(function () {
    var to = $('#mail-to');
    var cc = $('#mail-cc');
    var bcc = $('#mail-bcc');
    var subject = $('#mail-subject');
    var body = $('#mail-body');
    var result = $('#mail-tag');
    var link = $('#mail-link');

    setInterval(refresh);
    to.change(refresh).keypress(refresh);
    cc.change(refresh).keypress(refresh);
    bcc.change(refresh).keypress(refresh);
    subject.change(refresh).keypress(refresh);
    body.change(refresh).keypress(refresh);

    function refresh() {
        var mailto = 'mailto:';
        var options = [];
        mailto += encodeURI(to.val());
        if(cc.val()) options.push('cc=' + encodeURI(cc.val()));
        if(bcc.val()) options.push('bcc=' + encodeURI(bcc.val()));
        if(subject.val()) options.push('subject=' + encodeURI(subject.val()));
        if(body.val()) options.push('body=' + encodeURI(body.val()));
        if(options.length>0) {
            mailto += '?' + options.join('&');
        }
        result.val(mailto);
        link.attr('href', mailto);
    }
})();
</script>
