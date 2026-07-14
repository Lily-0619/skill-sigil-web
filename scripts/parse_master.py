# -*- coding: utf-8 -*-
"""マスタExcel → src/data/master.json 変換スクリプト。

使い方:
    python scripts/parse_master.py <マスタExcelのパス>

Excel構造(各クラスシート):
  行3-6   : 特別スキル(ラバム) 1-4  … 列グループ B/G/L/Q (番号,名前,枠タイプ×4行)
  行7-10  : 通常スキル 1-4
  行11-14 : 通常スキル 5-8
  行15-18 : 通常スキル 9-12
  行19    : 通常スキル 13 (秘伝装着不可・枠なし)
"""
import json
import sys
import unicodedata
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent  # skill-sigil-web/
OUT = ROOT / "src" / "data" / "master.json"

# クラスコード → 日本語名 (docs/04_データ設計書.md D-003正本 + コード対応は2026-07-13にまな承認スコープで確定)
CLASS_NAMES = {
    "WR": "ウォーリア", "RG": "レンジャー", "WT": "ウィッチ", "GA": "ジャイアント",
    "VK": "ヴァルキリー", "BD": "ブレイダー", "SR": "ソーサレス", "DK": "ダークナイト",
    "LS": "リトルサマナー", "TB": "ツバキ", "KT": "格闘家", "LN": "ラン",
    "MT": "ミスティック", "SH": "シャイ", "AC": "アーチャー", "HS": "ハサシン",
    "NJ": "忍者", "NV": "ノヴァ", "GD": "ガーディアン", "KN": "くノ一",
    "CO": "コルセア", "SG": "セージ", "DR": "ドラカニア", "MG": "メグ",
    "WS": "ウサ", "WZ": "ウィザード", "SC": "スカラー", "DS": "ドーサ",
    "DE": "デッドアイ", "SP": "セラフィム",
    "UC": "(未実装クラス)",
}

TYPE_BY_NAME = {
    "微か": "faint", "整った": "refined", "鮮明": "defined", "無欠": "flawless",
    "煌めく": "radiant", "守護": "guardian", "系列": "branch",
    # 画像側エイリアス
    "希微": "faint", "整頓": "refined", "燦爛": "radiant",
}

SIGIL_TYPES = [
    {"id": "branch",   "name": "系列",   "alias": "系列",  "color": "#D9D9D9"},
    {"id": "guardian", "name": "守護",   "alias": "守護",  "color": "#F4B183"},
    {"id": "flawless", "name": "無欠",   "alias": "無欠",  "color": "#D9E2F3"},
    {"id": "defined",  "name": "鮮明",   "alias": "鮮明",  "color": "#BDD7EE"},
    {"id": "refined",  "name": "整った", "alias": "整頓",  "color": "#C6E0B4"},
    {"id": "faint",    "name": "微か",   "alias": "希微",  "color": "#FFF2CC"},
    {"id": "radiant",  "name": "煌めく", "alias": "燦爛",  "color": "#F4B6D2"},
]

