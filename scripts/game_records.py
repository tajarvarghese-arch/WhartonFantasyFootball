"""
Extract the single-game scoring records from the league workbook and write
public/data/game-records.json.

    python scripts/game_records.py "path/to/FFL Stats and Keepers.xlsx"

The Summary Stats sheets each carry a top-10 Highest Game Scoring Record and
Lowest Game Scoring Record table (manager surname, points, year, with a *
marking playoff games). This runs standalone so refreshing these records
never re-runs the full ETL — keepers.json is app-maintained now and must not
be overwritten from the workbook.
"""

from __future__ import annotations

import json
import pathlib
import sys

import openpyxl

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHEETS = {
    "keeperEra": "Summary Stats (Keeper Era)",
    "allTime": "Summary Stats (All-Time)",
}
LABELS = {"highest": "Highest Game Scoring", "lowest": "Lowest Game Scoring"}
COL_MANAGER, COL_RANK, COL_POINTS, COL_YEAR = 12, 14, 15, 16


def parse_section(rows: list[tuple], label: str) -> list[dict]:
    start = next(
        r for r, row in enumerate(rows)
        if isinstance(row[COL_MANAGER], str) and row[COL_MANAGER].startswith(label)
    )
    header = next(r for r in range(start, len(rows)) if rows[r][COL_RANK] == "Rank")
    entries = []
    for row in rows[header + 1 :]:
        manager, points, year = row[COL_MANAGER], row[COL_POINTS], row[COL_YEAR]
        if not isinstance(manager, str) or points is None:
            break
        year_text = str(year)
        entries.append(
            {
                "manager": manager.strip().lower(),
                "points": round(float(points), 2),
                "year": int(year_text.rstrip("*")),
                "playoff": year_text.endswith("*"),
            }
        )
    return entries


def main() -> None:
    workbook_path = sys.argv[1] if len(sys.argv) > 1 else None
    if not workbook_path:
        raise SystemExit("usage: python scripts/game_records.py <workbook.xlsx>")
    wb = openpyxl.load_workbook(workbook_path, read_only=True, data_only=True)

    managers = {m["id"] for m in json.loads((ROOT / "public/data/managers.json").read_text())}
    out: dict = {}
    for key, sheet_name in SHEETS.items():
        rows = list(wb[sheet_name].iter_rows(values_only=True))
        out[key] = {kind: parse_section(rows, label) for kind, label in LABELS.items()}
        for kind in out[key]:
            for entry in out[key][kind]:
                if entry["manager"] not in managers:
                    raise SystemExit(f"unknown manager id: {entry['manager']}")

    target = ROOT / "public/data/game-records.json"
    target.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    for key, tables in out.items():
        print(key, {kind: len(rows) for kind, rows in tables.items()})


if __name__ == "__main__":
    main()
