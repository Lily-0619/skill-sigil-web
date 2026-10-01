import React, { useEffect, useMemo, useState } from "react";
import { master } from "../../src/data/master";
import descriptionsJson from "../../src/data/descriptions.json";
import type { DescriptionsData, SkillDef } from "../../src/types";
import {
  classButtonUrl as manifestClassButtonUrl,
  manifestData,
  skillIconUrl as manifestSkillIconUrl,
} from "../../src/lib/assets";
import "./data-editor.css";

const descriptions = descriptionsJson as unknown as DescriptionsData;
const UPDATE_HISTORY_STORAGE_PREFIX = "skill-sigil-editor:update-history:";
const LEGACY_UPDATE_HISTORY_STORAGE_KEY = "skill-sigil-editor:update-history";

function loadLegacyUpdateHistories() {
  const histories = Object.fromEntries(
    master.classes.map((item) => [
      item.code,
      localStorage.getItem(`${UPDATE_HISTORY_STORAGE_PREFIX}${item.code}`) ?? "",
    ])
  ) as Record<string, string>;

  const legacyHistory = localStorage.getItem(LEGACY_UPDATE_HISTORY_STORAGE_KEY) ?? "";
  if (legacyHistory && !Object.values(histories).some(Boolean)) {
    histories.WR = legacyHistory;
  }

  return histories;
}

// Excelから生成されたマニフェストの相対パスを、既存サイトのpublic直下へ解決する。
// editor-app側への画像コピーや別名画像の生成は行わない。
const assetBase = new URLSearchParams(window.location.search).get("assetBase");
const existingAssetUrl = (relative: string | null) =>
  relative && assetBase ? new URL(relative, assetBase).href : relative;
const classButtonUrl = (code: string) => existingAssetUrl(manifestClassButtonUrl(code));
const SIGIL_OPTIONS = [
  { id: "guardian", label: "守護" },
  { id: "flawless", label: "無欠" },
  { id: "defined", label: "鮮明" },
  { id: "refined", label: "整った" },
  { id: "faint", label: "微か" },
  { id: "radiant", label: "煌めき" },
];

type EditableSkill = {
  name: string;
  group: "special" | "normal";
  displayNo: string;
  stack: string;
  ct: string;
  hit: string;
  ia: boolean;
  pve: boolean;
  pvp: boolean;
  sa: boolean;
  fg: boolean;
  enhancement: boolean;
  slots: string[];
  description: string;
  privateNote: string;
};

type SkillFlags = {
  ia?: boolean;
  sa?: boolean;
  fg?: boolean;
  enhancement?: boolean;
};

type PassiveDraft = {
  weapon: string;
  weaponKo: string;
  weaponEn: string;
  uniqueBody: string;
  commonPassive: string;
};

type EditorMetadata = {
  skill_icon_paths?: Record<string, string>;
  common_passives?: { name: string; body: string }[];
  excel_skill_stacks?: Record<string, string>;
  excel_skill_names?: Record<string, { ko: string; en: string }>;
  classes?: Record<string, {
    common_passives?: { name: string; body: string }[];
    passive_assignments?: Array<{
      weapon?: string;
      weapon_ko?: string;
      weapon_en?: string;
      common_passive?: string;
      unique_body?: string;
    }>;
    skill_flags?: Record<string, SkillFlags>;
    skill_notes?: Record<string, string>;
    update_history?: string;
  }>;
};

const SIGIL_LABELS: Record<string, string> = {
  guardian: "守護", flawless: "無欠", defined: "鮮明",
  refined: "整った", faint: "微か", radiant: "煌めき",
};

const bodyLines = (value: string) => value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
const comparableLine = (value: string) => value.replace(/[・ㆍ\s、，,。()（）]/g, "").toLowerCase();

