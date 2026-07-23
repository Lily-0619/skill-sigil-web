// 編成比較の集計ロジック (docs/17_編成比較機能_設計方針.md)
// 方針: 既存システムを一切変更しないため、BuildEdit.tsx の equippedCatalog 相当の集計を
//       この新規ファイル内で自己完結して持つ。equip.ts の純粋関数は import して使うだけ
//       (改変しない)。数値は合算せず「値 ×N個」で個数集約する。
import type {
  Build,
  BuildMode,
  ClassDef,
  Master,
  Rarity,
  RarityDef,
  SigilTypeDef,
  SkillGroup,
  UserData,
} from "../types";
import {
  buildEquipStats,
  effectOf,
  skillsOf,
} from "./equip";

/** 等級の良い順 (混沌 > 太古 > 深淵)。BuildEdit と同じ並び。 */
export const RARITY_ORDER: Rarity[] = ["chaos", "primal", "abyssal"];

/**
 * 同じ数値が重複する場合は「値 ×N個」にまとめ、出現順を保って " / " 区切りで返す。
 * (BuildEdit.tsx の collapseValues と同じ挙動。合算はしない)
 */
export function collapseValues(vals: string[]): string {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const v of vals) {
    if (!counts.has(v)) order.push(v);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return order
    .map((v) => (counts.get(v)! > 1 ? `${v} ×${counts.get(v)}個` : v))
    .join(" / ");
}

// ---- 表示用の型 ----------------------------------------------------------------

/** 案A: スキルの1枠ぶん (装着 or 空き) */
export interface CompareSlot {
  slotNo: number;
  slotType: string; // sigil_type_id
  effectId: string | null;
  effectName: string | null;
  rarity: Rarity | null;
  valueText: string; // 空文字なら数値なし
}

/** 案A: スキル1行 (固定4枠) */
export interface CompareSkillRow {
  skillId: string;
  displayNo: number;
  group: SkillGroup;
  name: string;
  eligible: boolean;
  slots: CompareSlot[]; // 対象外スキルは []
  filled: number; // 装着済み枠数
}

/** 案B: 等級ごとの集約 */
export interface SummaryRarity {
  rarity: RarityDef;
  valuesText: string; // collapseValues 済み
  count: number; // 本数 (合算ではなく個数)
}

/** 案B: 効果ごとの集約 */
export interface SummaryEffect {
  effectId: string;
  name: string;
  rarities: SummaryRarity[];
  count: number; // この効果の総本数
}

/** 案B: 秘伝タイプごとの集約 */
export interface SummaryTypeGroup {
  type: SigilTypeDef;
  effects: SummaryEffect[];
  count: number; // このタイプの総本数
}

/** 案C: バー1本ぶんの件数 */
export interface CountBar {
  id: string;
  label: string;
  color: string;
  count: number;
}

/** 1編成ぶんの比較データ (案A/B/C すべてこの1オブジェクトから描く) */
export interface CompareBuild {
  build: Build;
  cls: ClassDef | undefined;
  mode: BuildMode;
  used: number; // 装着枠数
  total: number; // 秘伝対象の総枠数
  skills: CompareSkillRow[]; // 案A
  summary: SummaryTypeGroup[]; // 案B
  typeCounts: CountBar[]; // 案C: タイプ別本数
  rarityCounts: CountBar[]; // 案C: 等級別本数
}

// ---- 内部: 装着済みを共通の行に正規化 --------------------------------------------

interface EquippedRow {
  typeId: string;
  effectId: string;
  name: string;
  rarity: Rarity;
  value: string;
  skillId: string;
  slotNo: number;
}

/**
 * 編成の装着済み秘伝を EquippedRow[] に正規化する。
 * My は equips → inventory を辿り、Free は freeEquips を直接参照する
 * (BuildEdit.tsx の equippedCatalog と同じ分岐)。
 */
function equippedRowsOf(
  master: Master,
  data: UserData,
  build: Build
): EquippedRow[] {
  if (build.mode === "free") {
    return data.freeEquips
      .filter((e) => e.build_id === build.build_id)
      .map((e) => {
        const eff = effectOf(master, e.effect_id);
        return {
          typeId: eff?.sigil_type_id ?? "",
          effectId: e.effect_id,
          name: eff?.name_ja ?? e.effect_id,
          rarity: e.rarity as Rarity,
          value: e.value_text,
          skillId: e.skill_id,
          slotNo: e.slot_no,
        };
      });
  }
  const rows: EquippedRow[] = [];
  for (const e of data.equips) {
    if (e.build_id !== build.build_id) continue;
    const inv = data.inventory.find((i) => i.inventory_id === e.inventory_id);
    if (!inv) continue;
    const eff = effectOf(master, inv.effect_id);
    rows.push({
      typeId: inv.sigil_type_id,
      effectId: inv.effect_id,
      name: eff?.name_ja ?? inv.effect_id,
      rarity: inv.rarity as Rarity,
      value: inv.value_text,
      skillId: e.skill_id,
      slotNo: e.slot_no,
    });
  }
  return rows;
}

