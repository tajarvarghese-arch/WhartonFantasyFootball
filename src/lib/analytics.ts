import type { LeagueData, ManagerId, Season } from './types'

/*
 * The Lab: every analysis computable from 22 seasons of standings and 12
 * years of keeper sheets. All pure functions — no state, no fetches.
 */

/* ------------------------------------------------------------------ *
 * Luck Index — Pythagorean expectation
 * ------------------------------------------------------------------ */

/** Standard fantasy-football Pythagorean exponent. */
const PYTHAG_EXP = 2.37

export interface LuckRow {
  manager: ManagerId
  year: number
  wins: number
  losses: number
  expectedWins: number
  /** Positive = won more than the points said they should. */
  luck: number
}

export function luckRows(seasons: Season[]): LuckRow[] {
  const rows: LuckRow[] = []
  for (const season of seasons) {
    for (const team of season.teams) {
      if (team.pointsFor === null || team.pointsAgainst === null) continue
      const games = team.wins + team.losses
      if (!games) continue
      const pf = Math.pow(team.pointsFor, PYTHAG_EXP)
      const pa = Math.pow(team.pointsAgainst, PYTHAG_EXP)
      const expected = (games * pf) / (pf + pa)
      rows.push({
        manager: team.manager,
        year: season.year,
        wins: team.wins,
        losses: team.losses,
        expectedWins: expected,
        luck: team.wins - expected,
      })
    }
  }
  return rows
}

export interface CareerLuck {
  manager: ManagerId
  seasons: number
  totalLuck: number
  luckiestYear: LuckRow
  unluckiestYear: LuckRow
}

export function careerLuck(rows: LuckRow[]): CareerLuck[] {
  const byManager = new Map<ManagerId, LuckRow[]>()
  for (const row of rows) {
    const list = byManager.get(row.manager) ?? []
    list.push(row)
    byManager.set(row.manager, list)
  }
  return [...byManager.entries()]
    .map(([manager, list]) => ({
      manager,
      seasons: list.length,
      totalLuck: list.reduce((total, row) => total + row.luck, 0),
      luckiestYear: list.reduce((best, row) => (row.luck > best.luck ? row : best)),
      unluckiestYear: list.reduce((worst, row) => (row.luck < worst.luck ? row : worst)),
    }))
    .sort((a, b) => b.totalLuck - a.totalLuck)
}

/* ------------------------------------------------------------------ *
 * GOAT Index — era-adjusted scoring
 * ------------------------------------------------------------------ */

export interface GoatRow {
  manager: ManagerId
  seasons: number
  /** Sum of per-season scoring z-scores: longevity and dominance together. */
  sumZ: number
  /** Average z-score: pure per-season quality. */
  avgZ: number
  titles: number
  bestSeason: { year: number; z: number }
}

/**
 * Scoring compared within each season, so 2018's kicker-era point totals
 * never beat 2025's directly — only how far a team stood above its peers.
 */
export function goatIndex(seasons: Season[]): GoatRow[] {
  const perManager = new Map<ManagerId, { z: number; year: number }[]>()
  const titles = new Map<ManagerId, number>()

  for (const season of seasons) {
    const values = season.teams
      .map((team) => team.avgPointsFor)
      .filter((value): value is number => value !== null)
    if (values.length < 4) continue
    const mean = values.reduce((total, value) => total + value, 0) / values.length
    const sd = Math.sqrt(
      values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length,
    )
    if (!sd) continue
    for (const team of season.teams) {
      if (team.avgPointsFor === null) continue
      const list = perManager.get(team.manager) ?? []
      list.push({ z: (team.avgPointsFor - mean) / sd, year: season.year })
      perManager.set(team.manager, list)
      if (team.rank === 1) titles.set(team.manager, (titles.get(team.manager) ?? 0) + 1)
    }
  }

  return [...perManager.entries()]
    .map(([manager, list]) => {
      const sumZ = list.reduce((total, entry) => total + entry.z, 0)
      const best = list.reduce((max, entry) => (entry.z > max.z ? entry : max))
      return {
        manager,
        seasons: list.length,
        sumZ,
        avgZ: sumZ / list.length,
        titles: titles.get(manager) ?? 0,
        bestSeason: { year: best.year, z: best.z },
      }
    })
    .sort((a, b) => b.sumZ - a.sumZ)
}

/* ------------------------------------------------------------------ *
 * Elo timeline
 * ------------------------------------------------------------------ */

