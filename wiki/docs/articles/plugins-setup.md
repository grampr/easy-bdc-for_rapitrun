---
slug: plugins-setup
title: 環境準備とプラグイン導入
subtitle: Tutorial 1
description: discord.py の導入、.env 運用、FFmpeg インストールまでをまとめた環境準備ガイド。
updated: 2025-12-02
tags: [setup, dependencies, ffmpeg]
accent: cyan
order: 1
---

# Tutorial 1: 環境準備とプラグイン導入

EDBB で生成したコードをすぐに動かせるよう、Python と FFmpeg まわりの初期セットアップをまとめます。

## 事前に用意するもの

- **Python 3.10+** と `pip`
- **discord.py**: Bot のコアライブラリ
- **python-dotenv**: `.env` からトークンを読み込むため
- **FFmpeg**: 音声ブロックを使うときに必須
- **Git / エディタ**: VS Code など、コード編集とバージョン管理用（任意）

## Python 仮想環境とライブラリ

プロジェクトごとに仮想環境を作っておくと、依存関係をきれいに保てます。

```bash
# 仮想環境を作成して有効化
python -m venv .venv
.\.venv\Scripts\activate      # macOS/Linux: source .venv/bin/activate

# ライブラリを導入
pip install -U discord.py python-dotenv
```

## .env を作成して読み込む

1. ルートに `.env` を作り、Bot トークンや Guild ID を書く
2. Python コードの先頭付近で `load_dotenv()` を呼び出す

```env
# .env
BOT_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
GUILD_ID=123456789012345678
```

```python
from dotenv import load_dotenv
import os

load_dotenv()
BOT_TOKEN = os.getenv("BOT_TOKEN")
GUILD_ID = os.getenv("GUILD_ID")
```

Git 管理する場合は `.gitignore` に `.env` を入れておくと安全です。

## FFmpeg の入れ方

- **Windows**: [公式ダウンロード](https://ffmpeg.org/download.html) から Gyan build を取得し、`bin/ffmpeg.exe` を環境変数 `PATH` に追加。
- **macOS**: Homebrew 使用なら `brew install ffmpeg`。
- **Linux**: Debian/Ubuntu 系は `sudo apt-get install ffmpeg`、RHEL/CentOS 系は `sudo dnf install ffmpeg`（必要なら EPEL を有効化）。

インストール後に `ffmpeg -version` でバージョンが表示されれば完了です。

## 動作確認チェックリスト

- `pip show discord.py` でバージョンが出る
- `ffmpeg -version` が通る
- `.env` にトークンが入り、Git でコミット対象になっていない
- `python bot.py` で起動ログが出る（Gateway Intents を有効化している場合はポータル設定も確認）
