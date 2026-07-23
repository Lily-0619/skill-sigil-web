// 組み立て済みマスタの単一集約点。
// master.json (クラス・スキル・固定枠) と src/game-rules の秘伝正本
// (種類・等級・効果) を合成して、アプリ全体が使う `master` を作る。
// React/DBに依存しないので、アプリ(store)からもテストからも安全に読める。
import type { Master } from "../types";
import masterJson from "./master.json";
import { effects, rarities, sigilTypes } from "../game-rules/skill-sigil-rules";

export const master: Master = {
  ...(masterJson as unknown as Master),
  sigil_types: sigilTypes,
  rarities,
  effects,
};
