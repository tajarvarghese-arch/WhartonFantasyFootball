import type { BetResult, ManagerId } from './types'

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
  /** When the loser actually handed the money over. Resolving != paying. */
  paidAt?: string
  /** Who last touched it, by display name — the shared password has no identity. */
  lastTouchedBy?: string
}

export interface BetsFile {
  bets: Bet[]
}

export const EMPTY_BETS: BetsFile = { bets: [] }

/**
 * Fold the commissioner's settlements into the league-writable bets.
 *
 * A winner is only ever taken from the results file, which lives in the repo
 * the league password cannot touch. A bet that claims `settled` in bets.json
 * without a matching result is treated as still live — otherwise anyone
 * holding the shared password could declare themselves the winner by editing
 * the file directly.
 */
export function applyResults(bets: Bet[], results: BetResult[]): Bet[] {
  const byId = new Map(results.map((r) => [r.betId, r]))
  return bets.map((bet) => {
    const result = byId.get(bet.id)
    if (result) {
      return { ...bet, status: 'settled', winner: result.winner, settledAt: result.settledAt }
    }
    return bet.status === 'settled'
      ? { ...bet, status: 'live', winner: null, settledAt: undefined }
      : bet
  })
}

export function newBetId(): string {
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/* ------------------------------------------------------------------ *
 * Corrections — the commissioner rewriting history
 * ------------------------------------------------------------------ *
 *
 * A settled bet is two records in two repos: the terms live in bets.json
 * (league-writable) and the ruling lives in bet-results.json (commissioner
 * only). Fixing a typo in the terms and fixing the wrong winner are therefore
 * different writes, and a full delete is both. These helpers keep the split
 * honest so the page never has to reason about which file it is touching.
 */

/** The parts of a bet the commissioner can rewrite after the fact. */
export interface BetEdit {
  terms: string
  stakeKind: StakeKind
  stake: number
  forfeit: string
  resolves: string
}

export function editableFields(bet: Bet): BetEdit {
  return {
    terms: bet.terms,
    stakeKind: bet.stakeKind,
    stake: bet.stake,
    forfeit: bet.forfeit,
    resolves: bet.resolves,
  }
}

/** Normalised so a stake never survives a switch to a forfeit, or vice versa. */
export function cleanEdit(edit: BetEdit): BetEdit {
  const cash = edit.stakeKind === 'cash'
  return {
    terms: edit.terms.trim(),
    stakeKind: edit.stakeKind,
    stake: cash ? Math.max(0, Math.round(edit.stake)) : 0,
    forfeit: cash ? '' : edit.forfeit.trim(),
    resolves: edit.resolves.trim(),
  }
}

export function editIsValid(edit: BetEdit): boolean {
  const clean = cleanEdit(edit)
  return Boolean(clean.terms) && (clean.stakeKind === 'cash' ? clean.stake > 0 : Boolean(clean.forfeit))
}

export function editChanged(bet: Bet, edit: BetEdit): boolean {
  const before = editableFields(bet)
  const after = cleanEdit(edit)
  return (Object.keys(after) as (keyof BetEdit)[]).some((key) => before[key] !== after[key])
}

/**
 * Apply a correction to one bet.
 *
 * `clearPaid` drops the paid stamp: if the stake changed or the ruling was
 * reversed, whatever changed hands was the wrong amount to the wrong person,
 * and the tab should reopen rather than quietly stay square.
 */
export function applyEdit(
  bets: Bet[],
  id: string,
  edit: BetEdit,
  options: { clearPaid?: boolean; by?: string } = {},
): Bet[] {
  const clean = cleanEdit(edit)
  return bets.map((bet) => {
    if (bet.id !== id) return bet
    const next: Bet = { ...bet, ...clean }
    if (options.clearPaid) delete next.paidAt
    if (options.by) next.lastTouchedBy = options.by
    return next
  })
}

export function removeBet(bets: Bet[], id: string): Bet[] {
  return bets.filter((bet) => bet.id !== id)
}

/** Reopen a settled bet without touching its terms. */
export function reopenBet(bets: Bet[], id: string): Bet[] {
  return bets.map((bet) => {
    if (bet.id !== id) return bet
    const next: Bet = { ...bet, status: 'live', winner: null }
    delete next.settledAt
    delete next.paidAt
    return next
  })
}

export function upsertResult(results: BetResult[], entry: BetResult): BetResult[] {
  return [...results.filter((r) => r.betId !== entry.betId), entry]
}

export function removeResult(results: BetResult[], betId: string): BetResult[] {
  return results.filter((r) => r.betId !== betId)
}

/**
 * Rulings whose bet no longer exists. A ruling is keyed by bet id, so a bet
 * deleted from the league-writable file would otherwise leave a result behind
 * that nothing can ever display — and that would silently resurrect the bet if
 * the id were ever reused.
 */
export function orphanResults(bets: Bet[], results: BetResult[]): BetResult[] {
  const live = new Set(bets.map((bet) => bet.id))
  return results.filter((result) => !live.has(result.betId))
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

/* ------------------------------------------------------------------ *
 * The side-bet ledger — kept deliberately apart from league cash
 * ------------------------------------------------------------------ */

export interface Debt {
  /** Owes the money. */
  from: ManagerId
  /** Is owed the money. */
  to: ManagerId
  amount: number
  /** The settled bets this nets together. */
  betIds: string[]
}

/**
 * Outstanding betting debts, netted per pair. Two managers who have beaten
 * each other several times owe one number, not a stack of them — which is how
 * people actually settle up. Forfeit bets never appear here; you cannot net a
 * dare against a dollar.
 */
export function openDebts(bets: Bet[]): Debt[] {
  const pairs = new Map<string, { a: ManagerId; b: ManagerId; balance: number; betIds: string[] }>()

  for (const bet of bets) {
    if (bet.status !== 'settled' || !bet.winner || bet.paidAt) continue
    if (bet.stakeKind !== 'cash' || bet.stake <= 0) continue
    const loser = loserOf(bet)
    if (!loser) continue

    const [a, b] = [bet.proposer, bet.opponent].sort()
    const key = `${a}|${b}`
    const row = pairs.get(key) ?? { a, b, balance: 0, betIds: [] }
    // Positive balance means b owes a.
    row.balance += bet.winner === a ? bet.stake : -bet.stake
    row.betIds.push(bet.id)
    pairs.set(key, row)
  }

  const debts: Debt[] = []
  for (const row of pairs.values()) {
    if (row.balance === 0) continue
    debts.push(
      row.balance > 0
        ? { from: row.b, to: row.a, amount: row.balance, betIds: row.betIds }
        : { from: row.a, to: row.b, amount: -row.balance, betIds: row.betIds },
    )
  }
  return debts.sort((x, y) => y.amount - x.amount)
}

/** Everything a manager is owed minus everything they owe, right now. */
export function netOwed(debts: Debt[], manager: ManagerId): number {
  return debts.reduce(
    (total, debt) =>
      total + (debt.to === manager ? debt.amount : debt.from === manager ? -debt.amount : 0),
    0,
  )
}

/** Venmo prefilled payment, when the payee has a handle on file. */
export function venmoUrl(handle: string | undefined, amount: number, note: string): string | null {
  const user = handle?.replace(/^@/, '').trim()
  if (!user) return null
  const params = new URLSearchParams({
    txn: 'pay',
    audience: 'private',
    recipients: user,
    amount: amount.toFixed(2),
    note,
  })
  return `https://venmo.com/?${params.toString()}`
}
