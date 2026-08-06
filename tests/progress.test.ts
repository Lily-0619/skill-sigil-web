// 達成度 (収集進捗) の集計テスト。
// 重点:
//  - 同じ効果を複数枠で使う理想編成で、所持数を消費しながら割り当てること
//    (手持ち1個で複数枠を満たしたことにしない)
//  - 等級は「理想と同じかそれ以上」で一致。下回るものは 等級不足 になること
//  - 達成率2本 (効果+等級 / 数値まで) が別々に出ること
//  - 「持っているのに着けていない」が swap になること
import { describe, expect, it } from "vitest";
import { master } from "../src/data/master";
import type { Build, InventoryItem, UserData } from "../src/types";
import { emptyUserData } from "../src/types";
import {
  buildProgressData,
  isTopValue,
  pct,
  rarityMeets,
  slotScore,
} from "../src/logic/progress";

const item = (p: Partial<InventoryItem>): InventoryItem => ({
  inventory_id: "inv1",
  sigil_type_id: "guardian",
  effect_id: "guardian_superarmor",
  rarity: "abyssal",
  value_text: "0.1秒",
  quantity: 1,
  note: "",
  created_at: "",
  updated_at: "",
  ...p,
});

const build = (p: Partial<Build>): Build => ({
  build_id: "free1",
  class_id: "WR",
  name: "理想",
  mode: "free",
  created_at: "",
  updated_at: "2026-01-01",
  ...p,
});

/** WRの守護枠 (WR_sp_1 枠2 / WR_sp_2 枠2) に同じ守護効果を理想として置く */
const idealData = (): UserData => {
  const d = emptyUserData();
  d.builds.push(build({}));
  for (const skillId of ["WR_sp_1", "WR_sp_2"]) {
    d.freeEquips.push({
      build_id: "free1",
      skill_id: skillId,
      slot_no: 2,
      effect_id: "guardian_superarmor",
      rarity: "abyssal",
      value_text: "0.1秒",
    });
  }
  return d;
};

const ideal = (d: UserData) => d.builds.find((b) => b.mode === "free")!;

describe("rarityMeets (等級は理想と同じかそれ以上でOK)", () => {
  it("同じ等級はOK", () => {
    expect(rarityMeets("abyssal", "abyssal")).toBe(true);
  });
  it("上位等級はOK (混沌 > 太古 > 深淵)", () => {
    expect(rarityMeets("chaos", "abyssal")).toBe(true);
    expect(rarityMeets("primal", "abyssal")).toBe(true);
  });
  it("下位等級はNG", () => {
    expect(rarityMeets("abyssal", "chaos")).toBe(false);
    expect(rarityMeets("primal", "chaos")).toBe(false);
  });
});

// guardian_superarmor の数値: 深淵[0.1秒,0.2秒] 太古[0.3秒,0.4秒] 混沌[0.5秒,0.6秒]
// 配列の最後が上位。
describe("点数式 (まな指定 2026-08-04)", () => {
  const EFF = "guardian_superarmor";

  it("数値の上位判定は配列の最後", () => {
    expect(isTopValue(master, EFF, "chaos", "0.6秒")).toBe(true);
    expect(isTopValue(master, EFF, "chaos", "0.5秒")).toBe(false);
  });

  it("混沌: 効果一致で数値上位=1.0 / 下位=0.95 / 効果不一致=0.8", () => {
    expect(slotScore(master, "chaos", true, EFF, "0.6秒")).toBe(1.0);
    expect(slotScore(master, "chaos", true, EFF, "0.5秒")).toBe(0.95);
    expect(slotScore(master, "chaos", false, EFF, "0.6秒")).toBe(0.8);
  });

  it("太古: 効果一致=0.7 (数値は問わない) / 効果不一致=0.6", () => {
    expect(slotScore(master, "primal", true, EFF, "0.4秒")).toBe(0.7);
    expect(slotScore(master, "primal", true, EFF, "0.3秒")).toBe(0.7);
    expect(slotScore(master, "primal", false, EFF, "0.3秒")).toBe(0.6);
  });

  it("深淵: 効果一致=0.4 / 効果不一致=0.3", () => {
    expect(slotScore(master, "abyssal", true, EFF, "0.2秒")).toBe(0.4);
    expect(slotScore(master, "abyssal", true, EFF, "0.1秒")).toBe(0.4);
    expect(slotScore(master, "abyssal", false, EFF, "0.1秒")).toBe(0.3);
  });
});

