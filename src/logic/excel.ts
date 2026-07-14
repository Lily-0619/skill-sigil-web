// Excelバックアップ入出力 (docs/05_Excel入出力仕様書.md 準拠)
// v0.2 #3: format_version 2 — Free編成/Free装着状況シートを追加。v1読込互換は維持。
import * as XLSX from "xlsx";
import type {
  Build,
  EquippedSigil,
  FreeEquip,
  InventoryItem,
  Master,
  Rarity,
  UserData,
} from "../types";
import { uid, nowIso } from "../lib/ids";
import { maxUsedPerBuild, typeName } from "./equip";

export const FORMAT_VERSION = 2;
export const APP_NAME = "スキル秘伝HP(黒い砂漠MOBILE情報まとめ・スキル秘伝編)";

const RARITY_JA: Record<Rarity, string> = {
  abyssal: "深淵",
  primal: "太古",
  chaos: "混沌",
};
const RARITY_FROM_JA: Record<string, Rarity> = {
  深淵: "abyssal",
  太古: "primal",
  混沌: "chaos",
};

export function backupFilename(d = new Date()): string {
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `skill-sigil-backup_${d.getFullYear()}${p(d.getMonth() + 1)}${p(
    d.getDate()
  )}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.xlsx`;
}

/** 書き出し前整合性チェック: 装着数が所持数を超えていないか */
export function exportIntegrityErrors(data: UserData): string[] {
  const errors: string[] = [];
  for (const item of data.inventory) {
    const { max } = maxUsedPerBuild(data.equips, item.inventory_id);
    if (max > item.quantity) {
      errors.push(
        `所持数超過: ${item.inventory_id} (所持${item.quantity} < 使用${max})`
      );
    }
  }
  return errors;
}

