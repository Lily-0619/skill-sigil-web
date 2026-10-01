import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));

const master = readJson("src/data/master.json");
const descriptions = readJson("src/data/descriptions.json");
const metadata = readJson("editor-app/data/editorMetadata.json");
const commonPassiveByName = new Map((metadata.common_passives ?? []).map((item) => [item.name, item.body]));
const sigilLabels = {
  guardian: "守護",
  flawless: "無欠",
  defined: "鮮明",
  refined: "整った",
  faint: "微か",
  radiant: "煌めき",
};

const cleanLines = (value) => {
  if (Array.isArray(value)) return value.map((line) => String(line));
  if (typeof value === "string") return value.split(/\r?\n/);
  return [];
};

const makeWeapons = (code, classDescription) => {
  const assignments = metadata.classes?.[code]?.passive_assignments ?? [];
  if (assignments.length) {
    return assignments.map((item, index) => ({
      number: index + 1,
      name_ja: item.weapon ?? "",
      name_ko: item.weapon_ko ?? "",
      name_en: item.weapon_en ?? "",
      unique_passive: cleanLines(item.unique_body),
      common_passive: item.common_passive
        ? {
            name: item.common_passive,
            description: cleanLines(commonPassiveByName.get(item.common_passive) ?? ""),
          }
        : null,
    }));
  }
  return (classDescription?.passives ?? []).map((item, index) => ({
    number: index + 1,
    name_ja: item.name ?? "",
    name_ko: "",
    name_en: "",
    unique_passive: cleanLines(item.lines),
    common_passive: null,
  }));
};

const makeSkills = (code, classDescription) => (master.skills?.[code] ?? [])
  .map((skill) => {
    const localId = skill.skill_id.replace(`${code}_`, "");
    const detail = classDescription?.skills?.[localId] ?? {};
    const lines = cleanLines(detail.lines);
    const savedFlags = metadata.classes?.[code]?.skill_flags?.[skill.skill_id] ?? {};
    const detected = {
      sa: lines.some((line) => line.includes("スーパーアーマー")),
      fg: lines.some((line) => line.includes("前方ガード")),
      enhancement: lines.some((line) => line.includes("深化")),
    };
    return {
      id: skill.skill_id,
      category: skill.group === "special" ? "ラバム" : "通常",
      number: skill.display_no,
      name: detail.name ?? skill.name_ja ?? "",
      stack: detail.stack ?? metadata.excel_skill_stacks?.[skill.skill_id] ?? null,
      ct_seconds: detail.ct === "" || detail.ct == null ? null : detail.ct,
      hit: detail.hit ?? null,
      modes: { pvp: Boolean(detail.pvp), pve: Boolean(detail.pve) },
      skill_use: {
        sa: savedFlags.sa ?? detected.sa,
        fg: savedFlags.fg ?? detected.fg,
        enhancement: savedFlags.enhancement ?? detected.enhancement,
      },
      equippable_sigils: (skill.slots ?? []).map((slot) => sigilLabels[slot] ?? slot),
      description: lines,
    };
  })
  .sort((a, b) => {
    const groupOrder = { "ラバム": 0, "通常": 1 };
    return groupOrder[a.category] - groupOrder[b.category] || a.number - b.number;
  });

const classes = [...master.classes]
  .filter((item) => item.enabled !== false)
  .sort((a, b) => a.sort_order - b.sort_order)
  .map((item) => {
    const classDescription = descriptions.classes?.[item.class_id] ?? {};
    return {
      class_id: item.class_id,
      class_name: item.name_ja,
      weapons: makeWeapons(item.class_id, classDescription),
      black_spirit_rage: classDescription.rage
        ? {
            name: classDescription.rage.name ?? "闇精霊の怒り",
            modes: { pvp: Boolean(classDescription.rage.pvp), pve: Boolean(classDescription.rage.pve) },
            common_description: cleanLines(classDescription.rage.common),
            weapon_descriptions: (classDescription.rage.weapon ?? []).map((lines, index) => ({
              weapon_number: index + 1,
              description: cleanLines(lines),
            })),
          }
        : null,
      skills: makeSkills(item.class_id, classDescription),
    };
  });