describe("buildProgressData — 点数の合計", () => {
  it("混沌上位を2枠ぶん持っていれば満点になる", () => {
    const d = idealData();
    for (const e of d.freeEquips) {
      e.rarity = "chaos";
      e.value_text = "0.6秒";
    }
    d.inventory.push(item({ quantity: 2, rarity: "chaos", value_text: "0.6秒" }));

    const p = buildProgressData(master, d, ideal(d), null);

    expect(p.total).toBe(2);
    expect(p.ownedScore).toBeCloseTo(2.0);
    expect(pct(p.ownedScore, p.total)).toBe(100);
  });

  it("違う効果でも同じ枠タイプなら点数が付く (混沌なら0.8)", () => {
    const d = idealData();
    for (const e of d.freeEquips) e.rarity = "chaos";
    // 理想とは違う守護効果を混沌で2個
    d.inventory.push(
      item({
        inventory_id: "other",
        effect_id: "guardian_frontguard",
        rarity: "chaos",
        value_text: "0.6秒",
        quantity: 2,
      })
    );

    const p = buildProgressData(master, d, ideal(d), null);

    expect(p.owned).toBe(0); // 理想の効果は持っていない
    expect(p.ownedScore).toBeCloseTo(1.6); // 0.8 × 2枠
  });

  it("同じ効果で等級違いを複数持つ場合、点数の高い方から使う", () => {
    const d = idealData();
    for (const e of d.freeEquips) {
      e.rarity = "chaos";
      e.value_text = "0.6秒";
    }
    d.inventory.push(item({ inventory_id: "c", rarity: "chaos", value_text: "0.6秒", quantity: 1 }));
    d.inventory.push(item({ inventory_id: "a", rarity: "abyssal", value_text: "0.1秒", quantity: 1 }));

    const p = buildProgressData(master, d, ideal(d), null);

    // 1枠目に混沌(1.0)、2枠目に深淵(0.4)
    expect(p.ownedScore).toBeCloseTo(1.4);
  });
});

describe("buildProgressData — 所持数の消費", () => {
  it("同じ効果を2枠で使う理想に対し、手持ち1個なら 1/2 にしかならない", () => {
    const d = idealData();
    d.inventory.push(item({ quantity: 1 }));

    const p = buildProgressData(master, d, ideal(d), null);

    expect(p.total).toBe(2);
    expect(p.owned).toBe(1); // 1個しか無いので1枠ぶんだけ
    expect(p.shortages).toHaveLength(1);
    expect(p.shortages[0]!.need).toBe(1);
  });

  it("手持ち2個なら 2/2 で不足なし", () => {
    const d = idealData();
    d.inventory.push(item({ quantity: 2 }));

    const p = buildProgressData(master, d, ideal(d), null);

    expect(p.owned).toBe(2);
    expect(p.ownedExact).toBe(2);
    expect(p.shortages).toHaveLength(0);
  });
});

describe("buildProgressData — 達成率2本 (効果+等級 / 数値まで)", () => {
  it("等級は足りるが数値が違うと、括弧なしだけ増えて括弧内は増えない", () => {
    const d = idealData();
    d.inventory.push(item({ quantity: 2, value_text: "0.2秒" })); // 数値違い

    const p = buildProgressData(master, d, ideal(d), null);

    expect(p.owned).toBe(2); // 効果+等級は一致
    expect(p.ownedExact).toBe(0); // 数値は理想と違う
  });

  it("上位等級で持っていれば一致扱いになる", () => {
    const d = idealData();
    d.inventory.push(item({ quantity: 2, rarity: "chaos" }));

    const p = buildProgressData(master, d, ideal(d), null);

    expect(p.owned).toBe(2);
  });
});

