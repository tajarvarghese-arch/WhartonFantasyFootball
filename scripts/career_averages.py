"""
Extract the book's career scoring averages from Master Data and write
public/data/career-averages.json.

    python scripts/career_averages.py "path/to/FFL Stats and Keepers.xlsx"

The workbook's career Avg Pts/Game is NOT derivable from the year tabs: the
2004-2006 seasons feed the career math through "(Adj.)" columns - totals
re-scored so the earliest seasons compare fairly - and each year carries a
hard-coded games divisor. Rather than reimplement that, this lifts the
book's own precomputed keeper-era and all-time averages per manager, for
and against, exactly as printed.
"""

from __future__ import annotations

import json
import pathlib
import re
import sys

import openpyxl

ROOT = pathlib.Path(__file__).resolve().parent.parent
# (header_row, first_row, last_row) of the per-manager average blocks
BLOCKS = {"pointsFor": (40, 41, 56), "pointsAgainst": (86, 87, 102)}
COL_NAME, COL_KEEPER, COL_ALLTIME = 0, 1, 2


def main() -> None:
    workbook_path = sys.argv[1] if len(sys.argv) > 1 else None
    if not workbook_path:
        raise SystemExit("usage: python scripts/career_averages.py <workbook.xlsx>")
    wb = openpyxl.load_workbook(workbook_path, read_only=True, data_only=True)
    rows = list(wb["Master Data"].iter_rows(values_only=True))
    managers = {m["id"] for m in json.loads((ROOT / "public/data/managers.json").read_text())}

    out: dict = {"keeperEra": {}, "allTime": {}, "seasons": {}}
    for field, (header, first, last) in BLOCKS.items():
        # header cells read '2025', '2006 (Adj.)', ... — map column -> year
        year_by_col = {}
        for col, cell in enumerate(rows[header - 1]):
            match = re.search(r"(20\d\d)", str(cell)) if cell is not None else None
            if match:
                year_by_col[col] = int(match.group(1))

        for row in rows[first - 1 : last]:
            name = row[COL_NAME]
            if not isinstance(name, str):
                continue
            who = name.strip().lower()
            if who not in managers:
                raise SystemExit(f"unknown manager id: {who}")
            for era, col in (("keeperEra", COL_KEEPER), ("allTime", COL_ALLTIME)):
                value = row[col]
                if isinstance(value, (int, float)):
                    out[era].setdefault(who, {})[field] = round(float(value), 4)
            for col, year in year_by_col.items():
                value = row[col]
                if isinstance(value, (int, float)):
                    out["seasons"].setdefault(who, {}).setdefault(str(year), {})[field] = round(
                        float(value), 4
                    )

    target = ROOT / "public/data/career-averages.json"
    target.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    season_cells = sum(len(years) for years in out["seasons"].values())
    print(
        f"keeperEra {len(out['keeperEra'])} · allTime {len(out['allTime'])} · "
        f"season cells {season_cells}"
    )


if __name__ == "__main__":
    main()
