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
- `kintone_DOMAIN`: kintoneのドメイン。
- `kintone_LOGS_APP_ID`: kintoneのアプリID。
- `kintone_LOGS_API_KEY`: kintoneのAPIキー。
- `kintone_LOGS_FIELD_CODE_RECORDING`: kintoneの録音ファイル添付フィールドのフィールドコード。

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
