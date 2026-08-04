// 達成度 (収集進捗) の集計ロジック。
// 「Freeで組んだ理想編成」に対して、所持秘伝がどれだけ集まったか / My編成にどれだけ
// 反映できているかを枠単位で突き合わせる。
//
// 方針 (compare.ts と同じ): 既存システムは一切変更しない。equip.ts の純粋関数は
// import して使うだけで改変しない。集計はこのファイル内で自己完結させる。
//
// まな指定のルール (2026-08-04):
//  - 達成率は点数式。1枠の満点=1.0 で、実際に持っている/着けている秘伝の
//    「等級 × 効果が理想と一致するか × (混沌のみ)数値が上位か」で係数が決まる (SCORE)
//  - 同じ効果を複数枠で使う理想編成では、所持数を消費しながら割り当てる
//    (手持ち1個で4枠を満たしたことにはしない)
//  - 「持っているのに着けていない」「理想と違うものを着けている」は
//    入れ替えるだけで解消できるので、最も目立たせる
import type {
  Build,
  ClassDef,
  InventoryItem,
  Master,
  Rarity,
  SkillGroup,
  UserData,
} from "../types";
import { effectOf, skillsOf } from "./equip";
import { skillIconUrls } from "../lib/assets";
import { RARITY_ORDER } from "../game-rules/skill-sigil-rules";

/** 枠の状態。左ほど良い。表示色もこの順で強さが変わる */
export type SlotState =
  /** 数値まで理想どおり */
  | "exact"
  /** 効果・等級は一致しているが数値が違う */
  | "value-diff"
  /** 持っているのに着けていない / 理想と違うものを着けている (入れ替えるだけ) */
  | "swap"
  /** 同じ効果はあるが等級が理想より下 */
  | "rarity-short"
  /** まだ引けていない */
  | "missing";

/** 理想1枠ぶんの判定結果 */
export interface ProgressSlot {
  slotNo: number;
  slotType: string;
  state: SlotState;
  /** 理想 (Free編成の内容) */
  idealEffectId: string;
  idealEffectName: string;
  idealRarity: Rarity;
  idealValue: string;
  /** My編成でこの枠に実際に着いているもの (無ければ null) */
  actualEffectName: string | null;
  actualRarity: Rarity | null;
  actualValue: string;
  /** 所持秘伝の中に理想と同じ効果があったか */
  owned: boolean;
  /** 所持している中で数値まで理想どおりのものがあったか */
  ownedExactValue: boolean;
  /** 所持ベースの点数 (満点1.0) */
  ownedScore: number;
  /** 装着ベースの点数 (満点1.0) */
  equippedScore: number;
}

/** スキル1行 */
export interface ProgressSkillRow {
  skillId: string;
  displayNo: number;
  group: SkillGroup;
  name: string;
  iconUrl: string | null;
  slots: ProgressSlot[];
  /** 理想と同じ効果を持てている枠数 (所持ベース) */
  ownedCount: number;
  /** 数値まで満たせている枠数 (所持ベース) */
  ownedExactCount: number;
  /** My編成で理想どおり着いている枠数 */
  equippedCount: number;
  /** 数値まで理想どおり着いている枠数 */
  equippedExactCount: number;
  /** このスキルの点数 (所持ベース / 装着ベース) と満点 */
  ownedScore: number;
  equippedScore: number;
}

/** 不足リスト1件 */
export interface ShortageRow {
  effectId: string;
  effectName: string;
  rarity: Rarity;
  /** 何個足りないか */
  need: number;
}

export interface ProgressData {
  ideal: Build;
  actual: Build | null;
  cls: ClassDef | undefined;
  /** 理想編成が埋めている総枠数 (=点数の満点。1枠1.0点) */
  total: number;
  /** 所持ベースの合計点 */
  ownedScore: number;
  /** 装着ベースの合計点 */
  equippedScore: number;
  /** 所持ベース: 理想と同じ効果を持てている枠数 */
  owned: number;
  /** 所持ベース: 数値まで一致 */
  ownedExact: number;
  /** 装着ベース: 効果+等級まで一致 */
  equipped: number;
  /** 装着ベース: 数値まで一致 */
  equippedExact: number;
  /** 入れ替えるだけで装着ベースが増える枠数 */
  swappable: number;
  skills: ProgressSkillRow[];
  shortages: ShortageRow[];
}

/** 等級の強さ。小さいほど良い (RARITY_ORDER は良い順) */
const rarityRank = (r: Rarity): number => {
  const i = RARITY_ORDER.indexOf(r);
  return i < 0 ? RARITY_ORDER.length : i;
};

/** actual が ideal と同じ等級以上か */
export const rarityMeets = (actual: Rarity, ideal: Rarity): boolean =>
  rarityRank(actual) <= rarityRank(ideal);

