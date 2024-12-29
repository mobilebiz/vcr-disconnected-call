# vcr-disconnected-call

## 概要

このプロジェクトは、Vonage AI StudioとKintoneを統合し、通話の録音データを取得してKintoneに保存するNode.jsアプリケーションです。Expressを使用してAPIサーバーを構築し、VonageのAPIを通じて通話データを取得し、KintoneのAPIを使用してデータを保存します。

このプロジェクトは、以下の記事と関連しています。
この記事の内容を事前に実施しておいてください。

[kintone × AI Studio 着信ハンズオン](https://zenn.dev/kwcplus/articles/kintone-incoming-agent)

## 主な機能

- **通話切断イベントの処理**: Vonage AI Studioから通話切断イベントを受信し、通話の録音データを取得します。
- **録音データの保存**: 取得した録音データを一時ファイルとしてローカルに保存します。
- **Kintoneへのデータ保存**: 録音データをKintoneにアップロードし、関連する通話ログを更新します。
- **録音データの削除**: 処理が完了した後、ローカルに保存した録音データを削除します。

## 環境変数

`vcr.yml`に、以下の環境変数を設定する必要があります。

- `VCR_PORT`: アプリケーションがリッスンするポート番号。
- `VONAGE_VGAI_KEY`: Vonage AI StudioのAPIキー。
- `KINTONE_DOMAIN`: Kintoneのドメイン。
- `KINTONE_LOGS_APP_ID`: KintoneのアプリID。
- `KINTONE_LOGS_API_KEY`: KintoneのAPIキー。

## 使用方法

1.必要な環境変数を設定します。

  ```bash
  mv vcr.sample.yml vcr.yml  
  ```
  
2.プロジェクトの依存関係をインストールします。

  ```bash
  npm install
  ```

3.デバッグモードで起動する場合は、以下のコマンドで起動します。

  ```bash
  npm run debug
  ```

　デバッグモードで起動ができたら、払い出されたURLをAI StudioのStartノードの`Call Disconnected Webhook`に設定してください。

`https://neru-XXXXXXXX-debug-debug.apse1.runtime.vonage.cloud/event-disconnected-call`

`XXXXXXXX`の部分はご自分の環境に合わせて更新してください。

4.アプリケーションの本番環境へのデプロイは、以下のコマンドを実行します。

  ```bash
  vcr deploy
  ```

デプロイが完了したら、AI Studio の Start ノードの`Call Disconnected Webhook`に、以下の設定を行います。

`https://neru-XXXXXXXX-vcr-disconnected-call-dev.apse1.runtime.vonage.cloud/event-disconnected-call`

`XXXXXXXX`の部分はご自分の環境に合わせて更新してください。

## 依存関係

- `express`: Webサーバーの構築に使用。
- `axios`: HTTPリクエストの送信に使用。
- `@kintone/rest-api-client`: Kintone APIとの通信に使用。
- `form-data`: ファイルアップロードに使用。

## 注意事項

- このアプリケーションは、Node.jsのモジュールシステムとしてESモジュールを使用しています。
- KintoneのAPIキーやVonageのAPIキーは、セキュリティのために公開しないでください。

## ライセンス

このプロジェクトはISCライセンスの下で公開されています。