const output = {
  document_type: "BDM class skill and passive data for AI analysis",
  generated_at: new Date().toISOString(),
  source_files: [
    "src/data/master.json",
    "src/data/descriptions.json",
    "editor-app/data/editorMetadata.json",
  ],
  notes: [
    "現行サイトおよび編集アプリの保存データを統合した出力です。",
    "null、空文字、空配列は元データに値が存在しないことを示します。推測による補完はしていません。",
    "SA・FG・深化は編集アプリの保存値を優先し、保存値がない場合は説明文の語句から判定しています。",
    "このデータにはスキル倍率や実戦環境、プレイヤー操作難度など未収録の要素があります。クラス強度を断定せず、データ内で確認できる性能の比較に使用してください。",
  ],
  summary: {
    class_count: classes.length,
    skill_count: classes.reduce((sum, item) => sum + item.skills.length, 0),
    weapon_count: classes.reduce((sum, item) => sum + item.weapons.length, 0),
    global_common_passive_count: commonPassiveByName.size,
    skills_without_description: classes.reduce((sum, item) => sum + item.skills.filter((skill) => skill.description.length === 0).length, 0),
    skills_without_stack: classes.reduce((sum, item) => sum + item.skills.filter((skill) => skill.stack == null).length, 0),
    skills_without_ct: classes.reduce((sum, item) => sum + item.skills.filter((skill) => skill.ct_seconds == null).length, 0),
    weapons_without_common_passive: classes.reduce((sum, item) => sum + item.weapons.filter((weapon) => !weapon.common_passive).length, 0),
  },
  data_quality: {
    skills_without_description: classes.flatMap((item) => item.skills
      .filter((skill) => skill.description.length === 0)
      .map((skill) => ({ class_id: item.class_id, skill_id: skill.id, name: skill.name }))),
    skills_without_stack: classes.flatMap((item) => item.skills
      .filter((skill) => skill.stack == null)
      .map((skill) => ({ class_id: item.class_id, skill_id: skill.id, name: skill.name }))),
    skills_without_ct: classes.flatMap((item) => item.skills
      .filter((skill) => skill.ct_seconds == null)
      .map((skill) => ({ class_id: item.class_id, skill_id: skill.id, name: skill.name }))),
    weapons_without_common_passive: classes.flatMap((item) => item.weapons
      .filter((weapon) => !weapon.common_passive)
      .map((weapon) => ({ class_id: item.class_id, weapon_number: weapon.number, name: weapon.name_ja }))),
  },
  common_passive_library: (metadata.common_passives ?? []).map((item) => ({
    name: item.name,
    description: cleanLines(item.body),
  })),
  classes,
};

const boolLabel = (value) => value ? "有効" : "無効";
const valueLabel = (value) => value === null || value === undefined || value === "" ? "未登録" : String(value);
const bulletLines = (lines, indent = "") => lines.length
  ? lines.map((line) => `${indent}- ${line || "（空行）"}`).join("\n")
  : `${indent}- 未登録`;

const md = [];
md.push("# AI分析用・全クラス スキル／パッシブ情報");
md.push("");
md.push(`生成日時: ${output.generated_at}`);
md.push("");
md.push(`収録: ${output.summary.class_count}クラス / ${output.summary.weapon_count}武器 / ${output.summary.skill_count}スキル / 共通パッシブ${output.summary.global_common_passive_count}種`);
md.push("");
md.push("## AIへ渡す際の注意");
md.push("");
md.push(bulletLines(output.notes));
md.push("");
md.push("## 現行データの未登録項目");
md.push("");
md.push(`- 説明未登録スキル: ${output.summary.skills_without_description}件`);
md.push(`- STACK未登録スキル: ${output.summary.skills_without_stack}件`);
md.push(`- CT未登録スキル: ${output.summary.skills_without_ct}件`);
md.push(`- 共通パッシブ未設定武器: ${output.summary.weapons_without_common_passive}件`);
for (const [label, records] of Object.entries(output.data_quality)) {
  if (!records.length) continue;
  md.push("");
  md.push(`### ${label}`);
  md.push("");
  md.push(records.map((record) => `- ${Object.entries(record).map(([key, value]) => `${key}=${value}`).join(" / ")}`).join("\n"));
}
md.push("");
md.push("## 共通パッシブ・ライブラリ");
for (const passive of output.common_passive_library) {
  md.push("");
  md.push(`### ${passive.name}`);
  md.push("");
  md.push(bulletLines(passive.description));
}