const ELO_START = 1500
const ELO_K = 6
const ELO_TITLE_BONUS = 14

export interface EloPoint {
  year: number
  ratings: Record<ManagerId, number>
}

/**
 * A season-granularity Elo: each manager's season win% against the expected
 * win% implied by their rating versus the field's average, plus a small
 * title bonus for playoff results the regular season can't see.
 */
export function eloTimeline(seasons: Season[]): EloPoint[] {
  const rating = new Map<ManagerId, number>()
  const points: EloPoint[] = []
  const chronological = [...seasons].sort((a, b) => a.year - b.year)

  for (const season of chronological) {
    const present = season.teams.map((team) => team.manager)
    for (const id of present) if (!rating.has(id)) rating.set(id, ELO_START)
    const snapshot: Record<ManagerId, number> = {}

    for (const team of season.teams) {
      const games = team.wins + team.losses
      if (!games) continue
      const mine = rating.get(team.manager) ?? ELO_START
      const others = present.filter((id) => id !== team.manager)
      const oppAvg =
        others.reduce((total, id) => total + (rating.get(id) ?? ELO_START), 0) /
        Math.max(others.length, 1)
      const expected = 1 / (1 + Math.pow(10, (oppAvg - mine) / 400))
      const actual = team.wins / games
      let next = mine + ELO_K * games * (actual - expected)
      if (team.rank === 1) next += ELO_TITLE_BONUS
      rating.set(team.manager, next)
    }
    for (const id of present) snapshot[id] = Math.round(rating.get(id) ?? ELO_START)
    points.push({ year: season.year, ratings: snapshot })
  }
  return points
}

/* ------------------------------------------------------------------ *
 * Torture Board
 * ------------------------------------------------------------------ */

export interface TortureRow {
  manager: ManagerId
  seasonsPlayed: number
  titles: number
  lastTitleYear: number | null
  /** Years since the last title, measured to the coming season. */
  drought: number
  runnerUps: number
  playoffAppearances: number
  neverWon: boolean
}

export function tortureBoard(seasons: Season[], currentSeason: number): TortureRow[] {
  const byManager = new Map<ManagerId, TortureRow>()
  for (const season of seasons) {
    for (const team of season.teams) {
      const row =
        byManager.get(team.manager) ??
        ({
          manager: team.manager,
          seasonsPlayed: 0,
          titles: 0,
          lastTitleYear: null,
          drought: 0,
          runnerUps: 0,
          playoffAppearances: 0,
          neverWon: true,
        } as TortureRow)
      row.seasonsPlayed += 1
      if (team.rank === 1) {
        row.titles += 1
        row.neverWon = false
        row.lastTitleYear = Math.max(row.lastTitleYear ?? 0, season.year)
      }
      if (team.rank === 2) row.runnerUps += 1
      if (team.playoffWins + team.playoffLosses > 0) row.playoffAppearances += 1
      byManager.set(team.manager, row)
    }
  }
  for (const row of byManager.values()) {
    const firstSeen = Math.min(
      ...seasons.filter((s) => s.teams.some((t) => t.manager === row.manager)).map((s) => s.year),
    )
    row.drought = currentSeason - (row.lastTitleYear ?? firstSeen)
  }
  return [...byManager.values()].sort(
    (a, b) => b.drought - a.drought || b.runnerUps - a.runnerUps,
  )
}

/* ------------------------------------------------------------------ *
 * Contract hall of fame / shame
 * ------------------------------------------------------------------ */

export interface ContractRun {
  manager: ManagerId
  player: string
  position: string
  years: number[]
  salaries: number[]
  /** Standard fantasy points scored across the kept seasons (nflverse). */
  totalPoints: number
  totalPaid: number
  /** The ranking metric: points scored minus dollars spent. */
  netPoints: number
}

const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v'])

