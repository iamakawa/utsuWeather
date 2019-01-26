var scriptProp  = PropertiesService.getScriptProperties().getProperties();
var sheet       = SpreadsheetApp.getActiveSheet();

// アドバイス用の閾値
var THRESH_deltatemp  = 3;
var THRESH_deltapressure = 3;

// 検索範囲(緯度)の閾値決定
var THRESH_LONGITUDE = 0.5;

// 気温・気圧の変化状況
var SLOPES_ORIGIN     = -1;
var SLOPES_STRAIGHT   = 0;
var SLOPES_DOWN       = 1;
var SLOPES_UP         = 2;

var SLOPES   = ["→→","→↘","→↗","↘→","↘↘","↘↗","↗→","↗↘","↗↗"];
var TIMEZONE = ["0_3","3_6","6_9","9_12","12_15","15_18","18_21","21_24"];

var base = FirebaseApp.getDatabaseByUrl(scriptProp.FIREBASE_IO,scriptProp.FIREBASE_IO_SECRETKEY);

// 状態遷移
var STATE_STAY     = 0;
var STATE_REGISTER = 1;
var STATE_UTSU     = 2;

/* LINE APIからメッセージ受領時の処理 */
function doPost(e) {
  // WebHookで受信した応答用Token
  var replyToken = JSON.parse(e.postData.contents).events[0].replyToken;
  // ユーザーのメッセージを取得
  var userMessage = JSON.parse(e.postData.contents).events[0].message.text;
  var userMessageType = JSON.parse(e.postData.contents).events[0].message.type;
  var userTimeStamp = JSON.parse(e.postData.contents).events[0].timestamp;
  // ユーザーIDを取得
  var userID = JSON.parse(e.postData.contents).events[0].source.userId;
  // 応答メッセージ用のAPI URL
  var url = 'https://api.line.me/v2/bot/message/reply';
  var replyMessage = "";
  
  // LINEのユーザーデータをFirebaseから取得(取得できなかった場合は新規登録)
  var userData = base.getData("user/" + userID); 
  if(userData == null)
  {
    userData = initUserData(userID);
  }
    
  if(userMessageType == "text")
  {
    if(userData["state"] == STATE_REGISTER)
    {
      userData["username"] = userMessage;
      userData["state"]    = STATE_STAY;
      base.setData("user/"+userID, userData);
      replyMessage = ("ユーザーネームは" + userMessage + "に更新されました");
    }
    else if(userMessage == "初期化")
    {
      initUserData(userID);
      replyMessage = "このLINEIDのユーザーは初期化されました";
    }
    else if(userMessage == "登録")
    {
      userData["state"]    = STATE_REGISTER;
      replyMessage = ("ユーザーネームは" + userData["username"] +"です\n" +
                        "登録したいユーザーネームを入力してください");
      base.setData("user/"+userID, userData);
    }
    else if(userMessage == "うつだ")
    {
      replyMessage = "今どこ?(LINEの位置情報を教えてください";
    }
    else if(userMessage == "データ")
    {
      replyMessage = generateUtsuDataMessage(null,userData);
    }
    else if(userMEssage == "ヘルプ")
    {
      replyMessage = "初期化：ユーザー情報の初期化\n" 
                     "登録：ユーザーの名前変更(初期値はundefined)\n" +
                     "うつだ：今どこ?と質問されます\n"+
                     "LINE位置情報：位置情報をもとに、うつ状態での位置情報を記録し、天候/気圧変化、時刻の傾向を記録した「うつ天気分析データ」を送信します\n" +
                     "データ：「うつ天気分析データ」を送信します\n" + 
                     "ヘルプ：コマンド一覧が出力されます";
    }
    else
    {
      replyMessage = ("undefined");
    }
  }
  else if(userMessageType == "location")
  {
    var user_lon = JSON.parse(e.postData.contents).events[0].message.longitude;
    var user_lat = JSON.parse(e.postData.contents).events[0].message.latitude;
    
    var pos_current = searchIndexFromList(user_lon)
    var pos_nearest = calcNearestPointFromList(user_lon, user_lat, pos_current);
    
    range = sheet.getRange(pos_nearest,1);
    var id_nearest  = range.getValue();
    
    var weatherData = getWeatherData(id_nearest);
    var dataset     = pushWeatherData(weatherData,userID,userTimeStamp);
    
    userData     = generateUtsuDataFromWeatherData(dataset,userID,userData);
    replyMessage = generateUtsuDataMessage(dataset,userData);

  }
  else
  {
    replyMessage ="not defined";
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
        'text': replyMessage
      }],
    }),
  });
  return ContentService.createTextOutput(JSON.stringify({'content': 'post ok'})).setMimeType(ContentService.MimeType.JSON);
}

