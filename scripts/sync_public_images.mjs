// 公開ビルド用に、プロジェクト1つ上の「画像/」フォルダを public/画像/ へミラーコピーする。
// ローカルの単一HTML版(../スキル秘伝HP.html)は引き続き ../画像/ を直接参照するため、
// このスクリプトは public/ 側の複製を最新化するだけで、元の画像/ フォルダは変更しない。
// 実行: node scripts/sync_public_images.mjs (npm run build 内から自動実行される)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");          // skill-sigil-web/
const SRC = path.resolve(ROOT, "..", "画像");          // 選択フォルダ直下の画像/ (正本)
const DEST = path.join(ROOT, "public", "画像");        // 公開ビルド用の複製

if (!fs.existsSync(SRC)) {
  console.log(`WARN: 画像フォルダが見つかりません: ${SRC} (public/画像への同期をスキップ)`);
  process.exit(0);
}

// 正本フォルダ(画像/)自体は存在するが、中の主要サブフォルダが欠けている場合がある
// (例: このPCの正本には「スキル画像」が無い)。気づかずビルドすると、次のrmSyncで
// public/画像 を全消去したあと空のコピー元で上書きし、全クラスのスキル画像が
// 消えてしまう。既存の複製より明らかに乏しい内容で同期しようとしていないか確認する。
const REQUIRED_SUBDIRS = ["スキル画像", "character", "class_button"];
const missing = REQUIRED_SUBDIRS.filter((d) => !fs.existsSync(path.join(SRC, d)));
if (missing.length > 0) {
  console.error(
    `ERROR: 正本フォルダ ${SRC} に想定サブフォルダが無い: ${missing.join(", ")}\n` +
    `  このまま同期すると public/画像 から該当分がまるごと消えます。同期を中止しました。\n` +
    `  正本フォルダの中身を確認してから再実行してください。`
  );
  process.exit(1);
}

// .zip等の作業用アーカイブは配信対象外 (元データ置き場に紛れていても複製しない)
const SKIP_EXT = /\.(zip|xlsx?|pdf|psd|ai)$/i;

fs.rmSync(DEST, { recursive: true, force: true });
fs.cpSync(SRC, DEST, {
  recursive: true,
  filter: (src) => !SKIP_EXT.test(src),
});

const countFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce(
    (n, e) => n + (e.isDirectory() ? countFiles(path.join(dir, e.name)) : 1),
    0
  );
console.log(`画像 -> public/画像 同期完了 (${countFiles(DEST)}ファイル)`);
