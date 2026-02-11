# CDM プラグイン作成手順書

CDM (Easy Discord Bot Builder) の機能を拡張するためのプラグイン作成ガイドです。

## 1. プラグインの基本構造

プラグインは以下の2つのファイルを含む ZIP 形式で配布・インストールされます。

- `manifest.json`: プラグインのメタデータ（必須）
- `plugin.js`: プラグインの実行コード（必須）

### manifest.json の例

```json
{
  "name": "My Plugin",
  "author": "YourName",
  "version": "1.0.0",
  "description": "プラグインの説明文です。",
  "affectsStyle": false,
  "affectsBlocks": true,
  "isCustom": true,
  "repo": "https://github.com/YourName/my-plugin"
}
```

| 項目 | 型 | 説明 |
| :--- | :--- | :--- |
| `name` | string | プラグインの表示名。 |
| `author` | string | 開発者名。 |
| `affectsStyle` | boolean | スタイル（CSSなど）に干渉するかどうか。 |
| `affectsBlocks` | boolean | ブロック（Blockly）に干渉するかどうか。 |
| `isCustom` | boolean | 自作プラグインかどうか。`true` の場合、セキュリティのため共有機能が制限されます。 |
| `repo` | string | GitHub リポジトリの URL（マーケットプレイス連携に必要）。 |

---

## 2. プラグインの実装 (plugin.js)

`plugin.js` は、以下の `Plugin` クラスを定義し、`workspace` を受け取るコンストラクタを持つ必要があります。

```javascript
class Plugin {
    constructor(workspace) {
        this.workspace = workspace;
    }

    // プラグインが有効化された時に呼ばれる
    async onload() {
        console.log("Plugin Loaded!");
        this.registerBlocks();
    }

    // プラグインが無効化された時に呼ばれる
    async onunload() {
        console.log("Plugin Unloaded");
        // 追加した要素の削除などのクリーンアップを行う
    }

    registerBlocks() {
        // Blockly ブロックの登録ロジック
    }
}
```

---

## 3. マーケットプレイスへの公開

作成したプラグインを CDM のマーケットプレイス（「GitHubで探す」）に表示させるには、以下の手順が必要です。

1.  GitHub リポジトリを作成し、コードをアップロードする。
2.  リポジトリの **Topics** に `edbp-plugin` を追加する。
3.  リポジトリのルートに `manifest.json` と `plugin.js` を配置する。

### 公式・公認バッジについて

- **公式バッジ**: `EDBPlugin` 組織のリポジトリであること。
- **公認バッジ**: `EDBPlugin/EDBP-API` の `1.json` リストに登録されていること。

---

## 4. 注意事項

- **CORS制限**: ブラウザから直接外部リソースを取得する場合、CORS 制限に注意してください。CDM 本体はプロキシを使用して GitHub からのインストールをサポートしています。
- **共有制限**: `isCustom: true` かつ `affectsBlocks: true` のプラグインが有効な場合、そのプロジェクトは共有リンクを作成できません。
- **UUID**: インストール時にシステムによって一意の UUID が割り振られます。共有機能はこの UUID を使用してプラグインを特定します。
