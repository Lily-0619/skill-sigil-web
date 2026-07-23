// 比較カラムの共通ヘッダー (編成名・クラス・MY/FREE・装着枠数)
import React from "react";
import type { CompareBuild } from "../../logic/compare";

export function CompareColumnHead({ b }: { b: CompareBuild }) {
  return (
    <div className="cmp-col-head">
      <div className="cmp-col-title-row">
        <span className="cmp-col-title">{b.build.name}</span>
        <span className={b.mode === "free" ? "badge-free" : "badge-my"}>
          {b.mode === "free" ? "FREE" : "MY"}
        </span>
      </div>
      <div className="cmp-col-sub">
        {b.cls?.name_ja ?? b.build.class_id} ・ 装着 {b.used}/{b.total}枠
      </div>
    </div>
  );
}