# 効果マスタ (docs/11_効果マスタ数値.md 正本 + 系列効果名はExcel「リスト」「名称」シートで2026-07-13判明)
# values: {rarity: [a, b] or [a] } / 存在しない等級はキーなし
# two_effects: 無欠のカンマ区切り(2効果同時付与)のみ true
EFFECTS = [
    # 煌めく (混沌のみ)
    {"effect_id": "radiant_cooltime", "sigil_type_id": "radiant", "name_ja": "スキル使用時全体のクールタイム減少", "values": {"chaos": ["0.2秒"]}},
    {"effect_id": "radiant_maxcount", "sigil_type_id": "radiant", "name_ja": "スキルの最大回数増加", "values": {"chaos": ["1"]}},
    {"effect_id": "radiant_instant", "sigil_type_id": "radiant", "name_ja": "スキルが即時発動に変更", "values": {"chaos": []}, "valueless": True},
    # 守護
    {"effect_id": "guardian_superarmor", "sigil_type_id": "guardian", "name_ja": "スキル使用時スーパーアーマー発動", "values": {"abyssal": ["0.1秒", "0.2秒"], "primal": ["0.3秒", "0.4秒"], "chaos": ["0.5秒", "0.6秒"]}},
    {"effect_id": "guardian_frontguard", "sigil_type_id": "guardian", "name_ja": "スキル使用時前方ガード発動", "values": {"abyssal": ["0.1秒", "0.2秒"], "primal": ["0.3秒", "0.4秒"], "chaos": ["0.5秒", "0.6秒"]}},
    {"effect_id": "guardian_ungrab", "sigil_type_id": "guardian", "name_ja": "スキル使用時掴み不可発動", "values": {"abyssal": ["0.1秒", "0.2秒"], "primal": ["0.3秒", "0.4秒"], "chaos": ["0.5秒", "0.6秒"]}},
    {"effect_id": "guardian_dmgreduce", "sigil_type_id": "guardian", "name_ja": "スキル使用時ダメージ減少発動", "values": {"primal": ["0.1秒", "0.2秒"], "chaos": ["0.3秒", "0.4秒"]}},
    # 無欠
    {"effect_id": "flawless_finaldmgdown", "sigil_type_id": "flawless", "name_ja": "スキル使用時受ける最終ダメージ量減少", "values": {"abyssal": ["10%"], "primal": ["12.5%"], "chaos": ["15%"]}},
    {"effect_id": "flawless_atkdefup", "sigil_type_id": "flawless", "name_ja": "スキル使用時3秒間攻撃力・防御力増加", "values": {"abyssal": ["20"], "primal": ["40"], "chaos": ["60"]}},
    {"effect_id": "flawless_debuff", "sigil_type_id": "flawless", "name_ja": "スキルヒット時攻撃力・防御力減少および攻撃速度・移動速度減少", "values": {"abyssal": ["20", "3%"], "primal": ["40", "6%"], "chaos": ["40", "9%"]}, "two_effects": True},
    {"effect_id": "flawless_seriesdmgdown", "sigil_type_id": "flawless", "name_ja": "スキルヒット時受ける系列ダメージ減少", "values": {"abyssal": ["4%"], "primal": ["8%"], "chaos": ["12%"]}},
    # 鮮明
    {"effect_id": "defined_range", "sigil_type_id": "defined", "name_ja": "スキル攻撃範囲増加", "values": {"abyssal": ["1%", "2%"], "primal": ["3%", "4%"], "chaos": ["5%", "6%"]}},
    {"effect_id": "defined_dmgup", "sigil_type_id": "defined", "name_ja": "スキル使用時ダメージ量増加", "values": {"abyssal": ["1%", "2%"], "primal": ["3%", "4%"], "chaos": ["5%", "6%"]}},
    {"effect_id": "defined_cooldown", "sigil_type_id": "defined", "name_ja": "スキル再使用時間減少", "values": {"abyssal": ["2%", "4%"], "primal": ["6%", "8%"], "chaos": ["10%", "12%"]}},
    {"effect_id": "defined_targets", "sigil_type_id": "defined", "name_ja": "スキル使用時ヒット対象数増加", "values": {"chaos": ["1"]}},
    # 整った
    {"effect_id": "refined_heal", "sigil_type_id": "refined", "name_ja": "スキル使用時ヒットごとに生命力回復", "values": {"abyssal": ["20", "40"], "primal": ["60", "80"], "chaos": ["100", "120"]}},
    {"effect_id": "refined_atkup", "sigil_type_id": "refined", "name_ja": "スキル使用時攻撃力増加", "values": {"abyssal": ["5", "10"], "primal": ["15", "20"], "chaos": ["25", "30"]}},
    {"effect_id": "refined_defup", "sigil_type_id": "refined", "name_ja": "スキル使用時防御力増加", "values": {"abyssal": ["5", "10"], "primal": ["15", "20"], "chaos": ["25", "30"]}},
    {"effect_id": "refined_critrate", "sigil_type_id": "refined", "name_ja": "スキル中クリティカル確率増加", "values": {"abyssal": ["1%", "2%"], "primal": ["3%", "4%"], "chaos": ["5%", "6%"]}},
    {"effect_id": "refined_critdmg", "sigil_type_id": "refined", "name_ja": "スキル中クリティカルダメージ量増加", "values": {"abyssal": ["2%", "4%"], "primal": ["6%", "8%"], "chaos": ["10%", "12%"]}},
    # 微か
    {"effect_id": "faint_dot", "sigil_type_id": "faint", "name_ja": "スキル使用時3秒間毎秒ダメージ", "values": {"abyssal": ["20", "40"], "primal": ["60", "80"], "chaos": ["100", "120"]}},
    {"effect_id": "faint_atkdown", "sigil_type_id": "faint", "name_ja": "スキルヒット時3秒間攻撃力減少", "values": {"abyssal": ["50"], "primal": ["100"], "chaos": ["150"]}},
    {"effect_id": "faint_defdown", "sigil_type_id": "faint", "name_ja": "スキルヒット時3秒間防御力減少", "values": {"abyssal": ["50"], "primal": ["100"], "chaos": ["150"]}},
    {"effect_id": "faint_aspdup", "sigil_type_id": "faint", "name_ja": "スキル使用時攻撃速度増加", "values": {"abyssal": ["3%"], "primal": ["6%"], "chaos": ["9%"]}},
    {"effect_id": "faint_mspdup", "sigil_type_id": "faint", "name_ja": "スキル使用時移動速度増加", "values": {"abyssal": ["3%"], "primal": ["6%"], "chaos": ["9%"]}},
    {"effect_id": "faint_aspddown", "sigil_type_id": "faint", "name_ja": "スキルヒット時3秒間攻撃速度減少", "values": {"abyssal": ["3%"], "primal": ["6%"], "chaos": ["9%"]}},
    {"effect_id": "faint_mspddown", "sigil_type_id": "faint", "name_ja": "スキルヒット時3秒間移動速度減少", "values": {"abyssal": ["3%"], "primal": ["6%"], "chaos": ["9%"]}},
    # 系列 (深淵のみ・10%統一 / 効果名は元Excel「リスト」シートで判明)
    {"effect_id": "branch_arl", "sigil_type_id": "branch", "name_ja": "アールのスキル秘伝", "values": {"abyssal": ["10%"]}},
    {"effect_id": "branch_celt", "sigil_type_id": "branch", "name_ja": "セルトのスキル秘伝", "values": {"abyssal": ["10%"]}},
    {"effect_id": "branch_ahib", "sigil_type_id": "branch", "name_ja": "アヒブのスキル秘伝", "values": {"abyssal": ["10%"]}},
    {"effect_id": "branch_labreve", "sigil_type_id": "branch", "name_ja": "ラブリフのスキル秘伝", "values": {"abyssal": ["10%"]}},
]


