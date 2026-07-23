// 案A: スキルごと。スキル → 固定4枠 → 装着秘伝 (効果名・等級・数値) を縦に並べる。
import React from "react";
import { master } from "../../state/store";
import type { CompareBuild } from "../../logic/compare";
import { RarityChip } from "../ui";
import { CompareColumnHead } from "./CompareColumnHead";

export function CompareBySkill({ builds }: { builds: CompareBuild[] }) {
  return (
    <div className="cmp-columns">
      {builds.map((b) => {
        // 秘伝対象スキルのみ表示 (対象外は枠が無いので比較に出さない)
        const skills = b.skills.filter((s) => s.eligible);
        return (
          <div className="cmp-col" key={b.build.build_id}>
            <CompareColumnHead b={b} />
            <div className="cmp-col-body">
              {skills.map((s) => (
                <div className="cmp-skill" key={s.skillId}>
                  <div className="cmp-skill-name">
                    <span className="cmp-skill-no">
                      {s.group === "special" ? `特${s.displayNo}` : s.displayNo}
                    </span>
                    {s.name}
                  </div>
                  <div className="cmp-slots">
                    {s.slots.map((slot) => (
                      <div
                        className={`cmp-slot ${slot.effectId ? "" : "empty"}`}
                        key={slot.slotNo}
                      >
                        <span className="cmp-slot-no">{slot.slotNo}</span>
                        {slot.effectId ? (
                          <>
                            {slot.rarity && (
                              <RarityChip master={master} rarity={slot.rarity} />
                            )}
                            <span className="cmp-eff">{slot.effectName}</span>
                            {slot.valueText && (
                              <span className="cmp-val">{slot.valueText}</span>
                            )}
                          </>
                        ) : (
                          <span className="cmp-empty-label">未装着</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {skills.length === 0 && (
                <div className="cmp-col-empty">秘伝対象スキルがありません</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
