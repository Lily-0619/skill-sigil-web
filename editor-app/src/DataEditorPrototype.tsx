import React, { useEffect, useMemo, useState } from "react";
import { master } from "../../src/data/master";
import descriptionsJson from "../../src/data/descriptions.json";
import type { DescriptionsData, SkillDef } from "../../src/types";
import {
  classButtonUrl as manifestClassButtonUrl,
  skillIconUrl as manifestSkillIconUrl,
} from "../../src/lib/assets";
import "./data-editor.css";

const descriptions = descriptionsJson as unknown as DescriptionsData;

// Excelから生成されたマニフェストの相対パスを、既存サイトのpublic直下へ解決する。
// editor-app側への画像コピーや別名画像の生成は行わない。
const assetBase = new URLSearchParams(window.location.search).get("assetBase");
const existingAssetUrl = (relative: string | null) =>
  relative && assetBase ? new URL(relative, assetBase).href : relative;
const classButtonUrl = (code: string) => existingAssetUrl(manifestClassButtonUrl(code));
const skillIconUrl = (classCode: string, skill: SkillDef) =>
  existingAssetUrl(manifestSkillIconUrl(classCode, skill));

const SIGIL_OPTIONS = [
  { id: "guardian", label: "守護" },
  { id: "flawless", label: "無欠" },
  { id: "defined", label: "鮮明" },
  { id: "refined", label: "精巧" },
  { id: "faint", label: "微か" },
  { id: "radiant", label: "煌めき" },
];

type EditableSkill = {
  name: string;
  ct: string;
  hit: string;
  pve: boolean;
  pvp: boolean;
  sa: boolean;
  fg: boolean;
  enhancement: boolean;
  slots: string[];
  description: string;
};

type PassiveDraft = {
  weapon: string;
  uniqueBody: string;
  commonPassive: string;
};

const skillKey = (skill: SkillDef) =>
  `${skill.group === "special" ? "sp" : "n"}_${skill.display_no}`;

function initialSkill(classCode: string, skill: SkillDef): EditableSkill {
  const detail = descriptions.classes[classCode]?.skills[skillKey(skill)];
  const oldSlots = (skill.slots ?? []).filter((slot) => slot !== "branch");
  return {
    name: skill.name_ja,
    ct: detail?.ct ?? "",
    hit: detail?.hit == null ? "" : String(detail.hit),
    pve: detail?.pve ?? false,
    pvp: detail?.pvp ?? false,
    sa: detail?.lines.some((line) => line.includes("スーパーアーマー")) ?? false,
    fg: detail?.lines.some((line) => line.includes("前方ガード")) ?? false,
    enhancement: detail?.lines.some((line) => line.includes("深化")) ?? false,
    slots: Array.from({ length: 3 }, (_, index) => oldSlots[index] ?? ""),
    description: detail?.lines.join("\n") ?? "",
  };
}

function Toggle({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" className={`de-toggle ${active ? "active" : ""}`} onClick={onClick} aria-pressed={active}>
      <span className="de-toggle-dot" />
      {children}
    </button>
  );
}

