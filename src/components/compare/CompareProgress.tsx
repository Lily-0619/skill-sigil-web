// 達成度: Freeで組んだ理想編成に対して、どれだけ集まったか / 着けられているか。
// 枠を色ブロックで並べ、「入れ替えるだけ」の枠を最も目立たせる。
import React from "react";
import { master } from "../../state/store";
import type { ProgressData, ProgressSlot, SlotState } from "../../logic/progress";
import { pct } from "../../logic/progress";
import { RarityChip } from "../ui";

const STATE_LABEL: Record<SlotState, string> = {
  exact: "理想どおり",
  "value-diff": "効果は一致（格下）",
  swap: "入れ替えるだけ",
  "rarity-short": "別効果で代用",
  missing: "未所持",
};

/** 凡例 (表示順は状態の良い順) */
const LEGEND: SlotState[] = [
  "exact",
  "value-diff",
  "swap",
  "rarity-short",
  "missing",
];

function slotTitle(s: ProgressSlot): string {
  const ideal = `理想: ${s.idealEffectName}(${
    master.rarities.find((r) => r.id === s.idealRarity)?.name ?? s.idealRarity
  })${s.idealValue ? ` ${s.idealValue}` : ""}`;
  const cur = s.actualEffectName
    ? `現在: ${s.actualEffectName}(${
        master.rarities.find((r) => r.id === s.actualRarity)?.name ?? s.actualRarity
      })${s.actualValue ? ` ${s.actualValue}` : ""}`
    : "現在: 未装着";
  return `${ideal}\n${cur}\n${STATE_LABEL[s.state]}（所持 ${s.ownedScore.toFixed(
    2
  )}点 / 装着 ${s.equippedScore.toFixed(2)}点）`;
}

export function CompareProgress({ data }: { data: ProgressData }) {
  if (data.total === 0) {
    return (
      <div className="cmp-empty">
        <span className="en">No Target</span>
        理想編成(Free)にまだ秘伝が入っていません。先にFreeで理想を組んでください。
      </div>
    );
  }

  return (
    <div className="prg-wrap">
      {/* ---- 達成率 (点数式) ---- */}
      <div className="prg-summary">
        <div className="prg-rate">
          <span className="prg-rate-label">所持ベース</span>
          <span className="prg-rate-main">
            {pct(data.ownedScore, data.total)}
            <span className="prg-rate-unit">%</span>
          </span>
          <span className="prg-rate-score">
            {data.ownedScore.toFixed(1)} / {data.total} 点
          </span>
          <span className="prg-rate-count">
            理想どおり {data.owned} 枠
          </span>
          <div className="prg-bar">
            <span
              className="prg-bar-fill exact"
              style={{ width: `${pct(data.ownedScore, data.total)}%` }}
            />
          </div>
        </div>

        <div className="prg-rate">
          <span className="prg-rate-label">装着ベース</span>
          <span className="prg-rate-main">
            {pct(data.equippedScore, data.total)}
            <span className="prg-rate-unit">%</span>
          </span>
          <span className="prg-rate-score">
            {data.equippedScore.toFixed(1)} / {data.total} 点
          </span>
          <span className="prg-rate-count">
            理想どおり {data.equipped} 枠
          </span>
          <div className="prg-bar">
            <span
              className="prg-bar-fill exact"
              style={{ width: `${pct(data.equippedScore, data.total)}%` }}
            />
          </div>
        </div>
      </div>

      <details className="prg-note">
        <summary>点数の付け方</summary>
        <table className="prg-score-table">
          <thead>
            <tr>
              <th>持っている等級</th>
              <th>理想と同じ効果</th>
              <th>違う効果</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>混沌</th>
              <td>1.0（数値が下位なら 0.95）</td>
              <td>0.8</td>
            </tr>
            <tr>
              <th>太古</th>
              <td>0.7（数値は問わない）</td>
              <td>0.6</td>
            </tr>
            <tr>
              <th>深淵</th>
              <td>0.4</td>
              <td>0.3</td>
            </tr>
          </tbody>
        </table>
        <p>1枠の満点は1.0点です。何も無い枠は0点になります。</p>
      </details>

      {/* ---- 入れ替えるだけで増える枠 ---- */}
      {data.swappable > 0 && (
        <div className="prg-callout">
          <span className="prg-callout-num">+{data.swappable}</span>
          持っているのに着けていない枠があります。入れ替えるだけで装着ベースが伸びます。
        </div>
      )}

      {/* ---- 凡例 ---- */}
      <div className="prg-legend">
        {LEGEND.map((s) => (
          <span className="prg-legend-item" key={s}>
            <span className={`prg-chip ${s}`} />
            {STATE_LABEL[s]}
          </span>
        ))}
      </div>

      {/* ---- スキル別 ---- */}
      <div className="prg-skills">
        {data.skills.map((row) => (
          <div className="prg-skill" key={row.skillId}>
            {row.iconUrl && (
              <img
                className="prg-skill-bg"
                src={row.iconUrl}
                alt=""
                aria-hidden="true"
                loading="lazy"
              />
            )}
            <div className="prg-skill-head">
              <span className="prg-skill-no">
                {row.group === "special" ? `特${row.displayNo}` : row.displayNo}
              </span>
              <span className="prg-skill-name">{row.name}</span>
              <span className="prg-skill-count">
                {row.ownedScore.toFixed(1)} / {row.slots.length} 点
              </span>
            </div>
            <div className="prg-slots">
              {row.slots.map((s) => (
                <div
                  className={`prg-slot ${s.state}`}
                  key={s.slotNo}
                  title={slotTitle(s)}
                >
                  <span className="prg-slot-no">{s.slotNo}</span>
                  <span className="prg-slot-eff">{s.idealEffectName}</span>
                  <RarityChip master={master} rarity={s.idealRarity} />
                  {s.idealValue && (
                    <span className="prg-slot-val">{s.idealValue}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ---- 不足リスト ---- */}
      <div className="prg-shortage">
        <div className="prg-shortage-head">
          <span className="overline">Still Needed</span>
          <span className="t">あと必要な秘伝</span>
        </div>
        {data.shortages.length === 0 ? (
          <p className="prg-shortage-done">
            理想編成に必要な秘伝はすべて揃っています。
          </p>
        ) : (
          <ul className="prg-shortage-list">
            {data.shortages.map((s) => (
              <li key={`${s.effectId}#${s.rarity}`}>
                <span className="prg-shortage-name">{s.effectName}</span>
                <RarityChip master={master} rarity={s.rarity} />
                <span className="prg-shortage-need">あと{s.need}個</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
