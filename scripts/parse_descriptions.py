# -*- coding: utf-8 -*-
"""説明Excel(資料/説明(パッシブ・スキル)/*.xlsx) → src/data/descriptions.json 変換スクリプト。

使い方:
    python scripts/parse_descriptions.py

HPに表示するのは日本語(正)列(E列)のみ。抽出ルール(2026-07-15 まな指示):
  - 改行・字下げ・「・」・効果の順番は変えない (行をそのまま配列に入れる)
  - 秘伝の種別タグ(系列/無欠/鮮明/洗練された/かすかな/守護/燦爛)は省く
  - PvE/PvP はフラグ化してチップ表示に使う (PvP=#eca6b7 / PvE=#a6d7ec)
  - パッシブ(①)(②) = 武器種1/2。名称行が武器名(タブラベル)
  - スキル(闇精霊の怒り) は「・武器(の)選択…」行を境に共通部と武器別2区間に分割
    (武器選択でCCが変わるため、パッシブの武器タブに連動して表示を切り替える)
  - スキル(1〜13) = 通常スキル番号、ラバムスキル(1〜4) = 特別スキル番号
  - スキル(０)は実装予定なしのため出力しない

タグ行の表記ゆれ対応:
  - 「PvE PvP ｜系列 無欠 …」の1行形式 (WR等)
  - 「PvE」行と「系列 無欠 …」行に分かれた2行形式 (VK等)
  - 先頭に「ラバム技術/ラバムスキル」が付く形式
"""
import glob
import json
import os
import re
import sys

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "資料", "説明(パッシブ・スキル)")
OUT = os.path.join(ROOT, "src", "data", "descriptions.json")
MASTER = os.path.join(ROOT, "src", "data", "master.json")

# 用語修正 (fix_terms.py と同じルール。未修正の元データから再生成しても安全なように冪等化)
REPLACEMENTS = [("スタン", "気絶"), ("黒精霊", "闇精霊")]

# 秘伝の種別 (계열tier) の日本語統一表記。この単語だけで構成される行はタグ行として省く
TIER_WORDS = {"系列", "無欠", "鮮明", "洗練された", "かすかな", "守護", "燦爛"}
PV_WORDS = {"PvE", "PvP"}
RABAM_WORDS = {"ラバム技術", "ラバムスキル"}

WEAPON_LINE = re.compile(r"武器の?選択")

dropped_tags = []  # レポート用
warnings = []


def norm(s):
    for old, new in REPLACEMENTS:
        s = s.replace(old, new)
    return s


def col_e_lines(ws, min_row):
    """min_row以降のE列を、空セルを除いてそのままの文字列リストで返す。"""
    out = []
    for row in ws.iter_rows(min_row=min_row, min_col=5, max_col=5):
        v = row[0].value
        if isinstance(v, str) and v.strip() != "":
            out.append(norm(v))
    return out


def classify_tag(line):
    """タグ行なら {'pve','pvp','rabam'} の部分フラグdictを、違えばNoneを返す。"""
    s = line.strip()
    if s.startswith("・") or s.startswith("　"):
        return None
    if "｜" in s:
        left = s.split("｜")[0]
        toks = set(left.split())
        if toks <= (PV_WORDS | RABAM_WORDS):
            return {
                "pve": "PvE" in toks,
                "pvp": "PvP" in toks,
                "rabam": bool(toks & RABAM_WORDS),
            }
        return None
    toks = set(s.split())
    if not toks:
        return None
    if toks <= (PV_WORDS | RABAM_WORDS):
        return {
            "pve": "PvE" in toks,
            "pvp": "PvP" in toks,
            "rabam": bool(toks & RABAM_WORDS),
        }
    if toks <= TIER_WORDS:  # 「系列 無欠 鮮明 …」だけの行 → 種別タグ(省く)
        return {}
    return None


def parse_body(lines, where):
    """本文行列からタグ行を除去し、(フラグ, 残り行) を返す。順番は変えない。"""
    flags = {"pve": False, "pvp": False, "rabam": False}
    kept = []
    for ln in lines:
        tag = classify_tag(ln)
        if tag is not None:
            dropped_tags.append(f"{where}: {ln}")
            for k, v in tag.items():
                flags[k] = flags[k] or v
        else:
            if "系列" in ln and not ln.startswith(("・", "　")):
                warnings.append(f"{where}: 種別らしき行が残存: {ln!r}")
            kept.append(ln)
    return flags, kept