describe("buildProgressData — 枠の状態", () => {
  it("理想より低い等級でも同じ効果なら所持扱いで、点数は深淵の0.4になる", () => {
    const d = idealData();
    // 理想を混沌にし、手持ちは深淵のみ
    for (const e of d.freeEquips) e.rarity = "chaos";
    d.inventory.push(item({ quantity: 2, rarity: "abyssal" }));

    const p = buildProgressData(master, d, ideal(d), null);

    expect(p.owned).toBe(2); // 効果は持っている
    expect(p.ownedScore).toBeCloseTo(0.8); // 0.4 × 2枠
    // 着けていないので「入れ替えるだけ」
    expect(p.skills.flatMap((s) => s.slots).every((s) => s.state === "swap")).toBe(true);
  });

  it("そもそも持っていない枠は missing になる", () => {
    const d = idealData();

    const p = buildProgressData(master, d, ideal(d), null);

    expect(p.owned).toBe(0);
    expect(p.skills.flatMap((s) => s.slots).every((s) => s.state === "missing")).toBe(true);
  });

  it("持っているのにMy編成へ着けていない枠は swap になる", () => {
    const d = idealData();
    d.inventory.push(item({ quantity: 2 }));
    // 同じクラスのMy編成はあるが、何も装着していない
    d.builds.push(
      build({ build_id: "my1", mode: "my", name: "自分の編成" })
    );
    const my = d.builds.find((b) => b.build_id === "my1")!;

    const p = buildProgressData(master, d, ideal(d), my);

    expect(p.owned).toBe(2); // 持ってはいる
    expect(p.equipped).toBe(0); // 着けていない
    expect(p.swappable).toBe(2);
    expect(p.skills.flatMap((s) => s.slots).every((s) => s.state === "swap")).toBe(true);
  });

  it("理想どおり着けていれば exact / 装着ベースも満点になる", () => {
    const d = idealData();
    d.inventory.push(item({ quantity: 2 }));
    d.builds.push(build({ build_id: "my1", mode: "my", name: "自分の編成" }));
    const my = d.builds.find((b) => b.build_id === "my1")!;
    for (const skillId of ["WR_sp_1", "WR_sp_2"]) {
      d.equips.push({
        build_id: "my1",
        skill_id: skillId,
        slot_no: 2,
        inventory_id: "inv1",
      });
    }

    const p = buildProgressData(master, d, ideal(d), my);

    expect(p.equipped).toBe(2);
    expect(p.equippedExact).toBe(2);
    expect(p.swappable).toBe(0);
    expect(p.skills.flatMap((s) => s.slots).every((s) => s.state === "exact")).toBe(true);
  });

  it("理想と違う効果を着けていて、理想品も持っているなら swap になる", () => {
    const d = idealData();
    d.inventory.push(item({ quantity: 2 })); // 理想品
    d.inventory.push(
      item({
        inventory_id: "inv2",
        effect_id: "guardian_damage_reduction",
        quantity: 1,
      })
    );
    d.builds.push(build({ build_id: "my1", mode: "my", name: "自分の編成" }));
    const my = d.builds.find((b) => b.build_id === "my1")!;
    // 枠には別効果が入っている
    d.equips.push({
      build_id: "my1",
      skill_id: "WR_sp_1",
      slot_no: 2,
      inventory_id: "inv2",
    });

    const p = buildProgressData(master, d, ideal(d), my);

    expect(p.equipped).toBe(0);
    expect(p.swappable).toBe(2);
    const slot = p.skills.flatMap((s) => s.slots).find((s) => s.slotNo === 2)!;
    expect(slot.state).toBe("swap");
    expect(slot.actualEffectName).not.toBeNull();
  });
});

describe("buildProgressData — 理想が空の枠", () => {
  it("Free編成で埋めていない枠は分母に入らない", () => {
    const d = idealData();
    d.freeEquips.pop(); // 1枠だけにする

    const p = buildProgressData(master, d, ideal(d), null);

    expect(p.total).toBe(1);
  });
});

describe("pct", () => {
  it("0除算しない", () => {
    expect(pct(0, 0)).toBe(0);
    expect(pct(1, 2)).toBe(50);
  });
});