for (const cls of classes) {
  md.push("");
  md.push("---");
  md.push("");
  md.push(`# ${cls.class_id}｜${cls.class_name}`);
  md.push("");
  md.push("## 武器・パッシブ");
  for (const weapon of cls.weapons) {
    md.push("");
    md.push(`### 武器${String(weapon.number).padStart(2, "0")}｜${weapon.name_ja || "未登録"}`);
    md.push("");
    md.push(`- 韓国語名: ${weapon.name_ko || "未登録"}`);
    md.push(`- 英語名: ${weapon.name_en || "未登録"}`);
    md.push(`- 共通パッシブ: ${weapon.common_passive?.name || "未設定"}`);
    md.push("");
    md.push("#### 固有パッシブ説明");
    md.push("");
    md.push(bulletLines(weapon.unique_passive));
    md.push("");
    md.push("#### 共通パッシブ説明");
    md.push("");
    md.push(bulletLines(weapon.common_passive?.description ?? []));
  }
  md.push("");
  md.push("## 闇精霊の怒り");
  md.push("");
  if (!cls.black_spirit_rage) {
    md.push("- 未登録");
  } else {
    md.push(`- PvP: ${boolLabel(cls.black_spirit_rage.modes.pvp)}`);
    md.push(`- PvE: ${boolLabel(cls.black_spirit_rage.modes.pve)}`);
    md.push("");
    md.push(bulletLines(cls.black_spirit_rage.common_description));
    for (const item of cls.black_spirit_rage.weapon_descriptions) {
      md.push("");
      md.push(`### 武器${String(item.weapon_number).padStart(2, "0")}適用時`);
      md.push("");
      md.push(bulletLines(item.description));
    }
  }
  md.push("");
  md.push("## スキル");
  for (const skill of cls.skills) {
    md.push("");
    md.push(`### ${skill.category}${String(skill.number).padStart(2, "0")}｜${skill.name}`);
    md.push("");
    md.push(`- ID: ${skill.id}`);
    md.push(`- STACK: ${valueLabel(skill.stack)}`);
    md.push(`- CT（秒）: ${valueLabel(skill.ct_seconds)}`);
    md.push(`- HIT: ${valueLabel(skill.hit)}`);
    md.push(`- PvP: ${boolLabel(skill.modes.pvp)}`);
    md.push(`- PvE: ${boolLabel(skill.modes.pve)}`);
    md.push(`- SA: ${boolLabel(skill.skill_use.sa)}`);
    md.push(`- FG: ${boolLabel(skill.skill_use.fg)}`);
    md.push(`- 深化: ${boolLabel(skill.skill_use.enhancement)}`);
    md.push(`- 装着可能秘伝: ${skill.equippable_sigils.length ? skill.equippable_sigils.join(" / ") : "なし"}`);
    md.push("");
    md.push("#### スキル説明");
    md.push("");
    md.push(bulletLines(skill.description));
  }
}

const outputDir = path.join(repoRoot, "exports");
fs.mkdirSync(outputDir, { recursive: true });
const now = new Date();
const dateStamp = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
  .map((value, index) => index === 0 ? String(value) : String(value).padStart(2, "0"))
  .join("");
const datedBaseName = `AI分析用_全クラス_スキル・パッシブ情報${dateStamp}`;
const jsonPath = path.join(outputDir, `${datedBaseName}.json`);
const mdPath = path.join(outputDir, `${datedBaseName}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, `${md.join("\n")}\n`, "utf8");

console.log(JSON.stringify({ jsonPath, mdPath, summary: output.summary }, null, 2));