def norm(s):
    if s is None:
        return ""
    return unicodedata.normalize("NFKC", str(s)).strip()


def parse_class_sheet(ws, code, warnings):
    """1クラスシートから17スキルを抽出する。"""
    skills = []
    col_groups = [2, 7, 12, 17]  # B, G, L, Q

    def read_block(row, group, start_no):
        for gi, col in enumerate(col_groups):
            no_cell = norm(ws.cell(row=row, column=col).value)
            name = norm(ws.cell(row=row, column=col + 1).value)
            if not no_cell and not name:
                continue
            try:
                no = int(float(no_cell)) if no_cell else start_no + gi
            except ValueError:
                no = start_no + gi
            slots = []
            for r in range(row, row + 4):
                t = norm(ws.cell(row=r, column=col + 2).value)
                if t:
                    tid = TYPE_BY_NAME.get(t)
                    if tid is None:
                        warnings.append(f"{code}: 不明な秘伝タイプ '{t}' (row {r})")
                    else:
                        slots.append(tid)
            skills.append({
                "skill_id": f"{code}_{'sp' if group == 'special' else 'n'}_{no}",
                "group": group,
                "display_no": no,
                "name_ja": name or f"(名称未設定 {no})",
                "sigil_eligible": len(slots) == 4,
                "slots": slots if len(slots) == 4 else None,
            })

    read_block(3, "special", 1)
    read_block(7, "normal", 1)
    read_block(11, "normal", 5)
    read_block(15, "normal", 9)
    # 通常13 (枠なし)
    no13 = norm(ws.cell(row=19, column=2).value)
    name13 = norm(ws.cell(row=19, column=3).value)
    if name13:
        skills.append({
            "skill_id": f"{code}_n_13", "group": "normal", "display_no": 13,
            "name_ja": name13, "sigil_eligible": False, "slots": None,
        })
    else:
        warnings.append(f"{code}: 下段13番が空欄")
    return skills


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "スキル秘伝_v0.1_PN_修復済み_20260713.xlsx"
    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)

    skip = {"表紙", "テンプレ", "名称", "リスト", "アイコン素材"}
    class_sheets = [n for n in wb.sheetnames if n not in skip]

    warnings = []
    classes = []
    skills_by_class = {}
    for i, code in enumerate(class_sheets):
        name = CLASS_NAMES.get(code)
        if name is None:
            warnings.append(f"未知のクラスコード: {code}")
            name = code
        skills = parse_class_sheet(wb[code], code, warnings)
        # LS 下段13「神獣の加護」入力漏れ対応 (docs/20260712_要件整理ログ.md)
        if not any(s["group"] == "normal" and s["display_no"] == 13 for s in skills):
            skills.append({
                "skill_id": f"{code}_n_13", "group": "normal", "display_no": 13,
                "name_ja": "神獣の加護" if code == "LS" else "(未登録)",
                "sigil_eligible": False, "slots": None,
            })
            warnings.append(f"{code}: 下段13番を補完 ({'神獣の加護' if code == 'LS' else '未登録'})")
        n_special = sum(1 for s in skills if s["group"] == "special")
        n_normal = sum(1 for s in skills if s["group"] == "normal")
        if n_special != 4 or n_normal != 13:
            warnings.append(f"{code}: スキル数異常 special={n_special} normal={n_normal}")
        classes.append({
            "class_id": code, "code": code, "name_ja": name,
            "sort_order": i, "enabled": True,
        })
        skills_by_class[code] = sorted(
            skills, key=lambda s: (0 if s["group"] == "special" else 1, s["display_no"])
        )

    # UC等: シートが無いがボタン画像があるクラスは enabled=false で登録しない
    # (クラス一覧はシート基準。画像マニフェスト側で未使用ボタンを検出)

    master = {
        "schema_version": 1,
        "master_version": "2026-07-13",
        "sigil_types": SIGIL_TYPES,
        "rarities": [
            {"id": "abyssal", "name": "深淵", "color": "#D32F2F"},
            {"id": "primal", "name": "太古", "color": "#C2185B"},
            {"id": "chaos", "name": "混沌", "color": "#0D47A1"},
        ],
        "effects": [dict(e, sort_order=i, enabled=True) for i, e in enumerate(EFFECTS)],
        "classes": classes,
        "skills": skills_by_class,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(master, ensure_ascii=False, indent=1), encoding="utf-8")

    total = sum(len(v) for v in skills_by_class.values())
    print(f"classes={len(classes)} skills={total} -> {OUT}")
    for w in warnings:
        print("WARN:", w)


if __name__ == "__main__":
    main()
