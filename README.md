# vcr-disconnected-call

## 概要

このプロジェクトは、Vonage AI Studioとkintoneを統合し、通話の録音データを取得してkintoneに保存するNode.jsアプリケーションです。Expressを使用してAPIサーバーを構築し、VonageのAPIを通じて通話データを取得し、kintoneのAPIを使用してデータを保存します。

このプロジェクトは、以下の記事と関連しています。
この記事の内容を事前に実施しておいてください。

[V Callプラグイン 着信カスタマイズ（基礎編）](https://zenn.dev/kwcplus/articles/vcall-incoming-basic)

## 主な機能

- **通話切断イベントの処理**: Vonage AI Studioから通話切断イベントを受信し、通話の録音データを取得します。
- **録音データの保存**: 取得した録音データを一時ファイルとしてローカルに保存します。
- **kintoneへのデータ保存**: 録音データをkintoneにアップロードし、関連する通話ログを更新します。
- **録音データの削除**: 処理が完了した後、ローカルに保存した録音データを削除します。

## しくみ

`POST /event-disconnected-call` に届く AI Studio からの切断イベントを起点に、以下のステップで処理を行います。

### 1. 録音データの取得

#### Step 1. Insights API でセッション情報を取得

AI Studio の Insights API (`https://studio-api-us.ai.vonage.com/insights/sessions/{session_id}`) に `X-Vgai-Key` ヘッダーを付けて GET します。

ただし、通話終了直後はまだ AI Studio 側の集計が完了しておらず、レスポンスの `channel_data.audio_url` が `null` で返ってくることがあります。そのため、`audio_url` が入るまで指数バックオフ（5/5/10/20/40 秒）で最大 5 回リトライします。

#### Step 2. `audio_url` から本来の録音 URL を抽出

`channel_data.audio_url` は次のような形式で渡されます。

```
https://stairway-us-east-1.ai.vonage.com/recordings?token=<JWT>
```

このプロジェクトでは AI Studio が US リージョン、Voice が Singapore (apse1) リージョンというリージョン跨ぎの構成のため、Stairway を経由したダウンロードが安定しません（500 が返り続けます）。

そこで `token` クエリパラメータの JWT を base64 デコードし、ペイロード内に格納されている `recordingUrl`（`https://api-sg-1.nexmo.com/v1/files/...`）を取り出して、Voice API に直接アクセスします。

#### Step 3. Vonage Application JWT で Voice API から録音ファイルを取得

[@vonage/vcr-sdk](https://www.npmjs.com/package/@vonage/vcr-sdk) の `vcr.createVonageToken()` で Vonage Application JWT を生成します。VCR ランタイムが Application credentials を自動で注入してくれるため、アプリケーション側で private key ファイルを保持する必要はありません。

生成した JWT を `Authorization: Bearer` ヘッダーに付与し、Step 2 で抽出した `recordingUrl` に対してストリームで GET します。録音ファイルが Voice API 側に反映されるまでに数秒〜数十秒のラグがあるため、404/5xx は同じく指数バックオフで最大 5 回リトライします。

#### Step 4. 一時ファイルとしてローカルに保存

取得した mp3 ストリームを `/tmp/{CONVERSATION_ID}.mp3` に書き出します。

### 2. kintone への書き込み

#### Step 1. ファイルアップロード

kintone REST API のファイルエンドポイント (`POST /k/v1/file.json`) に上記の一時ファイルを `multipart/form-data` で送信し、`fileKey` を受け取ります。

#### Step 2. レコード更新

AI Studio から渡された `USER.RECORD_ID` を対象に、`@kintone/rest-api-client` の `record.updateRecord` を実行します。環境変数 `KINTONE_LOGS_FIELD_CODE_RECORDING` で指定された添付ファイルフィールドに、取得した `fileKey` をセットして mp3 を紐付けます。

#### Step 3. 後始末

レコード更新が成功したら一時ファイルを削除し、ステータス 200 で応答します。

## 準備

本プロジェクトを実装するには、事前に以下の準備が必要です。

- VCR CLIのインストール（[こちらの記事](https://zenn.dev/kwcplus/articles/how-to-develop-vcr-on-local)を参照）
- kintoneアプリの準備
  - 通話ログを保存するアプリに関する以下の情報を取得してください。
    - Cybozuドメイン（xxxxxx.cybozu.comのxxxxxx部分）
    - アプリID
    - APIトークン（レコード閲覧・レコード追加・レコード編集の権限が必要）
    - アプリのフィールドコード（添付ファイルフィールド）
- Vonage アプリケーションの作成（Voiceアプリケーションとして作成）

Vonage アプリケーションの作成は以下のコマンドでも実行できます。
```sh
vcr app create --voice --name vcr-disconnected-call
```

## 使用方法

1.プロジェクトを Clone します。

  ```bash
  git clone https://github.com/mobilebiz/vcr-disconnected-call.git
  cd vcr-disconnected-call
  ```

2.必要な環境変数を設定します。

  ```bash
  mv vcr.sample.yml vcr.yml  
  ```

  `vcr.yml`に、以下の環境変数を設定する必要があります。

- `application-id`: Vonage上で作成したアプリケーションID。
- `VONAGE_VGAI_KEY`: Vonage AI StudioのAPIキー（AI Studioの右上の Userアイコン > Generate API Key で作成し、コピーしてください）。
- `KINTONE_DOMAIN`: kintoneのドメイン。
- `KINTONE_LOGS_APP_ID`: kintoneのアプリID。
- `KINTONE_LOGS_API_KEY`: kintoneのAPIキー。
- `KINTONE_LOGS_FIELD_CODE_RECORDING`: kintoneの録音ファイル添付フィールドのフィールドコード。

3.プロジェクトの依存関係をインストールします。

  ```bash
  npm install
  ```

4.デバッグモードで起動する場合は、以下のコマンドで起動します。

  ```bash
  npm run debug
  ```

  途中で以下の質問が出たら、`y`で応答してください。

  ```bash
  Are you sure you want to debug with instance app id ? [y/n]:
  ```

　デバッグモードで起動ができたら、払い出されたURLをAI StudioのStartノードの`Call Disconnected Webhook`に設定してください。

`https://neru-XXXXXXXX-debug-debug.apse1.runtime.vonage.cloud/event-disconnected-call`

`XXXXXXXX`の部分はご自分の環境に合わせて更新してください。

5.アプリケーションの本番環境へのデプロイは、以下のコマンドを実行します。

  ```bash
  vcr deploy
  ```

デプロイが完了したら、AI Studio の Start ノードの`Call Disconnected Webhook`に、以下の設定を行います。

`https://neru-XXXXXXXX-vcr-disconnected-call-dev.apse1.runtime.vonage.cloud/event-disconnected-call`

`XXXXXXXX`の部分はご自分の環境に合わせて更新してください。

## 依存関係

- `express`: Webサーバーの構築に使用。
- `axios`: HTTPリクエストの送信に使用。
- `@kintone/rest-api-client`: kintone APIとの通信に使用。
- `form-data`: ファイルアップロードに使用。

## 注意事項

- このアプリケーションは、Node.jsのモジュールシステムとしてESモジュールを使用しています。
- kintoneのAPIキーやVonageのAPIキーは、セキュリティのために公開しないでください。

## ライセンス

このプロジェクトはISCライセンスの下で公開されています。
