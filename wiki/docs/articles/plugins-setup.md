---
slug: plugins-setup
title: ブラウザで組んで Python に持ち帰る準備
subtitle: Tutorial 1
description: EDBB を開き、ブロックを組んで、生成された Python を実行するまでの準備をブログ調で整理。env 管理は無いので Token はコードに直接差し込みます。
updated: 2025-12-02
tags: [setup, dependencies, ffmpeg]
accent: cyan
order: 1
---

# Tutorial 1: ブラウザで組んで Python に持ち帰る準備

EDBB はブラウザだけで完結します。やることは「エディタを開いてブロックを置く」「生成されたコードに Token を入れて Python で走らせる」の2つ。env の仕組みは付いていないので、コード側に直接 Token を書き込みます。

## この記事のゴール

- EDBB のエディタを開ける状態にしておく（インストール不要）
- 自動保存・共有リンク・コード生成ボタンの場所を把握する
- 生成コードを Python + `discord.py` で実行する手順を知る
- 音声ブロックを使う場合の FFmpeg だけ後で足せるようにする

## ブラウザ側でやること

- エディタを開く: 公開版なら `https://himais0giiiin.com/editor/`、ローカルならリポジトリ内の `editor/index.html` をブラウザで開くだけ。
- レイアウト: ヘッダーの `Blocks / Split` トグルでブロックのみ表示かコード同時表示かを切り替え。
- 自動保存: ブロックを動かすとローカルストレージに保存されます。右上の Import/Export で JSON バックアップも取れます。
- 共有: `共有` ボタンでブロックの URL とプレビュー画像を生成。閲覧モード付きで安全に見せられます。
- コード生成: `コード生成` ボタンを押すと Python が丸ごと出ます。最後の `bot.run('TOKEN')` に自分の Token を直書きしてください。

## 生成コードを動かす最低限

1. Python 3.10+ を用意し、ターミナルで `pip install -U "discord.py[voice]"`（音声ブロックがあるため `[voice]` 付きが無難）。
2. コード生成モーダルからコピーした内容を `bot.py` などに保存。
3. 最下部の `bot.run('TOKEN')` に Discord Bot Token を文字列で差し込み。
4. `python bot.py` で実行し、ターミナルに `Synced ... command(s)` が出れば OK。

env を使った Token 管理は EDBB 側では提供していません。自前で `.env` を読みたい場合は生成コードに追記する運用になります。

## 権限と Intents の注意

生成コードでは `message_content` / `members` / `voice_states` の Intents を有効にしています。Developer Portal 側でも同じ Intents をオンにし、Bot を再招待しておくと挙動が安定します。

## 音声ブロックを使うなら

`🔊 音楽ファイルを再生` ブロックは FFmpeg を前提にしています。OS に合わせて FFmpeg を入れ、パスが通っているか `ffmpeg -version` で確認しておくと安心です。

## つまずき防止チェック

- エディタが開かない → ローカルなら `editor/index.html` を直接開く（ビルド不要）
- コード生成後に起動しない → Token が空になっていないか、Intents を Portal 側で有効化しているかを確認
- 音が出ない → `discord.py[voice]` と FFmpeg の導入、Bot に VC の接続/発言権限があるかを確認
