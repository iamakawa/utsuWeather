var scriptProp  = PropertiesService.getScriptProperties().getProperties();
var url_gethtml = scriptProp.BASE_URL + scriptProp.CITY_ID+"&APPID="+scriptProp.API_KEY;
var opt         = {"contentType":"application/json;","muteHttpExceptions":true};

// アドバイス用の閾値
var THRESH_deltatemp     = 5;
var THRESH_deltapressure = 10;

function doPost(e) {
  // WebHookで受信した応答用Token
  var replyToken  = JSON.parse(e.postData.contents).events[0].replyToken;
  // ユーザーのメッセージを取得
  var userMessage = JSON.parse(e.postData.contents).events[0].message.text;
  // ユーザーIDを取得
  var userID      = JSON.parse(e.postData.contents).events[0].source.userId.text;
  // 応答メッセージ用のAPI URL
  var url         = 'https://api.line.me/v2/bot/message/reply';

  if(userMessage == "うつだ")
  {
    var data_html = UrlFetchApp.fetch(url_gethtml,opt);

    var content_html = data_html.getContentText();
    var json         = JSON.parse(content_html);

    // 気象データに対して、過去のデータを取得する
    var temp_max     = -100;
    var temp_min     = 100;
    var pressure_max = 0;
    var pressure_min = 2000;

    // OpenWeatherは過去2回分のデータが残っているため、⊿の値はこれらの値を参考に取得する
    for(i=0;i<3;i++)
    {
      if(temp_max < json.list[i].main.temp_max)temp_max = json.list[i].main.temp_max;
      if(temp_min > json.list[i].main.temp_min)temp_min = json.list[i].main.temp_min;
      if(pressure_max < json.list[i].main.pressure)pressure_max = json.list[i].main.pressure;
      if(pressure_min > json.list[i].main.pressure)pressure_min = json.list[i].main.pressure;
    }
    var deltatemp     = temp_max - temp_min;
    var deltapressure = pressure_max - pressure_min;

    var userMsg_temp     = "";
    var userMsg_pressure = "";
    if(deltatemp > THRESH_deltatemp)
    {
      userMsg_temp = "・過去6時間で気温差が激しいようです";
    }
    else
    {
      userMsg_temp = "・過去6時間で気温差は激しくないようです";
    }

    if(deltapressure > THRESH_deltapressure)
    {
      userMsg_pressure = "・過去6時間で気圧差が激しいようです";
    }
    else
    {
      userMsg_pressure = "・過去6時間で気圧差は激しくないようです";
    }

    UrlFetchApp.fetch(url, {
      'headers': {
        'Content-Type': 'application/json; charset=UTF-8',
        'Authorization': 'Bearer ' + scriptProp.ACCESS_TOKEN,
      },
      'method': 'post',
      'payload': JSON.stringify({
        'replyToken': replyToken,
        'messages': [{
          'type': 'text',
          'text': userMsg_temp + "\n" + userMsg_pressure,
        }],
      }),
    });
  }
  else
  {
    UrlFetchApp.fetch(url, {
      'headers': {
        'Content-Type': 'application/json; charset=UTF-8',
        'Authorization': 'Bearer ' + scriptProp.ACCESS_TOKEN,
      },
      'method': 'post',
      'payload': JSON.stringify({
        'replyToken': replyToken,
        'messages': [{
          'type': 'text',
          'text': "not defined",
        }],
      }),
    });
  }
  return ContentService.createTextOutput(JSON.stringify({'content': 'post ok'})).setMimeType(ContentService.MimeType.JSON);
}
