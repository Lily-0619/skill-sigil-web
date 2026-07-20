import type { ClassDescriptions, SkillDesc } from "../../types";

/** PvE/PvP チップ。カラーはまな指定 (PvP=#eca6b7 / PvE=#a6d7ec、global.css) */
export function PvChips({ pve, pvp }: { pve: boolean; pvp: boolean }) {
  return (
    <>
      {pve && <span className="pv-chip pve">PvE</span>}
      {pvp && <span className="pv-chip pvp">PvP</span>}
    </>
  );
}

/** 説明本文。改行・字下げ・「・」・効果の順番は原文のまま 1行=1div で表示する */
export function DescLines({ lines }: { lines: string[] }) {
  return (
    <div className="desc-lines">
      {lines.map((ln, i) => (
        <div className="dline" key={i}>
          {ln}
        </div>
      ))}
    </div>
  );
}

export function PassiveSummary({
  desc,
  weaponIdx,
  onWeaponChange,
}: {
  desc: ClassDescriptions | null;
  weaponIdx: number;
  onWeaponChange: (idx: number) => void;
}) {
  return (
    <div className="panel skill-desc-panel rv rv-fade in">
      <div className="skill-desc-panel-head">
        <span className="overline">Passive</span>
        <span className="t">パッシブ</span>
        {desc && (
          <div className="weapon-tabs">
            {desc.passives.map((p, i) => (
              <button
                key={i}
                type="button"
                className={`weapon-tab ${weaponIdx === i ? "on" : ""}`}
                onClick={() => onWeaponChange(i)}
              >
                {p.name || `武器種${i + 1}`}
              </button>
            ))}
          </div>
        )}
      </div>
      {desc ? (
        <>
          <DescLines lines={desc.passives[weaponIdx]?.lines ?? []} />
          {desc.rage && (
            <div className="rage-block">
              <div className="rage-title">
                {desc.rage.name}
                <PvChips pve={desc.rage.pve} pvp={desc.rage.pvp} />
              </div>
              <DescLines
                lines={[
                  ...desc.rage.common,
                  ...(desc.rage.weapon[weaponIdx] ?? []),
                ]}
              />
            </div>
          )}
        </>
      ) : (
        <p className="skill-desc-panel-body">準備中</p>
      )}
    </div>
  );
}

export function SkillDescriptionPanel({
  skillName,
  desc,
}: {
  skillName: string;
  desc: SkillDesc | null;
}) {
  return (
    <div className="panel skill-desc-panel rv rv-fade in">
      <div className="skill-desc-panel-head">
        <span className="overline">Skill Description</span>
        <span className="t">スキル説明</span>
        {desc && (
          <span className="desc-tags" aria-label={`${skillName} の対応コンテンツ`}>
            {desc.rabam && <span className="pv-chip rabam">ラバム技術</span>}
            <PvChips pve={desc.pve} pvp={desc.pvp} />
          </span>
        )}
      </div>
      {desc ? (
        <DescLines lines={desc.lines} />
      ) : (
        <p className="skill-desc-panel-body">準備中</p>
      )}
    </div>
  );
}
