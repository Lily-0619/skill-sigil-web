// 案B: タイプ別サマリー。秘伝タイプ → 効果 → 等級で「何がどれだけ付いているか」を集計。
// 数値は合算せず「値 ×N個」で個数集約 (既存の「つけている秘伝一覧」と同じ)。
import React from "react";
import { master } from "../../state/store";
import type { CompareBuild } from "../../logic/compare";
import { RarityChip } from "../ui";
import { CompareColumnHead } from "./CompareColumnHead";

export function CompareBySummary({ builds }: { builds: CompareBuild[] }) {
  return (
    <div className="cmp-columns">
      {builds.map((b) => (
        <div className="cmp-col" key={b.build.build_id}>
          <CompareColumnHead b={b} />
          <div className="cmp-col-body">
            {b.summary.length === 0 ? (
              <div className="cmp-col-empty">まだ秘伝がついていません</div>
            ) : (
              b.summary.map((g) => (
                <div className="cmp-sum-type" key={g.type.id}>
                  <div className="cmp-sum-type-head">
                    <span
                      className="cmp-dot"
                      style={{ background: g.type.color }}
                    />
                    {g.type.name}
                    <span className="cmp-sum-count">{g.count}</span>
                  </div>
                  {g.effects.map((e) => (
                    <div className="cmp-sum-eff" key={e.effectId}>
                      <div className="cmp-sum-eff-top">
                        <span className="cmp-sum-eff-name">{e.name}</span>
                        <span className="cmp-sum-count">{e.count}</span>
                      </div>
                      <div className="cmp-sum-rarities">
                        {e.rarities.length === 0 ? (
                          <span className="cmp-noval">数値なし</span>
                        ) : (
                          e.rarities.map((r) => (
                            <span className="cmp-sum-rarity" key={r.rarity.id}>
                              <RarityChip master={master} rarity={r.rarity.id} />
                              {r.valuesText && (
                                <span className="cmp-val">{r.valuesText}</span>
                              )}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
