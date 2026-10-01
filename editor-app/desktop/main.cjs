const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const XLSX = require("xlsx");
const sharp = require("sharp");

const execFileAsync = promisify(execFile);
const editorRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(editorRoot, "..");
const masterPath = path.join(repoRoot, "src", "data", "master.json");
const descriptionsPath = path.join(repoRoot, "src", "data", "descriptions.json");
const imageManifestPath = path.join(repoRoot, "src", "data", "imageManifest.json");
const metadataPath = path.join(editorRoot, "data", "editorMetadata.json");
const imageTemplatePath = path.join(editorRoot, "print-template", "index.html");
const aiDataExportScriptPath = path.join(repoRoot, "scripts", "export_ai_class_data.mjs");
const sourceWorkbookPath = path.join(repoRoot, "資料", "クラスデータ", "黒い砂漠M_スキル・パッシブ.xlsx");
const passiveHeaderPattern = /^\[(.+?)\s*\/\s*(.+?)\s*\/\s*(.+?)\]$/;

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJson = (file, value) => {
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 1)}\n`, "utf8");
  fs.renameSync(temp, file);
};

// Windowsでは .cmd をexecFileで直接起動するとspawn EINVALになる環境があるため
// cmd.exeを使う。macOSではnpxを引数配列で直接実行する。
async function runNpx(args, label) {
  try {
    if (process.platform === "win32") {
      const command = `npx ${args.map((value) => `"${value.replaceAll('"', '\\"')}"`).join(" ")}`;
      return await execFileAsync(process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe", [
        "/d",
        "/s",
        "/c",
        command,
      ], { cwd: repoRoot, windowsHide: true });
    }
    const executable = path.join(repoRoot, "node_modules", ".bin", args[0]);
    return await execFileAsync(executable, args.slice(1), { cwd: repoRoot });
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
  if (!['special', 'normal'].includes(payload.skill.group)) throw new Error("スキル区分が不正です");
  assertText(payload.skill.displayNo, "スキル番号", 3);
  if (!/^[1-9]\d{0,2}$/.test(payload.skill.displayNo.trim())) throw new Error("スキル番号は1以上の整数で入力してください");
  assertText(payload.skill.stack, "STACK", 20);
  if (payload.skill.stack.trim() !== "" && !/^\d+$/.test(payload.skill.stack.trim())) {
    throw new Error("STACKは0以上の整数で入力してください");
  }
  assertText(payload.skill.description, "スキル説明");
  assertText(payload.skill.privateNote ?? "", "編集用メモ");
  if (!Array.isArray(payload.skill.slots) || payload.skill.slots.length !== 3) throw new Error("秘伝は3枠必要です");
  if (!Array.isArray(payload.passives) || payload.passives.length !== 2) throw new Error("武器パッシブは2件必要です");
  payload.passives.forEach((passive, index) => {
    assertText(passive.weapon, `武器${index + 1}の日本語名`, 200);
    assertText(passive.weaponKo, `武器${index + 1}の韓国語名`, 200);
    assertText(passive.weaponEn, `武器${index + 1}の英語名`, 200);
  });
  if (!Array.isArray(payload.commonPassives)) throw new Error("共通パッシブが不正です");
}

function loadMetadataWithExcelWeaponNames() {
  const metadata = fs.existsSync(metadataPath) ? readJson(metadataPath) : { schema_version: 1, classes: {} };
  metadata.classes ||= {};
  if (!Array.isArray(metadata.common_passives) || metadata.common_passives.length === 0) {
    const merged = new Map();
    for (const classMetadata of Object.values(metadata.classes)) {
      for (const passive of classMetadata.common_passives || []) {
        const name = String(passive.name || "").trim();
        if (!name) continue;
        const current = merged.get(name);
        if (!current || String(passive.body || "").length > String(current.body || "").length) merged.set(name, passive);
      }
    }
    metadata.common_passives = [...merged.values()];
  }
  metadata.skill_icon_paths ||= {};
  const master = readJson(masterPath);
  const imageManifest = readJson(imageManifestPath);
  const normalizeName = (value) => String(value || "").replace(/[_\s　]/g, "");
  for (const [classCode, skills] of Object.entries(master.skills || {})) {
    const entries = imageManifest.skills?.[classCode] || [];
    for (const skill of skills) {
      const exact = entries.find((entry) => entry.no === skill.display_no && entry.special === (skill.group === "special"));
      const named = entries.find((entry) => normalizeName(entry.name) === normalizeName(skill.name_ja));
      const match = named || exact;
      if (match?.path) metadata.skill_icon_paths[skill.skill_id] = match.path;
    }
  }
  if (!fs.existsSync(sourceWorkbookPath)) return metadata;

  const workbook = XLSX.readFile(sourceWorkbookPath, { cellDates: false });
  const sheet = workbook.Sheets["パッシブ一覧"];
  if (!sheet) return metadata;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  const classCodes = rows[0] || [];

  for (let column = 1; column < classCodes.length; column += 1) {
    const classCode = String(classCodes[column] || "").trim();
    if (!/^[A-Z]{2,3}$/.test(classCode)) continue;
    const classMetadata = metadata.classes[classCode] ||= {};
    const assignments = classMetadata.passive_assignments ||= [];
    for (let index = 0; index < 2; index += 1) {
      const firstLine = String(rows[index + 1]?.[column] || "").split(/\r?\n/, 1)[0].trim();
      const match = passiveHeaderPattern.exec(firstLine);
      if (!match) continue;
      const current = assignments[index] ||= {};
      current.weapon ||= match[1].trim();
      current.weapon_ko ||= match[2].trim();
      current.weapon_en ||= match[3].trim();
    }
  }
  metadata.excel_skill_stacks = {};
  metadata.excel_skill_names = {};
  for (const sheetName of workbook.SheetNames.filter((name) => name.startsWith("スキル_"))) {
    const skillRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, defval: "" });
    for (let row = 1; row < skillRows.length; row += 1) {
      const skillId = String(skillRows[row]?.[0] || "").trim();
      const stack = String(skillRows[row]?.[5] || "").trim();
      if (skillId && stack) metadata.excel_skill_stacks[skillId] = stack;
      if (skillId) {
        metadata.excel_skill_names[skillId] = {
          ko: String(skillRows[row]?.[13] || "").trim(),
          en: String(skillRows[row]?.[14] || "").trim(),
        };
      }
    }
  }
  return metadata;
}

ipcMain.handle("editor:load-metadata", () => loadMetadataWithExcelWeaponNames());

function validateImageData(data) {
  if (!data || typeof data !== "object") throw new Error("画像用データがありません");
  if (!/^[A-Z]{2,3}$/.test(data.classCode || "")) throw new Error("画像用クラスコードが不正です");
  assertText(data.className, "画像用クラス名", 200);
  if (!Array.isArray(data.weapons) || data.weapons.length !== 2) throw new Error("画像には武器が2件必要です");
  if (!Array.isArray(data.skills) || data.skills.length === 0) throw new Error("画像用スキルがありません");
}

async function renderImageWindow(data, visible) {
  validateImageData(data);
  const win = new BrowserWindow({
    width: 1580,
    height: visible ? 960 : 800,
    show: false,
    backgroundColor: "#11141d",
    title: `${data.classCode} スキル・パッシブ画像`,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.removeMenu();
  await win.loadFile(imageTemplatePath);
  await win.webContents.executeJavaScript(`window.renderClass(${JSON.stringify(data)})`);
  await win.webContents.executeJavaScript("document.fonts.ready");
  if (visible) {
    await win.webContents.executeJavaScript("window.enablePreview()");
    win.show();
    return win;
  }
  return win;
}

ipcMain.handle("editor:preview-image", async (_event, data) => {
  await renderImageWindow(data, true);
  return { ok: true, message: "画像プレビューを開きました" };
});

ipcMain.handle("editor:export-image", async (_event, data) => {
  const win = await renderImageWindow(data, false);
  try {
    const dimensions = await win.webContents.executeJavaScript(`({
      width: Math.ceil(document.documentElement.scrollWidth),
      height: Math.ceil(document.documentElement.scrollHeight)
    })`);
    win.setContentSize(Math.min(8192, dimensions.width), Math.min(30000, dimensions.height));
    await new Promise((resolve) => setTimeout(resolve, 100));
    const image = await win.webContents.capturePage({
      x: 0,
      y: 0,
      width: Math.min(8192, dimensions.width),
      height: Math.min(30000, dimensions.height),
    });
    const result = await dialog.showSaveDialog({
      title: "クラス画像を保存",
      defaultPath: `${data.classCode}_skill_passive.png`,
      filters: [{ name: "PNG画像", extensions: ["png"] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, cancelled: true };
    fs.writeFileSync(result.filePath, image.toPNG());
    return { ok: true, message: `PNGを保存しました: ${result.filePath}`, filePath: result.filePath };
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
});

ipcMain.handle("editor:export-all-images", async (_event, items) => {
  if (!Array.isArray(items) || items.length !== 30) throw new Error("30クラス分の画像データが必要です");
  items.forEach(validateImageData);
  const result = await dialog.showSaveDialog({
    title: "30クラス一括画像を保存",
    defaultPath: "all_classes_10x3.png",
    filters: [{ name: "PNG画像", extensions: ["png"] }],
  });
  if (result.canceled || !result.filePath) return { ok: false, cancelled: true };

  const cellWidth = 1170;
  const panels = [];
  for (const item of items) {
    const win = await renderImageWindow(item, false);
    try {
      const dimensions = await win.webContents.executeJavaScript(`({
        width: Math.ceil(document.documentElement.scrollWidth),
        height: Math.ceil(document.documentElement.scrollHeight)
      })`);
      win.setContentSize(dimensions.width, dimensions.height);
      await new Promise((resolve) => setTimeout(resolve, 80));
      const captured = await win.webContents.capturePage({ x: 0, y: 0, width: dimensions.width, height: dimensions.height });
      const resized = await sharp(captured.toPNG(), { limitInputPixels: false })
        .resize({ width: cellWidth })
        .png()
        .toBuffer({ resolveWithObject: true });
      panels.push({ input: resized.data, width: resized.info.width, height: resized.info.height });
    } finally {
      if (!win.isDestroyed()) win.destroy();
    }
  }

  const columns = 10;
  const rows = 3;
  const rowHeights = Array.from({ length: rows }, (_, row) =>
    Math.max(...panels.slice(row * columns, row * columns + columns).map((panel) => panel.height))
  );
  const rowTops = rowHeights.map((_, row) => rowHeights.slice(0, row).reduce((sum, height) => sum + height, 0));
  const width = cellWidth * columns;
  const height = rowHeights.reduce((sum, rowHeight) => sum + rowHeight, 0);
  const composites = panels.map((panel, index) => ({
    input: panel.input,
    left: (index % columns) * cellWidth,
    top: rowTops[Math.floor(index / columns)],
  }));
  const png = await sharp({
    create: { width, height, channels: 4, background: { r: 17, g: 20, b: 29, alpha: 1 } },
    limitInputPixels: false,
  }).composite(composites).png({ compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(result.filePath, png);
  const parsed = path.parse(result.filePath);
  const svgPath = path.join(parsed.dir, `${parsed.name}.svg`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image width="100%" height="100%" href="data:image/png;base64,${png.toString("base64")}"/></svg>`;
  fs.writeFileSync(svgPath, svg, "utf8");
  let aiDataResult;
  try {
    const { stdout } = await execFileAsync(process.execPath, [aiDataExportScriptPath], {
      cwd: repoRoot,
      windowsHide: true,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    });
    aiDataResult = JSON.parse(stdout);
  } catch (error) {
    const detail = error?.stderr?.trim() || error?.stdout?.trim() || error?.message || String(error);
    throw new Error(`30クラス画像は保存しましたが、AI分析用データの更新に失敗しました: ${detail}`);
  }
  return {
    ok: true,
    message: `30クラス画像と日付付きAI分析用データを保存しました (${width}×${height}px): ${result.filePath}`,
    filePath: result.filePath,
    svgPath,
    aiDataJsonPath: aiDataResult.jsonPath,
    aiDataMarkdownPath: aiDataResult.mdPath,
  };
});

