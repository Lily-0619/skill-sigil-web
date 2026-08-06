// S-06 編成比較 (docs/17_編成比較機能_設計方針.md)
// 編成管理にある編成同士を並べて、どのスキルにどの秘伝のどの効果がついているかを比較する。
// 読み取り専用。ビューは 案A スキルごと / 案B タイプ別サマリー / 案C グラフ を切替。
// 既存システムは変更せず、集計は src/logic/compare.ts に自己完結して持つ。
import React, { useEffect, useMemo, useState } from "react";
import { master, useStore } from "../state/store";
import { buildCompareData } from "../logic/compare";
import { buildProgressData } from "../logic/progress";
import { BuildSelectBar } from "./compare/BuildSelectBar";
import { CompareBySkill } from "./compare/CompareBySkill";
import { CompareBySummary } from "./compare/CompareBySummary";
import { CompareChart } from "./compare/CompareChart";
import { CompareProgress } from "./compare/CompareProgress";
import "../styles/compare.css";

/** 横並びの最大編成数 (docs/17 既定=4)。増減はここを変えるだけ。 */
const MAX_COMPARE = 4;

type CompareView = "skill" | "summary" | "chart" | "progress";

const VIEWS: { id: CompareView; label: string }[] = [
  { id: "skill", label: "スキルごと" },
  { id: "summary", label: "タイプ別サマリー" },
  { id: "chart", label: "グラフ" },
  { id: "progress", label: "達成度" },
];

/** 達成度タブが選べないときの説明 (ホバーで出す) */
const PROGRESS_HINT =
  "達成度は「同じクラスのFree編成とMy編成」を選んだときだけ表示できます。\n" +
  "例: FreeのWR + MyのWR は可 / Free同士や別クラスの組み合わせは不可";

export default function Compare() {
  const { data } = useStore();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [view, setView] = useState<CompareView>("skill");

  // 編成管理と同じ並び (最終更新の降順)
  const builds = useMemo(
    () =>
      data.builds
        .slice()
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [data.builds]
  );

  const toggle = (buildId: string) =>
    setSelectedIds((cur) => {
      if (cur.includes(buildId)) return cur.filter((id) => id !== buildId);
      if (cur.length >= MAX_COMPARE) return cur; // 上限超過は無視 (ボタン側でも無効化)
      return [...cur, buildId]; // 選択順を保ってカラム順にする
    });

  // 選択された編成の比較データ (選択順を維持)。削除済みIDは除外。
  const compareData = useMemo(
    () =>
      selectedIds
        .map((id) => data.builds.find((b) => b.build_id === id))
        .filter((b): b is NonNullable<typeof b> => !!b)
        .map((b) => buildCompareData(master, data, b)),
    [selectedIds, data]
  );

  // 達成度は「同じクラスの Free(理想) と My(現在)」の組でしか成立しない。
  // Free同士や別クラスの組み合わせでは出せないので、タブ自体を無効にする。
  const progressData = useMemo(() => {
    const picked = selectedIds
      .map((id) => data.builds.find((b) => b.build_id === id))
      .filter((b): b is NonNullable<typeof b> => !!b);
    for (const ideal of picked.filter((b) => b.mode === "free")) {
      const actual = picked.find(
        (b) => b.mode === "my" && b.class_id === ideal.class_id
      );
      if (actual) return buildProgressData(master, data, ideal, actual);
    }
    return null;
  }, [selectedIds, data]);

  // 選択が変わって達成度が出せなくなったら、別のビューへ戻す
  useEffect(() => {
    if (view === "progress" && !progressData) setView("skill");
  }, [view, progressData]);

  return (
    <div className="cmp-screen">
      <div className="screen-head">
        <span className="overline">Build Compare</span>
        <h2>編成比較</h2>
        <p className="desc">
          編成管理にある編成を並べて、どのスキルにどの秘伝のどの効果がついているかを比較します。
          （読み取り専用・数値は合算しません）
        </p>
      </div>

      <BuildSelectBar
        builds={builds}
        selectedIds={selectedIds}
        onToggle={toggle}
        max={MAX_COMPARE}
      />

      {compareData.length < 2 ? (
        <div className="cmp-empty">
          <span className="en">Select 2+ Builds</span>
          比較する編成を2件以上選んでください。
        </div>
      ) : (
        <>
          <div className="cmp-toolbar">
            <span className="cmp-toolbar-label">表示</span>
            <div className="cmp-view-toggle" role="tablist" aria-label="表示切替">
              {VIEWS.map((v) => {
                // 達成度は「同じクラスのFree + My」が揃っていないと選べない
                const disabled = v.id === "progress" && !progressData;
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="tab"
                    aria-selected={view === v.id}
                    // disabled 属性を付けるとブラウザが title を出さないため、
                    // 見た目と操作だけ無効にして、ホバーで理由を出せるようにする
                    aria-disabled={disabled}
                    title={disabled ? PROGRESS_HINT : undefined}
                    className={`cmp-view-btn ${view === v.id ? "on" : ""} ${
                      disabled ? "disabled" : ""
                    }`}
                    onClick={() => {
                      if (!disabled) setView(v.id);
                    }}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>
          </div>

          {view === "skill" && <CompareBySkill builds={compareData} />}
          {view === "summary" && <CompareBySummary builds={compareData} />}
          {view === "chart" && <CompareChart builds={compareData} />}
          {view === "progress" && progressData && (
            <CompareProgress data={progressData} />
          )}
        </>
      )}
    </div>
  );
}
