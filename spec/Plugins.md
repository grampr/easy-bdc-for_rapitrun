# Plugins Guide

## JSプラグイン

### できること
- エディタUIの変更（ボタン名、テキスト、モーダル表示など）
- Blocklyブロックの追加・削除
- コード生成ロジックの追加（例: `Blockly.Python` / `Blockly.PHP`）
- 必要に応じた外部APIアクセス（`manifest.json` の `api` 宣言が必要）

### 作り方
1. プラグイン用フォルダを作る
2. `manifest.json` を作成する（JS向けは `minAppVersion: "1.1.0"` 推奨、`1.0.0` 互換あり）
3. `plugin.js` を作成して `class Plugin` を実装する
4. `onload()` でブロック登録やUI変更を行う
5. `onunload()` で登録解除や後片付けを行う
6. `manifest.json` と `plugin.js` を ZIP 直下に入れてインストールする

### 最小構成（JS）
`manifest.json`
```json
{
  "id": "my-js-plugin",
  "name": "My JS Plugin",
  "version": "1.0.0",
  "author": "YourName",
  "description": "Example JS plugin",
  "affectsStyle": false,
  "affectsBlocks": true,
  "minAppVersion": "1.1.0",
  "pipInstall": ["discord.py[voice]"]
}
```
`pipInstall` は任意で、`pip install` コマンドの引数部分だけを記載します。

`plugin.js`
```javascript
class Plugin {
  constructor(workspace) {
    this.workspace = workspace;
  }

  async onload() {
    Blockly.Blocks['my_js_block'] = {
      init: function () {
        this.appendDummyInput().appendField('My JS Block');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
      }
    };

    Blockly.Python.forBlock['my_js_block'] = function () {
      return 'print("hello from js plugin")\\n';
    };
  }

  async onunload() {
    delete Blockly.Blocks['my_js_block'];
    delete Blockly.Python.forBlock['my_js_block'];
  }
}
```

## PHPプラグイン

### できること
- PHP向けブロックを追加する
- 追加ブロックからPHPコードを生成する（`Blockly.PHP`）
- `plugin.php` の関数を呼ぶPHPコードを生成する

### 注意点
- プラグイン本体は `plugin.js`（JavaScript）で実行される
- `plugin.php` は「生成されたPHPコード側」で利用するファイル
- `Blockly.PHP` がロードされている必要がある

### 作り方
1. プラグイン用フォルダを作る
2. `manifest.json` を作成する（PHP向けは `minAppVersion: "1.0.1"`）
3. `plugin.js` でブロックと `Blockly.PHP` の生成関数を定義する
4. 必要に応じて `plugin.php` にヘルパー関数を実装する
5. `manifest.json` / `plugin.js` / `plugin.php` を ZIP 直下に入れてインストールする

### 最小構成（PHP）
`manifest.json`
```json
{
  "id": "my-php-plugin",
  "name": "My PHP Plugin",
  "version": "1.0.0",
  "author": "YourName",
  "description": "Example PHP plugin",
  "affectsStyle": false,
  "affectsBlocks": true,
  "minAppVersion": "1.0.1",
  "pipInstall": ["discord.py"]
}
```
`pipInstall` は任意で、`pip install` まで含めた文字列は書かないでください。

`plugin.js`
```javascript
class Plugin {
  async onload() {
    Blockly.Blocks['php_call_helper'] = {
      init: function () {
        this.appendValueInput('TEXT').setCheck('String').appendField('PHP helper call');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
      }
    };

    Blockly.PHP.forBlock['php_call_helper'] = function (block) {
      const text = Blockly.PHP.valueToCode(block, 'TEXT', Blockly.PHP.ORDER_NONE) || '""';
      return "require_once __DIR__ . '/plugin.php';\\n" + `my_php_helper(${text});\\n`;
    };
  }

  async onunload() {
    delete Blockly.Blocks['php_call_helper'];
    delete Blockly.PHP.forBlock['php_call_helper'];
  }
}
```

`plugin.php`
```php
<?php
declare(strict_types=1);

if (!function_exists('my_php_helper')) {
    function my_php_helper(string $text): void
    {
        echo '[PLUGIN] ' . $text . PHP_EOL;
    }
}
```
