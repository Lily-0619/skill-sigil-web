import React, { useEffect, useMemo, useState } from "react";
import type { BuildMode } from "./types";
import { StoreProvider, useStore, master } from "./state/store";
import TopPage from "./components/TopPage";
import Hero from "./components/Hero";
import Shell, { type Screen } from "./components/Shell";
import ClassSelect from "./components/ClassSelect";
import BuildEdit from "./components/BuildEdit";
import Inventory from "./components/Inventory";
import Builds from "./components/Builds";
import Compare from "./components/Compare";
import Backup from "./components/Backup";
import Help from "./components/Help";
import { ToastHost } from "./components/ui";

function AppInner() {
  const { data, dispatch, loaded } = useStore();
  // キャラクター図鑑の「このクラスで編成を作る」からの深いリンク (#class=CODE)。
  // 有効なクラスコードのときだけ、TOPを経由せず直接そのクラスの編成編集へ入る。
  const deepLinkClass = useMemo(() => {
    const m = (window.location.hash || "").match(/class=([A-Za-z]{2,})/i);
    if (!m) return null;
    const code = m[1].toUpperCase();
    return master.classes.some((c) => c.class_id === code && c.enabled)
      ? code
      : null;
  }, []);
  const [topStage, setTopStage] = useState<"top" | "sigil" | "app">(
    deepLinkClass ? "app" : "top"
  );
  const [screen, setScreen] = useState<Screen>(
    deepLinkClass ? "build" : "class"
  );
  // v0.2 #3: トップで選んだ入口モード (My / Free)。編成が選択済みならそちらのmodeを優先。
  const [mode, setMode] = useState<BuildMode>("my");
  const [deepLinkDone, setDeepLinkDone] = useState(false);

  // ストア読込後にクラスを選択し、ハッシュを消す (再読込でTOPに戻れるように)
  useEffect(() => {
    if (deepLinkDone || !loaded || !deepLinkClass) return;
    dispatch({ type: "SELECT_CLASS", classId: deepLinkClass });
    setDeepLinkDone(true);
    window.history.replaceState(null, "", window.location.pathname);
  }, [loaded, deepLinkClass, deepLinkDone, dispatch]);

  if (topStage === "top") {
    return <TopPage onOpenSkillSigil={() => setTopStage("sigil")} />;
  }

  if (topStage === "sigil") {
    return (
      <Hero
        onEnter={(m) => {
          const sel = data.builds.find(
            (b) => b.build_id === data.meta.selected_build_id
          );
          // 入口モードと選択中編成のモードが食い違う場合は編成選択を解除
          if (sel && sel.mode !== m) {
            dispatch({ type: "SELECT_BUILD", buildId: null });
          }
          setMode(m);
          setScreen("class");
          setTopStage("app");
        }}
        onBack={() => setTopStage("top")}
      />
    );
  }

  if (!loaded) return null;

  const hasClass = !!data.meta.selected_class_id;

  return (
    <>
      <Shell
        screen={screen}
        onNavigate={(s) => setScreen(s)}
        onHome={() => setTopStage("top")}
      >
        {screen === "class" && (
          <ClassSelect
            mode={mode}
            onModeChange={setMode}
            onSelect={(classId) => {
              dispatch({ type: "SELECT_CLASS", classId });
              setScreen("build");
            }}
          />
        )}
        {screen === "build" &&
          (hasClass ? <BuildEdit defaultMode={mode} /> : <ClassSelect mode={mode} onModeChange={setMode} onSelect={(c) => {
            dispatch({ type: "SELECT_CLASS", classId: c });
          }} />)}
        {screen === "inventory" && <Inventory />}
        {screen === "builds" && <Builds onOpen={() => setScreen("build")} />}
        {screen === "compare" && <Compare />}
        {screen === "backup" && <Backup />}
        {screen === "help" && <Help />}
      </Shell>
      <ToastHost />
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppInner />
    </StoreProvider>
  );
}
