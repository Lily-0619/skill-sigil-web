// S-05 バックアップ (docs/03 §7, 05_Excel入出力仕様書.md)
import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { master, useStore } from "../state/store";
import {
  applyImport,
  backupFilename,
  buildWorkbook,
  exportIntegrityErrors,
  parseWorkbook,
  type ImportMode,
  type ImportResult,
} from "../logic/excel";
import { idbSet, KEY_PRE_IMPORT_BACKUP } from "../lib/db";
import { nowIso } from "../lib/ids";
import { Modal } from "./ui";
import { useReveal } from "../hooks/useReveal";

export default function Backup() {
  const { data, dispatch, toast } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [mode, setMode] = useState<ImportMode>("replace");
  const [confirming, setConfirming] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportName, setExportName] = useState("");
  const rv = useReveal<HTMLDivElement>();

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("ja-JP") : "まだありません";

  // ---- 書き出し ----
  const openExportDialog = () => {
    const errors = exportIntegrityErrors(data);
    if (errors.length > 0) {
      toast("error", `整合性エラーのため書き出せません: ${errors[0]}`);
      return;
    }
    setExportName(backupFilename().replace(/\.xlsx$/i, ""));
    setExporting(true);
  };

  const doExport = () => {
    const name = exportName.trim().replace(/\.xlsx$/i, "");
    if (!name) {
      toast("error", "ファイル名を入力してください");
      return;
    }
    if (/[\\\\/:*?\"<>|]/.test(name)) {
      toast("error", "ファイル名に Windows で使えない文字が含まれています");
      return;
    }
    try {
      const wb = buildWorkbook(master, data);
      XLSX.writeFile(wb, `${name}.xlsx`);
      dispatch({ type: "SET_LAST_EXPORT", at: nowIso() });
      toast("success", "Excelバックアップを書き出しました");
      setExporting(false);
    } catch (e) {
      toast("error", "書き出しに失敗しました");
    }
  };

  // ---- 読み込み ----
  const onFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      setResult(parseWorkbook(master, wb));
    } catch (e) {
      setResult({
        issues: {
          errors: [".xlsxファイルとして読み込めませんでした。"],
          warnings: [],
          infos: [],
        },
        parsed: null,
      });
    }
  };

  const doApply = async () => {
    if (!result?.parsed) return;
    try {
      // 取込前の自動退避 (docs/03 §7)
      await idbSet(KEY_PRE_IMPORT_BACKUP, { at: nowIso(), data });
      dispatch({ type: "SET_LAST_BACKUP", at: nowIso() });
    } catch {
      toast("error", "退避コピーの作成に失敗したため中止しました");
      return;
    }
    const next = applyImport(data, result.parsed, mode);
    dispatch({ type: "REPLACE_ALL", data: { ...next, meta: { ...next.meta, last_backup_at: nowIso() } } });
    toast("success", mode === "replace" ? "置換で復元しました" : "追加統合しました");
    setResult(null);
    setConfirming(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div ref={rv.ref} className={`stack ${rv.cls} rv-up`}>
      <div className="screen-head">
        <span className="overline">Backup &amp; Restore</span>
        <h2>バックアップ</h2>
        <p className="desc">
          データはこのPCのブラウザ内にだけ保存されます。定期的なExcelバックアップをおすすめします。
        </p>
      </div>

      <div className="card panel">
        <h3>
          Excelに書き出す <span className="en">Export</span>
        </h3>
        <p>
          所持秘伝・全編成・装着状況・バージョン情報を1つのExcelファイルへ保存します。
        </p>
        <p className="fine">最終書き出し: {fmt(data.meta.last_export_at)}</p>
        <button className="btn primary" onClick={openExportDialog}>
          Excelに書き出す
        </button>
      </div>

      <div className="card panel">
        <h3>
          Excelから読み込む <span className="en">Import</span>
        </h3>
        <p>
          <strong>置換</strong>: 現在のデータを退避してから、ファイルの内容へ置き換えます(推奨)。
          <br />
          <strong>追加統合</strong>: IDが重ならない所持品・編成を追加します。同じ内容の重複は自動で数量加算しません。
        </p>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", margin: "14px 0" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
            <input
              type="radio"
              checked={mode === "replace"}
              onChange={() => setMode("replace")}
              style={{ accentColor: "var(--pink)" }}
            />
            置換(推奨)
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
            <input
              type="radio"
              checked={mode === "merge"}
              onChange={() => setMode("merge")}
              style={{ accentColor: "var(--pink)" }}
            />
            追加統合
          </label>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            ファイルを選ぶ
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </div>
        <p className="fine">
          読み込み確定前に、現在の状態をこのPC内へ自動退避します(直前退避: {fmt(data.meta.last_backup_at)})。
        </p>

        {/* 取込前プレビュー */}
        {result && (
          <div style={{ marginTop: 10 }}>
            <div className="hairline" style={{ margin: "14px 0" }} />
            <div className="issue-list">
              {result.issues.errors.map((m, i) => (
                <div key={`e${i}`} className="issue error">✕ {m}</div>
              ))}
              {result.issues.warnings.map((m, i) => (
                <div key={`w${i}`} className="issue warning">⚠ {m}</div>
              ))}
              {result.issues.infos.map((m, i) => (
                <div key={`i${i}`} className="issue info">ℹ {m}</div>
              ))}
            </div>
            {result.parsed ? (
              <button className="btn primary" onClick={() => setConfirming(true)}>
                {mode === "replace" ? "置換で取り込む" : "追加統合で取り込む"}
              </button>
            ) : (
              <p className="fine" style={{ color: "var(--r-abyssal-t)" }}>
                エラーがあるため取り込めません。ファイルを確認してください。
              </p>
            )}
          </div>
        )}
      </div>

      {confirming && result?.parsed && (
        <Modal
          title={mode === "replace" ? "置換の確認" : "追加統合の確認"}
          onClose={() => setConfirming(false)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setConfirming(false)}>
                キャンセル
              </button>
              <button className="btn primary" onClick={doApply}>
                実行する
              </button>
            </>
          }
        >
          <p>
            {mode === "replace"
              ? "現在の所持秘伝・編成をすべてファイルの内容へ置き換えます。現在の状態は実行前にPC内へ退避されます。"
              : "ファイルの所持秘伝・編成を現在のデータへ追加します。ID衝突分は別IDで追加されます。"}
          </p>
        </Modal>
      )}

      {exporting && (
        <Modal
          title="Excelに書き出す"
          onClose={() => setExporting(false)}
          actions={
            <>
              <button className="btn ghost" onClick={() => setExporting(false)}>
                キャンセル
              </button>
              <button className="btn primary" onClick={doExport}>
                書き出す
              </button>
            </>
          }
        >
          <p>ファイル名を確認してから書き出します。</p>
          <label className="export-filename">
            <span>ファイル名</span>
            <div>
              <input
                className="input"
                value={exportName}
                onChange={(e) => setExportName(e.target.value)}
                aria-label="書き出すファイル名"
                autoFocus
              />
              <span>.xlsx</span>
            </div>
          </label>
          <p className="fine">空欄、および \ / : * ? &quot; &lt; &gt; | は使用できません。</p>
        </Modal>
      )}
    </div>
  );
}
