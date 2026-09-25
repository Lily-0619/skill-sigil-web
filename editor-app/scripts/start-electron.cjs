const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const editorRoot = path.resolve(__dirname, "..");
const candidates = [
  path.join(editorRoot, "node_modules", "electron", "dist", "electron.exe"),
  path.join(editorRoot, "..", "node_modules", "electron", "dist", "electron.exe"),
];
const executable = candidates.find((candidate) => fs.existsSync(candidate));

if (!executable) {
  console.error("Electron本体が見つかりません。editor-appで npm install をやり直してください。");
  process.exit(1);
}

const child = spawn(executable, [editorRoot], { stdio: "inherit", windowsHide: false });
child.on("exit", (code) => process.exit(code ?? 0));
