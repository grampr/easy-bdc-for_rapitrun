---
slug: moderation-logging
title: モデレーション & ログ
subtitle: Tutorial 4
description: メッセージ削除、リアクション監視、Kick/BAN、ログ出力など、サーバー管理に役立つ構成例。
updated: 2025-12-02
tags: [moderation, logs, roles]
accent: emerald
order: 4
---

# Tutorial 4: モデレーション & ログ

削除・リアクション監視・Kick/BAN・スレッド・ロール付与をまとめた管理テンプレートです。

## 使用ブロック

- イベント: `on_message`, `on_reaction_add`, `on_member_join` / `on_member_remove`
- メッセージ系: `delete_message`, `purge_messages`, `create_thread`
- 権限: `member_has_role`, `get_user_info`
- アクション: `kick_user`, `ban_user`, `add_user_role`, `remove_user_role`
- ログ送信: `send_channel_message`, `create_embed`, `add_embed_field`
- 待機/判定: `controls_if`, `wait_seconds`

## 構成例

1. **ログ用チャンネル ID** を変数や定数にしておき、ログ送信ブロックの引数に使う。
2. **メッセージ削除**: `on_message` 内で NG ワードを判定し、hit したら `delete_message` とログ送信。
3. **リアクション監視**: 特定メッセージ ID + 絵文字を `on_reaction_add` で検知し、役職付与やスレッド作成。
4. **Kick/BAN**: スラッシュ or プレフィックスコマンドでユーザー ID を受け取り、理由を添えて kick/ban。ログへ Embed 送信。
5. **退出検知**: `on_member_remove` で「さようなら」メッセージを送り、同時にロール情報をログに記録。

> Embed ログのひな形:  
> `create_embed` → 「タイトル = Moderation Log」→ フィールドに「ユーザー」「操作」「理由」「実行者」を追加 → 「チャンネル ID に送信」。

## 権限と安全策

- Bot ロールが対象ユーザーより上位にあること（ロール付与/剥奪やキック/BAN）。
- 「メッセージの管理」「ロールの管理」「メンバーをキック/BAN」権限を付与。
- 誤操作防止に `controls_if` で `member_has_role` をチェックし、許可ロールのみ実行。
- 大量削除 `purge_messages` は 100 件以内でテストし、上限を変数で管理すると安全。
