---
title: vcr-disconnected-call セットアップマニュアル
subtitle: Vonage Cloud Runtime（VCR）が初めての方向け
date: 2026-05-11
---

# はじめに

このマニュアルは、Vonage の AI Studio と kintone を組み合わせて「通話の録音データを自動で kintone に保存する」アプリケーション `vcr-disconnected-call` を、**VCR が初めての方でも動かせる**ようにステップごとに説明したものです。

## このアプリでできること

- お客様から電話がかかってくると、Vonage AI Studio が応対します。
- 応対が終わると、本アプリが起動して以下を自動で行います。
    1. AI Studio から録音データを取得
    2. kintone の通話ログアプリに mp3 をアップロード
    3. 通話ログレコードの「録音」フィールドに紐付け

## システム全体像

```
[電話の発信者]
      │ 着信
      ▼
[Vonage 電話番号（apse1）]
      │
      ▼
[Vonage AI Studio エージェント（US/EU）]
      │ 通話を応対 / 録音
      │ 通話が切断されると Webhook を呼び出す
      ▼
[本アプリ（VCR上で動作）]
      │ ① Insights API でセッション情報を取得
      │ ② JWT を decode して録音 URL を抽出
      │ ③ Voice API（apse1）から録音ファイル取得
      │ ④ kintone API でファイルアップロード
      │ ⑤ kintone レコードに録音を紐付け
      ▼
[kintone アプリ]
```

# 第1部：事前準備

ここでは、アプリを動かすのに必要な**各種アカウントと環境**を整えます。

## 1.1 必要なもの一覧

| 項目 | 用途 |
|---|---|
| Node.js（v20 以上） | 本アプリのランタイム |
| Git | リポジトリの取得 |
| Vonage アカウント | Voice / AI Studio の利用 |
| kintone 環境 | 通話ログ保存先 |
| ターミナル（macOS / Linux / Windows のいずれか） | コマンド実行 |

## 1.2 Node.js のインストール

すでに入っていれば不要です。バージョンの確認は以下のコマンドで行います。

```bash
node --version
```

