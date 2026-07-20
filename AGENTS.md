# AGENTS.md — skill-sigil-web (スキル秘伝HP)

Codex 向けの要約。詳細ルールは `CLAUDE.md` と対。担当・ワークフロー・公開方法を
変えるときは `CLAUDE.md` と `AGENTS.md` の両方を同じ作業で更新すること。

黒い砂漠MOBILE 非公式ファンサイト「スキル秘伝編」。React + TypeScript + Vite の
静的Webアプリ (バックエンドなし / IndexedDB + Excelバックアップ)。

## ★本番デプロイ = GitHub main へ push するだけ

この GitHub リポジトリ (Lily-0619/skill-sigil-web) は **Cloudflare Workers Builds と
連携済み**。main への push で Cloudflare がソースから自動ビルド・自動公開する
(反映まで数分)。`wrangler deploy` を手で叩く必要はない。

```bash
git add -A && git commit -m "..." && git push origin main
```

- `dist/` は .gitignore 対象 (Cloudflare 側がビルド)。手元ビルドは検証用。
- **画像の注意:** Cloudflare はリポジトリ単体をビルドするため正本 `../画像/` (repo外) は
  無く、`scripts/sync_public_images.mjs` はスキップされ、**コミット済みの `public/画像/`
  がそのまま配信される**。手元 `npm run build` は sync で正本から消えた画像を
  `public/画像/` から削除するので、コミット前に `git restore -- "public/画像"` で
  意図しない画像削除を巻き込まないこと。
- 手動デプロイは `npx wrangler login` (要まな本人) → `npx wrangler deploy`。
  設計方針: `docs/12_公開方式・技術構成_Workers版.md`。

## 環境・ビルド

- Node は PATH に無い。ポータブル版 `E:\AI\` (node.exe / npm.cmd / npx.cmd)。
- `npm run build` の前に dev サーバーを止める (public/画像 削除の ENOTEMPTY 回避)。
- `npm run dev` / `npm test` (vitest) / `npm run build` (tsc + vite)。

## データ生成 (Excel → JSON、コード側は JSON を読む)

- マスタ: `../スキル秘伝_v0.1_PN.xlsx` → `python scripts/parse_master.py <path>` →
  `src/data/master.json` (効果数値は `EFFECTS` 定数が正本)。
- 説明・プロフィール: `資料/説明(パッシブ・スキル)/黒い砂漠M_説明_*.xlsx` (30クラス) →
  `python scripts/parse_descriptions.py` → `src/data/descriptions.json`。
  「プロフィール」シート (A列: 名前/出身地/Other、B列: 値) から各クラス `profile` を取込む。
  Other は未入力なら HP 非表示。
- 画像: `node scripts/gen_image_manifest.mjs`。

## 規約

パスはプロジェクトルート相対のみ (repo-conventions Skill 準拠)。ローカル閲覧用の
単一HTMLは `dist/index.html` を `../スキル秘伝HP.html` へコピー。