function ClassPicker({ selected, onSelect }: { selected: string; onSelect: (code: string) => void }) {
  const classes = master.classes.filter((item) => item.enabled);
  return (
    <section className="de-class-picker" aria-label="クラス選択">
      <div className="de-section-label"><span>01</span> CLASS SELECT</div>
      <div className="de-class-strip">
        {classes.map((item) => {
          const icon = classButtonUrl(item.code);
          return (
            <button
              type="button"
              key={item.code}
              className={`de-class-button ${selected === item.code ? "active" : ""}`}
              onClick={() => onSelect(item.code)}
              title={item.name_ja}
            >
              {icon ? <img src={icon} alt="" /> : <span>{item.code}</span>}
              <strong>{item.code}</strong>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PassiveCard({
  index,
  commonOptions,
  value,
  onChange,
}: {
  index: number;
  commonOptions: { name: string; body: string }[];
  value: PassiveDraft;
  onChange: (value: PassiveDraft) => void;
}) {
  return (
    <article className="de-passive-card">
      <div className="de-card-topline">
        <span>WEAPON {String(index + 1).padStart(2, "0")}</span>
        <span className="de-status">編集中</span>
      </div>
      <label className="de-field"><span>武器名</span><input className="de-input de-passive-name" value={value.weapon} onChange={(event) => onChange({ ...value, weapon: event.target.value })} /></label>
      <label className="de-field de-grow">
        <span>固有パッシブ説明</span>
        <textarea className="de-textarea" value={value.uniqueBody} onChange={(event) => onChange({ ...value, uniqueBody: event.target.value })} />
      </label>
      <label className="de-field de-common-picker">
        <span>共通パッシブ <small>⚙で選択肢を編集</small></span>
        <select className="de-select" value={value.commonPassive} onChange={(event) => onChange({ ...value, commonPassive: event.target.value })}>
          <option value="">選択してください</option>
          {commonOptions.map((option) => <option key={option.name} value={option.name}>{option.name}</option>)}
        </select>
      </label>
    </article>
  );
}

export default function DataEditorPrototype() {
  const [classCode, setClassCode] = useState("WR");
  const skills = master.skills[classCode] ?? [];
  const [selectedSkillId, setSelectedSkillId] = useState("WR_sp_1");
  const selectedSkill = skills.find((skill) => skill.skill_id === selectedSkillId) ?? skills[0];
  const [draft, setDraft] = useState<EditableSkill>(() => initialSkill("WR", master.skills.WR[0]));
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [commonPassives, setCommonPassives] = useState([
    {
      name: "守護者の決意",
      body: "2秒間スキル使用中、冒険者から受ける最終ダメージ量40%減少\n再使用待機時間14秒",
    },
    { name: "バトルセンス", body: "説明Bを入力" },
  ]);
  const [passiveDrafts, setPassiveDrafts] = useState<PassiveDraft[]>(() =>
    descriptions.classes.WR.passives.map((passive, index) => ({
      weapon: passive.name,
      uniqueBody: passive.lines.join("\n"),
      commonPassive: index === 0 ? "守護者の決意" : "バトルセンス",
    }))
  );
  const [actionNotice, setActionNotice] = useState("");
  const [updateHistory, setUpdateHistory] = useState(() =>
    localStorage.getItem("skill-sigil-editor:update-history") ?? ""
  );

  const selectedClass = master.classes.find((item) => item.code === classCode);
  const classData = descriptions.classes[classCode];
  const grouped = useMemo(
    () => ({
      special: skills.filter((skill) => skill.group === "special"),
      normal: skills.filter((skill) => skill.group === "normal"),
    }),
    [skills]
  );

  useEffect(() => {
    if (!selectedSkill) return;
    setDraft(initialSkill(classCode, selectedSkill));
    setIconPreview(null);
  }, [classCode, selectedSkill]);

  useEffect(() => {
    setCommonPassives(
      classCode === "WR"
        ? [
            {
              name: "守護者の決意",
              body: "2秒間スキル使用中、冒険者から受ける最終ダメージ量40%減少\n再使用待機時間14秒",
            },
            { name: "バトルセンス", body: "説明Bを入力" },
          ]
        : [
            { name: "共通パッシブ名A", body: "説明Aを入力" },
            { name: "共通パッシブ名B", body: "説明Bを入力" },
          ]
    );
  }, [classCode]);

  useEffect(() => {
    localStorage.setItem("skill-sigil-editor:update-history", updateHistory);
  }, [updateHistory]);

  useEffect(() => {
    const next = descriptions.classes[classCode]?.passives ?? [];
    setPassiveDrafts([0, 1].map((index) => ({
      weapon: next[index]?.name ?? `武器 ${index + 1}`,
      uniqueBody: next[index]?.lines.join("\n") ?? "",
      commonPassive: commonPassives[index]?.name ?? "",
    })));
    // クラス切替時のみ既存値から作り直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classCode]);

  const selectClass = (code: string) => {
    const first = master.skills[code]?.[0];
    setClassCode(code);
    if (first) setSelectedSkillId(first.skill_id);
  };

  const updateSlot = (index: number, value: string) => {
    setDraft((current) => {
      const slots = [...current.slots];
      slots[index] = value;
      return { ...current, slots };
    });
  };

  const updateCommonPassive = (index: number, field: "name" | "body", value: string) => {
    setCommonPassives((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  };

  const existingIcon = selectedSkill ? skillIconUrl(classCode, selectedSkill) : null;

  const saveToSiteData = async () => {
    if (!selectedSkill || !window.skillEditor) {
      setActionNotice("デスクトップアプリから開いた時だけ保存できます");
      return;
    }
    try {
      const result = await window.skillEditor.save({ classCode, skillId: selectedSkill.skill_id, skill: draft, passives: passiveDrafts, commonPassives });
      setActionNotice(result.message ?? "保存しました");
    } catch (error) {
      setActionNotice(`保存できませんでした: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const publishSite = async () => {
    if (!window.skillEditor) return setActionNotice("デスクトップアプリから実行してください");
    try {
      const result = await window.skillEditor.publish();
      if (!result.cancelled) setActionNotice(result.message ?? "公開処理が完了しました");
    } catch (error) {
      setActionNotice(`公開できませんでした: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <main className="de-page">
      <header className="de-header">
        <div>
          <div className="de-kicker">SKILL DATA STUDIO / UI PROTOTYPE</div>
          <h1>スキルデータ編集</h1>
          <p>クラス・スキル・パッシブをひとつの画面で確認しながら編集</p>
        </div>
        <div className="de-header-actions">
          <span className="de-prototype-badge">編集専用デスクトップアプリ</span>
          {window.skillEditor && <button className="de-publish" type="button" onClick={publishSite}>サイトへ公開</button>}
          <button className="de-settings" type="button" onClick={() => setDrawerOpen(true)} aria-label="共通パッシブ設定を開く">
            <span>⚙</span><small>共通パッシブ</small>
          </button>
        </div>
      </header>

      <ClassPicker selected={classCode} onSelect={selectClass} />

      <div className="de-current-class">
        <div className="de-class-emblem">
          {classButtonUrl(classCode) && <img src={classButtonUrl(classCode)!} alt="" />}
        </div>
        <div><span>CURRENT CLASS</span><h2>{selectedClass?.name_ja}<small>{classCode}</small></h2></div>
        <div className="de-change-state"><span />下書き・未保存</div>
      </div>

      <div className="de-workspace">
        <aside className="de-skill-list panel">
          <div className="de-pane-heading"><span>02</span><div><strong>スキル</strong><small>SKILL LIST</small></div></div>
          <div className="de-skill-scroll">
            <div className="de-skill-group-title"><span>ラバムスキル</span><small>{grouped.special.length}</small></div>
            {grouped.special.map((skill) => <SkillButton key={skill.skill_id} skill={skill} classCode={classCode} active={selectedSkill?.skill_id === skill.skill_id} onClick={() => setSelectedSkillId(skill.skill_id)} />)}
            <div className="de-skill-group-title normal"><span>通常スキル</span><small>{grouped.normal.length}</small></div>
            {grouped.normal.map((skill) => <SkillButton key={skill.skill_id} skill={skill} classCode={classCode} active={selectedSkill?.skill_id === skill.skill_id} onClick={() => setSelectedSkillId(skill.skill_id)} />)}
          </div>
        </aside>

        <section className="de-skill-editor panel">
          <div className="de-pane-heading"><span>03</span><div><strong>スキル編集</strong><small>SKILL DETAIL</small></div></div>
          <div className="de-editor-grid">
            <div className="de-icon-column">
              <div className="de-skill-icon-preview">
                {(iconPreview || existingIcon) ? <img src={iconPreview || existingIcon!} alt="選択中のスキルアイコン" /> : <span>NO IMAGE</span>}
                <div className="de-icon-number">{selectedSkill?.group === "special" ? "R" : "N"}-{selectedSkill?.display_no}</div>
              </div>
              <label className="de-upload-button">
                画像を差し替え
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) setIconPreview(URL.createObjectURL(file));
                }} />
              </label>
              <small>PNG / SVG / WEBP</small>
            </div>

            <div className="de-fields">
              <label className="de-field de-name-field"><span>スキル名</span><input className="de-input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
              <div className="de-inline-fields">
                <label className="de-field"><span>CT <small>秒</small></span><input className="de-input de-number" inputMode="decimal" value={draft.ct} onChange={(event) => setDraft({ ...draft, ct: event.target.value })} /></label>
                <label className="de-field"><span>HIT <small>打撃</small></span><input className="de-input de-number" inputMode="numeric" value={draft.hit} onChange={(event) => setDraft({ ...draft, hit: event.target.value })} /></label>
                <div className="de-field"><span>適用モード</span><div className="de-toggles"><Toggle active={draft.pvp} onClick={() => setDraft({ ...draft, pvp: !draft.pvp })}>PvP</Toggle><Toggle active={draft.pve} onClick={() => setDraft({ ...draft, pve: !draft.pve })}>PvE</Toggle></div></div>
              </div>
              <div className="de-field">
                <span>装着可能な秘伝 <small>系列を除く6種類から3つ</small></span>
                <div className="de-sigil-selects">
                  {draft.slots.map((slot, index) => (
                    <label key={index}><b>{index + 1}</b><select className="de-select" value={slot} onChange={(event) => updateSlot(index, event.target.value)}><option value="">選択</option>{SIGIL_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
                  ))}
                </div>
              </div>
              <div className="de-usage-tabs" aria-label="スキル使用時の効果">
                <span>スキル使用時</span>
                <Toggle active={draft.sa} onClick={() => setDraft({ ...draft, sa: !draft.sa })}>SA</Toggle>
                <Toggle active={draft.fg} onClick={() => setDraft({ ...draft, fg: !draft.fg })}>FG</Toggle>
                <Toggle active={draft.enhancement} onClick={() => setDraft({ ...draft, enhancement: !draft.enhancement })}>深化</Toggle>
              </div>
              <label className="de-field de-description"><span>スキル説明 <small>改行・箇条書きもそのまま反映</small></span><textarea className="de-textarea" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
            </div>
          </div>
          <div className="de-editor-footer"><span>保存すると、サイトが参照するJSONデータを直接更新します。</span><button className="de-secondary" type="button" onClick={() => selectedSkill && setDraft(initialSkill(classCode, selectedSkill))}>変更を戻す</button><button className="de-primary" type="button">変更を確認</button></div>
        </section>

        <section className="de-passives panel">
          <div className="de-pane-heading"><span>04</span><div><strong>パッシブ</strong><small>PASSIVE SETTINGS</small></div></div>
          <div className="de-passive-stack">{passiveDrafts.map((passive, index) => <PassiveCard key={index} index={index} value={passive} commonOptions={commonPassives} onChange={(value) => setPassiveDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))} />)}</div>
        </section>
      </div>

      <section className="de-update-history panel">
        <div className="de-pane-heading"><span>05</span><div><strong>更新履歴</strong><small>LOCAL UPDATE LOG</small></div></div>
        <div className="de-update-history-body">
          <label className="de-field">
            <span>アプデ実績 <small>この端末の編集アプリ内だけに保存・サイトへは送信しません</small></span>
            <textarea
              className="de-textarea"
              value={updateHistory}
              onChange={(event) => setUpdateHistory(event.target.value)}
              placeholder={"例：2026/09/25　系列秘伝の廃止対応\n2026/10/01　WRスキル説明を更新"}
            />
          </label>
          <span className="de-local-only">LOCAL ONLY / 自動保存</span>
        </div>
      </section>

      <div className={`de-drawer-shade ${drawerOpen ? "open" : ""}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`de-drawer ${drawerOpen ? "open" : ""}`} aria-hidden={!drawerOpen}>
        <div className="de-drawer-header"><div><span>COMMON PASSIVE LIBRARY</span><h2>共通パッシブ編集</h2></div><button type="button" onClick={() => setDrawerOpen(false)}>×</button></div>
        <p className="de-drawer-lead">ここでは、武器欄のプルダウンに表示する共通パッシブを管理します。名前や説明を直すと、同じ共通パッシブを選んでいる武器へまとめて反映されます。</p>
        <div className="de-common-passive-list">
          {commonPassives.map((passive, index) => (
            <article className="de-common-passive-card" key={index}>
              <div className="de-common-card-head">
                <span>COMMON PASSIVE {String(index + 1).padStart(2, "0")}</span>
                <strong>選択肢 {index + 1}</strong>
              </div>
              <label className="de-field">
                <span>共通パッシブ名</span>
                <input className="de-input" value={passive.name} onChange={(event) => updateCommonPassive(index, "name", event.target.value)} />
              </label>
              <label className="de-field de-common-body">
                <span>共通パッシブ説明</span>
                <textarea className="de-textarea" value={passive.body} onChange={(event) => updateCommonPassive(index, "body", event.target.value)} />
              </label>
            </article>
          ))}
          <button type="button" className="de-add-common" onClick={() => setCommonPassives((current) => [...current, { name: `共通パッシブ${current.length + 1}`, body: "" }])}>＋ 共通パッシブを追加</button>
        </div>
        <div className="de-drawer-actions"><button className="de-secondary" type="button" onClick={() => setDrawerOpen(false)}>閉じる</button><button className="de-primary" type="button">変更を確認</button></div>
      </aside>

      <nav className="de-bottom-actions" aria-label="データ操作">
        <button type="button" className="de-bottom-save" onClick={saveToSiteData}><span>✓</span><div><small>SAVE DATA</small><strong>保存</strong></div></button>
      </nav>
      {actionNotice && <button type="button" className="de-action-notice" onClick={() => setActionNotice("")}>{actionNotice}<span>×</span></button>}
    </main>
  );
}

function SkillButton({ skill, classCode, active, onClick }: { skill: SkillDef; classCode: string; active: boolean; onClick: () => void }) {
  const icon = skillIconUrl(classCode, skill);
  return (
    <button type="button" className={`de-skill-button ${active ? "active" : ""}`} onClick={onClick}>
      <span className="de-skill-thumb">{icon ? <img src={icon} alt="" /> : <span>{skill.display_no}</span>}</span>
      <span className="de-skill-copy"><small>{skill.group === "special" ? "RABAM" : `SKILL ${String(skill.display_no).padStart(2, "0")}`}</small><strong>{skill.name_ja}</strong></span>
      <span className="de-chevron">›</span>
    </button>
  );
}
