# vcr-disconnected-call

## 概要

このプロジェクトは、Vonage AI StudioとKintoneを統合し、通話の録音データを取得してKintoneに保存するNode.jsアプリケーションです。Expressを使用してAPIサーバーを構築し、VonageのAPIを通じて通話データを取得し、KintoneのAPIを使用してデータを保存します。

このプロジェクトは、以下の記事と関連しています。
この記事の内容を事前に実施しておいてください。

[V Callプラグイン 着信カスタマイズ（基礎編）](https://zenn.dev/kwcplus/articles/vcall-incoming-basic)

## 主な機能

- **通話切断イベントの処理**: Vonage AI Studioから通話切断イベントを受信し、通話の録音データを取得します。
- **録音データの保存**: 取得した録音データを一時ファイルとしてローカルに保存します。
- **Kintoneへのデータ保存**: 録音データをKintoneにアップロードし、関連する通話ログを更新します。
- **録音データの削除**: 処理が完了した後、ローカルに保存した録音データを削除します。

## 環境変数

`vcr.yml`に、以下の環境変数を設定する必要があります。

- `application-id`: AI StudioのアプリケーションID。
- `VONAGE_VGAI_KEY`: Vonage AI StudioのAPIキー。
- `KINTONE_DOMAIN`: Kintoneのドメイン。
- `KINTONE_LOGS_APP_ID`: KintoneのアプリID。
- `KINTONE_LOGS_API_KEY`: KintoneのAPIキー。

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
- `@kintone/rest-api-client`: Kintone APIとの通信に使用。
- `form-data`: ファイルアップロードに使用。

## 注意事項

- このアプリケーションは、Node.jsのモジュールシステムとしてESモジュールを使用しています。
- KintoneのAPIキーやVonageのAPIキーは、セキュリティのために公開しないでください。

## ライセンス

このプロジェクトはISCライセンスの下で公開されています。
