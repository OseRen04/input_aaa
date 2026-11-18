# Local Input Translator

PLaMo 3 Translate 0.8B GGUF を使い、日本語で入力した文章を Chrome 拡張機能の中で選択言語に翻訳するプロトタイプ。翻訳文を入力欄に直接置換できます。

- **LLM**: [pfnet/plamo-3-translate-0.8b-GGUF](https://huggingface.co/pfnet/plamo-3-translate-0.8b-GGUF) (`Q4_K_M`、約0.57GB)
- **推論**: [@wllama/wllama](https://github.com/ngxson/wllama) + WebAssembly / 対応環境で WebGPU
- **UI**: Chrome Manifest V3、ポップアップ、キーボードショートカット
- **翻訳先**: PLaMo が対応する53言語。入力文の言語は日本語で固定
- **通信**: 初回モデル取得時は Hugging Face に通信。翻訳する文章は外部APIに送信しない

## 機能

1. ポップアップの入力欄に日本語を入れ、翻訳先言語を選択して翻訳・コピーする。
2. Webページのテキスト入力欄にカーソルを置き、Macでは `Command+Shift+Y`、Windows/Linuxでは `Ctrl+Shift+Y` で、その入力欄の文章を翻訳して置換する。文章の一部を選択している場合は選択部分のみを置換する。
3. `contenteditable` では翻訳する範囲を選択した場合のみ対応。
4. **翻訳中に入力欄が変更された場合は上書きしない。**
5. 初回にモデルをダウンロードし、wllama のブラウザ内キャッシュに保存する。キャッシュの保持はブラウザ側のストレージ状態に依存する。

### 必要環境

- Chrome 116以降（WebGPUが使えない環境ではWASM/CPUへのフォールバックに依存）
- Node.js 20以降、npm
- 初回モデルダウンロードに約570MBの通信、モデル動作に追加のRAM/VRAMが必要

## Chromeへのインストール

```bash
npm install
npm run check
npm run build
```

1. Chromeで `chrome://extensions` を開く。
2. 「デベロッパーモード」を有効化する。
3. 「パッケージ化されていない拡張機能を読み込む」で **`dist/`** を指定する。
4. 拡張機能をクリックして翻訳先言語を選択する。
5. ポップアップかページ上の入力欄で翻訳を実行する。最初の翻訳ではモデルを取得するため時間がかかる。

ショートカットが衝突する場合は `chrome://extensions/shortcuts` で変更する。Chrome内部ページ（`chrome://`）、Chrome Web Storeなど、拡張スクリプトを注入できないページでは入力欄置換は利用不可。ページによってはリッチエディタ側で変更を受理しないこともある。

## ソース公開（GitHub CLI）

GitHub CLI をMacにインストールし認証した上で、プロジェクトのルートで以下を実行する。

```bash
brew install gh
gh auth login
./scripts/publish.sh
```

`local-input-translator` という**公開リポジトリ**を作成し、現在のソースをコミットしてpushする。既存の `origin` が設定されている場合は事故防止のため停止する。

## データと権限

- `activeTab`, `scripting`: **操作したタブにだけ**入力欄を読み取るコードを注入する。全ページの常時監視は行わない。
- `storage`: 翻訳先言語をローカル保存する。翻訳原文の履歴は保存しない。
- `offscreen`: バックグラウンドでwllamaによるLLM推論を行う。
- Hugging Faceのホスト権限: モデルのダウンロードのみ。変換対象の文章は送信しない。

PLaMo のモデル重みは**このリポジトリに含まれない**。モデルは [PLaMo Community License](https://plamo.preferredai.jp/info/plamo-community-license-en) が適用される。ソースコードのMITライセンスとは別であり、特に商用配布・利用時はモデルの条件を確認すること。

## アーキテクチャ

```text
Chrome popup / keyboard command
       |
background service worker --(activeTab + scripting)--> page input
       |
Chrome offscreen document
       |
@wllama/wllama + WebAssembly/WebGPU
       |
PLaMo 3 Translate 0.8B (GGUF, OPFS cache)
       |
translation result --(runtime message)--> popup / original input
```

翻訳プロンプトは[公式のPFML3](https://huggingface.co/pfnet/plamo-3-translate-0.8b-GGUF#pfml3-prompt-format)形式を使用し、`lang=ja` → 選択先コードを指定する。LLMに文章への追加指示を書かせる汎用チャット形式ではない。

## 既知の制約 / 検証状況

- 単体テストとコード静的検査は可能。ただし実モデルによる翻訳精度、Chrome実機での性能・Offscreen/Wllama互換性は要検証。
- モデル取得URL・量子化は固定。大きい文章は3000文字までに制限。
- 長文、特殊なフォーム、Shadow DOM、iframe、Webアプリ独自のエディタへの入力置換は完全には保証しない。
- popupは閉じると結果表示が終了する。ページ入力欄への置換ジョブはOffscreen documentで継続する。
- ウェブサイトの権限外にはアクセスしない。パスワードなどの入力欄は翻訳対象外。

## 参考

- [PLaMo モデルカード](https://huggingface.co/pfnet/plamo-3-translate-0.8b-GGUF)
- [Wllama V3 ガイド](https://github.com/ngxson/wllama/blob/master/guides/intro-v3.md)
- [Chrome Offscreen Documents](https://developer.chrome.com/docs/extensions/reference/api/offscreen)
