import React, { useState } from "react";
import type { BuildMode } from "./types";
import { StoreProvider, useStore } from "./state/store";
import Hero from "./components/Hero";
import Shell, { type Screen } from "./components/Shell";
import ClassSelect from "./components/ClassSelect";
import BuildEdit from "./components/BuildEdit";
import Inventory from "./components/Inventory";
import Builds from "./components/Builds";
import Backup from "./components/Backup";
import Help from "./components/Help";
import { ToastHost } from "./components/ui";

function AppInner() {
  const { data, dispatch, loaded } = useStore();
  const [entered, setEntered] = useState(false);
  const [screen, setScreen] = useState<Screen>("class");
  // v0.2 #3: トップで選んだ入口モード (My / Free)。編成が選択済みならそちらのmodeを優先。
  const [mode, setMode] = useState<BuildMode>("my");

  if (!entered) {
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
          setEntered(true);
        }}
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
        onHome={() => setEntered(false)}
      >
        {screen === "class" && (
          <ClassSelect
            onSelect={(classId) => {
              dispatch({ type: "SELECT_CLASS", classId });
              setScreen("build");
            }}
          />
        )}
        {screen === "build" &&
          (hasClass ? <BuildEdit defaultMode={mode} /> : <ClassSelect onSelect={(c) => {
            dispatch({ type: "SELECT_CLASS", classId: c });
          }} />)}
        {screen === "inventory" && <Inventory />}
        {screen === "builds" && <Builds onOpen={() => setScreen("build")} />}
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
