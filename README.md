# skill-sigil-web — スキル秘伝HP

黒い砂漠MOBILE 非公式ファンサイト「黒い砂漠MOBILE情報まとめ」の第1コンテンツ
**スキル秘伝編**。所持スキル秘伝の登録と、クラス別17スキル×固定4枠への装着シミュレーター。

- 設計正本: `../docs/` (企画書〜テスト基準)
- 技術構成: React + TypeScript + Vite (バックエンドなしの静的Webアプリ)
- データ保存: ブラウザ内 IndexedDB + Excelバックアップ
- パス規約: プロジェクトルート相対のみ (repo-conventions Skill準拠)

## すぐ使う (ビルド済み)

フォルダ直下の `../スキル秘伝HP.html` をダブルクリックするだけで開けます
(単一HTML。隣の `画像/` フォルダを参照するため、**HTMLと画像フォルダはセットで同じ場所に置く**こと)。

## 開発

```bash
npm install
npm run dev        # 開発サーバー (画像/ は自動で配信される)
npm test           # vitest (装着ルール・Excel往復・スモーク)
npm run build      # dist/index.html (単一ファイル) を生成
```

ビルド後、`dist/index.html` を `../スキル秘伝HP.html` として置くと公開物になる。

## マスタ更新の手順 (ゲームアップデート時)

1. `../スキル秘伝_v0.1_PN.xlsx` (30クラスシート) を更新する
2. `python scripts/parse_master.py <Excelパス>` → `src/data/master.json` 再生成
3. 画像を追加した場合は `node scripts/gen_image_manifest.mjs` → マニフェスト再生成
4. `npm run build` → 単一HTMLを差し替え

効果マスタの数値 (`11_効果マスタ数値.md`) は `scripts/parse_master.py` 内の
`EFFECTS` 定数が正本のコード側コピー。数値が変わったらそこを直す。

## トップページの動画差し込み

`../画像/hero/` に以下の名前で置くだけで自動で使われます(無ければキャラ立ち絵で代替)。

- 左パネル: `left.mp4` (または `left.webm` / `left.png` / `left.jpg`)
- 右パネル: `right.mp4` (同上)

カーソルを載せた側だけ再生されます。

## 公開 (docs/12 準拠, 2026-07-14更新)

GitHub (Lily-0619 / private) へ push → Cloudflare Workers Static Assets でビルド公開。
(Cloudflare Pagesではなく、新規プロジェクト向けにCloudflareが推奨する Workers Static Assets を採用)

- `npm run build` は自動で `scripts/sync_public_images.mjs` を実行し、
  1つ上の `../画像/` フォルダを `public/画像/` へミラーコピーしてからビルドする
  (ローカル単一HTML版は `../画像/` を直接参照するため、正本は引き続き `../画像/`)。
- `wrangler.jsonc` に Workers Static Assets の設定を用意済み (`directory: "./dist"`)。
- 公開には別途 Cloudflareアカウント登録と `wrangler login` (または GitHub連携によるWorkers Builds) が必要。
- `npm run deploy` で `build` → `wrangler deploy` を実行する (要Cloudflareログイン)。

## 既知の要確認事項

- WZ 通常3「ライトニングプラズマ」のみ枠構成が 無欠/鮮明/鮮明/微か (系列枠なし)。
  元Excelどおりだが、ゲーム内仕様と一致するか要確認。
- 系列効果の名称4種はExcel「リスト」シート由来 (アール/セルト/アヒブ/ラブリフ)。