ipcMain.handle("editor:save", async (_event, payload) => {
  validatePayload(payload);
  const master = readJson(masterPath);
  const descriptions = readJson(descriptionsPath);
  const skills = master.skills[payload.classCode];
  const masterSkill = skills?.find((item) => item.skill_id === payload.skillId);
  if (!masterSkill) throw new Error("対象スキルが見つかりません");
  const oldGroup = masterSkill.group;
  const oldNo = masterSkill.display_no;
  const oldKey = `${oldGroup === "special" ? "sp" : "n"}_${oldNo}`;
  const newGroup = payload.skill.group;
  const newNo = Number(payload.skill.displayNo);
  const newKey = `${newGroup === "special" ? "sp" : "n"}_${newNo}`;
  const descriptionSkills = descriptions.classes[payload.classCode]?.skills;
  const descSkill = descriptionSkills?.[oldKey];
  if (!descSkill) throw new Error("対象スキル説明が見つかりません");

  if (oldGroup !== newGroup || oldNo !== newNo) {
    const counterpart = skills.find((item) =>
      item.skill_id !== masterSkill.skill_id &&
      item.group === newGroup &&
      item.display_no === newNo
    );
    const counterpartDescription = descriptionSkills[newKey];
    if (counterpart) {
      counterpart.group = oldGroup;
      counterpart.display_no = oldNo;
      if (counterpartDescription) counterpartDescription.rabam = oldGroup === "special";
    }
    descriptionSkills[newKey] = descSkill;
    if (counterpart && counterpartDescription) descriptionSkills[oldKey] = counterpartDescription;
    else delete descriptionSkills[oldKey];
    masterSkill.group = newGroup;
    masterSkill.display_no = newNo;
    descSkill.rabam = newGroup === "special";

    const imageManifest = readJson(imageManifestPath);
    const imageEntries = imageManifest.skills?.[payload.classCode] ?? [];
    const normalizeName = (value) => String(value || "").replace(/[_\s　]/g, "");
    const selectedName = normalizeName(masterSkill.name_ja);
    imageEntries
      .filter((entry) => normalizeName(entry.name) === selectedName)
      .forEach((entry) => {
        entry.special = newGroup === "special";
        entry.no = newNo;
      });
    if (counterpart) {
      const counterpartName = normalizeName(counterpart.name_ja);
      imageEntries
        .filter((entry) => normalizeName(entry.name) === counterpartName)
        .forEach((entry) => {
          entry.special = oldGroup === "special";
          entry.no = oldNo;
        });
    }
    writeJson(imageManifestPath, imageManifest);
  }

  masterSkill.name_ja = payload.skill.name.trim();
  masterSkill.slots = payload.skill.slots;
  masterSkill.sigil_eligible = true;
  descSkill.name = payload.skill.name.trim();
  descSkill.stack = payload.skill.stack.trim() === "" ? null : Number(payload.skill.stack);
  descSkill.ct = payload.skill.ct.trim() || null;
  descSkill.hit = payload.skill.hit.trim() === "" ? null : Number(payload.skill.hit);
  descSkill.pve = Boolean(payload.skill.pve);
  descSkill.pvp = Boolean(payload.skill.pvp);
  descSkill.lines = payload.skill.description.split(/\r?\n/).filter((line) => line.trim() !== "");
  skills.sort((left, right) => {
    if (left.group !== right.group) return left.group === "special" ? -1 : 1;
    return left.display_no - right.display_no;
  });

  const metadata = fs.existsSync(metadataPath) ? readJson(metadataPath) : { schema_version: 1, classes: {} };
  if (payload.skill.iconPath) {
    const manifest = readJson(imageManifestPath);
    const entries = manifest.skills?.[payload.classCode] || [];
    const normalizeName = (value) => String(value || "").replace(/[_\s　]/g, "");
    const publicRoot = path.resolve(repoRoot, "public");
    const skillImageRoot = path.resolve(publicRoot, "画像", "スキル画像");
    const selectedPath = path.resolve(String(payload.skill.iconPath));
    const relativeToSkillImages = path.relative(skillImageRoot, selectedPath);
    const insideSkillImages = relativeToSkillImages !== "" && !relativeToSkillImages.startsWith("..") && !path.isAbsolute(relativeToSkillImages);
    if (!insideSkillImages || !fs.existsSync(selectedPath)) {
      throw new Error(`画像は「${skillImageRoot}」内の既存ファイルを選択してください`);
    }
    const relativePath = path.relative(publicRoot, selectedPath).split(path.sep).join("/");
    let manifestEntry = entries.find((entry) => normalizeName(entry.name) === normalizeName(masterSkill.name_ja))
      || entries.find((entry) => entry.no === masterSkill.display_no && entry.special === (masterSkill.group === "special"));
    if (!manifestEntry) {
      manifestEntry = { no: masterSkill.display_no, special: masterSkill.group === "special", name: masterSkill.name_ja, path: relativePath };
      manifest.skills ||= {};
      manifest.skills[payload.classCode] ||= [];
      manifest.skills[payload.classCode].push(manifestEntry);
    } else {
      manifestEntry.no = masterSkill.display_no;
      manifestEntry.special = masterSkill.group === "special";
      manifestEntry.name = masterSkill.name_ja;
      manifestEntry.path = relativePath;
    }
    writeJson(imageManifestPath, manifest);
    metadata.skill_icon_paths ||= {};
    metadata.skill_icon_paths[payload.skillId] = relativePath;
  }
  metadata.classes ||= {};
  const previousClassMetadata = metadata.classes[payload.classCode] || {};
  metadata.classes[payload.classCode] = {
    ...previousClassMetadata,
    skill_flags: {
      ...(previousClassMetadata.skill_flags || {}),
      [payload.skillId]: {
        ia: payload.skill.ia,
        sa: payload.skill.sa,
        fg: payload.skill.fg,
        enhancement: payload.skill.enhancement,
      },
    },
    skill_notes: {
      ...(previousClassMetadata.skill_notes || {}),
      [payload.skillId]: String(payload.skill.privateNote || ""),
    },
  };

  writeJson(masterPath, master);
  writeJson(descriptionsPath, descriptions);
  fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
  writeJson(metadataPath, metadata);
  return { ok: true, message: "サイト用データへ保存しました", iconPath: metadata.skill_icon_paths?.[payload.skillId] };
});

