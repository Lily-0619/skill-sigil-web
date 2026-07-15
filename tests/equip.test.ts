// 装着ルールのテスト (docs/07_テスト・受け入れ基準.md 相当の中核ルール)
import { describe, expect, it } from "vitest";
import masterJson from "../src/data/master.json";
import type { InventoryItem, Master, UserData } from "../src/types";
import { emptyUserData } from "../src/types";
import {
  canEquip,
  canEquipFree,
  defaultValueText,
  maxUsedPerBuild,
  rarityAvailable,
  remaining,
  skillsOf,
} from "../src/logic/equip";

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

const baseData = (): UserData => {
  const d = emptyUserData();
  d.builds.push({
    build_id: "b1",
    class_id: "WR",
    name: "編成 1",
    mode: "my",
    created_at: "",
    updated_at: "",
  });
  return d;
};

describe("マスタ構造", () => {
  it("30クラス・各17スキル・装着可能16スキル", () => {
    expect(master.classes.filter((c) => c.enabled).length).toBe(30);
    for (const c of master.classes) {
      const sk = skillsOf(master, c.class_id);
      expect(sk.length).toBe(17);
      expect(sk.filter((s) => s.group === "special").length).toBe(4);
      expect(sk.filter((s) => s.group === "normal").length).toBe(13);
      const n13 = sk.find((s) => s.group === "normal" && s.display_no === 13)!;
      expect(n13.sigil_eligible).toBe(false);
      expect(sk.filter((s) => s.sigil_eligible).length).toBe(16);
      for (const s of sk) {
        if (s.sigil_eligible) expect(s.slots?.length).toBe(4);
      }
    }
  });
});

describe("装着判定 (REQ-RULE-002/003)", () => {
  const wr = skillsOf(master, "WR");
  const sp1 = wr.find((s) => s.skill_id === "WR_sp_1")!; // 系列/守護/無欠/鮮明
  const n13 = wr.find((s) => s.skill_id === "WR_n_13")!;

  it("タイプ一致で装着できる", () => {
    const d = baseData();
    d.inventory.push(item({}));
    const r = canEquip(master, d, "WR", "b1", sp1.skill_id, 2, d.inventory[0]);
    expect(r.ok).toBe(true);
  });

  it("タイプ不一致は装着できない", () => {
    const d = baseData();
    d.inventory.push(item({}));
    const r = canEquip(master, d, "WR", "b1", sp1.skill_id, 1, d.inventory[0]); // 枠1=系列
    expect(r.ok).toBe(false);
  });

  it("下段13番は装着対象外", () => {
    const d = baseData();
    d.inventory.push(item({}));
    const r = canEquip(master, d, "WR", "b1", n13.skill_id, 1, d.inventory[0]);
    expect(r.ok).toBe(false);
  });

  it("所持1個を同一編成の2スキルへ重複装着できない(移動提案になる)", () => {
    const d = baseData();
    const inv = item({ quantity: 1 });
    d.inventory.push(inv);
    d.equips.push({ build_id: "b1", skill_id: "WR_sp_1", slot_no: 2, inventory_id: "inv1" });
    // WR_sp_2 の守護枠 (枠2=守護)
    const r = canEquip(master, d, "WR", "b1", "WR_sp_2", 2, inv);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.needsMoveFrom).toBeTruthy();
  });

  it("2個所持なら2スキルへ1個ずつ装着できる", () => {
    const d = baseData();
    const inv = item({ quantity: 2 });
    d.inventory.push(inv);
    d.equips.push({ build_id: "b1", skill_id: "WR_sp_1", slot_no: 2, inventory_id: "inv1" });
    const r = canEquip(master, d, "WR", "b1", "WR_sp_2", 2, inv);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.needsMoveFrom).toBeUndefined();
  });

  it("残数 = 所持数 - 同一編成内使用数", () => {
    const d = baseData();
    const inv = item({ quantity: 3 });
    d.inventory.push(inv);
    d.equips.push({ build_id: "b1", skill_id: "WR_sp_1", slot_no: 2, inventory_id: "inv1" });
    d.equips.push({ build_id: "b1", skill_id: "WR_sp_2", slot_no: 2, inventory_id: "inv1" });
    // 別編成の使用は数えない
    d.equips.push({ build_id: "b2", skill_id: "WR_sp_1", slot_no: 2, inventory_id: "inv1" });
    expect(remaining(inv, d.equips, "b1")).toBe(1);
    expect(maxUsedPerBuild(d.equips, "inv1").max).toBe(2);
  });
});

