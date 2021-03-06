# はじめに
このLINEbotはうつな時にLINEの位置情報を送信すると、その時の天気・気圧の変化状況を蓄積・分析した結果を通知してくれるアプリです。

# ユーザー登録
こちらのページからLINEのQRコードリーダーで友達追加してください。
https://docs.google.com/presentation/d/1VJMyaj3RAaSyNnDn0u0CFM4DLh2T6EcoDUfV2nA_osY/edit?usp=sharing

# マニュアル
## 「うつ情報」の送信方法について
「うつだ」とコメントすると、
「位置情報を教えてください」とコメントされます。
左下の"＋"マーク→位置情報で、現在の位置情報を送信してください。
(直接位置情報を送信しても同様の結果になります)

送信後に、以下の情報が通知されます。
+ 位置情報を本にした現在の気温、気圧
+ 気温、気圧の過去6時間での変化状況(→、↘、↗で表示)
+ 過去の変化状況の蓄積結果

※「データ」と送信すると、データを更新せずに現在の状況を確認できます

## ユーザーネームの登録について
「登録」と送信するとユーザーネームを聞かれますので、登録したいユーザー名を送信してください。
(ユーザーネームの登録は必須ではありません)

## コマンド一覧
+ "初期化"：ユーザー情報の初期化
+ "登録"：ユーザーの名前変更(初期値はundefined)
+ "うつだ"：今どこ?と質問されます
+ LINE位置情報：位置情報をもとに、うつ状態での位置情報を記録し、天候/気圧変化、時刻の傾向を記録した「うつ天気分析データ」を送信します
+ "データ"：「うつ天気分析データ」を送信します
+ "ヘルプ"：コマンド一覧が出力されます

# Version
1.0.0
