// S-04 編成管理 (docs/03 §6 / v0.2 #7): 全クラス一括管理・作成 / 複製 / 名前変更 / 削除
import React, { useState } from "react";
import { master, newBuild, useStore } from "../state/store";
import type { Build, BuildMode } from "../types";
import { buildEquipStats } from "../logic/equip";
import { classButtonUrl } from "../lib/assets";
import { Modal, EmptyState } from "./ui";
import { useReveal, staggerDelay } from "../hooks/useReveal";

export default function Builds({ onOpen }: { onOpen: () => void }) {
  const { data, dispatch, toast } = useStore();
  // v0.2 #7: クラス横断の一括表示 (最終更新の降順)
  const builds = data.builds
    .slice()
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  const enabledClasses = master.classes
    .filter((c) => c.enabled)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);

  const [renameTarget, setRenameTarget] = useState<Build | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Build | null>(null);
  // v0.2 #7: 新規作成はクラス選択ドロップダウン付きモーダル (#3: My/Free選択つき)
  const [createOpen, setCreateOpen] = useState(false);
  const [createClassId, setCreateClassId] = useState(
    data.meta.selected_class_id ?? enabledClasses[0]?.class_id ?? ""
  );
  const [createMode, setCreateMode] = useState<BuildMode>("my");
  const grid = useReveal<HTMLDivElement>();

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(
      d.getHours()
    ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const countOf = (classId: string, mode: BuildMode = "my") =>
    data.builds.filter((b) => b.class_id === classId && b.mode === mode).length;

  const doCreate = () => {
    if (!createClassId) return;
    const prefix = createMode === "free" ? "Free編成" : "編成";
    const build = newBuild(
      createClassId,
      `${prefix} ${countOf(createClassId, createMode) + 1}`,
      createMode
    );
    dispatch({ type: "CREATE_BUILD", build });
    // 作成した編成を選択状態に (クラスも同時に切替 → 背景も追従)
    dispatch({ type: "OPEN_BUILD", buildId: build.build_id });
    setCreateOpen(false);
    toast("success", "新しい編成を作成しました");
  };

  return (
    <div>
      <div className="screen-head">
        <span className="overline">Build Manager</span>
        <h2>編成管理</h2>
      </div>

      <div style={{ marginBottom: 20 }}>
        <button className="btn" onClick={() => setCreateOpen(true)}>
          ＋ 新規編成
        </button>
      </div>

      {builds.length === 0 ? (
        <EmptyState en="No Builds">
          まだ編成がありません。「＋ 新規編成」から作成してください。
        </EmptyState>
      ) : (
        <div ref={grid.ref} className="build-cards">
          {builds.map((b, i) => {
            const bcls = master.classes.find((c) => c.class_id === b.class_id);
            // v0.2 #3: Free編成は freeEquips から集計
            const stats = buildEquipStats(
              master,
              b.class_id,
              b.mode === "free" ? data.freeEquips : data.equips,
              b.build_id
            );
            const active = b.build_id === data.meta.selected_build_id;
            const icon = bcls ? classButtonUrl(bcls.code) : null;
            return (
              <div
                key={b.build_id}
                className={`build-card panel ${grid.cls} rv-up`}
                style={{
                  ...staggerDelay(i),
                  borderColor: active ? "var(--pink)" : undefined,
                  cursor: "pointer",
                }}
                // v0.2 #7: カード選択で編成+クラスを選択 (背景もそのクラスへ切替)
                onClick={() => dispatch({ type: "OPEN_BUILD", buildId: b.build_id })}
                role="button"
                aria-pressed={active}
              >
                <div className="bname">
                  <span>{b.name}</span>
                  <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {/* v0.2 #3: My/Freeバッジ */}
                    <span className={b.mode === "free" ? "badge-free" : "badge-my"}>
                      {b.mode === "free" ? "FREE" : "MY"}
                    </span>
                    {active && (
                      <span className="chip" style={{ color: "var(--pink)", borderColor: "var(--line-strong)" }}>
                        編集中
                      </span>
                    )}
                  </span>
                </div>
                <div className="bclass">
                  {icon && <img src={icon} alt="" />}
                  <span className="code">{bcls?.code ?? b.class_id}</span>
                  <span className="cname">{bcls?.name_ja ?? ""}</span>
                </div>
                <div className="bmeta">
                  <span>装着 {stats.used} / {stats.total} 枠 (未装着 {stats.total - stats.used})</span>
                  <span>最終更新 {fmt(b.updated_at)}</span>
                </div>
                <div className="bactions">
                  <button
                    className="btn small primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({ type: "OPEN_BUILD", buildId: b.build_id });
                      onOpen();
                    }}
                  >
                    ひらく
                  </button>
                  <button
                    className="btn small ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({
                        type: "DUP_BUILD",
                        sourceId: b.build_id,
                        build: newBuild(b.class_id, `${b.name} の複製`, b.mode),
                      });
                      toast("success", "編成を複製しました");
                    }}
                  >
                    複製
                  </button>
                  <button
                    className="btn small ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenameTarget(b);
                      setRenameValue(b.name);
                    }}
                  >
                    名前変更
                  </button>
                  <button
                    className="btn small danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(b);
                    }}
                  >
                    削除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {createOpen && (
        <Modal
          title="新規編成の作成"
          onClose={() => setCreateOpen(false)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setCreateOpen(false)}>
                キャンセル
              </button>
              <button className="btn primary" disabled={!createClassId} onClick={doCreate}>
                作成する
              </button>
            </>
          }
        >
          <p style={{ marginBottom: 10 }}>編成を作成するクラスを選択してください。</p>
          <select
            className="select"
            value={createClassId}
            onChange={(e) => setCreateClassId(e.target.value)}
            aria-label="クラスを選択"
            autoFocus
          >
            {enabledClasses.map((c) => (
              <option key={c.class_id} value={c.class_id}>
                {c.code} — {c.name_ja}
              </option>
            ))}
          </select>
          {/* v0.2 #3: My/Free選択 */}
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 12 }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
              <input
                type="radio"
                checked={createMode === "my"}
                onChange={() => setCreateMode("my")}
                style={{ accentColor: "var(--pink)" }}
              />
              My (所持秘伝で組む)
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
              <input
                type="radio"
                checked={createMode === "free"}
                onChange={() => setCreateMode("free")}
                style={{ accentColor: "var(--pink)" }}
              />
              Free (理想編成を組む)
            </label>
          </div>
        </Modal>
      )}

      {renameTarget && (
        <Modal
          title="編成名の変更"
          onClose={() => setRenameTarget(null)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setRenameTarget(null)}>
                キャンセル
              </button>
              <button
                className="btn primary"
                disabled={!renameValue.trim()}
                onClick={() => {
                  dispatch({
                    type: "RENAME_BUILD",
                    buildId: renameTarget.build_id,
                    name: renameValue.trim(),
                  });
                  setRenameTarget(null);
                }}
              >
                変更する
              </button>
            </>
          }
        >
          <input
            className="input"
            value={renameValue}
            autoFocus
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameValue.trim()) {
                dispatch({
                  type: "RENAME_BUILD",
                  buildId: renameTarget.build_id,
                  name: renameValue.trim(),
                });
                setRenameTarget(null);
              }
            }}
          />
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="編成の削除"
          onClose={() => setDeleteTarget(null)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setDeleteTarget(null)}>
                キャンセル
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  // 選択中クラスの最後の1編成を削除する場合は空の初期編成を作る (docs/03 §6)
                  const isLastOfSelected =
                    deleteTarget.class_id === data.meta.selected_class_id &&
                    countOf(deleteTarget.class_id, deleteTarget.mode) === 1 &&
                    deleteTarget.mode === "my";
                  dispatch({
                    type: "DELETE_BUILD",
                    buildId: deleteTarget.build_id,
                    replacement: isLastOfSelected
                      ? newBuild(deleteTarget.class_id, "編成 1")
                      : undefined,
                  });
                  toast("info", "編成を削除しました");
                  setDeleteTarget(null);
                }}
              >
                削除する
              </button>
            </>
          }
        >
          <p>
            編成「{deleteTarget.name}」を削除します。装着状況も削除されます。
            {deleteTarget.class_id === data.meta.selected_class_id &&
              deleteTarget.mode === "my" &&
              countOf(deleteTarget.class_id, "my") === 1 && (
                <>
                  <br />
                  選択中クラスの最後の編成のため、削除後に空の初期編成を作成します。
                </>
              )}
          </p>
        </Modal>
      )}
    </div>
  );
}
