# -*- coding: utf-8 -*-
"""説明Excel(資料/説明(パッシブ・スキル)/*.xlsx) の用語一括修正スクリプト。

日本語(正)列(E列)のみを置換する。日本語(AI)列(D列)はAI訳の記録として保存し、触らない
(作業指示書 §5「後で人間がE列だけ修正、D列は保存」に準拠)。
シート名「スキル(黒精霊の怒り)」も「スキル(闇精霊の怒り)」へ改名する
(30クラスのスキルは黒精霊ではなく闇精霊のため)。

使い方:
    python scripts/fix_terms.py
"""
import glob
import os
import sys

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "資料", "説明(パッシブ・スキル)")

# 置換ルール (適用順)。追加の用語修正が出たらここに足す。
REPLACEMENTS = [
    ("スタン", "気絶"),
    ("黒精霊", "闇精霊"),
]

RAGE_OLD = "スキル(黒精霊の怒り)"
RAGE_NEW = "スキル(闇精霊の怒り)"


def fix_file(path: str) -> dict:
    wb = openpyxl.load_workbook(path)
    counts = {old: 0 for old, _ in REPLACEMENTS}
    renamed = False
    for ws in wb.worksheets:
        if ws.title == RAGE_OLD:
            ws.title = RAGE_NEW
            renamed = True
        for row in ws.iter_rows(min_col=5, max_col=5):
            cell = row[0]
            v = cell.value
            if not isinstance(v, str):
                continue
            nv = v
            for old, new in REPLACEMENTS:
                if old in nv:
                    counts[old] += nv.count(old)
                    nv = nv.replace(old, new)
            if nv != v:
                cell.value = nv
    wb.save(path)
    wb.close()
    return {"counts": counts, "renamed": renamed}


def main() -> int:
    files = sorted(glob.glob(os.path.join(DATA_DIR, "黒い砂漠M_説明_*.xlsx")))
    if not files:
        print(f"対象ファイルなし: {DATA_DIR}", file=sys.stderr)
        return 1
    total = {old: 0 for old, _ in REPLACEMENTS}
    for f in files:
        r = fix_file(f)
        for k, v in r["counts"].items():
            total[k] += v
        flags = " ".join(f"{k}x{v}" for k, v in r["counts"].items() if v)
        print(f"{os.path.basename(f)}: {'シート名修正 ' if r['renamed'] else ''}{flags or '置換なし'}")
    print("---")
    for k, v in total.items():
        print(f"合計 {k} → : {v}件")
    return 0


if __name__ == "__main__":
    sys.exit(main())
