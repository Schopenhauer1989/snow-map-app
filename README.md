# Snow Map App

北陸地域の積雪・通行状況を地図上で共有する React + Vite アプリです。Leaflet で投稿ピンとルートを表示し、Firebase Firestore の `snowReports` コレクションから投稿データを読み書きします。

## 主な機能

- 北陸地域の投稿を Leaflet 地図上にピン表示
- Firestore の `snowReports` コレクションをリアルタイム購読
- 投稿がない場合、金沢・富山・福井・新潟などのサンプル投稿を初期登録
- 地図クリックで地点を選び、タイトル・状態・対象・コメントを投稿
- 既存投稿の編集、削除、通行可能報告
- 投稿状態の表示: `通行可能`、`通行注意`、`積雪多い`、`通行止め`、`凍結注意`
- 対象の表示: `車`、`歩行者`、`車・歩行者`
- 目的地検索、出発地検索、地図クリックによる地点指定
- 歩行者向けルート表示と経由地の追加・削除
- ルートから 50m 以内にある注意投稿を検出し、該当ピンを強調表示

## 使用技術

- React 19
- Vite 8
- Firebase / Firestore
- Leaflet / React Leaflet
- Leaflet Routing Machine
- OpenStreetMap タイル
- Nominatim 場所検索 API
- OSRM ルート検索 API

## 起動方法

```bash
npm install
npm run dev
```

表示されたローカル URL をブラウザで開きます。初回表示時に Firestore の `snowReports` が空の場合は、サンプル投稿が自動で登録されます。

## 利用方法

### 投稿する

1. `投稿モード` で地図上の投稿したい場所をクリックします。
2. タイトル、状態、対象、コメントを入力します。
3. 投稿ボタンで Firestore に保存します。

### ルートを確認する

1. ナビゲーションモードに切り替えます。
2. 目的地と出発地を検索、または地図クリックで指定します。
3. 必要に応じて経由地を追加します。
4. ルート開始後、ルート付近の注意投稿が検出されます。

## Firestore のデータ

投稿は `snowReports` コレクションに保存されます。主なフィールドは次のとおりです。

- `title`: 投稿タイトル
- `status`: `cleared`、`caution`、`heavy_snow`、`blocked`、`icy`
- `target`: `car`、`pedestrian`、`both`
- `comment`: 状況コメント
- `lat` / `lng`: 投稿地点
- `isResolved`: 通行可能扱いかどうか
- `createdAt` / `updatedAt`: 日本時間の ISO 形式日時
- `passableReportCount` / `passableReports` / `autoResolved`: 通行可能報告用の情報

## 確認コマンド

Lint:

```bash
npm run lint
```

ビルド確認:

```bash
npm run build
```
