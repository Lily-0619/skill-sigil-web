// S-02 編成編集 (docs/03 §4): 17スキル / 固定4枠 / 所持秘伝トレイ / 装着操作
// v0.2 #3: Freeモード対応 — 所持秘伝トレイの代わりに秘伝カタログを表示し、
//          所持数・残数・重複の制限なしで理想編成を組める。
// v0.2 #5: スロット先行選択フロー (枠クリック→トレイ/カタログ強調→クリックで装着)
import React, { useEffect, useMemo, useRef, useState } from "react";
import { master, newBuild, useStore } from "../state/store";
import type { BuildMode, EffectDef, InventoryItem, Rarity, SkillDef } from "../types";
import {
  canEquip,
  canEquipFree,
  defaultValueText,
  effectCountInBuild,
  equipAt,
  equipsForSkill,
  effectOf,
  freeEquipAt,
  freeEquipsForSkill,
  isBranchEffect,
  remaining,
  SAME_SERIES_MAX,
  skillsOf,
  typeName,
  usedCount,
} from "../logic/equip";
import { skillIconUrls, effectIconUrl } from "../lib/assets";
import { classDescriptions, skillDescOf } from "../lib/descriptions";
import { RarityChip, TypeChip } from "./ui";
import { SkillIcon } from "./build-edit/SkillIcon";
import { EquipConfirmModal, type PendingEquip } from "./build-edit/EquipConfirmModal";
import {
  PassiveSummary,
  ProfileCard,
  SkillDescriptionPanel,
} from "./build-edit/DescriptionPanels";
import { useReveal, staggerDelay } from "../hooks/useReveal";

/**
 * 秘伝効果一覧の数値表示 (v0.2 #11): 同じ数値が重複する場合は「値 ×N個」にまとめ、
 * 出現順を保って " / " 区切りで返す。重複が無ければ数値をそのまま並べる。
 */
const collapseValues = (vals: string[]): string => {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const v of vals) {
    if (!counts.has(v)) order.push(v);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return order
    .map((v) => (counts.get(v)! > 1 ? `${v} ×${counts.get(v)}個` : v))
    .join(" / ");
};

/** 等級の良い順 (混沌 > 太古 > 深淵)。デフォルト等級・並び順に使う。 */
const RARITY_ORDER: Rarity[] = ["chaos", "primal", "abyssal"];

/** Freeモードのカタログ選択 (効果 + 等級 + 2値効果の下位/上位) */
interface CatalogSel {
  effectId: string;
  rarity: Rarity;
  pick: "a" | "b";
}

