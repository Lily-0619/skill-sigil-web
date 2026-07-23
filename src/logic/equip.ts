// 装着判定・残数計算 (docs/02_要件定義書.md REQ-RULE-002/003, 04_データ設計書.md §4)
import type {
  EquippedSigil,
  FreeEquip,
  InventoryItem,
  Master,
  SkillDef,
  UserData,
} from "../types";

export function skillsOf(master: Master, classId: string): SkillDef[] {
  return master.skills[classId] ?? [];
}

export function findSkill(
  master: Master,
  classId: string,
  skillId: string
): SkillDef | undefined {
  return skillsOf(master, classId).find((s) => s.skill_id === skillId);
}

/** 同一編成内での使用数 */
export function usedCount(
  equips: EquippedSigil[],
  buildId: string,
  inventoryId: string
): number {
  return equips.filter(
    (e) => e.build_id === buildId && e.inventory_id === inventoryId
  ).length;
}

/** 残数 = 所持数 - 同一編成内の使用数 */
export function remaining(
  item: InventoryItem,
  equips: EquippedSigil[],
  buildId: string
): number {
  return item.quantity - usedCount(equips, buildId, inventoryId(item));
}

const inventoryId = (item: InventoryItem) => item.inventory_id;

/** 全編成を横断した「1編成あたりの最大使用数」(所持数減少の下限判定に使う) */
export function maxUsedPerBuild(
  equips: EquippedSigil[],
  invId: string
): { max: number; buildIds: string[] } {
  const byBuild = new Map<string, number>();
  for (const e of equips) {
    if (e.inventory_id === invId) {
      byBuild.set(e.build_id, (byBuild.get(e.build_id) ?? 0) + 1);
    }
  }
  let max = 0;
  for (const n of byBuild.values()) max = Math.max(max, n);
  const buildIds = [...byBuild.entries()]
    .filter(([, n]) => n === max)
    .map(([b]) => b);
  return { max, buildIds };
}

/** 指定編成内の装着一覧 */
export function equipsForSkill(
  equips: EquippedSigil[],
  buildId: string,
  skillId: string
): EquippedSigil[] {
  return equips.filter(
    (e) => e.build_id === buildId && e.skill_id === skillId
  );
}

export function equipAt(
  equips: EquippedSigil[],
  buildId: string,
  skillId: string,
  slotNo: number
): EquippedSigil | undefined {
  return equips.find(
    (e) =>
      e.build_id === buildId && e.skill_id === skillId && e.slot_no === slotNo
  );
}

/** 同一編成内でこの所持品が装着されている場所 */
export function locationsOf(
  equips: EquippedSigil[],
  buildId: string,
  invId: string
): EquippedSigil[] {
  return equips.filter(
    (e) => e.build_id === buildId && e.inventory_id === invId
  );
}

export type EquipCheck =
  | { ok: true; needsMoveFrom?: EquippedSigil }
  | { ok: false; reason: string };

/**
 * 装着可否判定 (docs/04 §4)
 * 1. sigil_eligible / 2. slot存在 / 3. タイプ一致 / 4. 残数>=1 / 5. 効果enabled
 * 残数0でも「同一編成内の別枠から移動」できる場合は needsMoveFrom を返す。
 */
export function canEquip(
  master: Master,
  data: UserData,
  classId: string,
  buildId: string,
  skillId: string,
  slotNo: number,
  item: InventoryItem
): EquipCheck {
  const skill = findSkill(master, classId, skillId);
  if (!skill) return { ok: false, reason: "スキルが見つかりません" };
  if (!skill.sigil_eligible || !skill.slots)
    return { ok: false, reason: "このスキルは秘伝装着対象外です" };
  if (slotNo < 1 || slotNo > skill.slots.length)
    return { ok: false, reason: "枠番号が不正です" };

  const slotType = skill.slots[slotNo - 1];
  if (slotType !== item.sigil_type_id)
    return {
      ok: false,
      reason: `この枠は「${typeName(master, slotType)}」タイプ固定です`,
    };

  const effect = master.effects.find((e) => e.effect_id === item.effect_id);
  if (!effect) return { ok: false, reason: "効果がマスタに存在しません" };
  if (!effect.enabled)
    return { ok: false, reason: "無効化された旧マスタの効果のため新規装着できません" };

  // すでに同じ枠に同じ所持品が装着済みなら何もしない扱い
  const current = equipAt(data.equips, buildId, skillId, slotNo);
  if (current?.inventory_id === item.inventory_id) return { ok: true };

  // 系列(branch)は1編成に同一系列4つまで (この枠を除いて数える)
  if (item.sigil_type_id === BRANCH_TYPE_ID) {
    const cnt = effectCountInBuild(data, buildId, item.effect_id, false, {
      skillId,
      slotNo,
    });
    if (cnt >= SAME_SERIES_MAX)
      return {
        ok: false,
        reason: `同じ系列（${effect.name_ja}）は1編成に${SAME_SERIES_MAX}つまでです`,
      };
  }

  const rem = remaining(item, data.equips, buildId);
  if (rem >= 1) return { ok: true };

  // 残数0: 同一編成内の別の場所で使用中なら移動を提案
  const locs = locationsOf(data.equips, buildId, item.inventory_id).filter(
    (e) => !(e.skill_id === skillId && e.slot_no === slotNo)
  );
  if (locs.length > 0) return { ok: true, needsMoveFrom: locs[0] };

  return { ok: false, reason: "残数が0のため装着できません" };
}

/**
 * v0.2 #3: Free編成の装着可否判定。
 * タイプ一致＋効果enabledのみ検証し、所持数・残数・重複の制限は課さない。
 */
