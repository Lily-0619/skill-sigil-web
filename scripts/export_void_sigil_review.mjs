import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 確認用Markdownだけを読み、候補単位の中間JSONへ変換する。本番正本には触れない。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = 'docs/20_空虚スキル秘伝_確認用.md';
const output = 'docs/data/void-sigil.review.json';
const text = fs.readFileSync(path.join(root, source), 'utf8');
const types = new Set(['faint', 'refined', 'defined', 'flawless', 'radiant', 'guardian']);
const expected = { faint: 12, refined: 10, defined: 12, flawless: 19, radiant: 5, guardian: 4 };
const ids = new Set();
const candidates = [];
for (const [index, line] of text.split(/\r?\n/).entries()) {
  if (!/^\|\s*[VRDFLG]\d+\s*\|/.test(line)) continue;
  const cells = line.split('|').slice(1, -1).map(s => s.trim());
  const [id, type_id, effect_text_ja, penalty, probability, review_status] = cells;
  const fail = message => { throw new Error(`${source}:${index + 1}: ${message}`); };
  if (cells.length !== 6) fail('列数は6列です。本文に半角 | は使わないでください。');
  if (ids.has(id)) fail(`ID重複: ${id}`);
  if (!types.has(type_id)) fail(`不明な種類ID: ${type_id}`);
  if (!effect_text_ja || !penalty) fail('効果・デメリットは空欄にできません。');
  if (!/^\d+(?:\.\d{1,4})?%$/.test(probability)) fail('確率は 2.5000% の形式です。');
  const probability_percent = Number(probability.slice(0, -1));
  if (probability_percent <= 0 || probability_percent > 100) fail('確率が範囲外です。');
  if (!['未確認', '要確認', '確認済', '確認'].includes(review_status)) fail('確認欄の値が不正です。');
  ids.add(id);
  candidates.push({ id, rarity_id: 'void', type_id, effect_text_ja,
    penalty_text_ja: penalty === 'なし' ? null : penalty,
    probability_percent, probability_display: probability, review_status });
}
if (candidates.length !== 62) throw new Error(`候補数が62件ではありません: ${candidates.length}`);
for (const [type, count] of Object.entries(expected)) {
  if (candidates.filter(c => c.type_id === type).length !== count) throw new Error(`${type}の件数不一致`);
}
const sumUnits = candidates.reduce((n, c) => n + Math.round(c.probability_percent * 10000), 0);
if (Math.abs(sumUnits - 1000000) > 10) throw new Error(`確率合計を確認してください: ${sumUnits / 10000}%`);
const data = {
  schema_version: 1, status: 'review_only', source_markdown: source,
  rarity: { id: 'void', name_ja: '空虚', id_status: 'proposed', icon: 'docs/data/void-sigil-icon.png' },
  probability_scope: '未確認の空虚スキル秘伝・全候補（韓国公式、国内未確定）',
  sources: ['ユーザー提供日本語一覧画像2枚', 'https://www.blackdesertm.com/Ocean/Wiki?wikiNo=10011002',
    'https://www.world.blackdesertm.com/Ocean/News/Detail?boardNo=4819'],
  integration_note: '候補単位の中間データ。本番skill-sigil.jsonへの直接上書き不可。複合効果・デメリット対応が必要。',
  unresolved: candidates.filter(c => c.review_status === '要確認').map(c => c.id),
  candidate_count: candidates.length, probability_total_percent: sumUnits / 10000, candidates,
};
fs.mkdirSync(path.dirname(path.join(root, output)), { recursive: true });
fs.writeFileSync(path.join(root, output), JSON.stringify(data, null, 2) + '\n');
console.log(`${output}: ${candidates.length}件、確率合計${sumUnits / 10000}%、要確認: ${data.unresolved.join(', ') || 'なし'}`);
