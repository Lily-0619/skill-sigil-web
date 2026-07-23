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
        # スキル秘伝の種類・等級・効果は src/game-rules/skill-sigil.json が正本。
        # アプリは src/data/master.ts でそこと合成するため、ここでは出力しない。
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