/**
 * 1枠ぶんの点数 (満点=1.0)。まな指定 (2026-08-04)。
 * 実際に持っている/着けている秘伝の等級で決まる。理想の等級には依らない。
 *  - 混沌: 効果一致で数値が上位=1.0 / 下位=0.95 、効果不一致=0.8
 *  - 太古: 効果一致=0.7 (数値は問わない) 、効果不一致=0.6
 *  - 深淵: 効果一致=0.4 、効果不一致=0.3
 */
export const SCORE: Record<
  Rarity,
  { matchTop: number; matchLow: number; miss: number }
> = {
  chaos: { matchTop: 1.0, matchLow: 0.95, miss: 0.8 },
  primal: { matchTop: 0.7, matchLow: 0.7, miss: 0.6 },
  abyssal: { matchTop: 0.4, matchLow: 0.4, miss: 0.3 },
};

/**
 * その等級の数値2択のうち上位かどうか。
 * skill-sigil.json の values は良い順に並んでいないので「配列の最後=上位」とみなす
 * (2値41件中38件が昇順。残りは単位の違う特殊ケース)。2択でない効果は上位扱い。
 */
export function isTopValue(
  master: Master,
  effectId: string,
  rarity: Rarity,
  value: string
): boolean {
  const vals = effectOf(master, effectId)?.values?.[rarity] ?? [];
  if (vals.length < 2) return true;
  return value === vals[vals.length - 1];
}

/** 1枠ぶんの点数を求める */
export function slotScore(
  master: Master,
  rarity: Rarity,
  effectMatched: boolean,
  effectId: string,
  value: string
): number {
  const s = SCORE[rarity];
  if (!s) return 0;
  if (!effectMatched) return s.miss;
  return isTopValue(master, effectId, rarity, value) ? s.matchTop : s.matchLow;
}

/** 所持秘伝を「効果ごと・等級ごとの残り個数」に展開する */
interface Stock {
  effectId: string;
  typeId: string;
  rarity: Rarity;
  value: string;
  left: number;
}

function stockOf(inventory: InventoryItem[]): Stock[] {
  return inventory
    .filter((i) => i.quantity > 0)
    .map((i) => ({
      effectId: i.effect_id,
      typeId: i.sigil_type_id,
      rarity: i.rarity,
      value: i.value_text,
      left: i.quantity,
    }));
}

interface Picked {
  stock: Stock;
  score: number;
  matched: boolean;
}

/**
 * 理想1枠に対して、所持在庫から最も点数が高くなるものを1つ取り出して消費する。
 * 1) 理想と同じ効果 (等級が理想より下でも点数は付く)
 * 2) 無ければ同じ枠タイプの別効果 (効果不一致の点数)
 * 返り値: 消費できたら { score, matched, stock } / 何も使えなければ null
 */
function consumeBest(
  master: Master,
  stock: Stock[],
  effectId: string,
  slotType: string
): Picked | null {
  const candidates = stock.filter(
    (s) => s.left > 0 && (s.effectId === effectId || s.typeId === slotType)
  );
  if (candidates.length === 0) return null;

  let best: Picked | null = null;
  for (const s of candidates) {
    const matched = s.effectId === effectId;
    const score = slotScore(master, s.rarity, matched, s.effectId, s.value);
    if (!best || score > best.score) best = { stock: s, score, matched };
  }
  if (!best) return null;
  best.stock.left -= 1;
  return best;
}

/**
 * 達成度データを組み立てる。
 * @param ideal  Free編成 (理想)
 * @param actual 同じクラスのMy編成 (無ければ装着ベースは0になる)
 */
