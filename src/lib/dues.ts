import type { CashEntry, League, ManagerId } from './types'

/**
 * Season dues, derived from the cash ledger the commissioner already keeps:
 * every `dues` entry for the season, grouped by manager, with an escalation
 * tier driven by the league's deadline. No new data to maintain — a manager
 * leaves the wanted board the moment their entry is marked settled.
 */

export type DuesTier = 'paid' | 'pending' | 'overdue' | 'deadbeat'

/** Days past the deadline before a poster earns the DEADBEAT overprint. */
const DEADBEAT_AFTER_DAYS = 30

export interface DuesRow {
  manager: ManagerId
  owed: number
  settled: boolean
  tier: DuesTier
  /** Negative = days remaining. Null when no deadline is configured. */
  daysOverdue: number | null
  entryIds: string[]
}

function dayDelta(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((a - b) / 86_400_000)
}

export function duesRows(
  entries: CashEntry[],
  league: League,
  season: number,
  today: Date = new Date(),
): DuesRow[] {
  const deadline = league.duesDeadline ? new Date(`${league.duesDeadline}T00:00:00`) : null
  const daysOverdue =
    deadline && !Number.isNaN(deadline.valueOf()) ? dayDelta(today, deadline) : null

  const byManager = new Map<ManagerId, DuesRow>()
  for (const entry of entries) {
    if (entry.type !== 'dues' || entry.season !== season) continue
    const row =
      byManager.get(entry.manager) ??
      ({
        manager: entry.manager,
        owed: 0,
        settled: true,
        tier: 'paid',
        daysOverdue,
        entryIds: [],
      } as DuesRow)
    row.entryIds.push(entry.id)
    if (!entry.settled) {
      row.owed += Math.abs(entry.amount)
      row.settled = false
    }
    byManager.set(entry.manager, row)
  }

  for (const row of byManager.values()) {
    if (row.settled) {
      row.tier = 'paid'
    } else if (daysOverdue === null || daysOverdue <= 0) {
      row.tier = 'pending'
    } else {
      row.tier = daysOverdue > DEADBEAT_AFTER_DAYS ? 'deadbeat' : 'overdue'
    }
  }

  return [...byManager.values()]
}

/**
 * Venmo's prefilled-payment web link. It opens the app on a phone with the
 * recipient, amount, and note already filled. Venmo has changed this format
 * before, so callers should treat it as best effort — a stale format still
 * lands the payer on Venmo, which is the important half.
 */
export function venmoPayUrl(league: League, amount: number, season: number): string | null {
  const handle = league.venmoHandle?.replace(/^@/, '').trim()
  if (!handle) return null
  const params = new URLSearchParams({
    txn: 'pay',
    audience: 'private',
    recipients: handle,
    amount: amount.toFixed(2),
    note: `${league.name} ${season} dues`,
  })
  return `https://venmo.com/?${params.toString()}`
}