describe("効果マスタ既定値 (11_効果マスタ数値.md)", () => {
  it("等級で既定値が入る", () => {
    expect(defaultValueText(master, "flawless_finaldmgdown", "abyssal")).toBe("10%");
    expect(defaultValueText(master, "refined_atkup", "primal", "b")).toBe("20");
    expect(defaultValueText(master, "radiant_cooltime", "chaos")).toBe("0.2秒");
  });
  it("無欠2値効果はカンマ結合", () => {
    expect(defaultValueText(master, "flawless_debuff", "abyssal")).toBe("20 , 3%");
  });
  it("存在しない等級は選択不可 (煌めく=混沌のみ / 系列=深淵のみ)", () => {
    expect(rarityAvailable(master, "radiant_maxcount", "abyssal")).toBe(false);
    expect(rarityAvailable(master, "radiant_maxcount", "chaos")).toBe(true);
    expect(rarityAvailable(master, "branch_arl", "abyssal")).toBe(true);
    expect(rarityAvailable(master, "branch_arl", "primal")).toBe(false);
    expect(rarityAvailable(master, "guardian_dmgreduce", "abyssal")).toBe(false);
  });
});

describe("Free装着判定 (v0.2 #3)", () => {
  it("タイプ一致なら所持0件でも装着できる (所持数・残数の制限なし)", () => {
    const r = canEquipFree(master, baseData(), "WR", "b1", "WR_sp_1", 2, "guardian_superarmor");
    expect(r.ok).toBe(true);
  });
  it("枠タイプ不一致は装着できない", () => {
    const r = canEquipFree(master, baseData(), "WR", "b1", "WR_sp_1", 1, "guardian_superarmor");
    expect(r.ok).toBe(false);
  });
  it("装着対象外スキル(下段13)は装着できない", () => {
    const r = canEquipFree(master, baseData(), "WR", "b1", "WR_n_13", 1, "guardian_superarmor");
    expect(r.ok).toBe(false);
  });
  it("存在しない効果は装着できない", () => {
    const r = canEquipFree(master, baseData(), "WR", "b1", "WR_sp_1", 2, "no_such_effect");
    expect(r.ok).toBe(false);
  });
});

describe("系列4つ制限 (branch同一系列は1編成4つまで)", () => {
  // WRの系列(branch)枠を持つスキルを列挙 (枠1が系列)
  const branchSlots = skillsOf(master, "WR")
    .filter((s) => s.sigil_eligible && s.slots)
    .flatMap((s) =>
      (s.slots ?? [])
        .map((t, i) => ({ skillId: s.skill_id, slotNo: i + 1, type: t }))
        .filter((x) => x.type === "branch")
    );

  it("同一系列(アール)はFreeで5つ目を装着できない", () => {
    const d = baseData();
    // 先に4つ同一系列を装着
    for (let i = 0; i < 4; i++) {
      const s = branchSlots[i];
      d.freeEquips.push({
        build_id: "b1",
        skill_id: s.skillId,
        slot_no: s.slotNo,
        effect_id: "branch_arl",
        rarity: "abyssal",
        value_text: "10%",
      });
    }
    const fifth = branchSlots[4];
    const r = canEquipFree(master, d, "WR", "b1", fifth.skillId, fifth.slotNo, "branch_arl");
    expect(r.ok).toBe(false);
  });

  it("4つ埋まっていても別の系列(セルト)は装着できる", () => {
    const d = baseData();
    for (let i = 0; i < 4; i++) {
      const s = branchSlots[i];
      d.freeEquips.push({
        build_id: "b1",
        skill_id: s.skillId,
        slot_no: s.slotNo,
        effect_id: "branch_arl",
        rarity: "abyssal",
        value_text: "10%",
      });
    }
    const fifth = branchSlots[4];
    const r = canEquipFree(master, d, "WR", "b1", fifth.skillId, fifth.slotNo, "branch_celt");
    expect(r.ok).toBe(true);
  });

  it("Myモードでも同一系列は4つまで (5つ目は不可)", () => {
    const d = baseData();
    const inv = item({
      inventory_id: "arl",
      sigil_type_id: "branch",
      effect_id: "branch_arl",
      rarity: "abyssal",
      value_text: "10%",
      quantity: 10,
    });
    d.inventory.push(inv);
    for (let i = 0; i < 4; i++) {
      const s = branchSlots[i];
      d.equips.push({
        build_id: "b1",
        skill_id: s.skillId,
        slot_no: s.slotNo,
        inventory_id: "arl",
      });
    }
    const fifth = branchSlots[4];
    const r = canEquip(master, d, "WR", "b1", fifth.skillId, fifth.slotNo, inv);
    expect(r.ok).toBe(false);
  });
});
