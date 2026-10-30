// 人間が確認済みにしたMarkdownから空虚候補を正本へ反映する。
// 既存候補・既存IDは変更せず、空虚は複合効果とペナルティを不可分の候補として登録。
import './export_void_sigil_review.mjs';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const review = read('docs/data/void-sigil.review.json');
if (review.candidates.some(c => !['確認', '確認済'].includes(c.review_status))) {
  throw new Error('未確認候補があります。確認用Markdownを確認してください。');
}
const target = new URL('src/game-rules/skill-sigil.json', root);
const rules = read('src/game-rules/skill-sigil.json');
rules.rarities = rules.rarities.filter(r => r.id !== 'void');
rules.rarities.push({ id: 'void', name: '空虚', color: '#9465C8' });
rules.effects = rules.effects.filter(e => !e.effect_id.startsWith('void_'));
for (const [i, c] of review.candidates.entries()) {
  rules.effects.push({
    effect_id: `void_${c.id.toLowerCase()}`, sigil_type_id: c.type_id,
    name_ja: c.effect_text_ja + (c.penalty_text_ja ? ` 【デメリット：${c.penalty_text_ja}】` : ''),
    values: { void: [] }, valueless: true, sort_order: 100 + i, enabled: true,
    candidate_id: c.id, effect_text_ja: c.effect_text_ja,
    penalty_text_ja: c.penalty_text_ja, probability_percent: c.probability_percent,
  });
}
fs.writeFileSync(target, JSON.stringify(rules, null, 2) + '\n');
console.log(`${fileURLToPath(target)}: 空虚${review.candidates.length}候補を反映`);
