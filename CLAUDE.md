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

- **Node.js はポータブル版が `D:\AI\` にある** (node.exe / npm.cmd / npx.cmd)。
  PATH に入っていない場合は Bash で `export PATH="/d/AI:$PATH"` を付けてから npm/npx を実行。
- dev サーバーは `.claude/launch.json` の "dev" 設定 (vite)。
  **`npm run build` の前に dev サーバーを止める** (public/画像 の削除で ENOTEMPTY 失敗を防ぐ)。

## データ生成パイプライン (Excel → JSON)

コード側が読むのは `src/data/*.json`。**正本は `資料/クラスデータ/` の統合Excel 2本**で、
スクリプトで変換する。**スクリプトはExcelを読むだけ。生成側からExcelを上書きしないこと。**

- **統合Excel (正本):** `資料/クラスデータ/黒い砂漠M_スキル・パッシブ.xlsx`
  - `クラス一覧` … コード / クラス名 / 表示順 / 有効
  - `パッシブ一覧` … 横=クラス、縦=パッシブ①②。セルは `[日本語 / 韓国語 / 英語]` の
    ヘッダー行 + 本文
  - `スキル_{CODE}` ×30 … 1行=1スキル (通常13 + ラバム4 + 闇精霊の怒り1)。列は
    `skill_id / 種別 / 表示番号 / 名前(日本語) / 区分 / STACK / CT / HIT / 説明(日本語) /
    元の説明(検証用) / 装着可能秘伝 / 秘伝装着可否 / 画像パス / 名前(韓国語) / 名前(英語)`
    (「元の説明」は移行前の文章。説明の隣に置いて目視で突き合わせるための参考列)
  - `資料/クラスデータ/黒い砂漠M_プロフィール.xlsx` … `プロフィール_{CODE}` ×30
    (A列ラベル: 名前/出身地/Other/エピソード、B列に値)
- **マスタ (クラス・スキル・固定枠):** 統合Excel → `python scripts/parse_master.py` →
  `src/data/master.json`。「装着可能秘伝」の日本語表記は game-rules の逆引きでidに戻す。
- **スキル秘伝ルール (種類・等級・効果・装着ルール):** `src/game-rules/` が単一正本。
  `skill-sigil.json` (種類/等級/効果・数値) と `skill-sigil-rules.ts` (装着ルール定数・
  表示細則) を**手編集**する。アプリは `src/data/master.ts` が master.json と game-rules を
  合成して読む。ゲーム改定時はまず game-rules を直す (docs は記録用で参照しない)。
- **スキル/パッシブ説明・プロフィール:** 統合Excel 2本 →
  `python scripts/parse_descriptions.py` → `src/data/descriptions.json`。
- **画像マニフェスト:** 画像追加時 `node scripts/gen_image_manifest.mjs`。

### STACK / CT / HIT の扱い (まな指定)

説明本文から数値を切り出して列に持つ。HPでは `STACK:〇　CT:〇　HIT×〇` と表示し、
値の無い項目は出さない。

- **抽出は「最大使用回数 → 再使用待機時間 → 最大〇打撃」と並ぶ、その直後の1行だけ。**
  説明の後ろの方に出てくる「最大〇打撃」は対象外 (本文にそのまま残す)。
- 単独行 (「・最大2打撃」) は数値化して本文から除く。条件付き行
  (「・スキルボタン長押しで最大2打撃」) は**本文に残したままHIT値も入れる** (条件が
  情報として必要なため)。
- 「最大〇ヒット」も「最大〇打撃」と同じ扱い (古い言い回しのクラスが残っているため)。

### 旧データ (2026-08-03 にアーカイブ済み)

`資料/_archive/` に退避してある。**参照しないこと。** 復元が必要なときだけ見る。
- `資料/_archive/説明(パッシブ・スキル)/黒い砂漠M_説明_*.xlsx` (30本)
- `資料/_archive/スキル秘伝_v0.1_PN.xlsx` (旧マスタ・約29MB・.gitignore対象)

## 引き継ぎ資料の扱い (docs/ 配下)

`docs/00_資料一覧.md` の一覧は、各項目に **[進行中]** / **[完了]** のタグを付けて管理する。

- **[完了]** は記録用。次にやる作業を探すときはこれを読まない (もう終わっている)。
- **[進行中]** だけが「次にやること」の対象。セッション開始時に次の作業を探すときは、
  この一覧で [進行中] のものだけを見ればよい。
- 作業が終わったら、その資料の先頭に完了である旨を1行足し、
  `00_資料一覧.md` 側のタグも [完了] に変える (両方を同じ作業で更新する)。
- 新しく引き継ぎ資料を作るときも、このどちらかのタグを必ず付ける。

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
