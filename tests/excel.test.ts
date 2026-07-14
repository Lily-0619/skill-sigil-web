// Excel入出力の往復テスト (docs/05_Excel入出力仕様書.md)
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import masterJson from "../src/data/master.json";
import type { Master, UserData } from "../src/types";
import { emptyUserData } from "../src/types";
import {
  applyImport,
  buildWorkbook,
  exportIntegrityErrors,
  parseWorkbook,
} from "../src/logic/excel";

const master = masterJson as unknown as Master;

const sample = (): UserData => {
  const d = emptyUserData();
  d.inventory.push({
    inventory_id: "inv_a",
    sigil_type_id: "guardian",
    effect_id: "guardian_superarmor",
    rarity: "abyssal",
    value_text: "0.2秒",
    quantity: 2,
    note: "テスト",
    created_at: "2026-07-13T00:00:00.000Z",
    updated_at: "2026-07-13T00:00:00.000Z",
  });
  d.inventory.push({
    inventory_id: "inv_b",
    sigil_type_id: "branch",
    effect_id: "branch_arl",
    rarity: "abyssal",
    value_text: "10%",
    quantity: 1,
    note: "",
    created_at: "2026-07-13T00:00:00.000Z",
    updated_at: "2026-07-13T00:00:00.000Z",
  });
  d.builds.push({
    build_id: "b1",
    class_id: "WR",
    name: "狩り用",
    mode: "my",
    created_at: "2026-07-13T00:00:00.000Z",
    updated_at: "2026-07-13T00:00:00.000Z",
  });
  d.equips.push({ build_id: "b1", skill_id: "WR_sp_1", slot_no: 1, inventory_id: "inv_b" });
  d.equips.push({ build_id: "b1", skill_id: "WR_sp_1", slot_no: 2, inventory_id: "inv_a" });
  d.equips.push({ build_id: "b1", skill_id: "WR_sp_2", slot_no: 2, inventory_id: "inv_a" });
  return d;
};

/** v0.2 #3: Free編成入りサンプル */
const sampleWithFree = (): UserData => {
  const d = sample();
  d.builds.push({
    build_id: "fb1",
    class_id: "WR",
    name: "理想形",
    mode: "free",
    created_at: "2026-07-13T00:00:00.000Z",
    updated_at: "2026-07-13T00:00:00.000Z",
  });
  d.freeEquips.push({
    build_id: "fb1",
    skill_id: "WR_sp_1",
    slot_no: 2,
    effect_id: "guardian_superarmor",
    rarity: "abyssal",
    value_text: "0.1秒",
  });
  return d;
};

const roundtrip = (d: UserData) => {
  const wb = buildWorkbook(master, d);
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return parseWorkbook(master, XLSX.read(buf, { type: "array" }));
};

describe("Excel往復", () => {
  it("書き出し→読み込みで内容が一致する", () => {
    const d = sample();
    expect(exportIntegrityErrors(d)).toEqual([]);
    const r = roundtrip(d);
    expect(r.issues.errors).toEqual([]);
    expect(r.parsed).toBeTruthy();
    expect(r.parsed!.inventory.length).toBe(2);
    expect(r.parsed!.builds.length).toBe(1);
    expect(r.parsed!.equips.length).toBe(3);
    const invA = r.parsed!.inventory.find((i) => i.inventory_id === "inv_a")!;
    expect(invA.rarity).toBe("abyssal");
    expect(invA.quantity).toBe(2);
    expect(invA.value_text).toBe("0.2秒");
  });

  it("装着数超過は書き出し前エラー", () => {
    const d = sample();
    d.inventory[0].quantity = 1; // 2箇所で使用中なのに所持1
    expect(exportIntegrityErrors(d).length).toBeGreaterThan(0);
  });

  it("置換で復元できる", () => {
    const d = sample();
    const r = roundtrip(d);
    const restored = applyImport(emptyUserData(), r.parsed!, "replace");
    expect(restored.inventory.length).toBe(2);
    expect(restored.equips.length).toBe(3);
  });

  it("追加統合でID衝突は別IDになる", () => {
    const d = sample();
    const r = roundtrip(d);
    // 同じIDで内容が異なる状態を作る
    const current = sample();
    current.inventory[0].quantity = 5;
    const merged = applyImport(current, r.parsed!, "merge");
    // inv_a は内容差で別行追加、inv_b は同一内容でスキップ
    expect(merged.inventory.length).toBe(3);
    const ids = merged.inventory.map((i) => i.inventory_id);
    expect(new Set(ids).size).toBe(3);
  });

  it("壊れた等級はエラー", () => {
    const d = sample();
    const wb = buildWorkbook(master, d);
    const sheet = wb.Sheets["所持秘伝"];
    // 等級列(F)の1行目データを不正値へ
    sheet["F2"] = { t: "s", v: "伝説" };
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const r = parseWorkbook(master, XLSX.read(buf, { type: "array" }));
    expect(r.issues.errors.length).toBeGreaterThan(0);
    expect(r.parsed).toBeNull();
  });
});

