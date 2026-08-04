// スキル・パッシブ説明データ (descriptions.json) の構造と表示ルールのテスト
// (2026-07-15 まな指示: 用語統一 / 秘伝の種別タグ省略 / 武器分岐 / スキル(０)対象外)
import { describe, expect, it } from "vitest";
import descriptionsJson from "../src/data/descriptions.json";
import { master } from "../src/data/master";
import type { DescriptionsData } from "../src/types";

const D = descriptionsJson as unknown as DescriptionsData;

/** 説明本文のみ (名称は含まない)。用語統一の検査対象はこちら */
const allLines = (): string[] => {
  const out: string[] = [];
  for (const c of Object.values(D.classes)) {
    for (const p of c.passives) out.push(...p.lines);
    if (c.rage) {
      out.push(...c.rage.common);
      for (const w of c.rage.weapon) out.push(...w);
    }
    for (const s of Object.values(c.skills)) out.push(...s.lines);
  }
  return out;
};

/** パッシブ・スキル・闇精霊の怒りの名称 */
const allNames = (): string[] => {
  const out: string[] = [];
  for (const c of Object.values(D.classes)) {
    for (const p of c.passives) out.push(p.name);
    if (c.rage) out.push(c.rage.name);
    for (const s of Object.values(c.skills)) out.push(s.name);
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

  it("用語統一: スタン→気絶 / 黒精霊→闇精霊 が本文に適用済み", () => {
    for (const line of allLines()) {
      expect(line).not.toContain("スタン");
      expect(line).not.toContain("黒精霊");
    }
  });

  // 名称は固有名詞なので用語置換の対象外。
  // (旧パイプラインは一括置換で「タイドスタンプ」を「タイド気絶プ」に壊していた)
  it("名称は用語置換で壊されていない", () => {
    for (const name of allNames()) {
      expect(name).not.toContain("黒精霊");
      expect(name).not.toContain("気絶プ");
    }
    expect(D.classes["CO"].skills["sp_1"].name).toBe("タイドスタンプ");
  });

  it("秘伝の種別タグ行(｜系列 …)は本文から省かれている", () => {
    for (const line of allLines()) {
      expect(line).not.toContain("｜");
      // 種別単語だけで構成される行が残っていないこと
      expect(line).not.toMatch(/^\s*系列[\s　]/);
    }
  });

  // ---- v2: STACK / CT / HIT の構造化と profile (2026-08-03) ----

  it("全クラスにプロフィール(名前)がある", () => {
    for (const [code, c] of Object.entries(D.classes)) {
      expect(c.profile, code).toBeDefined();
      expect(c.profile.name, code).not.toBe("");
    }
  });

  it("STACK / CT / HIT の型が正しい", () => {
    for (const [code, c] of Object.entries(D.classes)) {
      for (const [key, s] of Object.entries(c.skills)) {
        const where = `${code}/${key}`;
        if (s.stack !== null) expect(typeof s.stack, where).toBe("number");
        if (s.hit !== null) expect(typeof s.hit, where).toBe("number");
        if (s.ct !== null) expect(typeof s.ct, where).toBe("string");
      }
    }
  });

  it("STACK / CT / HIT が実データとして入っている (抽出の回帰防止)", () => {
    const dk1 = D.classes["DK"].skills["n_1"];
    expect(dk1.stack).toBe(2);
    expect(dk1.ct).toBe("4");
    expect(dk1.hit).toBe(2);
    // 全体でも十分な件数が抽出できていること
    const withStack = Object.values(D.classes)
      .flatMap((c) => Object.values(c.skills))
      .filter((s) => s.stack !== null);
    expect(withStack.length).toBeGreaterThan(400);
  });

  it("STACK / CT の行は説明本文から取り除かれている", () => {
    for (const [code, c] of Object.entries(D.classes)) {
      for (const [key, s] of Object.entries(c.skills)) {
        for (const line of s.lines) {
          const t = line.replace(/^[・　\s]+/, "");
          expect(t, `${code}/${key}`).not.toMatch(/^最大使用(回数|数)\s*[:：]/);
          expect(t, `${code}/${key}`).not.toMatch(/^再使用待機時間\s*[:：]/);
        }
      }
    }
  });

  it("ラバムスキル(sp_1〜4)は全てラバム扱いになっている", () => {
    for (const [code, c] of Object.entries(D.classes)) {
      for (const [key, s] of Object.entries(c.skills)) {
        if (key.startsWith("sp_")) expect(s.rabam, `${code}/${key}`).toBe(true);
        else expect(s.rabam, `${code}/${key}`).toBe(false);
      }
    }
  });
});
