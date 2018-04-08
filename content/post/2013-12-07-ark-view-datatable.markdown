---
layout: post
title: "Ark-View-DataTable グラフや表やCSVを簡単に表示したい"
slug: ark-view-datatable
date: 2013-12-07T20:11:00+09:00
comments: true
categories: [perl,ark]
---

こんにちは、最近ログの解析をして遊んでいるいっちーです。
解析の結果は最終的にグラフに出すわけなのですが、
先輩方がよく使っているのもあって [Google Charts](https://developers.google.com/chart/) を使ってます。

で、このグラフを他の人に見せると「その元データCSVでちょうだい！」と言われるんです...。

<!-- More- -->

もちろんcsvを作るなんてこと簡単にできるんですが、
今のプログラムにはグラフ用のテンプレートとHTMLで表出力するためのテンプレートとCSV用のテンプレートがあって、
グラフが追加されるたびにコピペして微妙に書き直し、
という不毛な作業が発生してしまうのです。つらい。

## Ark::View::DataTable

使い回しの効かないテンプレートとかなんのためのテンプレートなのか。
データだけ用意してあとはそれぞれのテンプレートに入れるだけとなるのが理想的だよねー、と思い続けて早数ヶ月。
ようやく重い腰を上げて [Ark::View::DataTable](https://github.com/shogo82148/Ark-View-DataTable)ってのを書きました。

## 使い方

[Data::Google::Visualization::DataTable](https://metacpan.org/pod/Data::Google::Visualization::DataTable) をレンダリングするための
ArkのViewです。

``` perl
use Ark::View::DataTable;
use Data::Google::Visualization::DataTable;

sub gvis :Local {
    my ($self, $c) = @_;
    my $datatable = Data::Google::Visualization::DataTable->new();

    $datatable->add_columns(
        { id => 'x',   label => "X", type => 'number' },
        { id => 'y',   label => "Y", type => 'number' },
    );

    # 〜〜〜〜正弦波を描きましょう〜〜〜〜
    $datatable->add_rows(
        map { [$_, sin(2*3.1415926535*$_/500)] } 1..1000,
    );
    $c->stash->{table} = $datatable;
    $c->forward( $c->view( 'DataTable' ) );
}
```

Controllerに感じでかくと使えます。
「/gvis?tqx=out:html」にアクセスするとHTMLの表が、
「/gvis?tqx=out:csv」にアクセスするとCSV形式のファイルが、
「/gvis?tqx=out:tsv-excel」にアクセスするとExcelで開けるファイルがそれぞれダウンロードできます。


## グラフを書く

このViewは[Chart Tools Datasource Protocol](https://developers.google.com/chart/interactive/docs/dev/implementing_data_source)に対応したレスポンスを返すので、
Google Charts からも簡単に扱えます。

``` html
<html>
<body>
<span id="linechart"></span>
<script src="https://www.google.com/jsapi"></script>
<script>
google.load("visualization", '1', {packages:['corechart']});
google.setOnLoadCallback(drawChart);
function drawChart() {
  var query = new google.visualization.Query('/gvis');
  query.send(handleQueryResponse);
}

function handleQueryResponse(response) {
  var data = response.getDataTable();
  var chart = new google.visualization.LineChart(document.getElementById('linechart'));
  chart.draw(data, null);
}
</script>
</body>
</html>
```
