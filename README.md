# 黒い砂漠モバイル 非公式Webページ — スキル秘伝

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

## 公開 (本番デプロイ)

**本番の公開方法は「GitHub の main へ push」だけ。** この GitHub リポジトリ
(Lily-0619/skill-sigil-web) は Cloudflare Workers Builds と連携済みで、
main への push を契機に Cloudflare がソースから自動ビルド・自動公開する。
手元で `wrangler deploy` を叩く必要はない (このPCは wrangler 未ログインでもよい)。

```bash
git add -A && git commit -m "..." && git push origin main   # ← これで本番反映 (数分)
```

- Cloudflare はリポジトリ単体をビルドするため、正本の `../画像/` フォルダ (repo外) は
  存在せず、`sync_public_images.mjs` はスキップされる。よって **git にコミット済みの
  `public/画像/` がそのまま配信される。** 手元で `npm run build` を回すと sync が走り、
  正本から消えた画像を `public/画像/` から削除してしまうので、更新をコミットする前に
  `git restore -- "public/画像"` して意図しない画像削除を巻き込まないこと。
- ローカル閲覧用の単一HTMLは従来どおり `dist/index.html` を `../スキル秘伝HP.html` へコピー
  (`../画像/` を直接参照)。
- `wrangler.jsonc` に Workers Static Assets 設定あり (`directory: "./dist"`)。
  手動デプロイする場合のみ `npx wrangler login` (ブラウザOAuth) → `npx wrangler deploy`。
  設計方針の詳細は `docs/12_公開方式・技術構成_Workers版.md`。

## 既知の要確認事項

- WZ 通常3「ライトニングプラズマ」のみ枠構成が 無欠/鮮明/鮮明/微か (系列枠なし)。
  元Excelどおりだが、ゲーム内仕様と一致するか要確認。
- 系列効果の名称4種はExcel「リスト」シート由来 (アール/セルト/アヒブ/ラブリフ)。