export function canEquipFree(
  master: Master,
  data: UserData,
  classId: string,
  buildId: string,
  skillId: string,
  slotNo: number,
  effectId: string
): EquipCheck {
  const skill = findSkill(master, classId, skillId);
  if (!skill) return { ok: false, reason: "スキルが見つかりません" };
  if (!skill.sigil_eligible || !skill.slots)
    return { ok: false, reason: "このスキルは秘伝装着対象外です" };
  if (slotNo < 1 || slotNo > skill.slots.length)
    return { ok: false, reason: "枠番号が不正です" };

  const effect = master.effects.find((e) => e.effect_id === effectId);
  if (!effect) return { ok: false, reason: "効果がマスタに存在しません" };
  if (!effect.enabled)
    return { ok: false, reason: "無効化された旧マスタの効果のため新規装着できません" };

  const slotType = skill.slots[slotNo - 1];
  if (slotType !== effect.sigil_type_id)
    return {
      ok: false,
      reason: `この枠は「${typeName(master, slotType)}」タイプ固定です`,
    };

  // 系列(branch)は1編成に同一系列4つまで (この枠を除いて数える)
  if (effect.sigil_type_id === BRANCH_TYPE_ID) {
    const cnt = effectCountInBuild(data, buildId, effectId, true, {
      skillId,
      slotNo,
    });
    if (cnt >= SAME_SERIES_MAX)
      return {
        ok: false,
        reason: `同じ系列（${effect.name_ja}）は1編成に${SAME_SERIES_MAX}つまでです`,
      };
  }

  return { ok: true };
}

/** v0.2 #3: Free編成の指定枠の装着 */
export function freeEquipAt(
  freeEquips: FreeEquip[],
  buildId: string,
  skillId: string,
  slotNo: number
): FreeEquip | undefined {
  return freeEquips.find(
    (e) =>
      e.build_id === buildId && e.skill_id === skillId && e.slot_no === slotNo
  );
}

/** v0.2 #3: Free編成のスキル内装着一覧 */
export function freeEquipsForSkill(
  freeEquips: FreeEquip[],
  buildId: string,
  skillId: string
): FreeEquip[] {
  return freeEquips.filter(
    (e) => e.build_id === buildId && e.skill_id === skillId
  );
}

// 系列(branch)タイプのID / 同一系列の1編成あたり装着上限 は
// スキル秘伝ルールの正本 (src/game-rules) を参照する。既存importの後方互換で再export。
export { BRANCH_TYPE_ID, SAME_SERIES_MAX } from "../game-rules/skill-sigil-rules";
import { BRANCH_TYPE_ID, SAME_SERIES_MAX } from "../game-rules/skill-sigil-rules";

/** その効果が系列(branch)タイプか */
export function isBranchEffect(master: Master, effectId: string): boolean {
  return effectOf(master, effectId)?.sigil_type_id === BRANCH_TYPE_ID;
}

/**
 * 編成内で指定effectが装着されている数を数える (My=inventory経由 / Free=直接参照)。
 * exclude を渡すとその枠を除外して数える (置き換え時の自己カウント回避)。
 */
export function effectCountInBuild(
  data: UserData,
  buildId: string,
  effectId: string,
  isFree: boolean,
  exclude?: { skillId: string; slotNo: number }
): number {
  const isExcluded = (skillId: string, slotNo: number) =>
    !!exclude && exclude.skillId === skillId && exclude.slotNo === slotNo;
  if (isFree) {
    return data.freeEquips.filter(
      (e) =>
        e.build_id === buildId &&
        e.effect_id === effectId &&
        !isExcluded(e.skill_id, e.slot_no)
    ).length;
  }
  return data.equips.filter((e) => {
    if (e.build_id !== buildId || isExcluded(e.skill_id, e.slot_no)) return false;
    const inv = data.inventory.find((i) => i.inventory_id === e.inventory_id);
    return inv?.effect_id === effectId;
  }).length;
}

export function typeName(master: Master, typeId: string): string {
  return master.sigil_types.find((t) => t.id === typeId)?.name ?? typeId;
}

export function effectOf(master: Master, effectId: string) {
  return master.effects.find((e) => e.effect_id === effectId);
}

export function rarityDef(master: Master, rarity: string) {
  return master.rarities.find((r) => r.id === rarity);
}

/** 編成内の装着枠合計 / 装着済み数 (My/Freeどちらの装着配列でも使える) */
export function buildEquipStats(
  master: Master,
  classId: string,
  equips: { build_id: string }[],
  buildId: string
): { total: number; used: number } {
  const total = skillsOf(master, classId).reduce(
    (a, s) => a + (s.slots?.length ?? 0),
    0
  );
  const used = equips.filter((e) => e.build_id === buildId).length;
  return { total, used };
}

/** 効果と等級から既定値テキストを作る (docs/03 §5, 11_効果マスタ数値.md) */
export function defaultValueText(
  master: Master,
  effectId: string,
  rarity: string,
  pick?: "a" | "b"
): string {
  const effect = effectOf(master, effectId);
  if (!effect) return "";
  const vals = effect.values[rarity as keyof typeof effect.values];
  if (!vals || vals.length === 0) return "";
  if (effect.two_effects) return vals.join(" , ");
  if (vals.length === 2) return pick === "b" ? vals[1] : vals[0];
  return vals[0];
}

/** その効果がその等級で存在するか (`-`等級は選択不可) */
export function rarityAvailable(
  master: Master,
  effectId: string,
  rarity: string
): boolean {
  const effect = effectOf(master, effectId);
  if (!effect) return false;
  return rarity in effect.values;
}