function initUserData(userID)
{
  var data = {"username":"undefiend",
              "state":STATE_STAY,
              "slopes_temp":
              [{"→→":0,"→↘":0,"→↗":0,"↘→":0,"↘↘":0,"↘↗":0,"↗→":0,"↗↘":0,"↗↗":0}],
              "slopes_pressure":
              [{"→→":0,"→↗":0,"→↘":0,"↘→":0,"↘↗":0,"↘↘":0,"↗→":0,"↗↗":0,"↗↘":0}],
              "timezone":
              [{"0_3":0,"3_6":0,"6_9":0,"9_12":0,"12_15":0,"15_18":0,"18_21":0,"21_24":0}]
             };
  base.setData("user/"+userID, data);
  return data;
}

/* 天候データをOpenWeatherMapから取得 */
function getWeatherData(id_WeatherLocation)
{
  var replyMessage = ""; 
  
  var url_gethtml = scriptProp.BASE_URL + id_WeatherLocation +"&APPID="+scriptProp.API_KEY;
  var opt　　　　　　　　　　　　　　　　 = {"contentType":"application/json;","muteHttpExceptions":true};
  
  var data_html 　　　 　= UrlFetchApp.fetch(url_gethtml,opt);
  var content_html = data_html.getContentText();
  var json         = JSON.parse(content_html);
  
  return json;
}

/* 天候データをFirebaseに登録(時間別データの比較も行う) */
function pushWeatherData(json,userID,userTimeStamp)
{
  console.log(json);
  
  // 気象データに対して、過去のデータを取得する
  var temp_max = -100;
  var temp_min = 100;
  var pressure_max = 0;
  var pressure_min = 2000;

  var dataset = {};
  dataset["data"] = {};
  dataset["result"] = {};
  var result = {};
  
  //jstに変換
  var date = new Date(userTimeStamp);
  //date.setTime(date.getTime() + 1000*60*60*9);
  console.log(date.getHours());

  // OpenWeatherは過去2回分のデータが残っているため、⊿の値はこれらの値を参考に取得する
  for(i=0;i<3;i++)
  {
    var data = {};
    
    if(temp_max < json.list[i].main.temp_max)temp_max = json.list[i].main.temp_max;
    if(temp_min > json.list[i].main.temp_min)temp_min = json.list[i].main.temp_min;     
    if(pressure_max < json.list[i].main.pressure)pressure_max = json.list[i].main.pressure;
    if(pressure_min > json.list[i].main.pressure)pressure_min = json.list[i].main.pressure;
    
    data["temp_max"] = json.list[i].main.temp_max;
    data["temp_min"] = json.list[i].main.temp_min;
    data["temp"]     = json.list[i].main.temp;
    data["pressure"] = json.list[i].main.pressure;
    data["weather"]  = json.list[i].weather[0].description;
    data["rec_date"] = json.list[i].dt_txt
    
    if(i==0)
    {
      data["slope_temp"] = SLOPES_ORIGIN;
      data["slope_origin"] = SLOPES_ORIGIN;
    }
    else
    {
      var deltatemp = dataset["data"][i-1]["temp"]-data["temp"];
      var deltapressure = dataset["data"][i-1]["pressure"]-data["pressure"];
      
      if(deltatemp>THRESH_deltatemp)
      {
        data["slope_temp"] = SLOPES_DOWN;
      }
      else if((-deltatemp)>THRESH_deltatemp)
      {
        data["slope_temp"] = SLOPES_UP;
      }
      else
      {
        data["slope_temp"] = SLOPES_STRAIGHT;
      }

      if(deltapressure>THRESH_deltapressure)
      {
        data["slope_pressure"] = SLOPES_DOWN;
      }
      else if((-deltapressure)>THRESH_deltapressure)
      {
        data["slope_pressure"] = SLOPES_UP;
      }
      else
      {
        data["slope_pressure"] = SLOPES_STRAIGHT;
      }

    }
    dataset["data"][i] = data;
  }
  var deltatemp             = temp_max - temp_min;
  var deltapressure         = pressure_max - pressure_min;
  result["deltatemp"]       = deltatemp;
  result["deltapressure"]   = deltapressure;
  dataset["result"]         = result;
  dataset["date"]           = date;
  result["slopes_temp"]     = SLOPES[getNumSlope(dataset,"slope_temp")];
  result["slopes_pressure"] = SLOPES[getNumSlope(dataset,"slope_pressure")];

  base.pushData("data/"+userID, dataset);
  return dataset;
}

/* 登録されたデータからうつ傾向を生成する */
function generateUtsuDataFromWeatherData(dataset,userID,userData)
{
  userData["slopes_temp"][0][SLOPES[getNumSlope(dataset,"slope_temp")]]++;
  userData["slopes_pressure"][0][SLOPES[getNumSlope(dataset,"slope_pressure")]]++;
  userData["timezone"][0][TIMEZONE[getNumTimeArea(dataset)]]++;
  
  base.setData("user/"+userID, userData);
  
  return userData;
}