// ---- 案A: スキルごと ------------------------------------------------------------

function skillRowsOf(
  master: Master,
  build: Build,
  rows: EquippedRow[]
): CompareSkillRow[] {
  const skills = skillsOf(master, build.class_id);
  return skills.map((skill) => {
    const eligible = skill.sigil_eligible && !!skill.slots;
    const slots: CompareSlot[] = eligible
      ? skill.slots!.map((slotType, idx) => {
          const slotNo = idx + 1;
          const hit = rows.find(
            (r) => r.skillId === skill.skill_id && r.slotNo === slotNo
          );
          return {
            slotNo,
            slotType,
            effectId: hit?.effectId ?? null,
            effectName: hit?.name ?? null,
            rarity: hit?.rarity ?? null,
            valueText: hit?.value ?? "",
          };
        })
      : [];
    return {
      skillId: skill.skill_id,
      displayNo: skill.display_no,
      group: skill.group,
      name: skill.name_ja,
      eligible,
      slots,
      filled: slots.filter((s) => s.effectId !== null).length,
    };
  });
}

// ---- 案B: タイプ別サマリー ------------------------------------------------------

function summaryOf(
  master: Master,
  rows: EquippedRow[]
): SummaryTypeGroup[] {
  return master.sigil_types
    .map((type) => {
      const typeRows = rows.filter((r) => r.typeId === type.id);
      const effIds = Array.from(new Set(typeRows.map((r) => r.effectId))).sort(
        (a, b) =>
          (effectOf(master, a)?.sort_order ?? 0) -
          (effectOf(master, b)?.sort_order ?? 0)
      );
      const effects: SummaryEffect[] = effIds.map((effectId) => {
        const effRows = typeRows.filter((r) => r.effectId === effectId);
        const name = effRows[0]!.name;
        const rarities: SummaryRarity[] = RARITY_ORDER.filter((rid) =>
          effRows.some((r) => r.rarity === rid)
        ).map((rid) => {
          const rrRows = effRows.filter((r) => r.rarity === rid);
          return {
            rarity: master.rarities.find((x) => x.id === rid)!,
            valuesText: collapseValues(
              rrRows.map((r) => r.value).filter((v) => v && v.length > 0)
            ),
            count: rrRows.length,
          };
        });
        return { effectId, name, rarities, count: effRows.length };
      });
      return { type, effects, count: typeRows.length };
    })
    .filter((g) => g.effects.length > 0);
}

// ---- 案C: 件数バー --------------------------------------------------------------

function typeCountsOf(master: Master, rows: EquippedRow[]): CountBar[] {
  return master.sigil_types
    .map((t) => ({
      id: t.id,
      label: t.name,
      color: t.color,
      count: rows.filter((r) => r.typeId === t.id).length,
    }))
    .filter((b) => b.count > 0);
}

function rarityCountsOf(master: Master, rows: EquippedRow[]): CountBar[] {
  return RARITY_ORDER.map((rid) => {
    const def = master.rarities.find((r) => r.id === rid)!;
    return {
      id: rid,
      label: def.name,
      color: def.color,
      count: rows.filter((r) => r.rarity === rid).length,
    };
  }).filter((b) => b.count > 0);
}

// ---- まとめ --------------------------------------------------------------------

/** 1編成ぶんの比較データを組み立てる (案A/B/C 共通の入力) */
export function buildCompareData(
  master: Master,
  data: UserData,
  build: Build
): CompareBuild {
  const rows = equippedRowsOf(master, data, build);
  const equips = build.mode === "free" ? data.freeEquips : data.equips;
  const { total, used } = buildEquipStats(
    master,
    build.class_id,
    equips,
    build.build_id
  );
  return {
    build,
    cls: master.classes.find((c) => c.class_id === build.class_id),
    mode: build.mode,
    used,
    total,
    skills: skillRowsOf(master, build, rows),
    summary: summaryOf(master, rows),
    typeCounts: typeCountsOf(master, rows),
    rarityCounts: rarityCountsOf(master, rows),
  };
}
