// スキル・パッシブ説明データ (descriptions.json) の構造と表示ルールのテスト
// (2026-07-15 まな指示: 用語統一 / 秘伝の種別タグ省略 / 武器分岐 / スキル(０)対象外)
import { describe, expect, it } from "vitest";
import descriptionsJson from "../src/data/descriptions.json";
import { master } from "../src/data/master";
import type { DescriptionsData } from "../src/types";

const D = descriptionsJson as unknown as DescriptionsData;

const allLines = (): string[] => {
  const out: string[] = [];
  for (const c of Object.values(D.classes)) {
    for (const p of c.passives) out.push(p.name, ...p.lines);
    if (c.rage) {
      out.push(c.rage.name, ...c.rage.common);
      for (const w of c.rage.weapon) out.push(...w);
    }
    for (const s of Object.values(c.skills)) out.push(s.name, ...s.lines);
  }
  return out;
};

describe("descriptions.json", () => {
  it("マスタの全30クラス分の説明がある", () => {
    for (const cls of master.classes) {
      expect(D.classes[cls.code], cls.code).toBeDefined();
    }
    expect(Object.keys(D.classes)).toHaveLength(30);
  });

  it("各クラスにパッシブ2種(武器名つき)と闇精霊の怒りがある", () => {
    for (const [code, c] of Object.entries(D.classes)) {
      expect(c.passives, code).toHaveLength(2);
      for (const p of c.passives) {
        expect(p.name, code).not.toBe("");
        expect(p.lines.length, code).toBeGreaterThan(0);
      }
      expect(c.rage, code).not.toBeNull();
      // 武器分岐は「なし(0)」か「武器種1/2の2区間」のみ
      expect([0, 2], code).toContain(c.rage!.weapon.length);
      expect(c.rage!.name, code).toContain("闇精霊");
    }
  });

  it("スキルはスキル(1〜13)とラバムスキル(1〜4)のみ (スキル(０)は対象外)", () => {
    for (const [code, c] of Object.entries(D.classes)) {
      for (const key of Object.keys(c.skills)) {
        expect(key, code).toMatch(/^(n_([1-9]|1[0-3])|sp_[1-4])$/);
      }
      expect(c.skills["n_1"], code).toBeDefined();
      expect(c.skills["sp_1"], code).toBeDefined();
    }
  });

  it("用語統一: スタン→気絶 / 黒精霊→闇精霊 が全文に適用済み", () => {
    for (const line of allLines()) {
      expect(line).not.toContain("スタン");
      expect(line).not.toContain("黒精霊");
    }
  });

  it("秘伝の種別タグ行(｜系列 …)は本文から省かれている", () => {
    for (const line of allLines()) {
      expect(line).not.toContain("｜");
      // 種別単語だけで構成される行が残っていないこと
      expect(line).not.toMatch(/^\s*系列[\s　]/);
    }
  });
});
