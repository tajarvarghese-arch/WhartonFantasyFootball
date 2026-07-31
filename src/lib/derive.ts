import { useMemo } from 'react'
import { useLeagueData } from './data'
import { buildLedger, draftBudgets, faabPositions, type DraftBudget } from './rules'
import type { FaabPosition } from './rules'
import type { ManagerId, Trade } from './types'

/**
 * The workbook's trades are historical fact; the queue holds anything the app
 * has recorded since. Everything downstream reads the merged list so an
 * approval immediately moves budgets.
 */
export function useTrades(): Trade[] {
  const { trades, tradeQueue } = useLeagueData()
  return useMemo(() => {
    const queued = new Map(tradeQueue.proposals.map((trade) => [trade.id, trade]))
    // A queued record with the same id supersedes the seeded one.
    const merged = trades.map((trade) => queued.get(trade.id) ?? trade)
    const seen = new Set(merged.map((trade) => trade.id))
    for (const trade of tradeQueue.proposals) {
      if (!seen.has(trade.id)) merged.push(trade)
    }
    return merged.sort((a, b) => b.season - a.season || a.id.localeCompare(b.id))
  }, [trades, tradeQueue])
}

export function usePendingTrades(): Trade[] {
  const trades = useTrades()
  return useMemo(
    () => trades.filter((trade) => trade.status === 'pending' || trade.status === 'market-check'),
    [trades],
  )
}

export function useLedger() {
  const trades = useTrades()
  return useMemo(() => buildLedger(trades), [trades])
}

export function useBudgets(year: number): DraftBudget[] {
  const { league, keepers } = useLeagueData()
  const ledger = useLedger()
  return useMemo(
    () => draftBudgets(league, keepers[String(year)], ledger, year),
    [league, keepers, ledger, year],
  )
}

export function useFaab(season: number): FaabPosition[] {
  const { league, managers, faab } = useLeagueData()
  return useMemo(() => {
    const active = managers.filter((manager) => manager.active).map((manager) => manager.id)
    return faabPositions(league, faab.entries, season, active)
  }, [league, managers, faab, season])
}

export interface CashPosition {
  manager: ManagerId
  owed: number
  settled: number
  outstanding: number
  entries: number
}

/** Positive outstanding = the league owes the manager. Negative = they owe. */
export function useCash(season: number | 'all'): CashPosition[] {
  const { managers, cash } = useLeagueData()
  return useMemo(() => {
    const scoped = cash.entries.filter((entry) => season === 'all' || entry.season === season)
    return managers
      .filter((manager) => manager.active)
      .map((manager) => {
        const mine = scoped.filter((entry) => entry.manager === manager.id)
        const owed = mine.reduce((total, entry) => total + entry.amount, 0)
        const settled = mine
          .filter((entry) => entry.settled)
          .reduce((total, entry) => total + entry.amount, 0)
        return {
          manager: manager.id,
          owed,
          settled,
          outstanding: owed - settled,
          entries: mine.length,
        }
      })
      .sort((a, b) => a.outstanding - b.outstanding)
  }, [managers, cash, season])
}

/** Future auction-dollar obligations still on the books, by year. */
export function useObligationHorizon(fromYear: number) {
  const ledger = useLedger()
  return useMemo(() => {
    return Object.keys(ledger)
      .map(Number)
      .filter((year) => year >= fromYear)
      .sort((a, b) => a - b)
      .map((year) => {
        const entries = Object.values(ledger[String(year)])
        const gross = entries.reduce((total, entry) => total + entry.received, 0)
        return { year, gross, managers: entries.length }
      })
  }, [ledger, fromYear])
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}
