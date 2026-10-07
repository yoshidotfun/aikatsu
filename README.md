# わたしのアンコールカード

ログイン不要の、スマホ向けカード保有管理Webアプリです。

- タップで所持 / 未所持を切り替え
- 長押し（PCは右クリック、キーボードは Shift+Enter）で所持枚数（0〜99枚）を入力
- カード番号・レアリティ検索
- すべて / 持ってる / 未所持フィルター
- ブラウザの `localStorage` に自動保存

## 起動

`index.html` を開くだけです。ローカルサーバーを使う場合:

```powershell
python -m http.server 8000
```

最小チェックは `node smoke-test.mjs` で実行できます。

## 公開

GitHubリポジトリへpushし、Settings → Pages → Deploy from a branch で公開できます。

## カード画像について

本アプリは非公式のファンツールです。カード表面画像（85種）は権利者の許諾を得たうえで、公式サイトの画像（`https://dcd.aikatsu.com/encore/images/cardlist/card/E1-01_PR.webp` 形式）を `assets/cards/`（例: `assets/cards/E1-01_PR.webp`）に同梱し、カード番号から相対パスで表示しています。公式サイトへの直接参照（ホットリンク）はしません。画像の権利は各権利者に帰属します。

画像が読み込めない場合は、カード番号の表示に切り替わります。
