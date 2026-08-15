"""
Fetch FantasyPros Expert Consensus Rankings (standard scoring, draft season)
and write public/data/draft-pool.json for the Draft Board.

    python scripts/draft_pool.py

The board shows who is worth planning around on auction night, so the pool is
veterans only: anyone with zero seasons in public/data/player-points.json
(nflverse regular-season history) is treated as a rookie and dropped, per
league preference. Kickers and team defenses are exempt from that test —
nflverse's player stats don't cover them the same way.

Availability (kept vs on the board) is computed in the app at runtime against
the current keeper lists; this file is rankings only, refreshed whenever the
script reruns. Source and retrieval metadata ride along for the citation line.
"""

from __future__ import annotations

import datetime as dt
import json
import pathlib
import re
import unicodedata
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = "https://www.fantasypros.com/nfl/rankings/consensus-cheatsheets.php"
KEEP_TOP = 300
SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}
HISTORY_EXEMPT = {"K", "DST"}


def normalize(name: str) -> str:
    name = unicodedata.normalize("NFKD", name)
    name = "".join(ch for ch in name if not unicodedata.combining(ch))
    tokens = re.sub(r"[^a-z0-9 ]", "", name.lower().replace(".", " ")).split()
    while tokens and tokens[-1] in SUFFIXES:
        tokens.pop()
    return "".join(tokens)


def main() -> None:
    request = urllib.request.Request(
        URL,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36"
        },
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        html = response.read().decode("utf-8")

    match = re.search(r"var ecrData = (\{.*?\});", html, re.S)
    if not match:
        raise SystemExit("FantasyPros page layout changed: ecrData not found")
    ecr = json.loads(match.group(1))
    if ecr.get("scoring") != "STD":
        raise SystemExit(f"Expected STD scoring, got {ecr.get('scoring')}")

    points = json.loads((ROOT / "public/data/player-points.json").read_text())
    veterans = {name for season in points.values() for name in season}

    players, dropped = [], 0
    for row in ecr["players"]:
        position = row["player_position_id"]
        if position not in HISTORY_EXEMPT and normalize(row["player_name"]) not in veterans:
            dropped += 1  # no NFL history on record -> rookie
            continue
        players.append(
            {
                "rank": row["rank_ecr"],
                "player": row["player_name"],
                "pos": position,
                "posRank": row["pos_rank"],
                "team": row["player_team_id"],
                "bye": row["player_bye_week"],
                "tier": row["tier"],
            }
        )
        if len(players) >= KEEP_TOP:
            break

    pool = {
        "source": "FantasyPros Expert Consensus Rankings",
        "sourceUrl": URL,
        "scoring": "Standard (non-PPR)",
        "season": ecr["year"],
        "experts": ecr["total_experts"],
        "sourceUpdated": ecr["last_updated"],
        "retrieved": dt.date.today().isoformat(),
        "rookiesExcluded": True,
        "players": players,
    }
    out = ROOT / "public/data/draft-pool.json"
    out.write_text(json.dumps(pool, indent=2) + "\n", encoding="utf-8")
    print(
        f"{len(players)} players written ({dropped} rookies dropped), "
        f"season {ecr['year']}, {ecr['total_experts']} experts, "
        f"source updated {ecr['last_updated']}"
    )


if __name__ == "__main__":
    main()