ipcMain.handle("editor:save-class", async (_event, payload) => {
  if (!payload || !/^[A-Z]{2,3}$/.test(payload.classCode || "")) throw new Error("クラスコードが不正です");
  if (!Array.isArray(payload.passives) || payload.passives.length !== 2) throw new Error("武器パッシブは2件必要です");
  if (!Array.isArray(payload.commonPassives)) throw new Error("共通パッシブが不正です");
  const descriptions = readJson(descriptionsPath);
  const classDescription = descriptions.classes[payload.classCode];
  if (!classDescription) throw new Error("クラスデータが見つかりません");
  const metadata = fs.existsSync(metadataPath) ? readJson(metadataPath) : { schema_version: 1, classes: {} };
  metadata.classes ||= {};
  const commonPassives = metadata.common_passives || [];
  classDescription.passives = payload.passives.map((passive) => {
    const common = commonPassives.find((item) => item.name === passive.commonPassive);
    return {
      name: String(passive.weapon || "").trim(),
      lines: [
        ...String(passive.uniqueBody || "").split(/\r?\n/).filter((line) => line.trim() !== ""),
        ...(common ? [common.name, ...String(common.body || "").split(/\r?\n/).filter((line) => line.trim() !== "")] : []),
      ],
    };
  });
  const previous = metadata.classes[payload.classCode] || {};
  metadata.classes[payload.classCode] = {
    ...previous,
    passive_assignments: payload.passives.map((item) => ({
      weapon: item.weapon,
      weapon_ko: item.weaponKo,
      weapon_en: item.weaponEn,
      common_passive: item.commonPassive,
      unique_body: item.uniqueBody,
    })),
  };
  writeJson(descriptionsPath, descriptions);
  fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
  writeJson(metadataPath, metadata);
  return { ok: true, message: `${payload.classCode}クラスのデータを保存しました` };
});

