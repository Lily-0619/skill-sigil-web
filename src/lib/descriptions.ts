// スキル・パッシブ説明データ (scripts/parse_descriptions.py が生成する descriptions.json)。
// HPに出すのは日本語(正)のみ。秘伝の種別タグは生成時に省いてあり、PvE/PvPはフラグ化済み。
import descriptionsJson from "../data/descriptions.json";
import type { ClassDescriptions, DescriptionsData, SkillDef, SkillDesc } from "../types";

const D = descriptionsJson as unknown as DescriptionsData;

/** クラスコード → 説明一式。未整備クラスは null */
export function classDescriptions(classCode: string): ClassDescriptions | null {
  return D.classes[classCode] ?? null;
}

/** スキル定義 → 説明 (通常=シート スキル(N) / 特別=ラバムスキル(N))。無ければ null */
export function skillDescOf(
  desc: ClassDescriptions | null,
  skill: SkillDef
): SkillDesc | null {
  if (!desc) return null;
  const key = `${skill.group === "special" ? "sp" : "n"}_${skill.display_no}`;
  return desc.skills[key] ?? null;
}
