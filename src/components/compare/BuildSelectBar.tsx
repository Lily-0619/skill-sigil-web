// 比較する編成を選ぶバー (編成管理にある全編成をチェックで選択、2〜max件)
import React from "react";
import { master } from "../../state/store";
import type { Build } from "../../types";

export function BuildSelectBar({
  builds,
  selectedIds,
  onToggle,
  max,
}: {
  builds: Build[];
  selectedIds: string[];
  onToggle: (buildId: string) => void;
  max: number;
}) {
  const atMax = selectedIds.length >= max;
  return (
    <div className="cmp-select-bar">
      <div className="cmp-select-head">
        <span className="cmp-select-title">比較する編成を選択</span>
        <span className="cmp-select-note">
          {selectedIds.length} / {max} 件選択中（2件以上で比較）
        </span>
      </div>
      {builds.length === 0 ? (
        <div className="cmp-col-empty">
          編成がありません。「編成管理」から作成してください。
        </div>
      ) : (
        <div className="cmp-select-list">
          {builds.map((b) => {
            const on = selectedIds.includes(b.build_id);
            const disabled = !on && atMax;
            const cls = master.classes.find((c) => c.class_id === b.class_id);
            return (
              <button
                type="button"
                key={b.build_id}
                className={`cmp-select-item ${on ? "on" : ""} ${
                  disabled ? "disabled" : ""
                }`}
                aria-pressed={on}
                disabled={disabled}
                onClick={() => onToggle(b.build_id)}
              >
                <span className="cmp-select-check">{on ? "✓" : ""}</span>
                <span className="cmp-select-name">{b.name}</span>
                <span className={b.mode === "free" ? "badge-free" : "badge-my"}>
                  {b.mode === "free" ? "FREE" : "MY"}
                </span>
                <span className="cmp-select-class">
                  {cls?.name_ja ?? b.class_id}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
