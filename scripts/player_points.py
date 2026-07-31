"""
Fetch historical player fantasy points from nflverse and write
public/data/player-points.json for the Lab's points-per-dollar contract math.

    python scripts/player_points.py

Sums STANDARD (0-PPR) fantasy points over the regular season, per player, for
every season the keeper sheets cover, and records each player's position so
the app can filter boards (the Lab's best-contracts list excludes QBs).
Values are [points, position]. Names are normalised to bare alphanumerics
with suffixes (Jr/Sr/III...) stripped, and the app applies the same
normalisation when joining against keeper rosters.

Source: https://github.com/nflverse/nflverse-data (public, CC-BY-4.0-style
data releases maintained by the nflverse project).
"""

import csv
import gzip
import io
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "data" / "player-points.json"

SEASONS = range(2015, 2026)
# nflverse restructured its releases for 2025+: older seasons live under
# player_stats (weekly rows), newer under stats_player (season aggregates).
# Both carry the same fantasy_points columns, and summing rows works for both.
URLS = [
    "https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats_{year}.csv.gz",
    "https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_reg_{year}.csv.gz",
]

SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}


def normalize(name: str) -> str:
    tokens = re.sub(r"[^a-z0-9 ]", "", name.lower().replace(".", " ")).split()
    while tokens and tokens[-1] in SUFFIXES:
        tokens.pop()
    return "".join(tokens)


def season_points(year: int) -> dict:
    raw = None
    for url in URLS:
        request = urllib.request.Request(
            url.format(year=year), headers={"User-Agent": "wacl-league-etl"}
        )
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                raw = response.read()
            break
        except urllib.error.HTTPError as error:
            if error.code != 404:
                raise
    if raw is None:
        raise RuntimeError(f"no nflverse file found for {year}")
    totals: dict[str, float] = {}
    positions: dict[str, str] = {}
    with gzip.open(io.BytesIO(raw), "rt", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if row.get("season_type", "REG") not in ("REG", ""):
                continue
            name = row.get("player_display_name") or ""
            points = row.get("fantasy_points") or "0"
            try:
                value = float(points)
            except ValueError:
                continue
            key = normalize(name)
            if not key:
                continue
            totals[key] = totals.get(key, 0.0) + value
            pos = (row.get("position") or "").strip()
            if pos:
                positions[key] = pos
    return {
        key: [round(value, 1), positions.get(key, "")]
        for key, value in totals.items()
        if value != 0.0
    }


def main() -> None:
    output: dict[str, dict] = {}
    for year in SEASONS:
        data = season_points(year)
        output[str(year)] = data
        print(f"{year}: {len(data)} players")
    OUT.write_text(json.dumps(output, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