export function buildWorkbook(master: Master, data: UserData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const readme = XLSX.utils.aoa_to_sheet([
    ["key", "value"],
    ["format_version", FORMAT_VERSION],
    ["schema_version", data.meta.schema_version],
    ["master_version", master.master_version],
    ["exported_at", nowIso()],
    ["app_name", APP_NAME],
    [
      "notice",
      "所持数・数値・メモ・編成名は編集できます。ID・クラスコード・スキルID・枠番号は変更しないでください。",
    ],
  ]);
  XLSX.utils.book_append_sheet(wb, readme, "README");

  const invRows = data.inventory.map((i) => ({
    inventory_id: i.inventory_id,
    秘伝タイプID: i.sigil_type_id,
    秘伝タイプ名: typeName(master, i.sigil_type_id),
    効果ID: i.effect_id,
    効果名:
      master.effects.find((e) => e.effect_id === i.effect_id)?.name_ja ?? "",
    等級: RARITY_JA[i.rarity],
    数値: i.value_text,
    所持数: i.quantity,
    メモ: i.note,
    更新日時: i.updated_at,
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(invRows, {
      header: [
        "inventory_id", "秘伝タイプID", "秘伝タイプ名", "効果ID", "効果名",
        "等級", "数値", "所持数", "メモ", "更新日時",
      ],
    }),
    "所持秘伝"
  );

  // v0.2 #3: 既存シート(編成/装着状況)はMy専用のまま。FreeはFree編成/Free装着状況へ。
  const myBuilds = data.builds.filter((b) => (b.mode ?? "my") === "my");
  const freeBuilds = data.builds.filter((b) => b.mode === "free");

  const buildRows = myBuilds.map((b) => ({
    build_id: b.build_id,
    編成名: b.name,
    class_id: b.class_id,
    クラスコード:
      master.classes.find((c) => c.class_id === b.class_id)?.code ?? b.class_id,
    作成日時: b.created_at,
    更新日時: b.updated_at,
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(buildRows, {
      header: ["build_id", "編成名", "class_id", "クラスコード", "作成日時", "更新日時"],
    }),
    "編成"
  );

  const skillIndex = new Map(
    Object.values(master.skills)
      .flat()
      .map((s) => [s.skill_id, s])
  );
  const equipRows = data.equips.map((e) => {
    const s = skillIndex.get(e.skill_id);
    return {
      build_id: e.build_id,
      skill_id: e.skill_id,
      グループ: s?.group ?? "",
      表示番号: s?.display_no ?? "",
      slot_no: e.slot_no,
      inventory_id: e.inventory_id,
    };
  });
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(equipRows, {
      header: ["build_id", "skill_id", "グループ", "表示番号", "slot_no", "inventory_id"],
    }),
    "装着状況"
  );

  // v0.2 #3: Free編成
  const freeBuildRows = freeBuilds.map((b) => ({
    build_id: b.build_id,
    編成名: b.name,
    class_id: b.class_id,
    クラスコード:
      master.classes.find((c) => c.class_id === b.class_id)?.code ?? b.class_id,
    作成日時: b.created_at,
    更新日時: b.updated_at,
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      freeBuildRows.length > 0
        ? freeBuildRows
        : [{ build_id: "", 編成名: "", class_id: "", クラスコード: "", 作成日時: "", 更新日時: "" }],
      { header: ["build_id", "編成名", "class_id", "クラスコード", "作成日時", "更新日時"] }
    ),
    "Free編成"
  );

  // v0.2 #3: Free装着状況 (効果を直接参照)
  const freeEquipRows = data.freeEquips.map((e) => {
    const s = skillIndex.get(e.skill_id);
    return {
      build_id: e.build_id,
      skill_id: e.skill_id,
      グループ: s?.group ?? "",
      表示番号: s?.display_no ?? "",
      slot_no: e.slot_no,
      effect_id: e.effect_id,
      効果名:
        master.effects.find((x) => x.effect_id === e.effect_id)?.name_ja ?? "",
      等級: RARITY_JA[e.rarity],
      数値: e.value_text,
    };
  });
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      freeEquipRows.length > 0
        ? freeEquipRows
        : [{ build_id: "", skill_id: "", グループ: "", 表示番号: "", slot_no: "", effect_id: "", 効果名: "", 等級: "", 数値: "" }],
      { header: ["build_id", "skill_id", "グループ", "表示番号", "slot_no", "effect_id", "効果名", "等級", "数値"] }
    ),
    "Free装着状況"
  );

  // マスタ参照(調査用・最小情報)
  const usedSkillIds = new Set([
    ...data.equips.map((e) => e.skill_id),
    ...data.freeEquips.map((e) => e.skill_id),
  ]);
  const masterRows = [...usedSkillIds].map((id) => {
    const s = skillIndex.get(id);
    return {
      skill_id: id,
      スキル名: s?.name_ja ?? "(不明)",
      枠タイプ: s?.slots?.join("/") ?? "",
      master_version: master.master_version,
    };
  });
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      masterRows.length > 0
        ? masterRows
        : [{ skill_id: "", スキル名: "", 枠タイプ: "", master_version: master.master_version }],
      { header: ["skill_id", "スキル名", "枠タイプ", "master_version"] }
    ),
    "マスタ参照"
  );

  return wb;
}

// ---- 読み込み -----------------------------------------------------------------

export interface ImportIssues {
  errors: string[];
  warnings: string[];
  infos: string[];
}

export interface ParsedBackup {
  formatVersion: number;
  exportedAt: string;
  inventory: InventoryItem[];
  /** My/Free混在 (mode で区別) */
  builds: Build[];
  equips: EquippedSigil[];
  /** v0.2 #3 (v1ファイルは常に空 = Free編成0件) */
  freeEquips: FreeEquip[];
}

export interface ImportResult {
  issues: ImportIssues;
  parsed: ParsedBackup | null;
}

const str = (v: unknown) => (v == null ? "" : String(v).trim());

