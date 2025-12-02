---
slug: quickstart
title: はじめての Bot
subtitle: Tutorial 2
description: スラッシュコマンドで挨拶する最小構成を作り、生成コードを動かすまでの手順。
updated: 2025-12-02
tags: [quickstart, slash]
accent: blue
order: 2
---

# Tutorial 2: はじめての Bot

スラッシュコマンドで挨拶するミニマムな Bot を組み、エディタで生成した Python コードを手元で実行するまでの流れをまとめます。

## 前提と準備

- Discord Developer Portal で Bot を作成し、トークンを控えておく
- Bot に「アプリコマンドを作成」「メッセージ送信」権限を付けた招待 URL を発行する
- ローカルで動かす場合は Python 3.10+ を入れ、`pip install -U discord.py` を実行
- 音楽ブロックを使う場合は FFmpeg をインストール（詳しくは `環境準備とプラグイン導入` を参照）

最小セットアップの例:

```bash
python -m venv .venv
.\.venv\Scripts\activate   # macOS/Linux: source .venv/bin/activate
pip install -U discord.py
echo BOT_TOKEN=xxxxxxx > .env
```

## Step 1: エディタでブロックを配置

1. **イベントを置く**  
   左の「イベント」から「⚡ スラッシュコマンド」をドラッグ。コマンド名を `hello` にする。

2. **返信をつなぐ**  
   「応答」から「↩ 返信する」をイベント内に接続し、メッセージ欄に `こんにちは！` と入力。

3. **Embed を足す（任意）**  
   「埋め込み作成」「タイトル」「説明」をつなぎ、返信ブロックに差し込む。

4. **コードを確認**  
   右上または右側パネルで生成された Python コードを確認する。

> ヒント: 返答をあとで編集したいときは「応答を保留」「返信を編集」ブロックを組み合わせる。

## Step 2: コードを保存して実行

1. 生成コードをコピーし、`bot.py` など任意のファイルに保存する。
2. ファイル内の `BOT_TOKEN` などトークン設定箇所を書き換える。
3. ターミナルで `python bot.py` を実行し、ログに `Bot is ready` などが出れば成功。
4. Discord で `/hello` を入力し、挨拶が返れば完了。

> スラッシュコマンドは登録に数分かかる場合があります。まずは Guild 限定で試すと反映が早いです。

## トラブルシュート

- **コマンドが出ない**: Bot を招待した Guild に対して再読み込みを待つ。再起動や Guild 限定登録を試す。
- **Missing Access**: Bot の権限ロールに「アプリコマンド作成」「メッセージ送信」が含まれているか確認。
- **文字化け**: ターミナルやエディタを UTF-8 に設定して保存する。
