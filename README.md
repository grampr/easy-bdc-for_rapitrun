<div align="center">
  


<h1><img src="https://github.com/user-attachments/assets/85370508-c684-4084-b979-51e918d7e0e8" alt="EDBB Icon" style="width: 1em; height: 1em;"">Easy Discord Bot Builder (EDBB)</h1>
  
![EDBBCounter](https://count.getloli.com/@easybdc)

![Skills](https://skillicons.dev/icons?i=discord,js,py,html,css,tailwind)<br><br>
![Discord](https://badgen.net/discord/members/CmEGugrsje)  
![MIT](https://badgen.net/static/license/MIT/blue)  
</div>


<i><b>Easy Discord Bot Builder は、ブラウザ上でブロックを組み合わせて、誰でも簡単に Discord Bot を作成できるビジュアルプログラミングツールです。</i></b>

## 🚀 概要

プログラミングの専門知識がなくても、パズルのようにブロックを繋ぎ合わせるだけで Bot のロジックを構築できます。
作成した bot は Python コード (`discord.py`) として出力されるため、そのままご自身の環境で実行したり、学習用途に活用したりすることができます。

## ✨ 特徴

- **ビジュアルプログラミング**: 直感的なドラッグ＆ドロップ操作で開発可能。
- **豊富な機能ブロック**:
  - メッセージ受信時の応答
  - スラッシュコマンド (`/command`) の作成
  - 埋め込みメッセージ (Embed) の作成
  - プレフィックスコマンド (`!ping` など)
  - その他多数機能を搭載
- **Python コード生成**: 業界標準のライブラリに対応したコードを自動生成。
- **モダンな UI**: Tailwind CSS による洗練されたデザインと、ダークモード対応。
- **拡張性**: 任意の Python コードを直接記述できるブロックも搭載。


  ## 🛠️ 使い方

  1. **環境構築**
     ```bash
     python -m venv .venv
     .\.venv\Scripts\activate
     pip install -r requirements.txt

  依存: flask, flask-cors, discord.py

  2. サーバー起動

     python server.py
     起動後、ブラウザで http://localhost:5000/editor/index.html を開く。
     起動後、ブラウザで http://localhost:5000/editor/index.html を開く。
  3. トークン保存 (必須)
      - トークン欄に Discord Bot トークンを入力し、保存 ボタンを押す。
      - 好きなパスフレーズを2回入力すると、トークンが AES-GCM で暗号化されてブラウザに保存される。
      - パスフレーズを忘れると復号できないのでメモ必須。
  4. トークン復号 → Run
      - 復号 ボタンでパスフレーズを入力するとトークンが入力欄に戻る。
      - Run を押すとコードが生成されて Bot が起動し、ログは右下パネルに流れる。
      - Stop で Bot プロセス停止。
  5. 注意点
      - bot_run.py は Run 時に再生成される一時ファイルなので Git 管理に含めない。
      - このサーバーは認証がなく、任意コード実行が可能なので公開運用は不可。個人環境でのみ使用すること。
      - ブラウザに保存されるのは暗号化済みトークンだけだが、パスフレーズ管理は自己責任。忘れた場合は再保存が必要。

### 技術スタック

- **Frontend**: HTML, JavaScript, CSS (Tailwind CSS)
- **Core Library**: [Google Blockly](https://developers.google.com/blockly)
- **Icons**: [Lucide](https://lucide.dev/)
- **Hosting**: Cloudflare Workers / Pages
- **backend**: [flask]
### ローカルでの実行

リポジトリをクローンし、`index.html` をブラウザで開くだけで基本的な機能を利用できます。

```bash
git clone https://github.com/yuz-mc/easy-bdc-forked.git
cd easy-bdc-forked
# index.html をブラウザで開く
```

## 📄 ライセンス

このプロジェクトは [MIT License](LICENSE) の下で公開されています。

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=himais0giiiin/easy-bdc&type=date&legend=top-left)](https://www.star-history.com/?repos=journey-ad/Moe-Counter&type=Date#himais0giiiin/easy-bdc&type=date&legend=top-left)
## 💻 貢献するためには?

1. 開発者に金を貢ぎましょう。ドメイン代って高いんですよ。
2. issue を送り付けましょう。仕事が増えます。
3. 開発に協力してみましょう。

ko-fiはこちら
https://ko-fi.com/himais0giiiin
