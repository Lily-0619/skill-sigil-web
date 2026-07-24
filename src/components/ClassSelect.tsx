// S-01 クラス選択 (docs/03 §3)
import React, { useMemo } from "react";
import type { BuildMode } from "../types";
import { master, useStore } from "../state/store";
import { classButtonUrl } from "../lib/assets";
import { useReveal, staggerDelay } from "../hooks/useReveal";

export default function ClassSelect({
  onSelect,
  mode,
  onModeChange,
}: {
  onSelect: (classId: string) => void;
  // v0.2 #3: 入口モード (My / Free)。クラス選択画面でも切り替えられる。
  mode: BuildMode;
  onModeChange: (mode: BuildMode) => void;
}) {
  const { data } = useStore();
  const head = useReveal<HTMLDivElement>();
  const grid = useReveal<HTMLDivElement>();

  const classes = useMemo(() => {
    return master.classes
      .filter((c) => c.enabled)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, []);

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div>
      <div ref={head.ref} className={`screen-head ${head.cls} rv-blur`}>
        <span className="overline">Select Your Class</span>
        <h2>クラス選択</h2>
        <p className="desc">
          クラスを選ぶと、17スキルの編成編集へすすみます。所持秘伝の登録はいつでも左の「所持秘伝」から。
        </p>
      </div>

      {/* v0.2 #3: My / Free 切り替え */}
      <div
        className="mode-seg"
        role="radiogroup"
        aria-label="編成モード"
        style={{ marginBottom: 22 }}
      >
        <button
          type="button"
          role="radio"
          aria-checked={mode === "my"}
          className={`mode-seg-btn ${mode === "my" ? "active" : ""}`}
          onClick={() => onModeChange("my")}
        >
          <span className="seg-title">My</span>
          <span className="seg-sub">所持秘伝で組む</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === "free"}
          className={`mode-seg-btn ${mode === "free" ? "active" : ""}`}
          onClick={() => onModeChange("free")}
        >
          <span className="seg-title">Free</span>
          <span className="seg-sub">所持数にとらわれず組む</span>
        </button>
      </div>

      <div ref={grid.ref} className="class-grid">
        {classes.map((c, i) => {
          const iconUrl = classButtonUrl(c.code);
          const builds = data.builds.filter(
            (b) => b.class_id === c.class_id && b.mode === mode
          );
          const latest = builds
            .map((b) => b.updated_at)
            .sort()
            .at(-1);
          return (
            <button
              key={c.class_id}
              className={`class-card zoomable ${grid.cls} rv-up`}
              style={staggerDelay(i)}
              onClick={() => onSelect(c.class_id)}
            >
              <span className="icon-frame">
                {iconUrl ? (
                  <img src={iconUrl} alt="" loading="lazy" />
                ) : (
                  <span className="noimg">{c.code}</span>
                )}
              </span>
              <span className="code">{c.code}</span>
              <span className="name">{c.name_ja}</span>
              <span className="meta">
                {builds.length > 0
                  ? `${mode === "free" ? "Free編成" : "編成"} ${builds.length}件 ・ ${latest ? fmtDate(latest) : ""}`
                  : " "}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
