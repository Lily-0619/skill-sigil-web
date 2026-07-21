// アプリ共通レイアウト (docs/03 §2): ヘッダー / 左ナビ / 背景キャラ / フッター
import React, { useEffect, useState } from "react";
import { master, useStore } from "../state/store";
import { assetUrl, pickCharacterImage } from "../lib/assets";

export type Screen = "class" | "build" | "inventory" | "builds" | "backup" | "help";

const NAV: { id: Screen; ja: string; en: string; needsClass?: boolean }[] = [
  { id: "class", ja: "クラス選択", en: "Class" },
  { id: "build", ja: "編成編集", en: "Build", needsClass: true },
  { id: "inventory", ja: "所持秘伝", en: "Inventory" },
  { id: "builds", ja: "編成管理", en: "Manage" }, // v0.2 #7: クラス未選択でも開ける
  { id: "backup", ja: "バックアップ", en: "Backup" },
  { id: "help", ja: "ヘルプ・情報", en: "About" },
];

function SaveStatusView() {
  const { saveStatus } = useStore();
  const fmt = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (saveStatus.state === "saving")
    return (
      <span className="save-status saving">
        <span className="dot" />
        保存中…
      </span>
    );
  if (saveStatus.state === "saved")
    return (
      <span className="save-status saved">
        <span className="dot" />
        自動保存済み {fmt(saveStatus.at)}
      </span>
    );
  if (saveStatus.state === "error")
    return (
      <span className="save-status error">
        <span className="dot" />
        保存失敗 — Excelバックアップ推奨
      </span>
    );
  return (
    <span className="save-status">
      <span className="dot" />
      このPCに自動保存
    </span>
  );
}

/** キャラクター背景 (docs/03 §10) — 画面を開いた時だけ選び直す */
function BgCharacter({ screen }: { screen: Screen }) {
  const { data, dispatch } = useStore();
  const classCode =
    screen === "class" ? null : data.meta.selected_class_id ?? null;
  const [path, setPath] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [side] = useState(() => (Math.random() < 0.5 ? "left" : "right"));

  useEffect(() => {
    const next = pickCharacterImage(classCode, data.meta.last_character_image);
    setLoaded(false);
    setPath(next);
    if (next) dispatch({ type: "SET_LAST_CHARACTER", path: next });
    // 画面切替・クラス切替のときだけ選び直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, classCode]);

  if (!path) return null;
  return (
    <div className={`bg-character ${side}`} aria-hidden>
      <img
        src={assetUrl(path)}
        alt=""
        className={loaded ? "loaded" : ""}
        onLoad={() => setLoaded(true)}
        onError={() => setPath(null)}
      />
    </div>
  );
}

export default function Shell({
  screen,
  onNavigate,
  onHome,
  children,
}: {
  screen: Screen;
  onNavigate: (s: Screen) => void;
  onHome: () => void;
  children: React.ReactNode;
}) {
  const { data } = useStore();
  const cls = master.classes.find(
    (c) => c.class_id === data.meta.selected_class_id
  );
  const build = data.builds.find(
    (b) => b.build_id === data.meta.selected_build_id
  );

  return (
    <div className="app-viewport">
      <BgCharacter screen={screen} />
      <div className="app-shell">
        <header className="app-header">
          <div className="wordmark">
            <span className="en">スキル秘伝</span>
            <button className="wordmark-home" type="button" onClick={onHome}>
              TOPへ
            </button>
          </div>
          <div className="header-center">
            {cls ? (
              <>
                <span>{cls.name_ja}</span>
                <span className="sep">/</span>
                <span>{build ? build.name : "編成未選択"}</span>
                {build?.mode === "free" && (
                  <span className="badge-free">FREE</span>
                )}
              </>
            ) : (
              <span>クラス未選択</span>
            )}
          </div>
          <SaveStatusView />
        </header>

        <nav className="app-nav" aria-label="画面切替">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${screen === n.id ? "active" : ""}`}
              disabled={n.needsClass && !cls}
              onClick={() => onNavigate(n.id)}
            >
              <span className="en">{n.en}</span>
              <span className="ja">{n.ja}</span>
            </button>
          ))}
        </nav>

        <main className="app-main">{children}</main>

        <footer className="app-footer">
          <span>
            黒い砂漠モバイル 非公式Webページ「スキル秘伝」｜本サイトはPearl Abyssの著作物・知的財産を含む非公式ファンコンテンツであり、Pearl
            Abyss公式または公認のものではありません。
          </span>
          <span>
            master {master.master_version} / schema v{data.meta.schema_version}
            {" ・ "}
            <a
              href="https://www.jp.blackdesertm.com/"
              target="_blank"
              rel="noreferrer"
            >
              黒い砂漠MOBILE 公式
            </a>
            {" ・ "}
            <a
              href="https://www.world.blackdesertm.com/Policy?policyNo=10"
              target="_blank"
              rel="noreferrer"
            >
              ファンコンテンツガイド
            </a>
          </span>
        </footer>
      </div>
    </div>
  );
}
