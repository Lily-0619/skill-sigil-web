// S-03 所持秘伝管理 (docs/03 §5): タイプ→効果→等級の絞り込み登録フォーム + 一覧
import React, { useMemo, useState } from "react";
import { master, newItem, useStore } from "../state/store";
import type { InventoryItem, Rarity } from "../types";
import {
  defaultValueText,
  effectOf,
  maxUsedPerBuild,
  rarityAvailable,
  remaining,
  usedCount,
} from "../logic/equip";
import { effectIconUrl, sigilIconUrl } from "../lib/assets";
import { EmptyState, Modal, RarityChip, Stepper, TypeChip } from "./ui";
import { useReveal } from "../hooks/useReveal";

interface FormState {
  editingId: string | null;
  typeId: string;
  effectId: string;
  rarity: Rarity | "";
  abPick: "a" | "b";
  valueText: string;
  value2Text: string; // 無欠2値効果の効果2
  quantity: number;
  note: string;
}

const initialForm: FormState = {
  editingId: null,
  typeId: "",
  effectId: "",
  rarity: "",
  abPick: "a",
  valueText: "",
  value2Text: "",
  quantity: 1,
  note: "",
};

export default function Inventory() {
  const { data, dispatch, toast } = useStore();
  const [form, setForm] = useState<FormState>(initialForm);
  const [mergeTarget, setMergeTarget] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const formRv = useReveal<HTMLDivElement>();
  const tableRv = useReveal<HTMLDivElement>();

  const effect = form.effectId ? effectOf(master, form.effectId) : undefined;
  const typeEffects = master.effects.filter(
    (e) => e.sigil_type_id === form.typeId && e.enabled
  );
  const isTwoValue =
    !!effect &&
    !effect.two_effects &&
    !!form.rarity &&
    (effect.values[form.rarity]?.length ?? 0) === 2;
  const isTwoEffects = !!effect?.two_effects;
  const isValueless = !!effect?.valueless;

  // ---- フォーム操作 ----
  const pickType = (typeId: string) =>
    setForm((f) => ({
      ...initialForm,
      editingId: f.editingId,
      typeId,
      quantity: f.quantity,
      note: f.note,
    }));

  const pickEffect = (effectId: string) => {
    setForm((f) => {
      const eff = effectOf(master, effectId);
      // 等級が1つしか無い効果は自動選択 (煌めく=混沌のみ / 系列=深淵のみ)
      const avail = master.rarities.filter((r) => eff && r.id in eff.values);
      const rarity = avail.length === 1 ? avail[0].id : f.rarity && eff && f.rarity in eff.values ? f.rarity : "";
      return applyDefaults({ ...f, effectId, rarity, abPick: "a" });
    });
  };

  const pickRarity = (rarity: Rarity) =>
    setForm((f) => applyDefaults({ ...f, rarity, abPick: "a" }));

  const pickAb = (abPick: "a" | "b") =>
    setForm((f) => applyDefaults({ ...f, abPick }));

  function applyDefaults(f: FormState): FormState {
    if (!f.effectId || !f.rarity) return { ...f, valueText: "", value2Text: "" };
    const eff = effectOf(master, f.effectId);
    if (!eff) return f;
    if (eff.two_effects) {
      const vals = eff.values[f.rarity] ?? [];
      return { ...f, valueText: vals[0] ?? "", value2Text: vals[1] ?? "" };
    }
    return {
      ...f,
      valueText: defaultValueText(master, f.effectId, f.rarity, f.abPick),
      value2Text: "",
    };
  }

  const composedValue = isTwoEffects
    ? [form.valueText, form.value2Text].filter((s) => s !== "").join(" , ")
    : form.valueText;

  const canSubmit =
    form.typeId && form.effectId && form.rarity && form.quantity >= 1;

  // 使用数を下回る所持数を禁止 (docs/02 REQ-RULE-003)
  const minQty = form.editingId
    ? Math.max(1, maxUsedPerBuild(data.equips, form.editingId).max)
    : 1;

  const submit = () => {
    if (!canSubmit) return;
    if (form.editingId) {
      dispatch({
        type: "UPDATE_ITEM",
        inventoryId: form.editingId,
        patch: {
          sigil_type_id: form.typeId,
          effect_id: form.effectId,
          rarity: form.rarity as Rarity,
          value_text: composedValue,
          quantity: Math.max(minQty, form.quantity),
          note: form.note,
        },
      });
      toast("success", "所持秘伝を更新しました");
      setForm(initialForm);
      return;
    }
    // 統合候補 (同タイプ・効果・等級・数値完全一致)
    const dup = data.inventory.find(
      (i) =>
        i.sigil_type_id === form.typeId &&
        i.effect_id === form.effectId &&
        i.rarity === form.rarity &&
        i.value_text === composedValue
    );
    if (dup) {
      setMergeTarget(dup);
      return;
    }
    registerNew();
  };

  const registerNew = () => {
    dispatch({
      type: "REGISTER_ITEM",
      item: newItem({
        sigil_type_id: form.typeId,
        effect_id: form.effectId,
        rarity: form.rarity as Rarity,
        value_text: composedValue,
        quantity: form.quantity,
        note: form.note,
      }),
    });
    toast("success", "所持秘伝を登録しました");
    setForm(initialForm);
  };

  const startEdit = (item: InventoryItem) => {
    const eff = effectOf(master, item.effect_id);
    const values = eff?.values[item.rarity] ?? [];
    const abPick: "a" | "b" =
      !eff?.two_effects && values.length === 2 && item.value_text === values[1]
        ? "b"
        : "a";
    setForm(applyDefaults({
      editingId: item.inventory_id,
      typeId: item.sigil_type_id,
      effectId: item.effect_id,
      rarity: item.rarity,
      abPick,
      valueText: "",
      value2Text: "",
      quantity: item.quantity,
      note: item.note,
    }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ---- 一覧フィルタ ----
  const [fType, setFType] = useState("");
  const [fRarity, setFRarity] = useState("");
  const [fUse, setFUse] = useState("");

  const buildId = data.meta.selected_build_id;

  const rows = useMemo(() => {
    let list = data.inventory.slice();
    if (fType) list = list.filter((i) => i.sigil_type_id === fType);
    if (fRarity) list = list.filter((i) => i.rarity === fRarity);
    const usedOf = (i: InventoryItem) =>
      buildId
        ? usedCount(data.equips, buildId, i.inventory_id)
        : maxUsedPerBuild(data.equips, i.inventory_id).max;
    if (fUse === "used") list = list.filter((i) => usedOf(i) > 0);
    if (fUse === "free") list = list.filter((i) => usedOf(i) === 0);
    return list.sort(
      (a, b) =>
        a.sigil_type_id.localeCompare(b.sigil_type_id) ||
        a.effect_id.localeCompare(b.effect_id) ||
        a.rarity.localeCompare(b.rarity)
    );
  }, [data.inventory, data.equips, fType, fRarity, fUse, buildId]);

  return (
    <div>
      <div className="screen-head">
        <span className="overline">Inventory</span>
        <h2>所持秘伝管理</h2>
        <p className="desc">
          タイプ → 効果 → 等級のじゅんに選ぶと、数値はマスタから自動で確定します。
        </p>
      </div>

      <div className="inv-layout">
        {/* 登録フォーム */}
        <div ref={formRv.ref} className={`form-panel panel ${formRv.cls} rv-up`}>
          <div className="form-label" style={{ marginBottom: 18 }}>
            <span
              className="overline"
              style={{ fontSize: 10, letterSpacing: "0.3em" }}
            >
              {form.editingId ? "Edit Sigil" : "Register Sigil"}
            </span>
            {form.editingId && (
              <button
                className="btn small ghost"
                style={{ marginLeft: "auto" }}
                onClick={() => setForm(initialForm)}
              >
                編集をやめる
              </button>
            )}
          </div>

          {/* 1. タイプ */}
          <div className="step">
            <div className="form-label">
              <span className="n">1</span> 秘伝タイプ <span className="req">必須</span>
            </div>
            <div className="type-buttons">
              {master.sigil_types.map((t) => {
                const icon = sigilIconUrl(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`type-btn ${form.typeId === t.id ? "selected" : ""}`}
                    onClick={() => pickType(t.id)}
                  >
                    {icon ? (
                      <img src={icon} alt="" loading="lazy" />
                    ) : (
                      <span
                        className="dot"
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: t.color,
                        }}
                      />
                    )}
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. 効果 */}
          {form.typeId && (
            <div className="step rv rv-fade in">
              <div className="form-label">
                <span className="n">2</span> 効果 <span className="req">必須</span>
              </div>
              <div className="effect-list">
                {typeEffects.map((e) => (
                  <button
                    key={e.effect_id}
                    type="button"
                    className={`effect-option ${
                      form.effectId === e.effect_id ? "selected" : ""
                    }`}
                    onClick={() => pickEffect(e.effect_id)}
                  >
                    {e.name_ja}
                    {e.sigil_type_id === "radiant" && (
                      <span className="note">混沌等級のみ存在します</span>
                    )}
                    {e.sigil_type_id === "branch" && (
                      <span className="note">深淵等級のみ・10%固定</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. 等級 */}
          {form.effectId && (
            <div className="step rv rv-fade in">
              <div className="form-label">
                <span className="n">3</span> 等級 <span className="req">必須</span>
              </div>
              <div className="rarity-buttons">
                {master.rarities.map((r) => {
                  const ok = rarityAvailable(master, form.effectId, r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className={`rarity-btn ${r.id} ${
                        form.rarity === r.id ? "selected" : ""
                      }`}
                      disabled={!ok}
                      title={ok ? undefined : "この等級の秘伝は存在しません"}
                      onClick={() => pickRarity(r.id)}
                    >
                      <span className="swatch" style={{ background: r.color }} />
                      {r.name}
                    </button>
                  );
                })}
              </div>
              {master.rarities.some(
                (r) => !rarityAvailable(master, form.effectId, r.id)
              ) && (
                <div className="form-hint">
                  灰色の等級には、この効果の秘伝が存在しません。
                </div>
              )}
            </div>
          )}

          {/* 4. 数値 */}
          {form.rarity && (
            <div className="step rv rv-fade in">
              <div className="form-label">
                <span className="n">4</span> 数値 <span className="opt">自動確定</span>
              </div>
              {isValueless ? (
                <div className="form-hint">
                  この効果は数値を持ちません(効果の有無のみ)。
                </div>
              ) : isTwoEffects ? (
                <>
                  <div className="two-value-inputs">
                    <div>
                      <div className="lbl">効果1 (攻撃力・防御力減少)</div>
                      <div className="value-display">{form.valueText || "—"}</div>
                    </div>
                    <div>
                      <div className="lbl">効果2 (攻撃・移動速度減少)</div>
                      <div className="value-display">{form.value2Text || "—"}</div>
                    </div>
                  </div>
                  <div className="form-hint">
                    無欠のこの効果は、2種類の効果が同時に付与されます。
                  </div>
                </>
              ) : (
                <>
                  {isTwoValue && (
                    <div className="ab-radio">
                      {(["a", "b"] as const).map((k) => {
                        const vals = effect?.values[form.rarity as Rarity] ?? [];
                        return (
                          <label key={k} className={form.abPick === k ? "checked" : ""}>
                            <input
                              type="radio"
                              name="abpick"
                              checked={form.abPick === k}
                              onChange={() => pickAb(k)}
                            />
                            {k === "a" ? "下位" : "上位"} — {vals[k === "a" ? 0 : 1]}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <div className="value-display">{form.valueText || "—"}</div>
                  {isTwoValue && (
                    <div className="form-hint">
                      この効果は同一等級内で2つの値のどちらかを取ります。両方を控えたい場合はメモへ記録してください。
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 5. 所持数 */}
          <div className="step">
            <div className="form-label">
              <span className="n">5</span> 所持数 <span className="req">必須</span>
            </div>
            <Stepper
              value={form.quantity}
              min={minQty}
              onChange={(v) => setForm((f) => ({ ...f, quantity: v }))}
            />
            {minQty > 1 && (
              <div className="form-hint">
                編成で{minQty}個使用中のため、{minQty}未満にはできません。先に編成側で解除してください。
              </div>
            )}
          </div>

          {/* 6. メモ */}
          <div className="step">
            <div className="form-label">
              <span className="n">6</span> メモ <span className="opt">任意</span>
            </div>
            <input
              className="input"
              placeholder="入手先、用途など"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </div>

          <button
            className="btn primary"
            style={{ width: "100%", marginTop: 6 }}
            disabled={!canSubmit}
            onClick={submit}
          >
            {form.editingId ? "更新する" : "登録する"}
          </button>
        </div>

        {/* 一覧 */}
        <div ref={tableRv.ref} className={`panel ${tableRv.cls} rv-up`} style={{ padding: 20 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <select className="select" style={{ width: 150 }} value={fType} onChange={(e) => setFType(e.target.value)}>
              <option value="">全タイプ</option>
              {master.sigil_types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <select className="select" style={{ width: 130 }} value={fRarity} onChange={(e) => setFRarity(e.target.value)}>
              <option value="">全等級</option>
              {master.rarities.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <select className="select" style={{ width: 150 }} value={fUse} onChange={(e) => setFUse(e.target.value)}>
              <option value="">使用状況: すべて</option>
              <option value="used">使用中のみ</option>
              <option value="free">未使用のみ</option>
            </select>
          </div>

          {rows.length === 0 ? (
            <EmptyState en="No Sigils">
              まだ所持秘伝がありません。左のフォームから登録してください。
            </EmptyState>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="inv-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>タイプ</th>
                    <th>効果</th>
                    <th>等級</th>
                    <th>数値</th>
                    <th style={{ textAlign: "right" }}>所持</th>
                    <th style={{ textAlign: "right" }}>使用中</th>
                    <th style={{ textAlign: "right" }}>残り</th>
                    <th>メモ</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => {
                    const eff = effectOf(master, item.effect_id);
                    const used = buildId
                      ? usedCount(data.equips, buildId, item.inventory_id)
                      : maxUsedPerBuild(data.equips, item.inventory_id).max;
                    const rem = buildId
                      ? remaining(item, data.equips, buildId)
                      : item.quantity - used;
                    const icon = effectIconUrl(item.sigil_type_id, item.effect_id);
                    return (
                      <tr key={item.inventory_id}>
                        <td>
                          {icon && <img className="rowicon" src={icon} alt="" loading="lazy" />}
                        </td>
                        <td><TypeChip master={master} typeId={item.sigil_type_id} /></td>
                        <td style={{ maxWidth: 260 }}>{eff?.name_ja ?? item.effect_id}</td>
                        <td><RarityChip master={master} rarity={item.rarity} /></td>
                        <td className="num" style={{ color: "var(--pink)" }}>{item.value_text || "—"}</td>
                        <td className="num" style={{ textAlign: "right" }}>{item.quantity}</td>
                        <td className="num" style={{ textAlign: "right" }}>{used}</td>
                        <td className="num" style={{ textAlign: "right", color: rem > 0 ? "var(--pink)" : "var(--muted)" }}>{rem}</td>
                        <td style={{ maxWidth: 160, fontSize: 11, color: "var(--muted)" }}>{item.note}</td>
                        <td className="actions">
                          <button className="iconbtn" onClick={() => startEdit(item)}>編集</button>
                          <button className="iconbtn danger" onClick={() => setDeleteTarget(item)}>削除</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 統合候補モーダル (docs/03 §5) */}
      {mergeTarget && (
        <Modal
          title="おなじ秘伝がすでにあります"
          onClose={() => setMergeTarget(null)}
          actions={
            <>
              <button
                className="btn ghost"
                onClick={() => {
                  registerNew();
                  setMergeTarget(null);
                }}
              >
                別行として登録
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  dispatch({
                    type: "UPDATE_ITEM",
                    inventoryId: mergeTarget.inventory_id,
                    patch: { quantity: mergeTarget.quantity + form.quantity },
                  });
                  toast("success", `所持数を合算しました (${mergeTarget.quantity} → ${mergeTarget.quantity + form.quantity})`);
                  setForm(initialForm);
                  setMergeTarget(null);
                }}
              >
                所持数を合算する
              </button>
            </>
          }
        >
          <p>
            同じタイプ・効果・等級・数値の所持秘伝が登録済みです(所持数 {mergeTarget.quantity})。
            <br />
            所持数を合算しますか？別行として保持しますか？
          </p>
        </Modal>
      )}

      {/* 削除確認 */}
      {deleteTarget && (
        <Modal
          title="所持秘伝の削除"
          onClose={() => setDeleteTarget(null)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setDeleteTarget(null)}>
                キャンセル
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  dispatch({ type: "DELETE_ITEM", inventoryId: deleteTarget.inventory_id });
                  toast("info", "所持秘伝を削除しました");
                  setDeleteTarget(null);
                }}
              >
                削除する
              </button>
            </>
          }
        >
          <p>
            「{effectOf(master, deleteTarget.effect_id)?.name_ja}」(所持{deleteTarget.quantity})を削除します。
            {maxUsedPerBuild(data.equips, deleteTarget.inventory_id).max > 0 && (
              <>
                <br />
                <strong style={{ color: "var(--r-abyssal-t)" }}>
                  この秘伝は編成で使用中です。削除するとすべての編成から外れます。
                </strong>
              </>
            )}
          </p>
        </Modal>
      )}
    </div>
  );
}