export function buildProgressData(
  master: Master,
  data: UserData,
  ideal: Build,
  actual: Build | null
): ProgressData {
  const skills = skillsOf(master, ideal.class_id);
  const freeEquips = data.freeEquips.filter((e) => e.build_id === ideal.build_id);
  const stock = stockOf(data.inventory);

  // My編成の装着状況 (skill_id + slot_no → 所持品)
  const actualAt = new Map<string, InventoryItem>();
  if (actual) {
    for (const e of data.equips) {
      if (e.build_id !== actual.build_id) continue;
      const inv = data.inventory.find((i) => i.inventory_id === e.inventory_id);
      if (inv) actualAt.set(`${e.skill_id}#${e.slot_no}`, inv);
    }
  }

  // 不足数の集計 (効果+等級ごと)
  const shortageMap = new Map<string, ShortageRow>();

  const rows: ProgressSkillRow[] = [];
  let total = 0;
  let owned = 0;
  let ownedExact = 0;
  let equipped = 0;
  let equippedExact = 0;
  let swappable = 0;
  let ownedScoreSum = 0;
  let equippedScoreSum = 0;

  for (const skill of skills) {
    if (!skill.sigil_eligible || !skill.slots) continue;

    const slots: ProgressSlot[] = [];
    for (let idx = 0; idx < skill.slots.length; idx++) {
      const slotNo = idx + 1;
      const wish = freeEquips.find(
        (e) => e.skill_id === skill.skill_id && e.slot_no === slotNo
      );
      // 理想編成が空けている枠は達成率の対象にしない (組んでいない=目標が無い)
      if (!wish) continue;

      total++;
      const eff = effectOf(master, wish.effect_id);
      const idealName = eff?.name_ja ?? wish.effect_id;
      const idealRarity = wish.rarity as Rarity;

      // --- 所持ベース: 在庫から最も点数が高くなるものを1つ消費 ---
      const got = consumeBest(master, stock, wish.effect_id, skill.slots[idx]!);
      const isOwned = got?.matched === true;
      const isOwnedExact = isOwned && got!.stock.value === wish.value_text;
      const ownedScore = got?.score ?? 0;
      ownedScoreSum += ownedScore;
      if (isOwned) owned++;
      if (isOwnedExact) ownedExact++;

      // --- 装着ベース: My編成のその枠を見る ---
      const cur = actualAt.get(`${skill.skill_id}#${slotNo}`);
      const curMatched = !!cur && cur.effect_id === wish.effect_id;
      const equippedScore = cur
        ? slotScore(
            master,
            cur.rarity as Rarity,
            curMatched,
            cur.effect_id,
            cur.value_text
          )
        : 0;
      equippedScoreSum += equippedScore;
      // 「理想どおり着けている」の枠数カウントは従来どおり等級も見る
      const curMeets =
        curMatched && rarityMeets(cur!.rarity as Rarity, idealRarity);
      const curExact = curMeets && cur!.value_text === wish.value_text;
      if (curMeets) equipped++;
      if (curExact) equippedExact++;

      // --- 枠の状態を決める ---
      // 「入れ替えれば点数が上がる」を最優先で見せる (今すぐ直せる枠だから)。
      let state: SlotState;
      if (ownedScore > equippedScore + 1e-9) {
        state = "swap";
        swappable++;
      } else if (curExact) {
        state = "exact";
      } else if (curMatched) {
        // 効果は理想どおりだが等級か数値が理想に届いていない
        state = "value-diff";
      } else if (equippedScore > 0 || got) {
        // 理想の効果は無いが、その枠に入る別効果でしのいでいる
        state = "rarity-short";
      } else {
        state = "missing";
      }

      // 未所持なら不足リストに積む
      if (!isOwned) {
        const key = `${wish.effect_id}#${idealRarity}`;
        const hit = shortageMap.get(key);
        if (hit) hit.need++;
        else
          shortageMap.set(key, {
            effectId: wish.effect_id,
            effectName: idealName,
            rarity: idealRarity,
            need: 1,
          });
      }

      slots.push({
        slotNo,
        slotType: skill.slots[idx]!,
        state,
        idealEffectId: wish.effect_id,
        idealEffectName: idealName,
        idealRarity,
        idealValue: wish.value_text,
        actualEffectName: cur
          ? effectOf(master, cur.effect_id)?.name_ja ?? cur.effect_id
          : null,
        actualRarity: cur ? (cur.rarity as Rarity) : null,
        actualValue: cur?.value_text ?? "",
        owned: isOwned,
        ownedExactValue: isOwnedExact,
        ownedScore,
        equippedScore,
      });
    }

    if (slots.length === 0) continue;
    const sum = (f: (s: ProgressSlot) => number) =>
      slots.reduce((a, s) => a + f(s), 0);
    rows.push({
      skillId: skill.skill_id,
      displayNo: skill.display_no,
      group: skill.group,
      name: skill.name_ja,
      iconUrl: skillIconUrls(ideal.class_id, skill)[0] ?? null,
      slots,
      ownedCount: slots.filter((s) => s.owned).length,
      ownedExactCount: slots.filter((s) => s.ownedExactValue).length,
      equippedCount: slots.filter((s) => s.state === "exact" || s.state === "value-diff")
        .length,
      equippedExactCount: slots.filter((s) => s.state === "exact").length,
      ownedScore: sum((s) => s.ownedScore),
      equippedScore: sum((s) => s.equippedScore),
    });
  }

  const shortages = Array.from(shortageMap.values()).sort(
    (a, b) =>
      b.need - a.need ||
      rarityRank(a.rarity) - rarityRank(b.rarity) ||
      a.effectName.localeCompare(b.effectName)
  );

  return {
    ideal,
    actual,
    cls: master.classes.find((c) => c.class_id === ideal.class_id),
    total,
    ownedScore: ownedScoreSum,
    equippedScore: equippedScoreSum,
    owned,
    ownedExact,
    equipped,
    equippedExact,
    swappable,
    skills: rows,
    shortages,
  };
}

/** 0除算を避けた百分率 (整数) */
export const pct = (n: number, total: number): number =>
  total === 0 ? 0 : Math.round((n / total) * 100);
