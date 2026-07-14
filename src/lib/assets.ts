// 画像パス解決。マニフェスト(自動生成)を参照し、欠落時はフォールバック。
import manifest from "../data/imageManifest.json";
import type { ImageManifest, SkillDef } from "../types";

const M = manifest as unknown as ImageManifest;

/** 相対パス→URL。日本語パスをエンコードする(file://・dev両対応) */
export const assetUrl = (relPath: string): string => encodeURI(relPath);

export function classButtonUrl(code: string): string | null {
  const p = M.classButtons[code];
  return p ? assetUrl(p) : null;
}

/** スキル画像: 番号+特別フラグで照合し、なければ名前で照合 */
export function skillIconUrl(classCode: string, skill: SkillDef): string | null {
  return skillIconUrls(classCode, skill)[0] ?? null;
}

/**
 * スキル画像(複数枚対応): 番号+特別フラグで照合し、なければ名前で照合。
 * 同一no+specialの画像が2枚ある場合(名前末尾の1/2で前面・背面を表す命名規則)は、
 * 前面(1)→背面(2)の順で配列を返す。BuildEdit側で重ね表示に使う。
 */
export function skillIconUrls(classCode: string, skill: SkillDef): string[] {
  const entries = M.skills[classCode];
  if (!entries || entries.length === 0) return [];
  const special = skill.group === "special";
  let matches = entries.filter(
    (e) => e.no === skill.display_no && e.special === special
  );
  if (matches.length === 0) {
    const norm = (s: string) => s.replace(/[_\s　]/g, "");
    const hit = entries.find((e) => norm(e.name) === norm(skill.name_ja));
    return hit ? [assetUrl(hit.path)] : [];
  }
  if (matches.length > 1) {
    const order = (name: string) => {
      const m = name.match(/([12])$/);
      return m ? parseInt(m[1], 10) : 0;
    };
    matches = [...matches].sort((a, b) => order(a.name) - order(b.name));
  }
  return matches.map((e) => assetUrl(e.path));
}

export function sigilIconUrl(key: string): string | null {
  const p = M.sigilIcons[key];
  return p ? assetUrl(p) : null;
}

/** 効果IDに対応するアイコン(系列は効果別、それ以外はタイプ共通) */
export function effectIconUrl(sigilTypeId: string, effectId: string): string | null {
  return sigilIconUrl(effectId) ?? sigilIconUrl(sigilTypeId);
}

/**
 * キャラクター背景をランダム選択 (docs/03 §10)。
 * classCode指定時はそのクラスの画像のみ。直前と同じ画像は候補2枚以上なら避ける。
 */
export function pickCharacterImage(
  classCode: string | null,
  last: string | null
): string | null {
  let pool = classCode
    ? M.characters.filter((c) => c.code === classCode)
    : M.characters;
  if (pool.length === 0) pool = M.characters;
  if (pool.length === 0) return null;
  let candidates = pool;
  if (last && pool.length >= 2) {
    candidates = pool.filter((c) => c.path !== last);
    if (candidates.length === 0) candidates = pool;
  }
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return pick.path;
}

/** ヒーロー用メディア候補 (動画→静止画→キャラ画像の順に試す) */
export function heroMediaCandidates(side: "left" | "right"): {
  videos: string[];
  images: string[];
} {
  return {
    videos: [`画像/hero/${side}.mp4`, `画像/hero/${side}.webm`].map(assetUrl),
    images: [`画像/hero/${side}.png`, `画像/hero/${side}.jpg`].map(assetUrl),
  };
}

export const manifestData = M;
