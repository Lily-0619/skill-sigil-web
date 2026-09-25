const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const editorRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(editorRoot, "..");
const masterPath = path.join(repoRoot, "src", "data", "master.json");
const descriptionsPath = path.join(repoRoot, "src", "data", "descriptions.json");
const metadataPath = path.join(editorRoot, "data", "editorMetadata.json");

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJson = (file, value) => {
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 1)}\n`, "utf8");
  fs.renameSync(temp, file);
};

// Windowsでは .cmd をexecFileで直接起動するとspawn EINVALになる環境がある。
// 固定したnpmコマンドだけをcmd.exe経由で実行する。
async function runNpm(command, label) {
  try {
    return await execFileAsync(process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe", [
      "/d",
      "/s",
      "/c",
      command,
    ], { cwd: repoRoot, windowsHide: true });
  } catch (error) {
    const detail = error?.stderr?.trim() || error?.stdout?.trim() || error?.message || String(error);
    throw new Error(`${label}に失敗しました: ${detail}`);
  }
}

function assertText(value, label, max = 20000) {
  if (typeof value !== "string" || value.length > max) throw new Error(`${label}が不正です`);
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") throw new Error("保存データがありません");
  if (!/^[A-Z]{2,3}$/.test(payload.classCode)) throw new Error("クラスコードが不正です");
  assertText(payload.skillId, "スキルID", 80);
  assertText(payload.skill.name, "スキル名", 200);
  assertText(payload.skill.description, "スキル説明");
  if (!Array.isArray(payload.skill.slots) || payload.skill.slots.length !== 3) throw new Error("秘伝は3枠必要です");
  if (!Array.isArray(payload.passives) || payload.passives.length !== 2) throw new Error("武器パッシブは2件必要です");
  if (!Array.isArray(payload.commonPassives)) throw new Error("共通パッシブが不正です");
}

ipcMain.handle("editor:save", async (_event, payload) => {
  validatePayload(payload);
  const master = readJson(masterPath);
  const descriptions = readJson(descriptionsPath);
  const skills = master.skills[payload.classCode];
  const masterSkill = skills?.find((item) => item.skill_id === payload.skillId);
  if (!masterSkill) throw new Error("対象スキルが見つかりません");
  const key = `${masterSkill.group === "special" ? "sp" : "n"}_${masterSkill.display_no}`;
  const descSkill = descriptions.classes[payload.classCode]?.skills[key];
  if (!descSkill) throw new Error("対象スキル説明が見つかりません");

  masterSkill.name_ja = payload.skill.name.trim();
  masterSkill.slots = payload.skill.slots;
  masterSkill.sigil_eligible = true;
  descSkill.name = payload.skill.name.trim();
  descSkill.ct = payload.skill.ct.trim() || null;
  descSkill.hit = payload.skill.hit.trim() === "" ? null : Number(payload.skill.hit);
  descSkill.pve = Boolean(payload.skill.pve);
  descSkill.pvp = Boolean(payload.skill.pvp);
  descSkill.lines = payload.skill.description.split(/\r?\n/).filter((line) => line.trim() !== "");

  const classDesc = descriptions.classes[payload.classCode];
  classDesc.passives = payload.passives.map((passive) => {
    const common = payload.commonPassives.find((item) => item.name === passive.commonPassive);
    return {
      name: passive.weapon.trim(),
      lines: [
        ...passive.uniqueBody.split(/\r?\n/).filter((line) => line.trim() !== ""),
        ...(common ? [common.name, ...common.body.split(/\r?\n/).filter((line) => line.trim() !== "")] : []),
      ],
    };
  });

  const metadata = fs.existsSync(metadataPath) ? readJson(metadataPath) : { schema_version: 1, classes: {} };
  metadata.classes[payload.classCode] = {
    common_passives: payload.commonPassives,
    passive_assignments: payload.passives.map((item) => ({ weapon: item.weapon, common_passive: item.commonPassive })),
    skill_flags: {
      ...(metadata.classes[payload.classCode]?.skill_flags || {}),
      [payload.skillId]: { sa: payload.skill.sa, fg: payload.skill.fg, enhancement: payload.skill.enhancement },
    },
  };

  writeJson(masterPath, master);
  writeJson(descriptionsPath, descriptions);
  fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
  writeJson(metadataPath, metadata);
  return { ok: true, message: "サイト用データへ保存しました" };
});

ipcMain.handle("editor:publish", async () => {
  const result = await dialog.showMessageBox({
    type: "warning",
    buttons: ["キャンセル", "テストして公開"],
    defaultId: 0,
    cancelId: 0,
    title: "サイトへ公開",
    message: "保存済みの変更をGitHubへ送信し、公開サイトを更新します。",
  });
  if (result.response !== 1) return { ok: false, cancelled: true };
  // .claude/worktrees配下の古い作業コピーは対象外にし、現在のサイト本体だけ検証する。
  await runNpm("npx vitest run tests --exclude .claude/**", "サイトデータのテスト");
  // public/画像を既存正本として扱い、画像同期処理は実行しない。
  await runNpm("npx tsc --noEmit && npx vite build", "サイトのビルド");
  await execFileAsync("git", [
    "add",
    "src/data/master.json",
    "src/data/descriptions.json",
    "src/data/imageManifest.json",
    "src/game-rules/skill-sigil.json",
    "src/game-rules/skill-sigil-rules.ts",
    "src/components/BuildEdit.tsx",
    "src/components/Inventory.tsx",
    "tests",
    "scripts/remove_branch_sigils.mjs",
    "editor-app/desktop/main.cjs",
    "editor-app/src/DataEditorPrototype.tsx",
    "editor-app/src/data-editor.css",
  ], { cwd: repoRoot, windowsHide: true });
  await execFileAsync("git", ["commit", "-m", "Update skill data from desktop editor"], { cwd: repoRoot, windowsHide: true });
  await execFileAsync("git", ["push", "origin", "main"], { cwd: repoRoot, windowsHide: true });
  return { ok: true, message: "GitHubへ送信しました。数分後にサイトへ反映されます" };
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1580,
    height: 980,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: "#090c16",
    title: "スキルデータ編集",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.removeMenu();
  win.loadFile(path.join(editorRoot, "dist", "desktop", "index.html"), {
    query: {
      assetBase: pathToFileURL(`${path.join(repoRoot, "public")}${path.sep}`).href,
    },
  });
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
