# CLAUDE.md — skill-sigil-web (スキル秘伝HP)

黒い砂漠MOBILE 非公式ファンサイトの「スキル秘伝編」。React + TypeScript + Vite の
静的Webアプリ (バックエンドなし / 保存はブラウザ内 IndexedDB + Excelバックアップ)。

## ★本番デプロイ = GitHub main へ push するだけ

**この GitHub リポジトリ (Lily-0619/skill-sigil-web) は Cloudflare Workers Builds と
連携済み。main への push を契機に Cloudflare がソースから自動ビルド・自動公開する
(反映まで数分)。** 公開のために `wrangler deploy` を手で叩く必要はなく、このPCが
wrangler 未ログインでも問題ない。

```bash
git add -A && git commit -m "..." && git push origin main   # これで本番反映
```

- `dist/` は .gitignore 対象。Cloudflare 側が `npm run build` 相当でビルドするので、
  手元ビルドは検証用。
- **注意 (画像):** Cloudflare はリポジトリ単体をビルドするため、正本の `../画像/`
  フォルダ (repo外) は存在せず `scripts/sync_public_images.mjs` はスキップされる。
  したがって **git にコミット済みの `public/画像/` がそのまま配信される。**
  手元で `npm run build` を回すと sync が走り、正本から消えた画像を `public/画像/`
  から消してしまう。プロフィール等の更新をコミットする前に
  `git restore -- "public/画像"` して、意図しない画像削除を巻き込まないこと。
- 手動デプロイが必要な場合のみ `npx wrangler login` (ブラウザOAuth、まな本人) →
  `npx wrangler deploy`。設計方針は `docs/12_公開方式・技術構成_Workers版.md`。

## ローカル閲覧用の単一HTML

ビルド後 `dist/index.html` を `../スキル秘伝HP.html` へコピーすると、ダブルクリックで
開ける単一HTML版になる (`vite-plugin-singlefile`。隣の `../画像/` を直接参照)。

## この環境の前提

- **Node.js は PATH に無い。** ポータブル版が `E:\AI\` にある (node.exe / npm.cmd /
  npx.cmd)。Bash では先頭に `export PATH="/e/AI:$PATH"` を付けてから npm/npx を実行。
- dev サーバーは `.claude/launch.json` の "dev" 設定 (vite)。
  **`npm run build` の前に dev サーバーを止める** (public/画像 の削除で ENOTEMPTY 失敗を防ぐ)。

## データ生成パイプライン (Excel → JSON)

コード側が読むのは `src/data/*.json`。正本は Excel で、スクリプトで変換する。

- **マスタ:** `../スキル秘伝_v0.1_PN.xlsx` → `python scripts/parse_master.py <path>` →
  `src/data/master.json`。効果マスタ数値は `parse_master.py` の `EFFECTS` 定数が正本。
- **スキル/パッシブ説明・プロフィール:** `資料/説明(パッシブ・スキル)/黒い砂漠M_説明_*.xlsx`
  (30クラス) → `python scripts/parse_descriptions.py` → `src/data/descriptions.json`。
  各Excelの「プロフィール」シート (A列ラベル: 名前/出身地/Other、B列に値) から
  各クラスの `profile` を取り込む。Other は未入力なら HP 側で非表示。
- **画像マニフェスト:** 画像追加時 `node scripts/gen_image_manifest.mjs`。

## コマンド

```bash
npm run dev     # 開発サーバー
npm test        # vitest (装着ルール・Excel往復・スモーク)
npm run build   # tsc --noEmit + vite build → dist/index.html
```

## 共同運用 (Claude / Codex)

Codex は `AGENTS.md` を読む。担当・ワークフロー・公開方法を変えるときは
`CLAUDE.md` と `AGENTS.md` の両方を同じ作業で更新する。パス規約は
repo-conventions Skill (プロジェクトルート相対のみ) に従う。
