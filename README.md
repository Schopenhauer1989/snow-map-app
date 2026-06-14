# Snow Map App

北陸地域の雪道・通行状況を地図で共有する React + Vite アプリです。
Leaflet の地図上に投稿ピンを表示し、Firebase Firestore に投稿データを保存します。

## 主な機能

- 地図クリックで雪道情報を投稿
- 投稿の編集・削除
- 「通行可能」「通行注意」「積雪多い」「通行止め」「凍結注意」の状態表示
- 車・歩行者・車と歩行者の対象区分
- 投稿一覧と地図ピンの連動表示
- 目的地検索、出発地設定、経由地つきルート表示
- ルート付近の注意投稿チェック
- 通行可能報告による自動解決

## 使用技術

- React
- Vite
- Leaflet / React Leaflet
- Leaflet Routing Machine
- Firebase Firestore

## Firebase 設定

Firestore には `snowReports` コレクションを使用します。初回起動時に投稿が空の場合は、サンプルデータを自動登録します。