`v20.x.x` 以上が表示されれば OK です。未インストールの場合は [Node.js 公式サイト](https://nodejs.org/) から LTS 版をインストールしてください。

## 1.3 Vonage アカウントの準備

1. [KDDIウェブコミュニケーションズの Vonage 申し込みページ](https://kwcplus.kddi-web.com/application/vonage) からアカウントを作成（または既存アカウントでログイン）します。
2. ダッシュボードの「Getting Started」または「Settings」ページで、**API Key** と **API Secret** をメモしておきます。後ほど VCR CLI の設定で使います。

# 第2部：VCR CLI のセットアップ

Vonage Cloud Runtime（VCR）は、Vonage が提供するサーバーレス実行環境です。本アプリは VCR 上にデプロイして動かします。VCR CLI は、その VCR を操作するためのコマンドラインツールです。

## 2.1 VCR CLI のインストール

macOS / Linux：

```bash
curl -L https://vcr.vonage.com/install.sh | sh
```

Windows（PowerShell）：

```powershell
iwr https://vcr.vonage.com/install.ps1 -useb | iex
```

インストール後、ターミナルを再起動してから確認します。

```bash
vcr --version
```

バージョン番号が表示されれば成功です。

## 2.2 VCR CLI に認証情報を登録

```bash
vcr configure
```

対話形式で以下を聞かれます。

- **API Key**: 1.3 でメモした API Key
- **API Secret**: 1.3 でメモした API Secret
- **Region**: `aws.apse1`（Singapore）を選択

ユーザーホームに設定ファイル（`~/.vcr-cli` など）が作成されます。

## 2.3 Vonage アプリケーション（Voice）の作成

VCR 上で動くアプリは、Vonage の「Application」と紐付けて動作します。Voice 機能（録音取得）が必要なので **Voice アプリケーション**として作成します。

VCR CLI で一発で作る場合：

```bash
vcr app create --voice --name vcr-disconnected-call
```

実行すると以下が表示されます。

- **Application ID**（例：`103767cf-88d6-44f8-8ddd-235d5ce9f764`） → これを後で `vcr.yml` に記入します。

ダッシュボードから作成する場合は、[Vonage Dashboard → Applications → Create new](https://dashboard.nexmo.com/applications/new) で「Voice」を有効にして作成します。

# 第3部：Vonage AI Studio の準備

通話に応対するエージェントが AI Studio 上に必要です。**本マニュアルではエージェントの作成手順そのものは扱いません**が、最低限以下が用意されている前提です。

## 3.1 前提

- AI Studio 上にエージェントが作成済み
- そのエージェントが Vonage の電話番号に紐付いている
- エージェントのフローの中で、kintone に「着信ログレコード」を作成し、そのレコード ID を `USER.RECORD_ID` というセッション変数に格納する処理が組み込まれている

`USER.RECORD_ID` は本アプリが録音を紐付けるレコードを特定するために使う重要な値です。フローを設計する際は必ず設定してください。

## 3.2 AI Studio API Key の発行

本アプリは AI Studio Insights API を呼び出して録音情報を取得します。そのための API Key を発行します。

1. [AI Studio](https://studio.ai.vonage.com/) にログイン
2. 右上のユーザーアイコン → **Generate API Key**
3. 表示された API Key をコピー（後ほど `VONAGE_VGAI_KEY` として使用）

## 3.3 切断 Webhook の設定（あとで実施）

通話が切断されたときに本アプリに通知してもらう Webhook URL を、AI Studio のフローの **Start ノード → Call Disconnected Webhook** に設定します。これはアプリをデプロイしたあとで行うので、ここでは「設定する場所」だけ覚えておいてください。

# 第4部：kintone の準備

## 4.1 通話ログアプリの作成

kintone で「通話ログを保存するアプリ」を新規作成します。最低限、以下のフィールドを用意してください。

| フィールド種類 | 用途 |
|---|---|
| 添付ファイル | 録音 mp3 を保存（**フィールドコード**をメモ）|
| その他、AI Studio のフローで保存したい情報（電話番号、顧客名 など） | 任意 |

**ポイント：**
- フィールドコードは「フォーム設定」→ 各フィールドの「設定（歯車）」→「フィールドコード」で確認できます。
- 例：添付ファイルフィールドのフィールドコードを `recorded` にする、など。

## 4.2 アプリ情報の確認

アプリ作成後、以下をメモします。

| 項目 | 確認方法 |
|---|---|
| **ドメイン** | URL `https://xxxxxx.cybozu.com/...` の `xxxxxx` 部分 |
| **アプリ ID** | アプリ URL `https://xxxxxx.cybozu.com/k/123/` の `123` 部分 |
| **添付ファイルフィールドのフィールドコード** | 上記 4.1 で設定した値 |

## 4.3 API トークンの発行

1. kintone アプリの右上「設定（歯車アイコン）」をクリック
2. 「設定」タブ → 「API トークン」を選択
3. 「生成する」をクリック
4. 権限として **レコード閲覧 / レコード追加 / レコード編集** にチェックを入れる
5. メモを入力（任意）し「保存」
6. アプリの設定画面に戻り、必ず**右上の「アプリを更新」ボタンを押す**（押し忘れるとトークンが有効になりません）
7. 発行されたトークン文字列をメモ

# 第5部：本アプリのセットアップ

ここからは実際にコードを取得して動かしていきます。

## 5.1 リポジトリの clone

任意の作業ディレクトリで以下を実行します。

```bash
git clone https://github.com/mobilebiz/vcr-disconnected-call.git
cd vcr-disconnected-call
```

## 5.2 依存パッケージのインストール

```bash
npm install
```

## 5.3 `vcr.yml` の作成と編集

サンプルファイルをコピーします。

```bash
mv vcr.sample.yml vcr.yml
```

`vcr.yml` を開いて以下を埋めます。

```yaml
project:
    name: vcr-disconnected-call
instance:
    name: dev
    runtime: nodejs22
    region: aws.apse1
    application-id: <第2部 2.3 でメモした Application ID>
    environment:
        - name: VONAGE_VGAI_KEY
          value: <第3部 3.2 でメモした AI Studio API Key>
        - name: KINTONE_DOMAIN
          value: <第4部 4.2 でメモした kintone ドメイン>
        - name: KINTONE_LOGS_APP_ID
          value: <第4部 4.2 でメモした kintone アプリ ID>
        - name: KINTONE_LOGS_API_KEY
          value: <第4部 4.3 でメモした API トークン>
        - name: KINTONE_LOGS_FIELD_CODE_RECORDING
          value: <第4部 4.2 でメモした 添付ファイルフィールドコード>
    entrypoint:
        - node
        - index.js
debug:
    name: debug
    application-id: <Application ID（instance と同じでOK）>
    entrypoint:
        - nodemon
        - --inspect
        - index.js
```

### 各環境変数の意味

| 環境変数 | 説明 |
|---|---|
| `VONAGE_VGAI_KEY` | AI Studio の Insights API を呼ぶ時のキー |
| `KINTONE_DOMAIN` | kintone サブドメイン（`xxxxxx.cybozu.com` の `xxxxxx`）|
| `KINTONE_LOGS_APP_ID` | 通話ログ保存先アプリの ID |
| `KINTONE_LOGS_API_KEY` | 通話ログ保存先アプリの API トークン |
| `KINTONE_LOGS_FIELD_CODE_RECORDING` | 録音 mp3 を保存する添付ファイルフィールドのコード |

**注意：** `vcr.yml` には機密情報が含まれます。`.gitignore` で除外済みなので Git にコミットされませんが、共有時には十分注意してください。

# 第6部：動作確認（デバッグモード）

実際にデプロイする前に、ローカル開発機で動作確認をします。VCR には「デバッグモード」があり、ローカルのコードを VCR 上の Webhook URL から呼べるようになります。

## 6.1 デバッグモードの起動

```bash
npm run debug
```

途中で以下のような確認が出たら `y` を入力します。

```
Are you sure you want to debug with instance app id ? [y/n]:
```

しばらくすると、次のような URL が表示されます。

```
✓ Debug server deployed: service_name="neru-XXXXXXXX-debug-debug"
Application Host: https://neru-XXXXXXXX-debug-debug.apse1.runtime.vonage.cloud
```

この URL の末尾に `/event-disconnected-call` を付けたものが、AI Studio に登録する Webhook URL です。

```
https://neru-XXXXXXXX-debug-debug.apse1.runtime.vonage.cloud/event-disconnected-call
```

## 6.2 AI Studio 側に Webhook URL を設定

1. AI Studio でエージェントを開く
2. **Start ノード**をクリック
3. **Call Disconnected Webhook** の欄に上記の URL を入力
4. エージェントを保存・公開

## 6.3 テスト発信

実際に AI Studio に紐付いた電話番号に電話をかけ、適当に応対して切断します。

ローカルのターミナルに以下のようなログが順に出れば成功です。

```
🐞 event-disconnected-call received
🐞 Waiting 5000ms before insights fetch (attempt 1/5)
🐞 parameters: { ... }
🐞 channel_data: { ... }
🐞 recording_url: https://api-sg-1.nexmo.com/v1/files/...
🐞 Waiting 5000ms before recording fetch (attempt 1/5)
🐞 Recording file stream got.
🐞 Recording file save to /tmp/CON-xxxxxxxx.mp3
🐞 response.data: {"fileKey":"..."}
🐞 fileKey: ...
🐞 Record updated.
🐞 Recording file deleted.
```

kintone のレコードを開き、添付ファイルフィールドに mp3 が紐付いていれば完了です。

## 6.4 デバッグモードの終了

ターミナルで `Ctrl + C` を押します。VCR 側のデバッグサーバも自動的に削除されます。

> **注意：** デバッグセッションは Vonage 側で「1 アカウントあたり 1 つ」までです。前のセッションが残って `429` エラーが出たら、`vcr debug prune-sessions` を実行してから再度起動してください。

# 第7部：本番デプロイ

動作確認が取れたら、本番環境にデプロイします。本番では VCR 上のサーバが常時稼働し、AI Studio からの Webhook を受け付けます。

## 7.1 デプロイの実行

```bash
vcr deploy
```

デプロイが成功すると、本番用の URL が表示されます。

```
https://neru-XXXXXXXX-vcr-disconnected-call-dev.apse1.runtime.vonage.cloud
```

## 7.2 AI Studio の Webhook を本番 URL に変更

6.2 で設定した Webhook URL を、本番 URL に書き換えます。

```
https://neru-XXXXXXXX-vcr-disconnected-call-dev.apse1.runtime.vonage.cloud/event-disconnected-call
```

これで、実際の電話着信時に録音が自動で kintone に保存されるようになります。

# 第8部：困ったときに

## 8.1 よくあるエラーと対処

### `429 maximum debug session limit of 1 reached`

過去のデバッグセッションが残っています。以下を実行してください。

```bash
vcr debug prune-sessions
```

### `audio_url not available after retries`

AI Studio の処理が遅れて、リトライ上限内に録音 URL が取得できなかったケースです。短時間で再現するなら、AI Studio フローの構成や Vonage 側のステータスを確認してください。

### `KintoneRestAPIError [404] [GAIA_RE01] 指定したレコード（id: xxx）が見つかりません`

`USER.RECORD_ID` で指定されたレコードが kintone 側に存在していません。以下を確認してください。

- AI Studio のフロー内で「kintone レコード作成」が実行されているか
- 作成先の kintone アプリ ID と、`KINTONE_LOGS_APP_ID` が同じか
- kintone の API トークンに「レコード追加」権限があるか

### `401 Unauthorized` が録音取得時に出る

`VONAGE_VGAI_KEY` または Vonage Application の Application ID が正しくセットされていません。`vcr.yml` を見直し、必要なら `vcr debug` を再起動してください（環境変数の変更は再デプロイで反映されます）。

## 8.2 ログの確認

本番環境のログは以下で確認できます。

```bash
vcr instance log --project-name vcr-disconnected-call --instance-name dev
```

# 付録：内部の動き（おさらい）

詳細は README.md の「しくみ」セクションを参照してください。要点だけ列挙すると：

1. AI Studio から `POST /event-disconnected-call` の Webhook を受信
2. Insights API で `audio_url` を取得（取得できるまで指数バックオフでリトライ）
3. `audio_url` の JWT を decode して `recordingUrl`（Voice API の URL）を抽出
4. VCR SDK で Vonage Application JWT を生成し、Voice API へ直接アクセスして mp3 を取得
5. mp3 を kintone にアップロードして `fileKey` を取得
6. `USER.RECORD_ID` のレコードに `fileKey` を紐付ける

リージョンが AI Studio (US/EU) と Voice (apse1) で異なる構成のため、`stairway-us-east-1.ai.vonage.com` の経由がうまく動かず、Voice API へ直接アクセスする実装になっている点が本アプリの特徴です。
