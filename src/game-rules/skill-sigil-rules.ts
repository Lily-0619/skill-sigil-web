// ============================================================================
// スキル秘伝ルール (Skill Sigil Rules) — ゲーム上のルールの単一正本
// ----------------------------------------------------------------------------
// スキル秘伝の「種類・効果・装着ルール」をここ (src/game-rules/) に集約する。
// ゲーム側のルール変更があったら、まずこのフォルダだけを編集すればよい:
//   - 種類 / 等級 / 効果・数値 … skill-sigil.json  (手編集の正本)
//   - 装着ルール・表示細則      … このファイルの定数・関数
// docs/ は記録用であり、システムはここを参照する (docs は正本ではない)。
// アプリは src/data/master.ts でこの正本と master.json を組み立てて使う。
// ============================================================================
import type { EffectDef, Rarity, RarityDef, SigilTypeDef } from "../types";
import sigil from "./skill-sigil.json";

// ---- 種類 / 等級 / 効果 (skill-sigil.json 由来) --------------------------------

/** 秘伝タイプ (系列/守護/無欠/鮮明/整った/微か/煌めく) */
export const sigilTypes = sigil.sigil_types as SigilTypeDef[];
/** 等級 (深淵/太古/混沌) */
export const rarities = sigil.rarities as RarityDef[];
/** 効果マスタ (等級別既定値つき) */
export const effects = sigil.effects as EffectDef[];

// ---- 装着ルール ---------------------------------------------------------------

/** 系列(branch)タイプのID */
export const BRANCH_TYPE_ID = "branch";
/** 同一系列は1編成に4つまで */
export const SAME_SERIES_MAX = 4;
/** 各スキルの固定秘伝枠数 */
export const SLOT_COUNT = 4;
/** 等級の良い順 (混沌 > 太古 > 深淵)。既定等級・並び順に使う。 */
export const RARITY_ORDER: Rarity[] = ["chaos", "primal", "abyssal"];

// ---- 表示細則 -----------------------------------------------------------------

/**
 * 秘伝の数値は合算しない。同じ数値が重複する場合は「値 ×N個」にまとめ、
 * 出現順を保って " / " 区切りで返す。重複が無ければ数値をそのまま並べる。
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
