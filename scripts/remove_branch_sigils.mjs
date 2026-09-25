import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const write = (relative, value, indent) =>
  fs.writeFileSync(path.join(root, relative), `${JSON.stringify(value, null, indent)}\n`, "utf8");

const master = read("src/data/master.json");
let removedSlots = 0;
for (const skills of Object.values(master.skills)) {
  for (const skill of skills) {
    if (!Array.isArray(skill.slots)) continue;
    const next = skill.slots.filter((slot) => slot !== "branch").slice(0, 3);
    removedSlots += skill.slots.length - next.length;
    skill.slots = next;
  }
}
write("src/data/master.json", master, 1);

const rules = read("src/game-rules/skill-sigil.json");
rules.sigil_types = rules.sigil_types.filter((type) => type.id !== "branch");
rules.effects = rules.effects.filter((effect) => effect.sigil_type_id !== "branch");
write("src/game-rules/skill-sigil.json", rules, 2);

const manifest = read("src/data/imageManifest.json");
for (const key of Object.keys(manifest.sigilIcons ?? {})) {
  if (key === "branch" || key.startsWith("branch_")) delete manifest.sigilIcons[key];
}
write("src/data/imageManifest.json", manifest, 1);

console.log(`系列枠を${removedSlots}件削除しました。`);
