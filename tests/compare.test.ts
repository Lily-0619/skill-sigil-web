// 編成比較の集計テスト (docs/17_編成比較機能_設計方針.md)
// 重点: 数値は合算せず「値 ×N個」で個数集約されること。My/Free 両方で正しく集計されること。
import { describe, expect, it } from "vitest";
import masterJson from "../src/data/master.json";
import type { InventoryItem, Master, UserData } from "../src/types";
import { emptyUserData } from "../src/types";
import { buildCompareData, collapseValues } from "../src/logic/compare";

const master = masterJson as unknown as Master;

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

/** WRのMy編成1つを持つ空データ */
const myData = (): UserData => {
  const d = emptyUserData();
  d.builds.push({
    build_id: "b1",
    class_id: "WR",
    name: "編成 1",
    mode: "my",
    created_at: "",
    updated_at: "2026-01-01",
  });
  return d;
};

describe("collapseValues (合算しない)", () => {
  it("重複は ×N個 に集約し、足し算しない", () => {
    expect(collapseValues(["10%", "10%"])).toBe("10% ×2個");
    expect(collapseValues(["10%", "20%"])).toBe("10% / 20%");
    expect(collapseValues([])).toBe("");
  });
});

describe("buildCompareData — My編成", () => {
  it("同一効果+等級+数値の2本は合算されず count=2 / 値 ×2個 になる", () => {
    const d = myData();
    d.inventory.push(item({ quantity: 2 }));
    // 守護枠 (WR_sp_1 枠2 / WR_sp_2 枠2) に同じ守護秘伝を2本
    d.equips.push({ build_id: "b1", skill_id: "WR_sp_1", slot_no: 2, inventory_id: "inv1" });
    d.equips.push({ build_id: "b1", skill_id: "WR_sp_2", slot_no: 2, inventory_id: "inv1" });

    const c = buildCompareData(master, d, d.builds[0]);

    // 枠数カウント (合算ではなく枠の数)
    expect(c.used).toBe(2);
    expect(c.total).toBe(64); // 16対象スキル × 4枠

    // 案B: 守護タイプ → guardian_superarmor が count=2、値は ×2個
    const guardian = c.summary.find((g) => g.type.id === "guardian");
    expect(guardian).toBeTruthy();
    expect(guardian!.count).toBe(2);
    const eff = guardian!.effects.find((e) => e.effectId === "guardian_superarmor")!;
    expect(eff.count).toBe(2);
    expect(eff.rarities[0].rarity.id).toBe("abyssal");
    expect(eff.rarities[0].count).toBe(2);
    expect(eff.rarities[0].valuesText).toBe("0.1秒 ×2個"); // 合算(0.2秒)ではない

    // 案C: タイプ別・等級別の本数
    expect(c.typeCounts.find((b) => b.id === "guardian")!.count).toBe(2);
    expect(c.rarityCounts.find((b) => b.id === "abyssal")!.count).toBe(2);
  });

  it("案A: スキルの枠に装着効果が入り、空き枠は null", () => {
    const d = myData();
    d.inventory.push(item({ quantity: 1 }));
    d.equips.push({ build_id: "b1", skill_id: "WR_sp_1", slot_no: 2, inventory_id: "inv1" });

    const c = buildCompareData(master, d, d.builds[0]);
    const sp1 = c.skills.find((s) => s.skillId === "WR_sp_1")!;
    expect(sp1.eligible).toBe(true);
    expect(sp1.slots).toHaveLength(4);
    expect(sp1.slots[1].effectId).toBe("guardian_superarmor"); // 枠2=守護
    expect(sp1.slots[0].effectId).toBeNull(); // 枠1=系列は未装着
    expect(sp1.filled).toBe(1);
  });
});

describe("buildCompareData — Free編成", () => {
  it("freeEquips から直接集計し、同一2本は合算されない", () => {
    const d = emptyUserData();
    d.builds.push({
      build_id: "f1",
      class_id: "WR",
      name: "Free編成 1",
      mode: "free",
      created_at: "",
      updated_at: "2026-01-02",
    });
    d.freeEquips.push({
      build_id: "f1", skill_id: "WR_sp_1", slot_no: 2,
      effect_id: "guardian_superarmor", rarity: "primal", value_text: "0.2秒",
    });
    d.freeEquips.push({
      build_id: "f1", skill_id: "WR_sp_2", slot_no: 2,
      effect_id: "guardian_superarmor", rarity: "primal", value_text: "0.2秒",
    });

    const c = buildCompareData(master, d, d.builds[0]);
    expect(c.mode).toBe("free");
    expect(c.used).toBe(2);
    const eff = c.summary
      .find((g) => g.type.id === "guardian")!
      .effects.find((e) => e.effectId === "guardian_superarmor")!;
    expect(eff.count).toBe(2);
    expect(eff.rarities[0].rarity.id).toBe("primal");
    expect(eff.rarities[0].valuesText).toBe("0.2秒 ×2個");
    expect(c.rarityCounts.find((b) => b.id === "primal")!.count).toBe(2);
  });
});