export default function BuildEdit({
  defaultMode = "my",
}: {
  defaultMode?: BuildMode;
}) {
  const { data, dispatch, toast } = useStore();
  const classId = data.meta.selected_class_id!;
  const cls = master.classes.find((c) => c.class_id === classId)!;
  const skills = skillsOf(master, classId);

  // v0.2 #3: 選択中編成のモードを優先し、無ければ入口モード
  const allClassBuilds = data.builds.filter((b) => b.class_id === classId);
  const selectedAny =
    allClassBuilds.find((b) => b.build_id === data.meta.selected_build_id) ??
    null;
  const mode: BuildMode = selectedAny?.mode ?? defaultMode;
  const isFree = mode === "free";
  const classBuilds = allClassBuilds.filter((b) => b.mode === mode);
  const build = selectedAny && selectedAny.mode === mode ? selectedAny : null;

  // 編成が無ければ初期編成を自動作成 / 未選択なら先頭を選択
  useEffect(() => {
    if (classBuilds.length === 0) {
      dispatch({
        type: "CREATE_BUILD",
        build: newBuild(classId, isFree ? "Free編成 1" : "編成 1", mode),
      });
    } else if (!build) {
      dispatch({ type: "SELECT_BUILD", buildId: classBuilds[0].build_id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, mode, classBuilds.length, build?.build_id]);

  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  // v0.2 #3: カタログ選択 (Freeモード / selectedSlotと排他)
  const [selectedCatalog, setSelectedCatalog] = useState<CatalogSel | null>(null);
  // v0.2 #5: スロット先行選択 (selectedItem / selectedCatalog と排他)
  const [selectedSlot, setSelectedSlot] = useState<{
    skillId: string;
    slotNo: number;
  } | null>(null);
  const [pending, setPending] = useState<PendingEquip | null>(null);
  const [pulseKey, setPulseKey] = useState<string | null>(null);
  // v0.3: スキル・パッシブ説明 (資料Excel 日本語(正) 由来)。
  // パッシブは武器種1/2のタブで切り替え、闇精霊の怒りのCC(武器分岐)もこのタブに連動する。
  const desc = classDescriptions(cls.code);
  const [weaponIdx, setWeaponIdx] = useState(0);

  // クラス・モード変更時に選択をリセット
  useEffect(() => {
    setSelectedSkillId(null);
    setSelectedItemId(null);
    setSelectedCatalog(null);
    setSelectedSlot(null);
    setWeaponIdx(0);
  }, [classId, mode]);

  const selectedSkill = skills.find((s) => s.skill_id === selectedSkillId);
  const selectedSkillDesc = selectedSkill ? skillDescOf(desc, selectedSkill) : null;
  const selectedItem =
    data.inventory.find((i) => i.inventory_id === selectedItemId) ?? null;
  const selectedCatalogEffect = selectedCatalog
    ? effectOf(master, selectedCatalog.effectId) ?? null
    : null;
  // v0.2 #9: 枠が先行選択されている間は、その枠タイプに絞って「光る(装着可能)」判定と
  // 並び替えを一致させる (未選択ならスキル全体の対応タイプを使う)。
  const selectedSlotType = selectedSlot
    ? selectedSkill?.slots?.[selectedSlot.slotNo - 1] ?? null
    : null;
  const trayListRef = useRef<HTMLDivElement>(null);
  const slotPanelRef = useRef<HTMLDivElement>(null);
  // 装着可能な候補が上に来た状態で見えるよう、絞り込み条件が変わったら先頭へ戻す。
  // (jsdomにscrollToが無いため、より互換性の高いscrollTop代入を使う)
  useEffect(() => {
    if (trayListRef.current) trayListRef.current.scrollTop = 0;
  }, [selectedSlot?.skillId, selectedSlot?.slotNo, selectedSkillId]);

  const grid1 = useReveal<HTMLDivElement>();
  const grid2 = useReveal<HTMLDivElement>();
  const trayRv = useReveal<HTMLDivElement>();

  // ---- トレイ / カタログのフィルタ ----
  const [fType, setFType] = useState("");
  const [fRarity, setFRarity] = useState("");
  const [fText, setFText] = useState("");
  const [fUsable, setFUsable] = useState(false);

  const trayItems = useMemo(() => {
    if (!build || isFree) return [];
    let list = data.inventory.slice();
    if (fType) list = list.filter((i) => i.sigil_type_id === fType);
    if (fRarity) list = list.filter((i) => i.rarity === fRarity);
    if (fText.trim()) {
      const q = fText.trim();
      list = list.filter((i) => {
        const eff = effectOf(master, i.effect_id);
        return (
          (eff?.name_ja ?? "").includes(q) ||
          i.value_text.includes(q) ||
          i.note.includes(q)
        );
      });
    }
    if (fUsable)
      list = list.filter((i) => remaining(i, data.equips, build.build_id) > 0);

    // 装着可能な候補を上へ (v0.2 #9: 枠選択中はその枠タイプを優先、未選択ならスキル全体)
    const slotTypes = selectedSlotType
      ? new Set([selectedSlotType])
      : new Set(selectedSkill?.slots ?? []);
    const score = (i: InventoryItem) => {
      const rem = remaining(i, data.equips, build.build_id);
      let s = 0;
      if (slotTypes.has(i.sigil_type_id)) s -= 2;
      if (rem > 0) s -= 1;
      return s;
    };
    return list.sort(
      (a, b) =>
        score(a) - score(b) ||
        a.sigil_type_id.localeCompare(b.sigil_type_id) ||
        a.effect_id.localeCompare(b.effect_id)
    );
  }, [data.inventory, data.equips, build, isFree, fType, fRarity, fText, fUsable, selectedSkill, selectedSlotType]);

  // v0.2 #3: 秘伝カタログ (マスタ全効果)
  const catalogItems = useMemo(() => {
    if (!isFree) return [];
    let list = master.effects.filter((e) => e.enabled);
    if (fType) list = list.filter((e) => e.sigil_type_id === fType);
    if (fRarity) list = list.filter((e) => fRarity in e.values);
    if (fText.trim()) {
      const q = fText.trim();
      list = list.filter((e) => e.name_ja.includes(q));
    }
    // 枠を先行選択している場合は、その枠タイプの効果だけに絞る
    // (スロット選択 → そのタイプの効果だけ選べる、という操作にする)
    if (selectedSlotType) {
      list = list.filter((e) => e.sigil_type_id === selectedSlotType);
    }
    // 装着可能なタイプを上へ (v0.2 #9: 枠選択中はその枠タイプを優先、未選択ならスキル全体)
    const slotTypes = selectedSlotType
      ? new Set([selectedSlotType])
      : new Set(selectedSkill?.slots ?? []);
    const score = (e: EffectDef) => (slotTypes.has(e.sigil_type_id) ? -1 : 0);
    return list
      .slice()
      .sort(
        (a, b) =>
          score(a) - score(b) ||
          a.sigil_type_id.localeCompare(b.sigil_type_id) ||
          a.sort_order - b.sort_order
      );
  }, [isFree, fType, fRarity, fText, selectedSkill, selectedSlotType]);

  // v0.2 #11 (改訂): 秘伝効果一覧。この編成に「今つけている」秘伝だけを、
  // 秘伝タイプごと → 効果ごと → 等級ごと(混沌>太古>深淵)にまとめて表示。
  // 同じ効果+等級で数値が重複する場合は「値 ×N個」に集約。
  const equippedCatalog = useMemo(() => {
    const buildId = build?.build_id;
    if (!buildId) return [];
    // 装着済みを {typeId, effectId, name, rarity, value, skillId, slotNo} の配列に正規化
    type Row = {
      typeId: string;
      effectId: string;
      name: string;
      rarity: Rarity;
      value: string;
      skillId: string;
      slotNo: number;
    };
    const rows: Row[] = isFree
      ? data.freeEquips
          .filter((e) => e.build_id === buildId)
          .map((e) => {
            const eff = effectOf(master, e.effect_id);
            return {
              typeId: eff?.sigil_type_id ?? "",
              effectId: e.effect_id,
              name: eff?.name_ja ?? e.effect_id,
              rarity: e.rarity as Rarity,
              value: e.value_text,
              skillId: e.skill_id,
              slotNo: e.slot_no,
            };
          })
      : data.equips
          .filter((e) => e.build_id === buildId)
          .map((e) => {
            const inv = data.inventory.find((i) => i.inventory_id === e.inventory_id);
            if (!inv) return null;
            const eff = effectOf(master, inv.effect_id);
            return {
              typeId: inv.sigil_type_id,
              effectId: inv.effect_id,
              name: eff?.name_ja ?? inv.effect_id,
              rarity: inv.rarity as Rarity,
              value: inv.value_text,
              skillId: e.skill_id,
              slotNo: e.slot_no,
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);

    // タイプ → 効果 → 等級 → 数値配列 に集計
    return master.sigil_types
      .map((type) => {
        const typeRows = rows.filter((r) => r.typeId === type.id);
        const effIds = Array.from(new Set(typeRows.map((r) => r.effectId))).sort(
          (a, b) =>
            (effectOf(master, a)?.sort_order ?? 0) -
            (effectOf(master, b)?.sort_order ?? 0)
        );
        const effects = effIds.map((effectId) => {
          const name = typeRows.find((r) => r.effectId === effectId)!.name;
          const rarities = RARITY_ORDER.filter((rid) =>
            typeRows.some((r) => r.effectId === effectId && r.rarity === rid)
          ).map((rid) => ({
            rarity: master.rarities.find((x) => x.id === rid)!,
            valuesText: collapseValues(
              typeRows
                .filter((r) => r.effectId === effectId && r.rarity === rid)
                .map((r) => r.value)
                .filter((v) => v && v.length > 0)
            ),
          }));
          // #2: この効果を実際に装着しているスキル枠 (アイコン表示・編集ジャンプ用)
          const locations = typeRows
            .filter((r) => r.effectId === effectId)
            .map((r) => ({ skillId: r.skillId, slotNo: r.slotNo }))
            .sort((a, b) => a.skillId.localeCompare(b.skillId) || a.slotNo - b.slotNo);
          return { effectId, name, rarities, locations };
        });
        return { type, effects };
      })
      .filter((g) => g.effects.length > 0);
  }, [build?.build_id, isFree, data.equips, data.freeEquips, data.inventory]);

  // 系列(branch)は1編成に同一系列4つまで。上限に達した系列effect_idの集合。
  // トレイ/カタログでこれらを選択不可(グレーアウト)にする。
  const maxedBranchEffects = useMemo(() => {
    const s = new Set<string>();
    const buildId = build?.build_id;
    if (!buildId) return s;
    for (const eff of master.effects) {
      if (eff.sigil_type_id !== "branch") continue;
      if (effectCountInBuild(data, buildId, eff.effect_id, isFree) >= SAME_SERIES_MAX)
        s.add(eff.effect_id);
    }
    return s;
  }, [build?.build_id, isFree, data.equips, data.freeEquips, data.inventory]);

  // 選択中の効果が系列4つ上限に達したら選択を解除する (装着直後にグレーアウトへ移行)
  useEffect(() => {
    if (selectedCatalog && maxedBranchEffects.has(selectedCatalog.effectId))
      setSelectedCatalog(null);
    if (selectedItem && maxedBranchEffects.has(selectedItem.effect_id))
      setSelectedItemId(null);
  }, [maxedBranchEffects, selectedCatalog, selectedItem]);

  if (!build) return null;

  // 良い等級を既定に (混沌 > 太古 > 深淵)
  const defaultRarityFor = (eff: EffectDef): Rarity =>
    (RARITY_ORDER.find((r) => r in eff.values) ?? "chaos") as Rarity;

  // ---- 装着処理 (My) ----
  const tryEquip = (skill: SkillDef, slotNo: number, item: InventoryItem) => {
    const check = canEquip(
      master,
      data,
      classId,
      build.build_id,
      skill.skill_id,
      slotNo,
      item
    );
    if (!check.ok) {
      toast("error", check.reason);
      return;
    }
    const occupied = equipAt(data.equips, build.build_id, skill.skill_id, slotNo);
    if (occupied && occupied.inventory_id !== item.inventory_id) {
      const occItem = data.inventory.find(
        (i) => i.inventory_id === occupied.inventory_id
      );
      const occEff = occItem ? effectOf(master, occItem.effect_id) : null;
      setPending({
        skillId: skill.skill_id,
        slotNo,
        item,
        kind: check.needsMoveFrom ? "move" : "replace",
        moveFrom: check.needsMoveFrom
          ? { skillId: check.needsMoveFrom.skill_id, slotNo: check.needsMoveFrom.slot_no }
          : undefined,
        replaceName: occEff?.name_ja ?? "装着中の秘伝",
      });
      return;
    }
    if (check.needsMoveFrom) {
      setPending({
        skillId: skill.skill_id,
        slotNo,
        item,
        kind: "move",
        moveFrom: {
          skillId: check.needsMoveFrom.skill_id,
          slotNo: check.needsMoveFrom.slot_no,
        },
      });
      return;
    }
    doEquip(skill.skill_id, slotNo, item, undefined);
  };

  const doEquip = (
    skillId: string,
    slotNo: number,
    item: InventoryItem,
    moveFrom?: { skillId: string; slotNo: number }
  ) => {
    dispatch({
      type: "EQUIP",
      buildId: build.build_id,
      skillId,
      slotNo,
      inventoryId: item.inventory_id,
      moveFrom,
    });
    setPulseKey(`${skillId}|${slotNo}`);
    window.setTimeout(() => setPulseKey(null), 300);
    const remAfter = remaining(item, data.equips, build.build_id) - 1;
    if (remAfter <= 0) setSelectedItemId(null);
    setSelectedSlot(null); // #5: 装着完了で選択解除
  };

  // ---- 装着処理 (Free / v0.2 #3) ----
  const tryEquipFree = (skill: SkillDef, slotNo: number, sel: CatalogSel) => {
    const check = canEquipFree(
      master,
      data,
      classId,
      build.build_id,
      skill.skill_id,
      slotNo,
      sel.effectId
    );
    if (!check.ok) {
      toast("error", check.reason);
      return;
    }
    const eff = effectOf(master, sel.effectId);
    const vals = eff?.values[sel.rarity] ?? [];
    const valueText = defaultValueText(
      master,
      sel.effectId,
      sel.rarity,
      eff && !eff.two_effects && vals.length === 2 ? sel.pick : undefined
    );
    dispatch({
      type: "FREE_EQUIP",
      buildId: build.build_id,
      skillId: skill.skill_id,
      slotNo,
      effectId: sel.effectId,
      rarity: sel.rarity,
      valueText,
    });
    setPulseKey(`${skill.skill_id}|${slotNo}`);
    window.setTimeout(() => setPulseKey(null), 300);
    setSelectedSlot(null); // #5: 装着完了で選択解除
  };

  const skillName = (id: string) =>
    skills.find((s) => s.skill_id === id)?.name_ja ?? id;

  // #2: つけている秘伝一覧のスキルアイコンから、その枠の編集へジャンプする。
  // 対象スキルを選択し該当枠を先行選択、固定4枠パネルまでスクロールする。
  const editLocation = (skillId: string, slotNo: number) => {
    setSelectedSkillId(skillId);
    setSelectedItemId(null);
    setSelectedCatalog(null);
    setSelectedSlot({ skillId, slotNo });
    window.setTimeout(() => {
      slotPanelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }, 60);
  };

  // ---- スキルカード ----
  const SkillCard = ({ skill, index, rvCls }: { skill: SkillDef; index: number; rvCls: string }) => {
    const urls = skillIconUrls(cls.code, skill);
    const count = isFree
      ? freeEquipsForSkill(data.freeEquips, build.build_id, skill.skill_id).length
      : equipsForSkill(data.equips, build.build_id, skill.skill_id).length;
    const selected = skill.skill_id === selectedSkillId;
    return (
      <button
        className={`skill-card zoomable ${rvCls} rv-up ${selected ? "selected" : ""}`}
        style={staggerDelay(index, 40)}
        disabled={!skill.sigil_eligible}
        onClick={() => {
          setSelectedSkillId(selected ? null : skill.skill_id);
          setSelectedSlot(null);
        }}
        aria-pressed={selected}
      >
        <span className="no">
          {skill.group === "special" ? `特${skill.display_no}` : skill.display_no}
        </span>
        <span className="icon-frame">
          <SkillIcon urls={urls} noImageLabel="NO IMAGE" />
        </span>
        <span className="sname">{skill.name_ja}</span>
        {skill.sigil_eligible ? (
          <span
            className={`count ${count === 0 ? "zero" : count === 4 ? "full" : ""}`}
          >
            {count} / 4
          </span>
        ) : (
          <span className="ineligible">秘伝対象外</span>
        )}
      </button>
    );
  };

  const specials = skills.filter((s) => s.group === "special");
  const normals = skills.filter((s) => s.group === "normal");

  return (
    <div>
      <div className="screen-head">
        <span className="overline">Build Editor</span>
        <h2>
          {cls.name_ja} — 編成編集
          {isFree && <span className="badge-free" style={{ marginLeft: 10 }}>FREE</span>}
        </h2>
        {isFree && (
          <p className="desc">
            Freeモード: 所持数と無関係に、枠タイプに合う秘伝を自由に装着できます。
          </p>
        )}
      </div>

      {/* 編成ツールバー */}
      <div className="build-toolbar">
        <select
          className="select"
          value={build.build_id}
          onChange={(e) => dispatch({ type: "SELECT_BUILD", buildId: e.target.value })}
          aria-label="編成を選択"
        >
          {classBuilds.map((b) => (
            <option key={b.build_id} value={b.build_id}>
              {b.name}
            </option>
          ))}
        </select>
        <button
          className="btn small"
          onClick={() =>
            dispatch({
              type: "CREATE_BUILD",
              build: newBuild(
                classId,
                `${isFree ? "Free編成" : "編成"} ${classBuilds.length + 1}`,
                mode
              ),
            })
          }
        >
          ＋ 新規
        </button>
        <button
          className="btn small ghost"
          onClick={() =>
            dispatch({
              type: "DUP_BUILD",
              sourceId: build.build_id,
              build: newBuild(classId, `${build.name} の複製`, mode),
            })
          }
        >
          複製
        </button>
      </div>

      <div className="build-layout">
        <div>
          {/* クラスのプロフィール (資料Excel「プロフィール」シート: 名前/出身地/Other) */}
          <ProfileCard profile={desc?.profile ?? null} />

          {/* v0.3: パッシブ説明 (資料Excel 日本語(正))。枠右上の武器種タブで武器1/2を切替。
              同じ枠内にスキル(闇精霊の怒り)を続けて表示し、武器分岐(CC)もタブに連動する。 */}
          <PassiveSummary
            desc={desc}
            weaponIdx={weaponIdx}
            onWeaponChange={setWeaponIdx}
          />

          {/* 特別スキル */}
          <div className="skill-section-label">
            <span className="t">特別スキル</span>
            <span className="sub">Rabam — 1 ~ 4</span>
            <span className="rule" />
          </div>
          <div ref={grid1.ref} className="skill-grid">
            {specials.map((s, i) => (
              <SkillCard key={s.skill_id} skill={s} index={i} rvCls={grid1.cls} />
            ))}
          </div>

          {/* 通常スキル */}
          <div className="skill-section-label">
            <span className="t">通常スキル</span>
            <span className="sub">Normal — 1 ~ 13</span>
            <span className="rule" />
          </div>
          <div ref={grid2.ref} className="skill-grid">
            {normals.map((s, i) => (
              <SkillCard key={s.skill_id} skill={s} index={i} rvCls={grid2.cls} />
            ))}
          </div>

          {/* 固定4枠 */}
          {selectedSkill && selectedSkill.slots && (
            <div
              ref={slotPanelRef}
              className="slot-panel panel rv rv-fade in"
              key={selectedSkill.skill_id}
            >
              <div className="head">
                <span className="icon-frame">
                  <SkillIcon urls={skillIconUrls(cls.code, selectedSkill)} noImageLabel="—" />
                </span>
                <div>
                  <div className="title">
                    {selectedSkill.name_ja}
                    {isFree && <span className="badge-free" style={{ marginLeft: 8 }}>FREE</span>}
                  </div>
                  <div className="sub">
                    {selectedSkill.group === "special" ? "特別スキル(ラバム)" : "通常スキル"}{" "}
                    {selectedSkill.display_no} ・ 固定4枠
                  </div>
                </div>
              </div>
              <div className="slot-grid">
                {selectedSkill.slots.map((slotType, idx) => {
                  const slotNo = idx + 1;
                  // My装着
                  const eq = !isFree
                    ? equipAt(data.equips, build.build_id, selectedSkill.skill_id, slotNo)
                    : undefined;
                  const eqItem = eq
                    ? data.inventory.find((i) => i.inventory_id === eq.inventory_id)
                    : null;
                  const eqEffect = eqItem ? effectOf(master, eqItem.effect_id) : null;
                  // Free装着 (v0.2 #3)
                  const eqF = isFree
                    ? freeEquipAt(data.freeEquips, build.build_id, selectedSkill.skill_id, slotNo)
                    : undefined;
                  const eqFEffect = eqF ? effectOf(master, eqF.effect_id) : null;

                  const compatible = isFree
                    ? !!selectedCatalogEffect &&
                      selectedCatalogEffect.sigil_type_id === slotType
                    : !!selectedItem && selectedItem.sigil_type_id === slotType;
                  const hasSelection = isFree ? !!selectedCatalogEffect : !!selectedItem;
                  const incompatible = hasSelection && !compatible;
                  // v0.2 #5: この枠が先行選択されているか
                  const slotSelected =
                    !!selectedSlot &&
                    selectedSlot.skillId === selectedSkill.skill_id &&
                    selectedSlot.slotNo === slotNo;
                  return (
                    <div
                      key={slotNo}
                      className={`slot-cell ${compatible ? "compatible" : ""} ${
                        incompatible ? "incompatible" : ""
                      } ${slotSelected ? "selected" : ""} ${
                        pulseKey === `${selectedSkill.skill_id}|${slotNo}` ? "fx-confirm" : ""
                      }`}
                      onClick={() => {
                        if (compatible) {
                          // 従来フロー: アイテム/カタログ先行 → 枠クリックで装着
                          if (!isFree && selectedItem) {
                            tryEquip(selectedSkill, slotNo, selectedItem);
                            return;
                          }
                          if (isFree && selectedCatalog) {
                            tryEquipFree(selectedSkill, slotNo, selectedCatalog);
                            return;
                          }
                        }
                        // #5 スロット先行選択 (同じ枠の再クリックで解除 / 他の選択はクリア)
                        setSelectedItemId(null);
                        setSelectedCatalog(null);
                        setSelectedSlot(
                          slotSelected
                            ? null
                            : { skillId: selectedSkill.skill_id, slotNo }
                        );
                      }}
                      role="button"
                      aria-pressed={slotSelected}
                      aria-label={`枠${slotNo} ${typeName(master, slotType)}`}
                    >
                      <div className="slot-no">
                        <span>SLOT {slotNo}</span>
                        <TypeChip master={master} typeId={slotType} />
                      </div>
                      {!isFree && eqItem && eqEffect ? (
                        <>
                          <div className="equipped">
                            <span className="ename">{eqEffect.name_ja}</span>
                            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <RarityChip master={master} rarity={eqItem.rarity} />
                              {eqItem.value_text && (
                                <span className="num" style={{ color: "var(--pink)" }}>
                                  {eqItem.value_text}
                                </span>
                              )}
                            </span>
                          </div>
                          <button
                            className="unequip"
                            onClick={(e) => {
                              e.stopPropagation();
                              dispatch({
                                type: "UNEQUIP",
                                buildId: build.build_id,
                                skillId: selectedSkill.skill_id,
                                slotNo,
                              });
                            }}
                          >
                            解除 ↩
                          </button>
                        </>
                      ) : isFree && eqF ? (
                        <>
                          <div className="equipped">
                            <span className="ename">
                              {eqFEffect?.name_ja ?? eqF.effect_id}
                            </span>
                            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <RarityChip master={master} rarity={eqF.rarity} />
                              {eqF.value_text && (
                                <span className="num" style={{ color: "var(--pink)" }}>
                                  {eqF.value_text}
                                </span>
                              )}
                            </span>
                          </div>
                          <button
                            className="unequip"
                            onClick={(e) => {
                              e.stopPropagation();
                              dispatch({
                                type: "FREE_UNEQUIP",
                                buildId: build.build_id,
                                skillId: selectedSkill.skill_id,
                                slotNo,
                              });
                            }}
                          >
                            解除 ↩
                          </button>
                        </>
                      ) : (
                        <div className="empty-label">
                          {compatible
                            ? "クリックで装着"
                            : slotSelected
                            ? isFree
                              ? "カタログから秘伝を選択"
                              : "トレイから秘伝を選択"
                            : "未装着"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* v0.3: スキル説明 (資料Excel 日本語(正))。通常=スキル(1〜13) / 特別=ラバムスキル(1〜4)。
              秘伝の種別タグは省き、PvE/PvPはチップで表示する。 */}
          {selectedSkill && (
            <SkillDescriptionPanel
              key={`desc-${selectedSkill.skill_id}`}
              skillName={selectedSkill.name_ja}
              desc={selectedSkillDesc}
            />
          )}

          {/* v0.2 #11 (改訂): 秘伝効果一覧 = この編成に今つけている秘伝だけ。
              秘伝タイプごと → 効果 → 等級(混沌>太古>深淵)。重複数値は「値 ×N個」に集約。 */}
          <div className="panel effect-catalog rv rv-fade in">
            <div className="skill-desc-panel-head">
              <span className="overline">Equipped Sigils</span>
              <span className="t">つけている秘伝一覧</span>
            </div>
            {equippedCatalog.length === 0 ? (
              <p className="ec-noval" style={{ marginTop: 4 }}>
                この編成にはまだ秘伝がついていません。
              </p>
            ) : (
              <div className="ec-groups">
                {equippedCatalog.map((g) => (
                  <div className="ec-group" key={g.type.id}>
                    <div className="ec-type-head">
                      <span className="dot" style={{ background: g.type.color }} />
                      {g.type.name}
                    </div>
                    <div className="ec-effects">
                      {g.effects.map((e) => (
                        <div className="ec-effect" key={e.effectId}>
                          <span className="ec-ename">{e.name}</span>
                          <span className="ec-rarities">
                            {e.rarities.length === 0 ? (
                              <span className="ec-noval">数値なし</span>
                            ) : (
                              e.rarities.map((r) => (
                                <span className="ec-rarity" key={r.rarity.id}>
                                  <RarityChip master={master} rarity={r.rarity.id} />
                                  {r.valuesText && (
                                    <span className="ec-rvals">{r.valuesText}</span>
                                  )}
                                </span>
                              ))
                            )}
                          </span>
                          {/* #2: この効果を装着中のスキルアイコン。押すとその枠の編集へ切り替わる */}
                          {e.locations.length > 0 && (
                            <div className="ec-skill-icons">
                              {e.locations.map((loc, i) => {
                                const sk = skills.find(
                                  (s) => s.skill_id === loc.skillId
                                );
                                if (!sk) return null;
                                return (
                                  <button
                                    type="button"
                                    key={`${loc.skillId}-${loc.slotNo}-${i}`}
                                    className="ec-skill-icon"
                                    title={`${sk.name_ja} 枠${loc.slotNo} を編集`}
                                    aria-label={`${sk.name_ja} 枠${loc.slotNo} を編集`}
                                    onClick={() => editLocation(loc.skillId, loc.slotNo)}
                                  >
                                    <SkillIcon
                                      urls={skillIconUrls(cls.code, sk)}
                                      noImageLabel="?"
                                    />
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!selectedSkill && (
            <div className="empty-state" style={{ marginTop: 24 }}>
              <span className="en">Select a Skill</span>
              スキルカードを選ぶと、固定4枠がここにひらきます
            </div>
          )}
        </div>

        {/* 所持秘伝トレイ (My) / 秘伝カタログ (Free) */}
        <aside ref={trayRv.ref} className={`tray panel ${trayRv.cls} rv-left`}>
          <div className="tray-head">
            <span>{isFree ? "秘伝カタログ" : "所持秘伝トレイ"}</span>
            <span className="en">{isFree ? "Catalog" : "Inventory"}</span>
          </div>
          <div className="tray-filters">
            <div className="row">
              <select
                className="select"
                value={fType}
                onChange={(e) => setFType(e.target.value)}
                aria-label="タイプで絞り込み"
              >
                <option value="">全タイプ</option>
                {master.sigil_types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select
                className="select"
                value={fRarity}
                onChange={(e) => setFRarity(e.target.value)}
                aria-label="等級で絞り込み"
              >
                <option value="">全等級</option>
                {master.rarities.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="row">
              <input
                className="input"
                placeholder={isFree ? "効果名を検索" : "効果・数値・メモを検索"}
                value={fText}
                onChange={(e) => setFText(e.target.value)}
              />
            </div>
            {!isFree && (
              <label
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  fontSize: 11,
                  color: "var(--muted)",
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={fUsable}
                  onChange={(e) => setFUsable(e.target.checked)}
                  style={{ accentColor: "var(--pink)" }}
                />
                残数ありのみ表示
              </label>
            )}
          </div>

          {!isFree ? (
            <div className="tray-list" ref={trayListRef}>
              {trayItems.map((item) => {
                const eff = effectOf(master, item.effect_id);
                const rem = remaining(item, data.equips, build.build_id);
                const used = usedCount(data.equips, build.build_id, item.inventory_id);
                const selected = item.inventory_id === selectedItemId;
                const icon = effectIconUrl(item.sigil_type_id, item.effect_id);
                // v0.2 #5: スロット先行選択中は「枠タイプ一致かつ残数>0」を強調
                const slotType = selectedSlotType;
                // 系列4つ制限に達した系列は選択不可 (グレーアウト)
                const seriesMaxed = maxedBranchEffects.has(item.effect_id);
                const lit =
                  !!slotType && item.sigil_type_id === slotType && rem > 0 && !seriesMaxed;
                const dim = seriesMaxed || (!!slotType && !lit);
                return (
                  <button
                    key={item.inventory_id}
                    className={`tray-item ${selected ? "selected" : ""} ${
                      rem <= 0 ? "depleted" : ""
                    } ${lit ? "lit" : ""} ${dim ? "dim" : ""} ${
                      seriesMaxed ? "series-maxed" : ""
                    }`}
                    onClick={() => {
                      if (seriesMaxed) {
                        toast(
                          "error",
                          `同じ系列（${eff?.name_ja ?? "系列"}）は1編成に${SAME_SERIES_MAX}つまでです`
                        );
                        return;
                      }
                      // #5: 枠が先行選択されていれば、一致アイテムのクリックで即装着
                      if (selectedSlot && selectedSkill && lit) {
                        tryEquip(selectedSkill, selectedSlot.slotNo, item);
                        return;
                      }
                      setSelectedSlot(null);
                      setSelectedItemId(selected ? null : item.inventory_id);
                    }}
                    aria-pressed={selected}
                  >
                    <span className="icon-frame">
                      {icon ? (
                        <img src={icon} alt="" loading="lazy" />
                      ) : (
                        <span className="noimg">?</span>
                      )}
                    </span>
                    <span className="info">
                      <span className="ename">{eff?.name_ja ?? item.effect_id}</span>
                      <span className="emeta">
                        <TypeChip master={master} typeId={item.sigil_type_id} />
                        <RarityChip master={master} rarity={item.rarity} />
                        {item.value_text && (
                          <span style={{ fontSize: 10.5, color: "var(--pink)" }}>
                            {item.value_text}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="qty">
                      <span className="rem">{rem}</span> / {item.quantity}
                      <br />
                      <span style={{ fontSize: 9.5, color: "var(--muted)" }}>
                        使用 {used}
                      </span>
                    </span>
                  </button>
                );
              })}
              {trayItems.length === 0 && (
                <div className="empty-state">
                  <span className="en">Empty</span>
                  所持秘伝がありません。
                  <br />
                  「所持秘伝」画面から登録してください。
                </div>
              )}
            </div>
          ) : (
            /* v0.2 #3: 秘伝カタログ */
            <div className="tray-list" ref={trayListRef}>
              {catalogItems.map((eff) => {
                const selected = selectedCatalog?.effectId === eff.effect_id;
                const icon = effectIconUrl(eff.sigil_type_id, eff.effect_id);
                // #5: スロット先行選択中は枠タイプ一致を強調 (Freeは残数の概念なし)
                const slotType = selectedSlotType;
                // 系列4つ制限に達した系列は選択不可 (グレーアウト)
                const seriesMaxed = maxedBranchEffects.has(eff.effect_id);
                const lit = !!slotType && eff.sigil_type_id === slotType && !seriesMaxed;
                const dim = seriesMaxed || (!!slotType && !lit);
                const rarity = selected
                  ? selectedCatalog!.rarity
                  : defaultRarityFor(eff);
                const vals = eff.values[rarity] ?? [];
                const twoVal = !eff.two_effects && vals.length === 2;
                const pick = selected ? selectedCatalog!.pick : "a";
                const preview = defaultValueText(
                  master,
                  eff.effect_id,
                  rarity,
                  twoVal ? pick : undefined
                );
                return (
                  <div
                    key={eff.effect_id}
                    className={`tray-item cat-item ${selected ? "selected" : ""} ${
                      lit ? "lit" : ""
                    } ${dim ? "dim" : ""} ${seriesMaxed ? "series-maxed" : ""}`}
                    onClick={() => {
                      if (seriesMaxed) {
                        toast(
                          "error",
                          `同じ系列（${eff.name_ja}）は1編成に${SAME_SERIES_MAX}つまでです`
                        );
                        return;
                      }
                      // Free編成で等級・数値の選択肢がある秘伝は、枠を先に選んでいても即装着しない。
                      // 等級・数値を選んでから「装着」ボタン or 枠クリックで確定する。
                      // 選択肢がない秘伝だけ、従来どおり枠先行クリックで即装着する。
                      const hasRarityChoice = Object.keys(eff.values).length > 1;
                      const hasValueChoice = Object.values(eff.values).some(
                        (v) => !eff.two_effects && v.length === 2
                      );
                      if (selectedSlot && selectedSkill && lit && !hasRarityChoice && !hasValueChoice) {
                        tryEquipFree(selectedSkill, selectedSlot.slotNo, {
                          effectId: eff.effect_id,
                          rarity: defaultRarityFor(eff),
                          pick: "a",
                        });
                        return;
                      }
                      // 枠の先行選択(selectedSlot)は保持したまま。
                      setSelectedItemId(null);
                      setSelectedCatalog(
                        selected
                          ? null
                          : { effectId: eff.effect_id, rarity: defaultRarityFor(eff), pick: "a" }
                      );
                    }}
                    role="button"
                    aria-pressed={selected}
                  >
                    <span className="icon-frame">
                      {icon ? (
                        <img src={icon} alt="" loading="lazy" />
                      ) : (
                        <span className="noimg">?</span>
                      )}
                    </span>
                    <span className="info">
                      <span className="ename">{eff.name_ja}</span>
                      <span className="emeta">
                        <TypeChip master={master} typeId={eff.sigil_type_id} />
                        {!selected && preview && (
                          <span style={{ fontSize: 10.5, color: "var(--pink)" }}>
                            {preview}
                          </span>
                        )}
                      </span>
                    </span>
                    {selected && (
                      <span className="cat-picker" onClick={(e) => e.stopPropagation()}>
                        <span className="plabel">等級</span>
                        {RARITY_ORDER.filter((rid) => rid in eff.values).map((rid) => {
                          const r = master.rarities.find((x) => x.id === rid)!;
                          return (
                            <button
                              key={r.id}
                              className={`pchip ${selectedCatalog!.rarity === r.id ? "on" : ""}`}
                              onClick={() =>
                                setSelectedCatalog((c) =>
                                  c ? { ...c, rarity: r.id } : c
                                )
                              }
                            >
                              {r.name}
                            </button>
                          );
                        })}
                        {twoVal && <span className="picker-break" aria-hidden="true" />}
                        {twoVal && (
                          <>
                            <span className="plabel">値</span>
                            <button
                              className={`pchip ${pick === "a" ? "on" : ""}`}
                              onClick={() =>
                                setSelectedCatalog((c) => (c ? { ...c, pick: "a" } : c))
                              }
                            >
                              下位 {vals[0]}
                            </button>
                            <button
                              className={`pchip ${pick === "b" ? "on" : ""}`}
                              onClick={() =>
                                setSelectedCatalog((c) => (c ? { ...c, pick: "b" } : c))
                              }
                            >
                              上位 {vals[1]}
                            </button>
                          </>
                        )}
                        <span className="cat-value">{preview}</span>
                        <button
                          className="pchip cat-equip"
                          disabled={!selectedSlot}
                          onClick={() => {
                            if (selectedSlot && selectedSkill && selectedCatalog) {
                              tryEquipFree(
                                selectedSkill,
                                selectedSlot.slotNo,
                                selectedCatalog
                              );
                            }
                          }}
                        >
                          {selectedSlot ? `枠${selectedSlot.slotNo}に装着` : "先に枠を選択"}
                        </button>
                      </span>
                    )}
                  </div>
                );
              })}
              {catalogItems.length === 0 && (
                <div className="empty-state">
                  <span className="en">Empty</span>
                  条件に合う効果がありません。
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* 移動・置き換え確認 (docs/02 F-008 / Myのみ) */}
      {pending && (
        <EquipConfirmModal
          pending={pending}
          skillName={skillName}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            doEquip(pending.skillId, pending.slotNo, pending.item, pending.moveFrom);
            setPending(null);
          }}
        />
      )}
    </div>
  );
}