/** Must mirror scripts/player_points.py exactly, or the join silently misses. */
export function normalizePlayer(name: string): string {
  const tokens = name
    .toLowerCase()
    .replace(/\./g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
  while (tokens.length && NAME_SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop()
  return tokens.join('')
}

/**
 * Contract value: fantasy points produced minus auction dollars spent, summed
 * over the whole keeper run. Only seasons with a points record count (2026
 * hasn't been played; team DEFs have no player line), and spend is restricted
 * to those same seasons. Quarterbacks are excluded from the steals board —
 * every year someone finds a $1 QB, and it drowns out the real skill-position
 * bargains.
 */
export function contractRuns(
  keepers: LeagueData['keepers'],
  playerPoints: LeagueData['playerPoints'],
  playerPositions?: LeagueData['playerPositions'],
): { steals: ContractRun[]; overpays: ContractRun[]; unmatched: number } {
  const runs = new Map<string, ContractRun>()
  let unmatched = 0

  for (const [yearKey, blocks] of Object.entries(keepers)) {
    const seasonPoints = playerPoints?.[yearKey]
    for (const block of blocks) {
      if (!block.manager) continue
      for (const pick of block.keepers) {
        if (pick.salary === null) continue
        const entry = seasonPoints?.[normalizePlayer(pick.player)]
        if (entry === undefined) {
          if (seasonPoints) unmatched += 1
          continue
        }
        const [points, statPosition] = entry
        const position =
          statPosition || playerPositions?.[normalizePlayer(pick.player)] || ''
        const key = `${block.manager}|${normalizePlayer(pick.player)}`
        const run =
          runs.get(key) ??
          ({
            manager: block.manager,
            player: pick.player,
            position,
            years: [],
            salaries: [],
            totalPoints: 0,
            totalPaid: 0,
            netPoints: 0,
          } as ContractRun)
        run.years.push(Number(yearKey))
        run.salaries.push(pick.salary)
        run.totalPoints += points
        run.totalPaid += Math.max(pick.salary, 1) // $0 keepers still cost a slot
        runs.set(key, run)
      }
    }
  }

  const all = [...runs.values()]
  for (const run of all) {
    run.years.sort((a, b) => a - b)
    run.netPoints = run.totalPoints - run.totalPaid
  }

  return {
    steals: all
      .filter((run) => run.position !== 'QB')
      .sort((a, b) => b.netPoints - a.netPoints)
      .slice(0, 12),
    // Overpays need real money on the table; QBs stay eligible here —
    // a $40 quarterback bust is a legitimate worst contract.
    overpays: all
      .filter((run) => run.totalPaid >= 25)
      .sort((a, b) => a.netPoints - b.netPoints)
      .slice(0, 12),
    unmatched,
  }
}

/* ------------------------------------------------------------------ *
 * Vegas Board — Monte Carlo title odds
 * ------------------------------------------------------------------ */

export interface OddsRow {
  manager: ManagerId
  probability: number
  american: string
}

/**
 * Toy model, and labelled as such in the UI: sample each manager's historical
 * per-game scoring (keeper era), add week-to-week noise, and count how often
 * they post the best season. No schedules, no rosters — just track record.
 */
export function vegasBoard(
  seasons: Season[],
  managers: ManagerId[],
  sims = 5000,
): OddsRow[] {
  const samples = new Map<ManagerId, number[]>()
  for (const season of seasons) {
    if (!season.keeperEra) continue
    for (const team of season.teams) {
      if (team.avgPointsFor === null || !managers.includes(team.manager)) continue
      const list = samples.get(team.manager) ?? []
      list.push(team.avgPointsFor)
      samples.set(team.manager, list)
    }
  }
  const entrants = managers.filter((id) => (samples.get(id)?.length ?? 0) >= 2)
  const wins = new Map<ManagerId, number>(entrants.map((id) => [id, 0]))

  for (let sim = 0; sim < sims; sim++) {
    let best: ManagerId | null = null
    let bestScore = -Infinity
    for (const id of entrants) {
      const history = samples.get(id)!
      const pick = history[Math.floor(Math.random() * history.length)]
      const score = pick + (Math.random() + Math.random() + Math.random() - 1.5) * 6
      if (score > bestScore) {
        bestScore = score
        best = id
      }
    }
    if (best) wins.set(best, (wins.get(best) ?? 0) + 1)
  }

  return entrants
    .map((id) => {
      const p = (wins.get(id) ?? 0) / sims
      const american =
        p >= 0.5
          ? `-${Math.round((100 * p) / (1 - p) / 5) * 5}`
          : `+${Math.round((100 * (1 - p)) / Math.max(p, 0.001) / 5) * 5}`
      return { manager: id, probability: p, american }
    })
    .sort((a, b) => b.probability - a.probability)
}

/* ------------------------------------------------------------------ *
 * The Almanac
 * ------------------------------------------------------------------ */

export interface StarLine {
  player: string
  points: number
  position: string
}

export interface AlmanacEntry {
  year: number
  keeperEra: boolean
  champion: ManagerId
  runnerUp: ManagerId | null
  third: ManagerId | null
  champWins: number
  champLosses: number
  champAvg: number | null
  leagueAvg: number | null
  topScorer: { manager: ManagerId; avg: number } | null
  luckiest: { manager: ManagerId; luck: number } | null
  unluckiest: { manager: ManagerId; luck: number } | null
  /** The champion's actual engine: top scorers on their end-of-season roster. */
  champStars: StarLine[]
  /** The best player the runner-up brought to the final. */
  runnerUpStar: StarLine | null
  /** That season's biggest structured trade, if any. */
  bigTrade: { seller: ManagerId; buyer: ManagerId; players: string; total: number } | null
  /** A line from the old free-text trade wire, verbatim. */
  wireLine: string | null
}

/** Top scorers from a manager's end-of-season roster (kept in keepers[year+1]). */
function rosterStars(
  data: LeagueData,
  year: number,
  manager: ManagerId | null,
  count: number,
): StarLine[] {
  if (!manager) return []
  const seasonPoints = data.playerPoints?.[String(year)]
  if (!seasonPoints) return []
  const block = data.keepers[String(year + 1)]?.find((b) => b.manager === manager)
  if (!block) return []
  const stars: StarLine[] = []
  for (const spot of block.endingRoster) {
    const entry = seasonPoints[normalizePlayer(spot.player)]
    if (!entry) continue
    stars.push({ player: spot.player, points: entry[0], position: entry[1] })
  }
  return stars.sort((a, b) => b.points - a.points).slice(0, count)
}

export function almanac(data: LeagueData): AlmanacEntry[] {
  const seasons = data.seasons
  const luck = luckRows(seasons)
  return [...seasons]
    .sort((a, b) => b.year - a.year)
    .map((season) => {
      const champ = season.teams.find((team) => team.rank === 1)
      const scored = season.teams.filter(
        (team): team is typeof team & { avgPointsFor: number } => team.avgPointsFor !== null,
      )
      const top = scored.length
        ? scored.reduce((best, team) => (team.avgPointsFor > best.avgPointsFor ? team : best))
        : null
      const seasonLuck = luck.filter((row) => row.year === season.year)
      const luckiest = seasonLuck.length
        ? seasonLuck.reduce((best, row) => (row.luck > best.luck ? row : best))
        : null
      const unluckiest = seasonLuck.length
        ? seasonLuck.reduce((worst, row) => (row.luck < worst.luck ? row : worst))
        : null

      const seasonTrades = data.trades.filter(
        (trade) => trade.season === season.year && trade.status === 'approved' && trade.totalDollars > 0,
      )
      const bigTrade = seasonTrades.length
        ? seasonTrades.reduce((best, trade) => (trade.totalDollars > best.totalDollars ? trade : best))
        : null

      // The old wire: free-text trade log grouped under "<year> Trades ..."
      const wireGroups = data.legacyTrades.filter((group) =>
        group.heading.startsWith(`${season.year} Trades`),
      )
      const wireGroup =
        wireGroups.find((group) => !group.heading.includes('Preseason')) ?? wireGroups[0]
      const wireLine = wireGroup?.entries.find((line) => line.length > 25) ?? null

      return {
        year: season.year,
        keeperEra: season.keeperEra,
        champion: season.champion,
        runnerUp: season.runnerUp,
        third: season.thirdPlace,
        champWins: champ?.wins ?? 0,
        champLosses: champ?.losses ?? 0,
        champAvg: champ?.avgPointsFor ?? null,
        leagueAvg: scored.length
          ? scored.reduce((total, team) => total + team.avgPointsFor, 0) / scored.length
          : null,
        topScorer: top ? { manager: top.manager, avg: top.avgPointsFor } : null,
        luckiest: luckiest ? { manager: luckiest.manager, luck: luckiest.luck } : null,
        unluckiest: unluckiest ? { manager: unluckiest.manager, luck: unluckiest.luck } : null,
        champStars: rosterStars(data, season.year, season.champion, 3),
        runnerUpStar: rosterStars(data, season.year, season.runnerUp, 1)[0] ?? null,
        bigTrade: bigTrade
          ? {
              seller: bigTrade.seller,
              buyer: bigTrade.buyer,
              players: bigTrade.players,
              total: bigTrade.totalDollars,
            }
          : null,
        wireLine,
      }
    })
}
