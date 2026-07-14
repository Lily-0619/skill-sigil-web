// S-01 クラス選択 (docs/03 §3)
import React, { useMemo, useState } from "react";
import { master, useStore } from "../state/store";
import { classButtonUrl } from "../lib/assets";
import { useReveal, staggerDelay } from "../hooks/useReveal";

export default function ClassSelect({
  onSelect,
}: {
  onSelect: (classId: string) => void;
}) {
  const { data } = useStore();
  const [q, setQ] = useState("");
  const head = useReveal<HTMLDivElement>();
  const grid = useReveal<HTMLDivElement>();

  const classes = useMemo(() => {
    const list = master.classes
      .filter((c) => c.enabled)
      .sort((a, b) => a.sort_order - b.sort_order);
    const query = q.trim().toLowerCase();
    if (!query) return list;
    return list.filter(
      (c) =>
        c.name_ja.toLowerCase().includes(query) ||
        c.code.toLowerCase().includes(query)
    );
  }, [q]);

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

      <div style={{ maxWidth: 320, marginBottom: 22 }}>
        <input
          className="input"
          placeholder="クラス名・略称で検索"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="クラス検索"
        />
      </div>

      <div ref={grid.ref} className="class-grid">
        {classes.map((c, i) => {
          const iconUrl = classButtonUrl(c.code);
          const builds = data.builds.filter((b) => b.class_id === c.class_id);
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
                  ? `編成 ${builds.length}件 ・ ${latest ? fmtDate(latest) : ""}`
                  : " "}
              </span>
            </button>
          );
        })}
      </div>

      {classes.length === 0 && (
        <div className="empty-state" style={{ marginTop: 20 }}>
          <span className="en">No Result</span>
          該当するクラスがありません
        </div>
      )}
    </div>
  );
}
