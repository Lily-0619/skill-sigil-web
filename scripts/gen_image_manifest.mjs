// 画像フォルダを走査して src/data/imageManifest.json を生成する。
// 実行: node scripts/gen_image_manifest.mjs
// パスはすべてプロジェクトルート相対 (repo-conventions 準拠、ドライブ直書き禁止)。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");        // skill-sigil-web/
const IMG = path.resolve(ROOT, "..", "画像");       // 選択フォルダ直下の画像/
const OUT = path.join(ROOT, "src", "data", "imageManifest.json");

const warn = [];
const listPng = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => /\.(png|webp|jpe?g|svg)$/i.test(f)).sort()
    : (warn.push(`フォルダなし: ${dir}`), []);

// ---- クラスボタン -----------------------------------------------------------
const classButtons = {};
for (const f of listPng(path.join(IMG, "class_button"))) {
  classButtons[path.parse(f).name] = `画像/class_button/${f}`;
}

// ---- スキル画像 -------------------------------------------------------------
// 命名: {CODE}_{no}_{スキル名}(__)?.png  … 末尾 "__" は特別スキル(ラバム)
const skills = {};
const skillDir = path.join(IMG, "スキル画像");
for (const code of fs.readdirSync(skillDir).filter((d) => fs.statSync(path.join(skillDir, d)).isDirectory())) {
  skills[code] = [];
  for (const f of listPng(path.join(skillDir, code))) {
    const m = f.match(/^([A-Z]{2,3})_(\d+)_(.+?)(_+)?\.(png|webp|jpe?g)$/i);
    if (m) {
      skills[code].push({
        no: parseInt(m[2], 10),
        name: m[3],
        special: !!m[4],
        path: `画像/スキル画像/${code}/${f}`,
      });
    } else {
      // 旧命名(スキル名のみ)フォールバック
      skills[code].push({
        no: null,
        name: path.parse(f).name,
        special: false,
        path: `画像/スキル画像/${code}/${f}`,
      });
      warn.push(`旧命名: ${code}/${f}`);
    }
  }
}

// ---- キャラクター背景 --------------------------------------------------------
// 新命名: {CODE}_{n}.png / 旧命名: m_img_{english}[_variant].png
const EN_TO_CODE = {
  warrior: "WR", ranger: "RG", witch: "WT", giant: "GA", valkyrie: "VK",
  musa: "BD", sorceress: "SR", darkknight: "DK", dk: "DK", tamer: "LS",
  maehwa: "TB", striker: "KT", lahn: "LN", mystic: "MT", shai: "SH",
  archer: "AC", hashashin: "HS", ninja: "NJ", nova: "NV", guardian: "GD",
  kunoichi: "KN", corsair: "CO", sage: "SG", drakania: "DR", maegu: "MG",
  woosa: "WS", wizard: "WZ", scholar: "SC", dosa: "DS", deadeye: "DE",
  seraph: "SP", seraphim: "SP",
};
const characters = [];
for (const f of listPng(path.join(IMG, "character"))) {
  let code = null;
  let m = f.match(/^([A-Z]{2,3})_(\d+)\./i);
  if (m) code = m[1].toUpperCase();
  else {
    m = f.match(/^m_img_([a-z]+?)(?:_(awaken|classic|succession))?\.(png|webp|jpe?g)$/i);
    if (m) code = EN_TO_CODE[m[1].toLowerCase()] ?? null;
    if (!code) warn.push(`クラス対応不明の背景: ${f}`);
  }
  characters.push({ code, path: `画像/character/${f}` });
}

// ---- 秘伝タイプアイコン --------------------------------------------------------
const SIGIL_ICON_MAP = {
  "微かなスキル秘伝": "faint",
  "整ったスキル秘伝": "refined",
  "鮮明なスキル秘伝": "defined",
  "無欠のスキル秘伝": "flawless",
  "煌めくスキル秘伝": "radiant",
  "守護スキル秘伝": "guardian",
  "(系列)アールのスキル秘伝": "branch_arl",
  "(系列)セルトのスキル秘伝": "branch_celt",
  "(系列)アヒブのスキル秘伝": "branch_ahib",
  "(系列)ラブリフのスキル秘伝": "branch_labreve",
};
const sigilIcons = {};
for (const f of listPng(path.join(IMG, "スキル秘伝"))) {
  const key = SIGIL_ICON_MAP[path.parse(f).name];
  if (key) sigilIcons[key] = `画像/スキル秘伝/${f}`;
  else warn.push(`未対応の秘伝アイコン: ${f}`);
}
// 系列タイプ共通アイコンは アール を代表に使う
if (sigilIcons["branch_arl"] && !sigilIcons["branch"]) sigilIcons["branch"] = sigilIcons["branch_arl"];

const manifest = { generated_at: new Date().toISOString(), classButtons, skills, characters, sigilIcons };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(manifest, null, 1), "utf-8");

const nSkills = Object.values(skills).reduce((a, v) => a + v.length, 0);
console.log(`classButtons=${Object.keys(classButtons).length} skills=${nSkills} characters=${characters.length} sigilIcons=${Object.keys(sigilIcons).length}`);
console.log(`-> ${OUT}`);
for (const w of warn) console.log("WARN:", w);