ipcMain.handle("editor:save-common-passives", async (_event, commonPassives) => {
  if (!Array.isArray(commonPassives)) throw new Error("共通パッシブが不正です");
  const cleaned = commonPassives
    .map((item) => ({ name: String(item.name || "").trim(), body: String(item.body || "") }))
    .filter((item) => item.name && item.name !== "共通パッシブ名A" && item.name !== "共通パッシブ名B");
  const metadata = fs.existsSync(metadataPath) ? readJson(metadataPath) : { schema_version: 1, classes: {} };
  const previous = metadata.common_passives || [];
  const descriptions = readJson(descriptionsPath);
  for (const [classCode, classMetadata] of Object.entries(metadata.classes || {})) {
    const assignments = classMetadata.passive_assignments || [];
    const classPassives = descriptions.classes[classCode]?.passives || [];
    assignments.forEach((assignment, index) => {
      if (!assignment.common_passive) return;
      const oldIndex = previous.findIndex((item) => item.name === assignment.common_passive);
      const replacement = oldIndex >= 0 ? cleaned[oldIndex] : cleaned.find((item) => item.name === assignment.common_passive);
      const uniqueLines = String(assignment.unique_body || "").split(/\r?\n/).filter((line) => line.trim() !== "");
      if (classPassives[index] && uniqueLines.length) {
        classPassives[index].lines = [
          ...uniqueLines,
          ...(replacement ? [replacement.name, ...replacement.body.split(/\r?\n/).filter((line) => line.trim() !== "")] : []),
        ];
      }
      assignment.common_passive = replacement?.name || "";
    });
  }
  metadata.common_passives = cleaned;
  writeJson(descriptionsPath, descriptions);
  writeJson(metadataPath, metadata);
  return { ok: true, message: "共通パッシブ原本を保存し、割り当て済みクラスへ反映しました", commonPassives: cleaned };
});