export function parseWorkbook(master: Master, wb: XLSX.WorkBook): ImportResult {
  const issues: ImportIssues = { errors: [], warnings: [], infos: [] };

  const readmeSheet = wb.Sheets["README"];
  if (!readmeSheet) {
    issues.errors.push("READMEシートがありません。このアプリのバックアップ形式ではない可能性があります。");
    return { issues, parsed: null };
  }
  const readmeRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(readmeSheet);
  const readme = new Map(readmeRows.map((r) => [str(r["key"]), str(r["value"])]));
  const formatVersion = Number(readme.get("format_version") ?? NaN);
  if (!Number.isFinite(formatVersion)) {
    issues.errors.push("format_versionを読み取れません。");
    return { issues, parsed: null };
  }
  if (formatVersion > FORMAT_VERSION) {
    issues.errors.push(
      `このバックアップは新しい形式(v${formatVersion})です。サイトを最新版へ更新してください。`
    );
    return { issues, parsed: null };
  }
  if (str(readme.get("master_version")) !== master.master_version) {
    issues.warnings.push(
      `マスタ版が異なります (バックアップ: ${readme.get("master_version") || "不明"} / 現在: ${master.master_version})`
    );
  }

  for (const name of ["所持秘伝", "編成", "装着状況"]) {
    if (!wb.Sheets[name]) {
      issues.errors.push(`必須シート「${name}」がありません。`);
    }
  }
  if (issues.errors.length > 0) return { issues, parsed: null };

  // 所持秘伝
  const inventory: InventoryItem[] = [];
  const invIds = new Set<string>();
  const invRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["所持秘伝"]);
  invRows.forEach((r, idx) => {
    const rowNo = idx + 2;
    const id = str(r["inventory_id"]);
    const typeId = str(r["秘伝タイプID"]);
    const effectId = str(r["効果ID"]);
    const rarityJa = str(r["等級"]);
    const qty = Number(r["所持数"]);
    if (!id) return issues.errors.push(`所持秘伝 ${rowNo}行目: inventory_idがありません`), undefined;
    if (invIds.has(id)) return issues.errors.push(`所持秘伝 ${rowNo}行目: inventory_id重複 (${id})`), undefined;
    if (!master.sigil_types.some((t) => t.id === typeId))
      return issues.errors.push(`所持秘伝 ${rowNo}行目: 不明な秘伝タイプID (${typeId})`), undefined;
    const rarity = RARITY_FROM_JA[rarityJa];
    if (!rarity)
      return issues.errors.push(`所持秘伝 ${rowNo}行目: 等級は深淵/太古/混沌のいずれかです (${rarityJa})`), undefined;
    if (!Number.isInteger(qty) || qty < 1)
      return issues.errors.push(`所持秘伝 ${rowNo}行目: 所持数は1以上の整数です (${r["所持数"]})`), undefined;
    const effect = master.effects.find((e) => e.effect_id === effectId);
    if (!effect) {
      issues.warnings.push(`所持秘伝 ${rowNo}行目: マスタに無い効果ID (${effectId}) — 保持されますが装着候補には出ません`);
    } else if (!effect.enabled) {
      issues.warnings.push(`所持秘伝 ${rowNo}行目: 無効化された効果 (${effect.name_ja})`);
    } else if (effect.sigil_type_id !== typeId) {
      issues.errors.push(`所持秘伝 ${rowNo}行目: 効果とタイプが一致しません (${effectId} / ${typeId})`);
      return undefined;
    }
    invIds.add(id);
    inventory.push({
      inventory_id: id,
      sigil_type_id: typeId,
      effect_id: effectId,
      rarity,
      value_text: str(r["数値"]),
      quantity: qty,
      note: str(r["メモ"]),
      created_at: str(r["更新日時"]) || nowIso(),
      updated_at: str(r["更新日時"]) || nowIso(),
    });
  });

  // 編成
  const builds: Build[] = [];
  const buildIds = new Set<string>();
  const buildRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["編成"]);
  buildRows.forEach((r, idx) => {
    const rowNo = idx + 2;
    const id = str(r["build_id"]);
    const classId = str(r["class_id"]);
    const name = str(r["編成名"]);
    if (!id) return issues.errors.push(`編成 ${rowNo}行目: build_idがありません`), undefined;
    if (buildIds.has(id)) return issues.errors.push(`編成 ${rowNo}行目: build_id重複 (${id})`), undefined;
    if (!name) return issues.errors.push(`編成 ${rowNo}行目: 編成名がありません`), undefined;
    if (!master.classes.some((c) => c.class_id === classId)) {
      issues.warnings.push(`編成 ${rowNo}行目: 未知のクラス (${classId}) — 警告つきで保持します`);
    }
    buildIds.add(id);
    builds.push({
      build_id: id,
      class_id: classId,
      name,
      mode: "my",
      created_at: str(r["作成日時"]) || nowIso(),
      updated_at: str(r["更新日時"]) || nowIso(),
    });
  });

  // v0.2 #3: Free編成 (v1ファイルにはシートが無い = Free編成0件として読む)
  const freeBuildIds = new Set<string>();
  const freeBuildSheet = wb.Sheets["Free編成"];
  if (freeBuildSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(freeBuildSheet);
    rows.forEach((r, idx) => {
      const rowNo = idx + 2;
      const id = str(r["build_id"]);
      const classId = str(r["class_id"]);
      const name = str(r["編成名"]);
      if (!id && !name && !classId) return; // 空行(0件時のプレースホルダ)はスキップ
      if (!id) return issues.errors.push(`Free編成 ${rowNo}行目: build_idがありません`), undefined;
      if (buildIds.has(id)) return issues.errors.push(`Free編成 ${rowNo}行目: build_id重複 (${id})`), undefined;
      if (!name) return issues.errors.push(`Free編成 ${rowNo}行目: 編成名がありません`), undefined;
      if (!master.classes.some((c) => c.class_id === classId)) {
        issues.warnings.push(`Free編成 ${rowNo}行目: 未知のクラス (${classId}) — 警告つきで保持します`);
      }
      buildIds.add(id);
      freeBuildIds.add(id);
      builds.push({
        build_id: id,
        class_id: classId,
        name,
        mode: "free",
        created_at: str(r["作成日時"]) || nowIso(),
        updated_at: str(r["更新日時"]) || nowIso(),
      });
    });
  }

  // 装着状況
  const equips: EquippedSigil[] = [];
  const equipKeys = new Set<string>();
  const skillIndex = new Map(
    Object.values(master.skills).flat().map((s) => [s.skill_id, s])
  );
  const eqRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["装着状況"]);
  eqRows.forEach((r, idx) => {
    const rowNo = idx + 2;
    const buildId = str(r["build_id"]);
    const skillId = str(r["skill_id"]);
    const slotNo = Number(r["slot_no"]);
    const invId = str(r["inventory_id"]);
    if (!buildIds.has(buildId))
      return issues.errors.push(`装着状況 ${rowNo}行目: 存在しない編成 (${buildId})`), undefined;
    if (freeBuildIds.has(buildId))
      return issues.errors.push(`装着状況 ${rowNo}行目: Free編成への所持品装着は登録できません (${buildId})`), undefined;
    if (!invIds.has(invId))
      return issues.errors.push(`装着状況 ${rowNo}行目: 存在しない所持品 (${invId})`), undefined;
    if (!Number.isInteger(slotNo) || slotNo < 1 || slotNo > 4)
      return issues.errors.push(`装着状況 ${rowNo}行目: slot_noは1〜4です (${r["slot_no"]})`), undefined;
    const key = `${buildId}|${skillId}|${slotNo}`;
    if (equipKeys.has(key))
      return issues.errors.push(`装着状況 ${rowNo}行目: 同じ枠への重複装着 (${key})`), undefined;
    const skill = skillIndex.get(skillId);
    if (!skill) {
      issues.warnings.push(`装着状況 ${rowNo}行目: マスタに無いスキル (${skillId}) — 警告つきで保持します`);
    } else {
      if (!skill.sigil_eligible)
        return issues.errors.push(`装着状況 ${rowNo}行目: 装着対象外スキル (${skill.name_ja})`), undefined;
      const item = inventory.find((i) => i.inventory_id === invId);
      const slotType = skill.slots?.[slotNo - 1];
      if (item && slotType && item.sigil_type_id !== slotType) {
        return issues.errors.push(
          `装着状況 ${rowNo}行目: 枠タイプ不一致 (${skill.name_ja} 枠${slotNo}=${typeName(master, slotType)} / 所持品=${typeName(master, item.sigil_type_id)})`
        ), undefined;
      }
    }
    equipKeys.add(key);
    equips.push({ build_id: buildId, skill_id: skillId, slot_no: slotNo, inventory_id: invId });
  });

  // v0.2 #3: Free装着状況 (枠タイプ一致検証はFreeにも適用)
  const freeEquips: FreeEquip[] = [];
  const freeEquipSheet = wb.Sheets["Free装着状況"];
  if (freeEquipSheet) {
    const freeKeys = new Set<string>();
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(freeEquipSheet);
    rows.forEach((r, idx) => {
      const rowNo = idx + 2;
      const buildId = str(r["build_id"]);
      const skillId = str(r["skill_id"]);
      const slotNo = Number(r["slot_no"]);
      const effectId = str(r["effect_id"]);
      const rarityJa = str(r["等級"]);
      if (!buildId && !skillId && !effectId) return; // 空行(0件時のプレースホルダ)はスキップ
      if (!freeBuildIds.has(buildId))
        return issues.errors.push(`Free装着状況 ${rowNo}行目: 存在しないFree編成 (${buildId})`), undefined;
      if (!Number.isInteger(slotNo) || slotNo < 1 || slotNo > 4)
        return issues.errors.push(`Free装着状況 ${rowNo}行目: slot_noは1〜4です (${r["slot_no"]})`), undefined;
      const rarity = RARITY_FROM_JA[rarityJa];
      if (!rarity)
        return issues.errors.push(`Free装着状況 ${rowNo}行目: 等級は深淵/太古/混沌のいずれかです (${rarityJa})`), undefined;
      const key = `${buildId}|${skillId}|${slotNo}`;
      if (freeKeys.has(key))
        return issues.errors.push(`Free装着状況 ${rowNo}行目: 同じ枠への重複装着 (${key})`), undefined;
      const effect = master.effects.find((e) => e.effect_id === effectId);
      const skill = skillIndex.get(skillId);
      if (!effect) {
        issues.warnings.push(`Free装着状況 ${rowNo}行目: マスタに無い効果ID (${effectId}) — 警告つきで保持します`);
      }
      if (!skill) {
        issues.warnings.push(`Free装着状況 ${rowNo}行目: マスタに無いスキル (${skillId}) — 警告つきで保持します`);
      } else {
        if (!skill.sigil_eligible)
          return issues.errors.push(`Free装着状況 ${rowNo}行目: 装着対象外スキル (${skill.name_ja})`), undefined;
        const slotType = skill.slots?.[slotNo - 1];
        if (effect && slotType && effect.sigil_type_id !== slotType) {
          return issues.errors.push(
            `Free装着状況 ${rowNo}行目: 枠タイプ不一致 (${skill.name_ja} 枠${slotNo}=${typeName(master, slotType)} / 効果=${typeName(master, effect.sigil_type_id)})`
          ), undefined;
        }
      }
      freeKeys.add(key);
      freeEquips.push({
        build_id: buildId,
        skill_id: skillId,
        slot_no: slotNo,
        effect_id: effectId,
        rarity,
        value_text: str(r["数値"]),
      });
    });
  }

  // 装着数 > 所持数 チェック(編成ごと)
  for (const item of inventory) {
    const byBuild = new Map<string, number>();
    for (const e of equips) {
      if (e.inventory_id === item.inventory_id) {
        byBuild.set(e.build_id, (byBuild.get(e.build_id) ?? 0) + 1);
      }
    }
    for (const [bid, n] of byBuild) {
      if (n > item.quantity) {
        issues.errors.push(
          `装着数超過: ${item.inventory_id} が編成 ${bid} で ${n}個装着 (所持${item.quantity})`
        );
      }
    }
  }

  const myBuildCount = builds.filter((b) => b.mode === "my").length;
  const freeBuildCount = builds.filter((b) => b.mode === "free").length;
  issues.infos.push(
    `所持秘伝 ${inventory.length}件 / 編成 ${myBuildCount}件 / 装着 ${equips.length}件 / Free編成 ${freeBuildCount}件 / Free装着 ${freeEquips.length}件を読み取りました。`
  );

  return {
    issues,
    parsed: issues.errors.length > 0
      ? null
      : {
          formatVersion,
          exportedAt: str(readme.get("exported_at")),
          inventory,
          builds,
          equips,
          freeEquips,
        },
  };
}

