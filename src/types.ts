// ---- マスタデータ (docs/04_データ設計書.md 準拠) ----------------------------

export type Rarity = "abyssal" | "primal" | "chaos";
export type SkillGroup = "special" | "normal";

export interface SigilTypeDef {
  id: string;
  name: string;
  alias: string;
  color: string;
}

export interface RarityDef {
  id: Rarity;
  name: string;
  color: string;
}

export interface EffectDef {
  effect_id: string;
  sigil_type_id: string;
  name_ja: string;
  /** 等級別既定値。[a] 単値 / [a,b] 2値(AかB)。無欠two_effectsは[効果1,効果2] */
  values: Partial<Record<Rarity, string[]>>;
  two_effects?: boolean;
  valueless?: boolean;
  sort_order: number;
  enabled: boolean;
}

export interface ClassDef {
  class_id: string;
  code: string;
  name_ja: string;
  sort_order: number;
  enabled: boolean;
}

export interface SkillDef {
  skill_id: string;
  group: SkillGroup;
  display_no: number;
  name_ja: string;
  sigil_eligible: boolean;
  /** 固定4枠の秘伝タイプID。装着不可スキルは null */
  slots: string[] | null;
}

export interface Master {
  schema_version: number;
  master_version: string;
  sigil_types: SigilTypeDef[];
  rarities: RarityDef[];
  effects: EffectDef[];
  classes: ClassDef[];
  skills: Record<string, SkillDef[]>;
}

// ---- 画像マニフェスト ---------------------------------------------------------

export interface SkillImageEntry {
  no: number | null;
  name: string;
  special: boolean;
  path: string;
}

export interface CharacterImageEntry {
  code: string | null;
  path: string;
}

export interface ImageManifest {
  generated_at: string;
  classButtons: Record<string, string>;
  skills: Record<string, SkillImageEntry[]>;
  characters: CharacterImageEntry[];
  sigilIcons: Record<string, string>;
}

// ---- ユーザーデータ ------------------------------------------------------------

export interface InventoryItem {
  inventory_id: string;
  sigil_type_id: string;
  effect_id: string;
  rarity: Rarity;
  value_text: string;
  quantity: number;
  note: string;
  created_at: string;
  updated_at: string;
}

/** v0.2 #3: 編成モード。my=所持秘伝で組む / free=所持と無関係に理想編成を組む */
export type BuildMode = "my" | "free";

export interface Build {
  build_id: string;
  class_id: string;
  name: string;
  /** v0.2 #3 (既存データは読込時に "my" を補完) */
  mode: BuildMode;
  created_at: string;
  updated_at: string;
}

export interface EquippedSigil {
  build_id: string;
  skill_id: string;
  slot_no: number; // 1-4
  inventory_id: string;
}

/** v0.2 #3: Free編成の装着。所持品(inventory_id)ではなく効果を直接参照する */
export interface FreeEquip {
  build_id: string;
  skill_id: string;
  slot_no: number; // 1-4
  effect_id: string;
  rarity: Rarity;
  value_text: string;
}

export interface AppMeta {
  schema_version: number;
  master_version: string;
  selected_class_id: string | null;
  selected_build_id: string | null;
  last_export_at: string | null;
  last_backup_at: string | null;
  last_character_image: string | null;
}

export interface UserData {
  inventory: InventoryItem[];
  builds: Build[];
  equips: EquippedSigil[];
  /** v0.2 #3 */
  freeEquips: FreeEquip[];
  meta: AppMeta;
}

export const emptyUserData = (): UserData => ({
  inventory: [],
  builds: [],
  equips: [],
  freeEquips: [],
  meta: {
    schema_version: 1,
    master_version: "",
    selected_class_id: null,
    selected_build_id: null,
    last_export_at: null,
    last_backup_at: null,
    last_character_image: null,
  },
});
