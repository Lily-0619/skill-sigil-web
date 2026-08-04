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

**正本は `資料/クラスデータ/` の統合Excel 2本** (2026-08-03 移行)。スクリプトは読むだけで、
生成側からExcelを上書きしないこと。

- 統合Excel: `黒い砂漠M_スキル・パッシブ.xlsx` (シート: `クラス一覧` / `パッシブ一覧` /
  `スキル_{CODE}`×30) と `黒い砂漠M_プロフィール.xlsx` (`プロフィール_{CODE}`×30)。
- マスタ: 統合Excel → `python scripts/parse_master.py` → `src/data/master.json`
  (秘伝の種類・等級・効果は `src/game-rules/` が正本)。
- 説明・プロフィール: 統合Excel 2本 → `python scripts/parse_descriptions.py` →
  `src/data/descriptions.json`。
- 画像: `node scripts/gen_image_manifest.mjs`。
- STACK/CT/HIT: 説明の「最大使用回数 → 再使用待機時間 → 最大〇打撃」の並びの**直後の1行だけ**
  を数値化する。説明の後ろに出てくる「最大〇打撃」は本文に残す。条件付き行
  (「・スキルボタン長押しで最大2打撃」) は本文に残したままHIT値も入れる。詳細は `CLAUDE.md`。
- 旧データ (説明Excel 30本・旧マスタ) は `資料/_archive/` に退避済み。参照しない。

## 規約

パスはプロジェクトルート相対のみ (repo-conventions Skill 準拠)。ローカル閲覧用の
単一HTMLは `dist/index.html` を `../スキル秘伝HP.html` へコピー。
