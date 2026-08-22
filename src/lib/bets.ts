import type { ManagerId } from './types'

/**
 * Side bets. These live in their own repo (see betsRepo.ts) so the whole
 * league can write them without holding a token that could touch keepers,
 * trades, or cash. Everything here is pure derivation over that file.
 */

export type BetStatus = 'proposed' | 'live' | 'settled' | 'void'
export type StakeKind = 'cash' | 'forfeit'

export interface Bet {
  id: string
  season: number
  proposer: ManagerId
  opponent: ManagerId
  terms: string
  stakeKind: StakeKind
  /** Dollars at stake per side; 0 when the stake is a forfeit. */
  stake: number
  /** What the loser owes when it isn't money. */
  forfeit: string
  /** Free text — "Week 3", "End of season", a date. */
  resolves: string
  status: BetStatus
  winner: ManagerId | null
  proposedAt: string
  acceptedAt?: string
  settledAt?: string
  /** Who last touched it, by display name — the shared password has no identity. */
  lastTouchedBy?: string
}

export interface BetsFile {
  bets: Bet[]
}

export const EMPTY_BETS: BetsFile = { bets: [] }

export function newBetId(): string {
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function sideOf(bet: Bet, manager: ManagerId): 'proposer' | 'opponent' | null {
  if (bet.proposer === manager) return 'proposer'
  if (bet.opponent === manager) return 'opponent'
  return null
}

export function loserOf(bet: Bet): ManagerId | null {
  if (!bet.winner) return null
  return bet.winner === bet.proposer ? bet.opponent : bet.proposer
}

/** A one-line summary of what's on the line, for slips and tickers. */
export function stakeLabel(bet: Bet): string {
  return bet.stakeKind === 'cash' ? `$${bet.stake}` : bet.forfeit || 'Forfeit'
}

export interface BetRecord {
  manager: ManagerId
  won: number
  lost: number
  settled: number
  winPct: number
  /** Cash won minus cash lost across settled cash bets. */
  net: number
  /** Bets currently live. */
  live: number
  /** Cash riding on live bets. */
  exposure: number
  /** Current run: positive for wins, negative for losses. */
  streak: number
}

function blankRecord(manager: ManagerId): BetRecord {
  return {
    manager,
    won: 0,
    lost: 0,
    settled: 0,
    winPct: 0,
    net: 0,
    live: 0,
    exposure: 0,
    streak: 0,
  }
}

/** Career betting records, most profitable first. */
export function betRecords(bets: Bet[]): BetRecord[] {
  const rows = new Map<ManagerId, BetRecord>()
  const touch = (id: ManagerId) => {
    const row = rows.get(id) ?? blankRecord(id)
    rows.set(id, row)
    return row
  }

  for (const bet of bets) {
    if (bet.status === 'void') continue
    const a = touch(bet.proposer)
    const b = touch(bet.opponent)

    if (bet.status === 'live') {
      for (const row of [a, b]) {
        row.live += 1
        if (bet.stakeKind === 'cash') row.exposure += bet.stake
      }
      continue
    }
    if (bet.status !== 'settled' || !bet.winner) continue

    const loser = loserOf(bet)
    for (const row of [a, b]) {
      row.settled += 1
      if (row.manager === bet.winner) {
        row.won += 1
        if (bet.stakeKind === 'cash') row.net += bet.stake
      } else if (row.manager === loser) {
        row.lost += 1
        if (bet.stakeKind === 'cash') row.net -= bet.stake
      }
    }
  }

  // Streaks run over settled bets in chronological order.
  const settled = bets
    .filter((bet) => bet.status === 'settled' && bet.winner)
    .sort((a, b) => (a.settledAt ?? '').localeCompare(b.settledAt ?? ''))
  for (const row of rows.values()) {
    let streak = 0
    for (const bet of settled) {
      if (!sideOf(bet, row.manager)) continue
      const won = bet.winner === row.manager
      streak = won ? (streak > 0 ? streak + 1 : 1) : streak < 0 ? streak - 1 : -1
    }
    row.streak = streak
    row.winPct = row.settled ? row.won / row.settled : 0
  }

  return [...rows.values()].sort((a, b) => b.net - a.net || b.won - a.won)
}

export interface HeadToHead {
  a: ManagerId
  b: ManagerId
  /** Wins for `a` against `b`. */
  aWins: number
  bWins: number
}

/** Settled head-to-head records, keyed so each pair appears once. */
export function headToHead(bets: Bet[]): HeadToHead[] {
  const pairs = new Map<string, HeadToHead>()
  for (const bet of bets) {
    if (bet.status !== 'settled' || !bet.winner) continue
    const [a, b] = [bet.proposer, bet.opponent].sort()
    const key = `${a}|${b}`
    const row = pairs.get(key) ?? { a, b, aWins: 0, bWins: 0 }
    if (bet.winner === a) row.aWins += 1
    else row.bWins += 1
    pairs.set(key, row)
  }
  return [...pairs.values()].sort(
    (x, y) => y.aWins + y.bWins - (x.aWins + x.bWins),
  )
}