def parse_sheet(ws, where):
    """名称(B2..E2のE) と 説明行(3行目以降のE) を返す。"""
    name_cell = ws.cell(row=2, column=5).value
    name = norm(name_cell) if isinstance(name_cell, str) else ""
    lines = col_e_lines(ws, 3)
    flags, kept = parse_body(lines, where)
    return name, flags, kept


def split_rage(lines):
    """闇精霊の怒りの本文を 共通部 + 武器別セクション(0 or 2個) に分割。"""
    marks = [i for i, ln in enumerate(lines) if WEAPON_LINE.search(ln)]
    if len(marks) == 0:
        return lines, []
    common = lines[: marks[0]]
    if len(marks) == 1:
        return common, [lines[marks[0]:], []]
    return common, [lines[marks[0]: marks[1]], lines[marks[1]:]]


def main():
    files = sorted(glob.glob(os.path.join(DATA_DIR, "黒い砂漠M_説明_*.xlsx")))
    if len(files) != 30:
        print(f"警告: ファイル数が30ではありません ({len(files)})", file=sys.stderr)
    with open(MASTER, encoding="utf-8") as f:
        master = json.load(f)

    classes = {}
    for path in files:
        abbr = os.path.basename(path).replace("黒い砂漠M_説明_", "").replace(".xlsx", "")
        wb = openpyxl.load_workbook(path, read_only=True)
        sheet_by_name = {n.strip(): n for n in wb.sheetnames}

        # パッシブ(①)(②)
        passives = []
        for label in ["パッシブ(①)", "パッシブ(②)"]:
            ws = wb[sheet_by_name[label]]
            name, _flags, kept = parse_sheet(ws, f"{abbr}/{label}")
            passives.append({"name": name, "lines": kept})

        # スキル(闇精霊の怒り) — 旧名(黒精霊)にも対応
        rage_key = next(
            (k for k in sheet_by_name if "怒り" in k), None
        )
        rage = None
        if rage_key:
            ws = wb[sheet_by_name[rage_key]]
            name, flags, kept = parse_sheet(ws, f"{abbr}/{rage_key}")
            common, weapon = split_rage(kept)
            rage = {
                "name": name,
                "pve": flags["pve"],
                "pvp": flags["pvp"],
                "common": common,
                "weapon": weapon,
            }
        else:
            warnings.append(f"{abbr}: 闇精霊の怒りシートなし")

        # スキル(1〜13) と ラバムスキル(1〜4)。スキル(０)は対象外。
        skills = {}
        for stripped, actual in sheet_by_name.items():
            m = re.fullmatch(r"スキル\((\d+)\)", stripped)
            key = None
            if m:
                if int(m.group(1)) == 0:  # スキル(０)は実装予定なし
                    continue
                key = f"n_{int(m.group(1))}"
            else:
                m = re.fullmatch(r"ラバムスキル\((\d+)\)", stripped)
                if m:
                    key = f"sp_{int(m.group(1))}"
            if not key:
                continue
            ws = wb[actual]
            name, flags, kept = parse_sheet(ws, f"{abbr}/{stripped}")
            skills[key] = {
                "name": name,
                "pve": flags["pve"],
                "pvp": flags["pvp"],
                "rabam": flags["rabam"],
                "lines": kept,
            }

        wb.close()

        # master.json の名称と照合 (人間の編集用の参考情報。失敗にはしない)
        for s in master["skills"].get(abbr, []):
            key = f"{'sp' if s['group'] == 'special' else 'n'}_{s['display_no']}"
            d = skills.get(key)
            if d and d["name"] and s["name_ja"] and d["name"] != s["name_ja"]:
                warnings.append(
                    f"{abbr}/{key}: 名称不一致 master={s['name_ja']!r} excel={d['name']!r}"
                )

        classes[abbr] = {"passives": passives, "rage": rage, "skills": skills}

    data = {"schema_version": 1, "classes": classes}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    size = os.path.getsize(OUT)
    print(f"OK: {len(classes)}クラス → {OUT} ({size/1024:.0f} KB)")
    print(f"タグ行として省いた行: {len(dropped_tags)}件")
    if warnings:
        print(f"--- 警告 {len(warnings)}件 ---")
        for w in warnings:
            print(" ", w)


if __name__ == "__main__":
    main()
