// 案C: グラフ。案Bの集計 (タイプ別・等級別の本数) を自前バーで可視化する。
// 外部ライブラリは使わず div 幅バーで描く。バー長は全編成の最大値で正規化して比較しやすくする。
import React from "react";
import type { CompareBuild, CountBar } from "../../logic/compare";
import { CompareColumnHead } from "./CompareColumnHead";

/** 全編成・両軸を通じた最大件数 (バー正規化の分母)。0除算回避で最低1。 */
function maxCount(builds: CompareBuild[], key: "typeCounts" | "rarityCounts") {
  let m = 1;
  for (const b of builds) for (const bar of b[key]) m = Math.max(m, bar.count);
  return m;
}

function BarRow({ bar, scale }: { bar: CountBar; scale: number }) {
  const pct = Math.round((bar.count / scale) * 100);
  return (
    <div className="cmp-bar-row">
      <span className="cmp-bar-label">{bar.label}</span>
      <span className="cmp-bar-track">
        <span
          className="cmp-bar"
          style={{ width: `${pct}%`, background: bar.color }}
        />
      </span>
      <span className="cmp-bar-count">{bar.count}</span>
    </div>
  );
}

export function CompareChart({ builds }: { builds: CompareBuild[] }) {
  const typeScale = maxCount(builds, "typeCounts");
  const rarityScale = maxCount(builds, "rarityCounts");
  return (
    <div className="cmp-columns">
      {builds.map((b) => (
        <div className="cmp-col" key={b.build.build_id}>
          <CompareColumnHead b={b} />
          <div className="cmp-col-body">
            <div className="cmp-chart-section">
              <div className="cmp-chart-title">秘伝タイプ別の本数</div>
              {b.typeCounts.length === 0 ? (
                <div className="cmp-col-empty">データなし</div>
              ) : (
                b.typeCounts.map((bar) => (
                  <BarRow key={bar.id} bar={bar} scale={typeScale} />
                ))
              )}
            </div>
            <div className="cmp-chart-section">
              <div className="cmp-chart-title">等級別の本数</div>
              {b.rarityCounts.length === 0 ? (
                <div className="cmp-col-empty">データなし</div>
              ) : (
                b.rarityCounts.map((bar) => (
                  <BarRow key={bar.id} bar={bar} scale={rarityScale} />
                ))
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
