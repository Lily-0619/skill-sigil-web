import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { master } from '../src/data/master';
import review from '../docs/data/void-sigil.review.json';
import { emptyUserData } from '../src/types';
import { canEquip, canEquipFree, rarityAvailable } from '../src/logic/equip';
import { buildWorkbook, parseWorkbook } from '../src/logic/excel';
import { buildCompareData } from '../src/logic/compare';
import { rarityMeets, slotScore } from '../src/logic/progress';
import { idbGet, idbSet } from '../src/lib/db';

describe('空虚の候補とバックアップ', () => {
  it('確認済み62候補の複合効果・デメリットを失わず、同効果の別候補も区別する', () => {
    expect(master.effects.filter(e => 'void' in e.values)).toHaveLength(62);
    for (const c of review.candidates) {
      const effect = master.effects.find(e => e.candidate_id === c.id)!;
      expect(effect.effect_text_ja).toBe(c.effect_text_ja);
      expect(effect.penalty_text_ja).toBe(c.penalty_text_ja);
      expect(effect.probability_percent).toBe(c.probability_percent);
      expect(rarityAvailable(master, effect.effect_id, 'void')).toBe(true);
      expect(rarityAvailable(master, effect.effect_id, 'chaos')).toBe(false);
      if (c.penalty_text_ja) expect(effect.name_ja).toContain(c.penalty_text_ja);
    }
    expect(new Set(master.effects.map(e => e.effect_id)).size).toBe(master.effects.length);
  });

  it('全候補をMy/Freeで装着でき、ExcelとIndexedDBで保持できる', async () => {
    const d = emptyUserData();
    const build = { build_id: 'v', class_id: 'WR', name: '空虚', mode: 'my' as const, created_at: '', updated_at: '' };
    d.builds.push(build, { ...build, build_id: 'free', mode: 'free' });
    for (const eff of master.effects.filter(e => e.candidate_id)) {
      const skill = master.skills.WR.find(s => s.slots?.includes(eff.sigil_type_id))!;
      const slot = skill.slots!.indexOf(eff.sigil_type_id) + 1;
      const item = { inventory_id: eff.effect_id, sigil_type_id: eff.sigil_type_id,
        effect_id: eff.effect_id, rarity: 'void' as const, value_text: '', quantity: 1,
        note: '', created_at: '', updated_at: '' };
      d.inventory.push(item);
      expect(canEquip(master, d, 'WR', 'v', skill.skill_id, slot, item).ok).toBe(true);
      expect(canEquipFree(master, d, 'WR', 'free', skill.skill_id, slot, eff.effect_id).ok).toBe(true);
    }
    // 同じ枠には同時装着しない。デメリット付き候補のMy/Freeを各1件保持。
    const skill = master.skills.WR.find(s => s.slots?.includes('faint'))!;
    const slot = skill.slots!.indexOf('faint') + 1;
    d.equips.push({ build_id: 'v', skill_id: skill.skill_id, slot_no: slot, inventory_id: 'void_v09' });
    d.freeEquips.push({ build_id: 'free', skill_id: skill.skill_id, slot_no: slot,
      effect_id: 'void_v10', rarity: 'void', value_text: '' });
    const bytes = XLSX.write(buildWorkbook(master, d), { type: 'array', bookType: 'xlsx' });
    const result = parseWorkbook(master, XLSX.read(bytes, { type: 'array' }));
    expect(result.issues.errors).toEqual([]);
    expect(result.parsed!.inventory.map(i => [i.effect_id, i.rarity])).toEqual(d.inventory.map(i => [i.effect_id, i.rarity]));
    expect(result.parsed!.equips).toEqual(d.equips);
    expect(result.parsed!.freeEquips).toEqual(d.freeEquips);
    await idbSet('void_test', d);
    expect(await idbGet('void_test')).toEqual(d);
    const comparison = buildCompareData(master, d, build);
    expect(comparison.rarityCounts.find(r => r.id === 'void')?.count).toBe(1);
    expect(comparison.summary[0].effects[0].name).toContain('デメリット');
    expect(rarityMeets('void', 'chaos')).toBe(true);
    expect(slotScore(master, 'void', true, 'void_v09', '')).toBe(1);
  });
});