ipcMain.handle("editor:save-update-histories", async (_event, histories) => {
  if (!histories || typeof histories !== "object" || Array.isArray(histories)) {
    throw new Error("更新履歴が不正です");
  }
  const cleaned = {};
  for (const [classCode, value] of Object.entries(histories)) {
    if (!/^[A-Z]{2,3}$/.test(classCode)) continue;
    assertText(value, `${classCode}の更新履歴`);
    cleaned[classCode] = value;
  }
  const metadata = fs.existsSync(metadataPath) ? readJson(metadataPath) : { schema_version: 1, classes: {} };
  metadata.classes ||= {};
  for (const [classCode, value] of Object.entries(cleaned)) {
    metadata.classes[classCode] ||= {};
    metadata.classes[classCode].update_history = value;
  }
  delete metadata.update_histories;
  fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
  writeJson(metadataPath, metadata);
  return { ok: true, message: "更新情報を各クラスのデータへ保存しました" };
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
  await runNpx(["vitest", "run", "--dir", "tests"], "サイトデータのテスト");
  // public/画像を既存正本として扱い、画像同期処理は実行しない。
  await runNpx(["tsc", "--noEmit"], "サイトの型チェック");
  await runNpx(["vite", "build"], "サイトのビルド");
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
    "editor-app/desktop/preload.cjs",
    "editor-app/print-template/index.html",
    "editor-app/print-template/assets/DK.svg",
    "editor-app/README.md",
    "editor-app/src/DataEditorPrototype.tsx",
    "editor-app/src/data-editor.css",
    "editor-app/src/desktop-api.d.ts",
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
