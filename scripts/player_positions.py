"""
Build public/data/player-positions.json — a position for every player the
league has ever rostered, including the ones the scoring file misses.

    python scripts/player_positions.py

Sources, in priority order:
  1. nflverse historical rosters (2015-2025) — every rostered NFL player and
     their position, whether or not they ever scored a fantasy point.
  2. Team-defense detection: keeper sheets list DEFs by nickname or city
     ("Eagles", "Buffalo", "New Orleans"); those map to position "DEF".

The output is one flat map {normalised name: position}, latest season wins.
Also prints join coverage against the keeper sheets so gaps are visible.
"""

import csv
import gzip
import io
import json
import re
import unicodedata
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KEEPERS = ROOT / "public" / "data" / "keepers.json"
OUT = ROOT / "public" / "data" / "player-positions.json"

# 2014 included: the first keeper sheet carries 2014 ending rosters.
SEASONS = range(2014, 2026)
# Newer seasons ship gzipped, older ones plain; sniff the magic bytes.
URLS = [
    "https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_{year}.csv.gz",
    "https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_{year}.csv",
]

GZIP_MAGIC = bytes([0x1F, 0x8B])

SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}

# Sheet nickname -> nflverse legal name, both normalised.
ALIASES = {
    "hollywoodbrown": "marquisebrown",
    "benwatson": "benjaminwatson",
    "danielherron": "danherron",
    "joshuapalmer": "joshpalmer",
    "kennygainwell": "kennethgainwell",
}


# Every name the sheets have used for a team defense.
TEAM_WORDS = {
    "cardinals", "falcons", "ravens", "bills", "panthers", "bears", "bengals",
    "browns", "cowboys", "broncos", "lions", "packers", "texans", "colts",
    "jaguars", "chiefs", "raiders", "chargers", "rams", "dolphins", "vikings",
    "patriots", "saints", "giants", "jets", "eagles", "steelers", "49ers",
    "seahawks", "buccaneers", "titans", "commanders", "redskins", "football",
    "arizona", "atlanta", "baltimore", "buffalo", "carolina", "chicago",
    "cincinnati", "cleveland", "dallas", "denver", "detroit", "green", "bay",
    "houston", "indianapolis", "jacksonville", "kansas", "city", "vegas",
    "oakland", "angeles", "miami", "minnesota", "new", "england", "orleans",
    "york", "philadelphia", "pittsburgh", "san", "francisco", "seattle",
    "tampa", "tennessee", "washington", "def", "defense",
    # sheet shorthand: "Arizona  Ari", "Jacksonville  Jax"
    "ari", "atl", "bal", "buf", "car", "chi", "cin", "cle", "dal", "den",
    "det", "gb", "hou", "ind", "jax", "jac", "kc", "lv", "lac", "lar", "mia",
    "min", "ne", "no", "nyg", "nyj", "oak", "phi", "pit", "sd", "sea", "sf",
    "stl", "tb", "ten", "was", "wsh", "la", "los", "las", "st", "louis", "diego",
}


def normalize(name: str) -> str:
    # NFKD folds accents (nflverse spells him Estimé; the sheets say Estime)
    name = unicodedata.normalize("NFKD", name)
    name = "".join(ch for ch in name if not unicodedata.combining(ch))
    tokens = re.sub(r"[^a-z0-9 ]", "", name.lower().replace(".", " ")).split()
    while tokens and tokens[-1] in SUFFIXES:
        tokens.pop()
    return "".join(tokens)


def is_team_defense(name: str) -> bool:
    tokens = re.sub(r"[^a-z0-9 ]", "", name.lower()).split()
    return bool(tokens) and all(token in TEAM_WORDS for token in tokens)


def fetch_rosters(year: int) -> dict:
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
        raise RuntimeError(f"no roster file for {year}")
    positions: dict[str, str] = {}
    if raw[:2] == GZIP_MAGIC:
        handle = gzip.open(io.BytesIO(raw), "rt", encoding="utf-8")
    else:
        handle = io.TextIOWrapper(io.BytesIO(raw), encoding="utf-8")
    with handle:
        for row in csv.DictReader(handle):
            name = row.get("full_name") or row.get("player_name") or ""
            pos = (row.get("position") or "").strip()
            key = normalize(name)
            if key and pos:
                positions[key] = pos
    return positions


def main() -> None:
    merged: dict[str, str] = {}
    for year in SEASONS:
        merged.update(fetch_rosters(year))
        print(f"{year}: cumulative {len(merged)} players")

    keepers = json.loads(KEEPERS.read_text(encoding="utf-8"))
    roster_names: set[str] = set()
    for blocks in keepers.values():
        for block in blocks:
            for spot in block["endingRoster"]:
                roster_names.add(spot["player"])
            for pick in block["keepers"]:
                roster_names.add(pick["player"])

    # Two edge cases no roster file can supply: Ray Rice was suspended for all
    # of 2014 yet sits on that ending roster, and Tim Wright's stints predate
    # the files. 'Check' is sheet junk and stays unmatched on purpose.
    manual = {'rayrice': 'RB', 'timwright': 'TE'}
    merged.update(manual)

    matched = 0
    defenses = 0
    unmatched: list[str] = []
    output: dict[str, str] = {}
    for name in roster_names:
        key = normalize(name)
        key = ALIASES.get(key, key)
        if key in merged:
            output[key] = merged[key]
            matched += 1
        elif is_team_defense(name):
            output[key] = "DEF"
            defenses += 1
        else:
            unmatched.append(name)

    OUT.write_text(json.dumps(output, separators=(",", ":"), sort_keys=True) + "\n", "utf-8")
    total = len(roster_names)
    print(
        f"\ncoverage: {matched} players + {defenses} defenses of {total} "
        f"roster names ({(matched + defenses) / total:.1%})"
    )
    if unmatched:
        print(f"unmatched ({len(unmatched)}): {', '.join(sorted(unmatched)[:15])}")
    print(f"wrote {OUT} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