describe("Excel v2 (v0.2 #3 Free対応)", () => {
  it("My/Free混在の書き出し→読み込みで正しく往復する", () => {
    const d = sampleWithFree();
    const r = roundtrip(d);
    expect(r.issues.errors).toEqual([]);
    expect(r.parsed).toBeTruthy();
    // 既存シートはMy専用のまま / FreeはFreeシートへ分離
    expect(r.parsed!.builds.filter((b) => b.mode === "my").length).toBe(1);
    expect(r.parsed!.builds.filter((b) => b.mode === "free").length).toBe(1);
    expect(r.parsed!.equips.length).toBe(3);
    expect(r.parsed!.freeEquips.length).toBe(1);
    const fe = r.parsed!.freeEquips[0];
    expect(fe.effect_id).toBe("guardian_superarmor");
    expect(fe.rarity).toBe("abyssal");
    expect(fe.value_text).toBe("0.1秒");
    // 置換適用でMy/Free両方復元
    const restored = applyImport(emptyUserData(), r.parsed!, "replace");
    expect(restored.builds.length).toBe(2);
    expect(restored.freeEquips.length).toBe(1);
  });

  it("v1形式(Freeシートなし)はFree編成0件として読める", () => {
    const d = sample();
    const wb = buildWorkbook(master, d);
    // v1相当のワークブックを再構成 (Freeシートを外し、format_versionを1へ)
    const readme = wb.Sheets["README"];
    readme["B2"] = { t: "n", v: 1 };
    delete wb.Sheets["Free編成"];
    delete wb.Sheets["Free装着状況"];
    wb.SheetNames = wb.SheetNames.filter(
      (n) => n !== "Free編成" && n !== "Free装着状況"
    );
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const r = parseWorkbook(master, XLSX.read(buf, { type: "array" }));
    expect(r.issues.errors).toEqual([]);
    expect(r.parsed).toBeTruthy();
    expect(r.parsed!.formatVersion).toBe(1);
    expect(r.parsed!.builds.every((b) => b.mode === "my")).toBe(true);
    expect(r.parsed!.freeEquips.length).toBe(0);
  });

  it("Free装着の枠タイプ不一致はエラー", () => {
    const d = sampleWithFree();
    // WR_sp_1 の枠1は系列(branch)タイプ — 守護効果は不一致
    d.freeEquips[0] = { ...d.freeEquips[0], slot_no: 1 };
    const wb = buildWorkbook(master, d);
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const r = parseWorkbook(master, XLSX.read(buf, { type: "array" }));
    expect(r.issues.errors.length).toBeGreaterThan(0);
    expect(r.parsed).toBeNull();
  });

  it("Freeの追加統合でbuild_id衝突は別IDになり装着も追従する", () => {
    const d = sampleWithFree();
    const r = roundtrip(d);
    const current = sampleWithFree();
    current.builds = current.builds.map((b) =>
      b.build_id === "fb1" ? { ...b, name: "別名にした理想形" } : b
    );
    const merged = applyImport(current, r.parsed!, "merge");
    // fb1が衝突 → 取込側は別IDで追加
    expect(merged.builds.filter((b) => b.mode === "free").length).toBe(2);
    expect(merged.freeEquips.length).toBe(2);
    const ids = new Set(merged.builds.map((b) => b.build_id));
    expect(ids.size).toBe(merged.builds.length);
  });
});