function generateUtsuDataMessage(dataset,userData)
{
  var replyMessage ="";
  
  if(dataset != null)
  {
    replyMessage += "現在の気温:" + dataset["data"][2]["temp"] +"℃\n";
    replyMessage += "現在の気圧:" + dataset["data"][2]["pressure"] + "hPa\n";
    replyMessage += "時間帯:" + TIMEZONE[getNumTimeArea(dataset)] + "\n";
    replyMessage += "気温の変化:" + SLOPES[getNumSlope(dataset,"slope_temp")] + "\n";
    replyMessage += "気圧の変化:" + SLOPES[getNumSlope(dataset,"slope_pressure")] + "\n";
    replyMessage += "\n";
  }
  
  if(userData != null)
  {
    if(userData["username"] != "undefiend")
    {
      replyMessage += userData["username"] + "さんのデータ";
    }
    else
    {
      replyMessage += "あなたのデータ";
    }
    
    replyMessage += "■気温の変化の傾向\n";
    for(var i =0; i<9; i++)
    {
      replyMessage += SLOPES[i] + ":" + userData["slopes_temp"][0][SLOPES[i]] + "\n";
    }
    replyMessage += "\n";

    replyMessage += "■気圧の変化の傾向\n";
    for(var i =0; i<9; i++)
    {
      replyMessage += SLOPES[i] + ":" + userData["slopes_pressure"][0][SLOPES[i]] + "\n";
    }
    replyMessage += "\n";

    replyMessage += "■時間の傾向\n";
    for(var i =0; i<8; i++)
    {
      replyMessage += TIMEZONE[i] + ":" + userData["timezone"][0][TIMEZONE[i]] + "\n";
    }
  }
  return replyMessage;
}

function getNumSlope(dataset,str_slope)
{
  return dataset["data"][2][str_slope] *3 +dataset["data"][1][str_slope]
}
function getNumTimeArea(dataset)
{
  return Math.floor(dataset["date"].getHours()/3);
}

/* 観測所サーチの開始位置を2分探索的にサーチする */
function searchIndexFromList(lon)
{
  var range=sheet.getRange("F1");
  
  var pos_start = 2;
  var pos_end   = range.getValue();
  var pos_middle = Math.floor((pos_start + pos_end)/2);
  
  while((pos_end-pos_start)>1)
  {
    range = sheet.getRange(pos_middle,4);
    Logger.log(range.getValue());
    if((lon-range.getValue())>THRESH_LONGITUDE)
    {
      pos_start = pos_middle;
    }
    else
    {
      pos_end   = pos_middle;
    }
    pos_middle = Math.floor((pos_start + pos_end)/2);
  }
  console.log(pos_middle);
  return pos_middle;
}

/* 最も近い位置の観測所を算出 */
function calcNearestPointFromList(lon_cur,lat_cur,pos)
{
  var range=sheet.getRange("F1");
  var pos_end   = range.getValue();
  
  var distance = 9999999;
  var pos_nearest = -1;
  
  for(i=pos; i<=pos_end; i++)
  {
    range = sheet.getRange(i,4);
    var lon_pos = range.getValue();
    range = sheet.getRange(i,5);
    var lat_pos = range.getValue();
    
    if(lon_pos-lon_cur>THRESH_LONGITUDE)
    {
      break;
    }
    
    var distance_cur = hubeny(lat_cur,lon_cur,lat_pos,lon_pos);
    if(distance_cur<distance)
    {
      distance = distance_cur;
      pos_nearest = i;
    }
  }
  console.log("distance:"+ distance + ", pos_nearest:" + pos_nearest);
  return pos_nearest;
}

/* ヒュベニの公式(2点間の緯度経度から距離を算出) */
function hubeny(lat1, lng1, lat2, lng2) {
    function rad(deg) {
        return deg * Math.PI / 180;
    }
    //degree to radian
    lat1 = rad(lat1);
    lng1 = rad(lng1);
    lat2 = rad(lat2);
    lng2 = rad(lng2);

    // 緯度差
    var latDiff = lat1 - lat2;
    // 経度差算
    var lngDiff = lng1 - lng2;
    // 平均緯度
    var latAvg = (lat1 + lat2) / 2.0;
    // 赤道半径
    var a = 6378137.0;
    // 極半径
    var b = 6356752.314140356;
    // 第一離心率^2
    var e2 = 0.00669438002301188;
    // 赤道上の子午線曲率半径
    var a1e2 = 6335439.32708317;

    var sinLat = Math.sin(latAvg);
    var W2 = 1.0 - e2 * (sinLat * sinLat);

    // 子午線曲率半径M
    var M = a1e2 / (Math.sqrt(W2) * W2);
    // 卯酉線曲率半径
    var N = a / Math.sqrt(W2);

    t1 = M * latDiff;
    t2 = N * Math.cos(latAvg) * lngDiff;
    return Math.sqrt((t1 * t1) + (t2 * t2));
}