function inferSharedPassive(passives: PassiveDraft[]) {
  if (passives.length !== 2) return null;
  const left = bodyLines(passives[0].uniqueBody);
  const right = bodyLines(passives[1].uniqueBody);
  let count = 0;
  while (
    count < left.length && count < right.length &&
    comparableLine(left[left.length - 1 - count]) === comparableLine(right[right.length - 1 - count])
  ) count += 1;
  if (count < 3) return null;
  const shared = left.slice(left.length - count);
  const nameIndex = shared.findIndex((line) => {
    const cleaned = line.replace(/^[・ㆍ\s]+/, "").trim();
    return cleaned.length > 0 && cleaned.length <= 12 && !/[0-9%]/.test(cleaned);
  });
  if (nameIndex < 0) return null;
  return {
    name: shared[nameIndex].replace(/^[・ㆍ\s]+/, "").trim(),
    lines: shared.filter((_, index) => index !== nameIndex),
    unique: [left.slice(0, left.length - count), right.slice(0, right.length - count)],
  };
}

const skillKey = (skill: SkillDef) =>
  `${skill.group === "special" ? "sp" : "n"}_${skill.display_no}`;

function initialSkill(
  classCode: string,
  skill: SkillDef,
  excelStack?: string,
  savedFlags?: SkillFlags,
  privateNote = ""
): EditableSkill {
  const detail = descriptions.classes[classCode]?.skills[skillKey(skill)];
  const oldSlots = (skill.slots ?? []).filter((slot) => slot !== "branch");
  return {
    name: skill.name_ja,
    group: skill.group,
    displayNo: String(skill.display_no),
    stack: excelStack ?? (detail?.stack == null ? "" : String(detail.stack)),
    ct: detail?.ct ?? "",
    hit: detail?.hit == null ? "" : String(detail.hit),
    ia: savedFlags?.ia ?? detail?.lines.some((line) => line.includes("即時発動")) ?? false,
    pve: detail?.pve ?? false,
    pvp: detail?.pvp ?? false,
    sa: savedFlags?.sa ?? detail?.lines.some((line) => line.includes("スーパーアーマー")) ?? false,
    fg: savedFlags?.fg ?? detail?.lines.some((line) => line.includes("前方ガード")) ?? false,
    enhancement: savedFlags?.enhancement ?? detail?.lines.some((line) => line.includes("深化")) ?? false,
    slots: Array.from({ length: 3 }, (_, index) => oldSlots[index] ?? ""),
    description: detail?.lines.join("\n") ?? "",
    privateNote,
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
      <label className="de-field"><span>武器名（日本語）</span><input className="de-input de-passive-name" value={value.weapon} onChange={(event) => onChange({ ...value, weapon: event.target.value })} /></label>
      <div className="de-weapon-local-names">
        <label className="de-field"><span>武器名（韓国語） <small>Excelから自動取得・サイト非公開</small></span><input className="de-input" value={value.weaponKo} onChange={(event) => onChange({ ...value, weaponKo: event.target.value })} /></label>
        <label className="de-field"><span>武器名（英語） <small>Excelから自動取得・サイト非公開</small></span><input className="de-input" value={value.weaponEn} onChange={(event) => onChange({ ...value, weaponEn: event.target.value })} /></label>
      </div>
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
  const [iconSourcePath, setIconSourcePath] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [commonPassives, setCommonPassives] = useState<Array<{ name: string; body: string }>>([]);
  const [passiveDrafts, setPassiveDrafts] = useState<PassiveDraft[]>(() =>
    descriptions.classes.WR.passives.map((passive) => ({
      weapon: passive.name,
      weaponKo: "",
      weaponEn: "",
      uniqueBody: passive.lines.join("\n"),
      commonPassive: "",
    }))
  );
  const [editorMetadata, setEditorMetadata] = useState<EditorMetadata>({});
  const [savedSkillDrafts, setSavedSkillDrafts] = useState<Record<string, EditableSkill>>({});
  const [dataRevision, setDataRevision] = useState(0);
  const [actionNotice, setActionNotice] = useState("");
  const [updateHistories, setUpdateHistories] = useState<Record<string, string>>(loadLegacyUpdateHistories);
  const updateHistory = updateHistories[classCode] ?? "";

  const selectedClass = master.classes.find((item) => item.code === classCode);
  const grouped = useMemo(
    () => ({
      special: skills.filter((skill) => skill.group === "special"),
      normal: skills.filter((skill) => skill.group === "normal"),
    }),
    [skills, dataRevision]
  );

  useEffect(() => {
    if (!selectedSkill) return;
    setDraft(savedSkillDrafts[selectedSkill.skill_id] ?? initialSkill(
      classCode,
      selectedSkill,
      editorMetadata.excel_skill_stacks?.[selectedSkill.skill_id],
      editorMetadata.classes?.[classCode]?.skill_flags?.[selectedSkill.skill_id],
      editorMetadata.classes?.[classCode]?.skill_notes?.[selectedSkill.skill_id] ?? ""
    ));
    setIconPreview(null);
    setIconSourcePath("");
  }, [classCode, selectedSkill, editorMetadata, savedSkillDrafts]);

  useEffect(() => {
    window.skillEditor?.loadMetadata().then((metadata) => {
      setEditorMetadata(metadata);
      setUpdateHistories((localHistories) => {
        const merged = Object.fromEntries(master.classes.map((item) => [
          item.code,
          metadata.classes?.[item.code]?.update_history ?? localHistories[item.code] ?? "",
        ])) as Record<string, string>;
        window.skillEditor?.saveUpdateHistories(merged).catch(() => undefined);
        return merged;
      });
    }).catch(() => setEditorMetadata({}));
  }, []);

  useEffect(() => {
    setCommonPassives(editorMetadata.common_passives ?? []);
  }, [editorMetadata.common_passives]);

  useEffect(() => {
    const next = descriptions.classes[classCode]?.passives ?? [];
    const assignments = editorMetadata.classes?.[classCode]?.passive_assignments ?? [];
    setPassiveDrafts([0, 1].map((index) => ({
      weapon: next[index]?.name ?? `武器 ${index + 1}`,
      weaponKo: assignments[index]?.weapon_ko ?? "",
      weaponEn: assignments[index]?.weapon_en ?? "",
      uniqueBody: assignments[index]?.unique_body ?? next[index]?.lines.join("\n") ?? "",
      commonPassive: assignments[index]?.common_passive ?? "",
    })));
    // クラス切替時のみ既存値から作り直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classCode, editorMetadata.classes]);

  const selectClass = (code: string) => {
    window.skillEditor?.saveUpdateHistories(updateHistories).catch(() => undefined);
    const first = master.skills[code]?.[0];
    setClassCode(code);
    if (first) setSelectedSkillId(first.skill_id);
  };

  const editorSkillIconUrl = (code: string, skill: SkillDef) => {
    const resolved = existingAssetUrl(editorMetadata.skill_icon_paths?.[skill.skill_id] ?? manifestSkillIconUrl(code, skill));
    if (!resolved || dataRevision === 0) return resolved;
    const refreshed = new URL(resolved, window.location.href);
    refreshed.searchParams.set("revision", String(dataRevision));
    return refreshed.href;
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

  const existingIcon = selectedSkill ? editorSkillIconUrl(classCode, selectedSkill) : null;
  const savedSelectedDraft = selectedSkill
    ? savedSkillDrafts[selectedSkill.skill_id] ?? initialSkill(
        classCode,
        selectedSkill,
        editorMetadata.excel_skill_stacks?.[selectedSkill.skill_id],
        editorMetadata.classes?.[classCode]?.skill_flags?.[selectedSkill.skill_id],
        editorMetadata.classes?.[classCode]?.skill_notes?.[selectedSkill.skill_id] ?? ""
      )
    : null;
  const hasUnconfirmedSkillChanges = Boolean(savedSelectedDraft && JSON.stringify(draft) !== JSON.stringify(savedSelectedDraft));

  const saveToSiteData = async () => {
    if (!selectedSkill || !window.skillEditor) {
      setActionNotice("デスクトップアプリから開いた時だけ保存できます");
      return;
    }
    try {
      const oldGroup = selectedSkill.group;
      const oldNo = selectedSkill.display_no;
      const newGroup = draft.group;
      const newNo = Number(draft.displayNo);
      const counterpart = skills.find((item) =>
        item.skill_id !== selectedSkill.skill_id && item.group === newGroup && item.display_no === newNo
      );
      const result = await window.skillEditor.save({ classCode, skillId: selectedSkill.skill_id, skill: { ...draft, iconPath: iconSourcePath || undefined }, passives: passiveDrafts, commonPassives });
      if (oldGroup !== newGroup || oldNo !== newNo) {
        const descriptionSkills = descriptions.classes[classCode]?.skills;
        const oldKey = `${oldGroup === "special" ? "sp" : "n"}_${oldNo}`;
        const newKey = `${newGroup === "special" ? "sp" : "n"}_${newNo}`;
        const selectedDescription = descriptionSkills?.[oldKey];
        const counterpartDescription = descriptionSkills?.[newKey];
        if (descriptionSkills && selectedDescription) {
          descriptionSkills[newKey] = selectedDescription;
          if (counterpart && counterpartDescription) descriptionSkills[oldKey] = counterpartDescription;
          else delete descriptionSkills[oldKey];
        }
        if (counterpart) {
          counterpart.group = oldGroup;
          counterpart.display_no = oldNo;
        }
        selectedSkill.group = newGroup;
        selectedSkill.display_no = newNo;
        const normalizeName = (value: string) => value.replace(/[_\s　]/g, "");
        const imageEntries = manifestData.skills[classCode] ?? [];
        imageEntries.filter((entry) => normalizeName(entry.name) === normalizeName(selectedSkill.name_ja)).forEach((entry) => {
          entry.special = newGroup === "special";
          entry.no = newNo;
        });
        if (counterpart) imageEntries.filter((entry) => normalizeName(entry.name) === normalizeName(counterpart.name_ja)).forEach((entry) => {
          entry.special = oldGroup === "special";
          entry.no = oldNo;
        });
      }
      selectedSkill.name_ja = draft.name.trim();
      selectedSkill.slots = [...draft.slots];
      skills.sort((left, right) => left.group === right.group
        ? left.display_no - right.display_no
        : left.group === "special" ? -1 : 1);
      setDataRevision((current) => current + 1);
      setSavedSkillDrafts((current) => ({ ...current, [selectedSkill.skill_id]: { ...draft, slots: [...draft.slots] } }));
      setEditorMetadata((current) => ({
        ...current,
        common_passives: commonPassives,
        skill_icon_paths: result.iconPath
          ? { ...(current.skill_icon_paths ?? {}), [selectedSkill.skill_id]: result.iconPath }
          : current.skill_icon_paths,
        classes: {
          ...(current.classes ?? {}),
          [classCode]: {
            ...(current.classes?.[classCode] ?? {}),
            skill_flags: {
              ...(current.classes?.[classCode]?.skill_flags ?? {}),
              [selectedSkill.skill_id]: {
                ia: draft.ia,
                sa: draft.sa,
                fg: draft.fg,
                enhancement: draft.enhancement,
              },
            },
            skill_notes: {
              ...(current.classes?.[classCode]?.skill_notes ?? {}),
              [selectedSkill.skill_id]: draft.privateNote,
            },
          },
        },
      }));
      setIconSourcePath("");
      setActionNotice(result.message ?? "保存しました");
    } catch (error) {
      setActionNotice(`保存できませんでした: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const saveClassData = async () => {
    if (!window.skillEditor) return setActionNotice("デスクトップアプリから開いた時だけ保存できます");
    if (hasUnconfirmedSkillChanges) {
      setActionNotice("選択中のスキルに未保存の変更があります。先に「変更を確認」を押してください");
      return;
    }
    try {
      const result = await window.skillEditor.saveClass({ classCode, passives: passiveDrafts, commonPassives });
      const classDescription = descriptions.classes[classCode];
      if (classDescription) classDescription.passives = passiveDrafts.map((item) => {
        const common = commonPassives.find((candidate) => candidate.name === item.commonPassive);
        return {
          name: item.weapon.trim(),
          lines: [
            ...bodyLines(item.uniqueBody),
            ...(common ? [common.name, ...bodyLines(common.body)] : []),
          ],
        };
      });
      setEditorMetadata((current) => ({
        ...current,
        common_passives: commonPassives,
        classes: {
          ...(current.classes ?? {}),
          [classCode]: {
            ...(current.classes?.[classCode] ?? {}),
            passive_assignments: passiveDrafts.map((item) => ({
              weapon: item.weapon,
              weapon_ko: item.weaponKo,
              weapon_en: item.weaponEn,
              common_passive: item.commonPassive,
              unique_body: item.uniqueBody,
            })),
          },
        },
      }));
      setActionNotice(result.message ?? `${classCode}クラスを保存しました`);
    } catch (error) {
      setActionNotice(`クラスを保存できませんでした: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const saveCommonPassiveLibrary = async () => {
    if (!window.skillEditor) return setActionNotice("デスクトップアプリから開いた時だけ保存できます");
    try {
      const result = await window.skillEditor.saveCommonPassives(commonPassives);
      setCommonPassives(result.commonPassives);
      setEditorMetadata((current) => ({ ...current, common_passives: result.commonPassives }));
      setDrawerOpen(false);
      setActionNotice(result.message ?? "共通パッシブを保存しました");
    } catch (error) {
      setActionNotice(`共通パッシブを保存できませんでした: ${error instanceof Error ? error.message : String(error)}`);
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

  const buildImageData = () => {
    const inferred = inferSharedPassive(passiveDrafts);
    const weapons = passiveDrafts.map((passive, index) => {
      const common = inferred
        ? { name: inferred.name, lines: inferred.lines }
        : (() => {
            const found = commonPassives.find((item) => item.name === passive.commonPassive);
            return found ? { name: found.name, lines: bodyLines(found.body) } : null;
          })();
      return {
        name: passive.weapon,
        nameEn: passive.weaponEn,
        passives: [
          { name: passive.weapon, lines: inferred ? inferred.unique[index] : bodyLines(passive.uniqueBody) },
          ...(common ? [common] : []),
        ],
      };
    });
    const imageSkills = skills.map((skill) => {
      const value = selectedSkill?.skill_id === skill.skill_id
        ? draft
        : initialSkill(
            classCode,
            skill,
            editorMetadata.excel_skill_stacks?.[skill.skill_id],
            editorMetadata.classes?.[classCode]?.skill_flags?.[skill.skill_id]
          );
      const savedFlags = editorMetadata.classes?.[classCode]?.skill_flags?.[skill.skill_id];
      const usage = [
        savedFlags?.sa ?? value.sa ? "SA" : "",
        savedFlags?.fg ?? value.fg ? "FG" : "",
        savedFlags?.enhancement ?? value.enhancement ? "深化" : "",
      ].filter(Boolean);
      return {
        kind: value.group === "special" ? "ラバム" : "通常",
        number: String(value.displayNo || skill.display_no).padStart(2, "0"),
        id: skill.skill_id,
        name: value.name,
        nameEn: editorMetadata.excel_skill_names?.[skill.skill_id]?.en ?? "",
        stack: value.stack || "—",
        ct: value.ct ? `${value.ct}秒` : "—",
        hit: value.hit || "—",
        ia: savedFlags?.ia ?? value.ia,
        relics: value.slots.filter(Boolean).map((slot) => SIGIL_LABELS[slot] ?? slot),
        pvp: value.pvp,
        pve: value.pve,
        usage,
        description: bodyLines(value.description),
        icon: editorSkillIconUrl(classCode, skill) ?? "",
      };
    });
    const today = new Date();
    const createdAt = [today.getFullYear(), today.getMonth() + 1, today.getDate()]
      .map((part, index) => index === 0 ? String(part) : String(part).padStart(2, "0")).join(".");
    return {
      classCode,
      className: selectedClass?.name_ja ?? classCode,
      classIcon: classCode === "DK" ? "assets/DK.svg" : (classButtonUrl(classCode) ?? ""),
      createdAt,
      weapons,
      skills: imageSkills,
    };
  };

  const buildAllImageData = () => master.classes.map((classEntry) => {
    const targetCode = classEntry.code;
    const targetSkills = master.skills[targetCode] ?? [];
    const targetDescription = descriptions.classes[targetCode];
    const targetMetadata = editorMetadata.classes?.[targetCode];
    const assignments = targetMetadata?.passive_assignments ?? [];
    const storedPassives: PassiveDraft[] = [0, 1].map((index) => ({
      weapon: targetDescription?.passives[index]?.name ?? `武器 ${index + 1}`,
      weaponKo: assignments[index]?.weapon_ko ?? "",
      weaponEn: assignments[index]?.weapon_en ?? "",
      uniqueBody: assignments[index]?.unique_body ?? targetDescription?.passives[index]?.lines.join("\n") ?? "",
      commonPassive: assignments[index]?.common_passive ?? "",
    }));
    const inferred = inferSharedPassive(storedPassives);
    const storedCommonPassives = editorMetadata.common_passives ?? [];
    const weapons = storedPassives.map((passive, index) => {
      const selectedCommon = storedCommonPassives.find((item) => item.name === passive.commonPassive);
      const common = inferred
        ? { name: inferred.name, lines: inferred.lines }
        : selectedCommon ? { name: selectedCommon.name, lines: bodyLines(selectedCommon.body) } : null;
      return {
        name: passive.weapon,
        nameEn: passive.weaponEn,
        passives: [
          { name: passive.weapon, lines: inferred ? inferred.unique[index] : bodyLines(passive.uniqueBody) },
          ...(common ? [common] : []),
        ],
      };
    });
    const imageSkills = targetSkills.map((skill) => {
      const savedFlags = targetMetadata?.skill_flags?.[skill.skill_id];
      const value = initialSkill(
        targetCode,
        skill,
        editorMetadata.excel_skill_stacks?.[skill.skill_id],
        savedFlags
      );
      return {
        kind: skill.group === "special" ? "ラバム" : "通常",
        number: String(skill.display_no).padStart(2, "0"),
        id: skill.skill_id,
        name: value.name,
        nameEn: editorMetadata.excel_skill_names?.[skill.skill_id]?.en ?? "",
        stack: value.stack || "—",
        ct: value.ct ? `${value.ct}秒` : "—",
        hit: value.hit || "—",
        ia: savedFlags?.ia ?? value.ia,
        relics: value.slots.filter(Boolean).map((slot) => SIGIL_LABELS[slot] ?? slot),
        pvp: value.pvp,
        pve: value.pve,
        usage: [
          savedFlags?.sa ?? value.sa ? "SA" : "",
          savedFlags?.fg ?? value.fg ? "FG" : "",
          savedFlags?.enhancement ?? value.enhancement ? "深化" : "",
        ].filter(Boolean),
        description: bodyLines(value.description),
        icon: editorSkillIconUrl(targetCode, skill) ?? "",
      };
    });
    const today = new Date();
    const createdAt = [today.getFullYear(), today.getMonth() + 1, today.getDate()]
      .map((part, index) => index === 0 ? String(part) : String(part).padStart(2, "0")).join(".");
    return {
      classCode: targetCode,
      className: classEntry.name_ja ?? targetCode,
      classIcon: classButtonUrl(targetCode) ?? "",
      createdAt,
      weapons,
      skills: imageSkills,
    };
  });

  const previewImage = async () => {
    if (!window.skillEditor) return setActionNotice("デスクトップアプリから実行してください");
    try {
      const result = await window.skillEditor.previewImage(buildImageData());
      setActionNotice(result.message ?? "画像プレビューを開きました");
    } catch (error) {
      setActionNotice(`プレビューできませんでした: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const exportImage = async () => {
    if (!window.skillEditor) return setActionNotice("デスクトップアプリから実行してください");
    try {
      const result = await window.skillEditor.exportImage(buildImageData());
      if (!result.cancelled) setActionNotice(result.message ?? "PNGを保存しました");
    } catch (error) {
      setActionNotice(`PNGを保存できませんでした: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const exportAllImages = async () => {
    if (!window.skillEditor) return setActionNotice("デスクトップアプリから実行してください");
    try {
      setActionNotice("30クラス画像を生成中です。保存完了までアプリを閉じないでください…");
      const result = await window.skillEditor.exportAllImages(buildAllImageData());
      if (!result.cancelled) setActionNotice(result.message ?? "30クラス画像を保存しました");
    } catch (error) {
      setActionNotice(`30クラス画像を保存できませんでした: ${error instanceof Error ? error.message : String(error)}`);
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
          {window.skillEditor && <button className="de-image-action" type="button" onClick={previewImage}>画像プレビュー</button>}
          {window.skillEditor && <button className="de-image-action primary" type="button" onClick={exportImage}>PNG保存</button>}
          {window.skillEditor && <button className="de-image-action primary" type="button" onClick={exportAllImages}>30クラス一括画像</button>}
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
            {grouped.special.map((skill) => <SkillButton key={skill.skill_id} skill={skill} icon={editorSkillIconUrl(classCode, skill)} active={selectedSkill?.skill_id === skill.skill_id} onClick={() => setSelectedSkillId(skill.skill_id)} />)}
            <div className="de-skill-group-title normal"><span>通常スキル</span><small>{grouped.normal.length}</small></div>
            {grouped.normal.map((skill) => <SkillButton key={skill.skill_id} skill={skill} icon={editorSkillIconUrl(classCode, skill)} active={selectedSkill?.skill_id === skill.skill_id} onClick={() => setSelectedSkillId(skill.skill_id)} />)}
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
                  if (file) {
                    setIconSourcePath(window.skillEditor?.getFilePath(file) ?? "");
                    setIconPreview(URL.createObjectURL(file));
                  }
                }} />
              </label>
              <small>PNG / SVG / WEBP</small>
              <label className="de-field">
                <span>スキル区分</span>
                <select className="de-select" value={draft.group} onChange={(event) => setDraft({ ...draft, group: event.target.value as EditableSkill["group"] })}>
                  <option value="normal">通常スキル</option>
                  <option value="special">ラバムスキル</option>
                </select>
              </label>
              <label className="de-field">
                <span>スキル番号</span>
                <input className="de-input de-number" value={draft.displayNo} onChange={(event) => setDraft({ ...draft, displayNo: event.target.value })} />
              </label>
            </div>

            <div className="de-fields">
              <label className="de-field de-name-field"><span>スキル名</span><input className="de-input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
              <div className="de-inline-fields">
                <label className="de-field"><span>STACK <small>回</small></span><input className="de-input de-number" value={draft.stack} onChange={(event) => setDraft({ ...draft, stack: event.target.value })} /></label>
                <label className="de-field"><span>CT <small>秒</small></span><input className="de-input de-number" value={draft.ct} onChange={(event) => setDraft({ ...draft, ct: event.target.value })} /></label>
                <label className="de-field"><span>HIT <small>打撃</small></span><input className="de-input de-number" value={draft.hit} onChange={(event) => setDraft({ ...draft, hit: event.target.value })} /></label>
                <div className="de-field de-ia-field">
                  <span>IA <small>即時発動</small></span>
                  <label className="de-checkbox-toggle">
                    <input type="checkbox" checked={draft.ia} onChange={(event) => setDraft({ ...draft, ia: event.target.checked })} />
                    <span>即時</span>
                  </label>
                </div>
                <div className="de-field de-mode-toggle"><span>PvP</span><Toggle active={draft.pvp} onClick={() => setDraft({ ...draft, pvp: !draft.pvp })}>PvP</Toggle></div>
                <div className="de-field de-mode-toggle"><span>PvE</span><Toggle active={draft.pve} onClick={() => setDraft({ ...draft, pve: !draft.pve })}>PvE</Toggle></div>
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
              <label className="de-field de-private-note">
                <span>編集用メモ <small>ゲーム外情報・編集ツール内だけに保存（サイト／画像には非公開）</small></span>
                <textarea
                  className="de-textarea"
                  value={draft.privateNote}
                  onChange={(event) => setDraft({ ...draft, privateNote: event.target.value })}
                  placeholder="アップデート時に開示された情報などを自由に入力"
                />
              </label>
            </div>
          </div>
          <div className="de-editor-footer"><span>「変更を確認」で、選択中の1スキルを保存します。</span><button className="de-secondary" type="button" onClick={() => selectedSkill && setDraft(savedSkillDrafts[selectedSkill.skill_id] ?? initialSkill(classCode, selectedSkill, editorMetadata.excel_skill_stacks?.[selectedSkill.skill_id], editorMetadata.classes?.[classCode]?.skill_flags?.[selectedSkill.skill_id], editorMetadata.classes?.[classCode]?.skill_notes?.[selectedSkill.skill_id] ?? ""))}>変更を戻す</button><button className="de-primary" type="button" onClick={saveToSiteData}>変更を確認</button></div>
        </section>

        <section className="de-passives panel">
          <div className="de-pane-heading"><span>04</span><div><strong>パッシブ</strong><small>PASSIVE SETTINGS</small></div></div>
          <div className="de-passive-stack">{passiveDrafts.map((passive, index) => <PassiveCard key={index} index={index} value={passive} commonOptions={commonPassives} onChange={(value) => setPassiveDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))} />)}</div>
        </section>
      </div>

      <section className="de-update-history panel">
        <div className="de-pane-heading"><span>05</span><div><strong>更新情報</strong><small>CLASS UPDATE LOG</small></div></div>
        <div className="de-update-history-body">
          <label className="de-field">
            <span>アプデ実績 <small>この端末の編集アプリ内だけに保存・サイトへは送信しません</small></span>
            <textarea
              className="de-textarea"
              value={updateHistory}
              onChange={(event) => {
                const value = event.target.value;
                setUpdateHistories((current) => ({ ...current, [classCode]: value }));
              }}
              onBlur={() => window.skillEditor?.saveUpdateHistories(updateHistories).catch((error) => {
                setActionNotice(`更新履歴を保存できませんでした: ${error instanceof Error ? error.message : String(error)}`);
              })}
              placeholder={"例：2026/09/25　系列秘伝の廃止対応\n2026/10/01　WRスキル説明を更新"}
            />
          </label>
          <span className="de-local-only">{classCode} DATA / 自動保存</span>
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
        <div className="de-drawer-actions"><button className="de-secondary" type="button" onClick={() => setDrawerOpen(false)}>閉じる</button><button className="de-primary" type="button" onClick={saveCommonPassiveLibrary}>変更を確認</button></div>
      </aside>

      <nav className="de-bottom-actions" aria-label="データ操作">
        <button type="button" className="de-bottom-save" onClick={saveClassData}><span>✓</span><div><small>SAVE CLASS</small><strong>クラスを保存</strong></div></button>
      </nav>
      {actionNotice && <button type="button" className="de-action-notice" onClick={() => setActionNotice("")}>{actionNotice}<span>×</span></button>}
    </main>
  );
}

function SkillButton({ skill, icon, active, onClick }: { skill: SkillDef; icon: string | null; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`de-skill-button ${active ? "active" : ""}`} onClick={onClick}>
      <span className="de-skill-thumb">{icon ? <img src={icon} alt="" /> : <span>{skill.display_no}</span>}</span>
      <span className="de-skill-copy"><small>{skill.group === "special" ? "RABAM" : `SKILL ${String(skill.display_no).padStart(2, "0")}`}</small><strong>{skill.name_ja}</strong></span>
      <span className="de-chevron">›</span>
    </button>
  );
}