export type ImportMode = "replace" | "merge";

/** 取込適用。replace=置換 / merge=追加統合(ID重複は別IDを採番して追加) */
export function applyImport(
  current: UserData,
  parsed: ParsedBackup,
  mode: ImportMode
): UserData {
  if (mode === "replace") {
    return {
      ...current,
      inventory: parsed.inventory,
      builds: parsed.builds,
      equips: parsed.equips,
      freeEquips: parsed.freeEquips,
      meta: { ...current.meta, selected_build_id: null },
    };
  }

  // merge: 完全同一IDかつ内容同一→スキップ / ID衝突で内容差→新IDで追加
  const invIdMap = new Map<string, string>();
  const inventory = [...current.inventory];
  for (const item of parsed.inventory) {
    const existing = current.inventory.find((i) => i.inventory_id === item.inventory_id);
    if (existing) {
      const same =
        existing.sigil_type_id === item.sigil_type_id &&
        existing.effect_id === item.effect_id &&
        existing.rarity === item.rarity &&
        existing.value_text === item.value_text &&
        existing.quantity === item.quantity;
      if (same) {
        invIdMap.set(item.inventory_id, existing.inventory_id);
        continue;
      }
      const newId = uid("inv");
      invIdMap.set(item.inventory_id, newId);
      inventory.push({ ...item, inventory_id: newId });
    } else {
      invIdMap.set(item.inventory_id, item.inventory_id);
      inventory.push(item);
    }
  }

  const buildIdMap = new Map<string, string>();
  const builds = [...current.builds];
  for (const b of parsed.builds) {
    const existing = current.builds.find((x) => x.build_id === b.build_id);
    if (existing) {
      const newId = uid("build");
      buildIdMap.set(b.build_id, newId);
      builds.push({ ...b, build_id: newId, name: `${b.name} (取込)` });
    } else {
      buildIdMap.set(b.build_id, b.build_id);
      builds.push(b);
    }
  }

  const equips = [...current.equips];
  for (const e of parsed.equips) {
    const bid = buildIdMap.get(e.build_id);
    const iid = invIdMap.get(e.inventory_id);
    if (!bid || !iid) continue;
    // 既存編成へ統合された場合、同一枠が埋まっていればスキップ
    if (equips.some((x) => x.build_id === bid && x.skill_id === e.skill_id && x.slot_no === e.slot_no)) {
      continue;
    }
    equips.push({ ...e, build_id: bid, inventory_id: iid });
  }

  // v0.2 #3: Free装着の統合 (所持品参照が無いためIDマップはbuildのみ)
  const freeEquips = [...current.freeEquips];
  for (const e of parsed.freeEquips) {
    const bid = buildIdMap.get(e.build_id);
    if (!bid) continue;
    if (freeEquips.some((x) => x.build_id === bid && x.skill_id === e.skill_id && x.slot_no === e.slot_no)) {
      continue;
    }
    freeEquips.push({ ...e, build_id: bid });
  }

  return { ...current, inventory, builds, equips, freeEquips };
}
