import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { commitFile, isCommissioner } from './github'
import type {
  CashFile,
  FaabFile,
  LeagueData,
  LiveStandings,
  Manager,
  ManagerId,
  TradeQueueFile,
} from './types'

const FILES = {
  league: 'league.json',
  managers: 'managers.json',
  seasons: 'seasons.json',
  keepers: 'keepers.json',
  trades: 'trades.json',
  tradeLedger: 'trade-ledger.json',
  waivers: 'waivers.json',
  legacyTrades: 'legacy-trades.json',
  rules: 'rules.json',
  cash: 'cash.json',
  faab: 'faab.json',
  tradeQueue: 'trade-queue.json',
  live: 'live.json',
  playerPoints: 'player-points.json',
} as const

/** Files the commissioner edits in-app. Writes go to GitHub *and* to this cache. */
export type WritableFile = 'cash.json' | 'faab.json' | 'trade-queue.json'

const OVERLAY_KEY = 'wacl.overlay'

/**
 * GitHub Pages redeploys a minute or two after a commit, so a fresh fetch can
 * still return the pre-write file. This overlay keeps the UI truthful in the
 * meantime and is discarded once the served file catches up.
 */
type Overlay = Partial<Record<WritableFile, unknown>>

function readOverlay(): Overlay {
  try {
    return JSON.parse(localStorage.getItem(OVERLAY_KEY) ?? '{}') as Overlay
  } catch {
    return {}
  }
}

function writeOverlay(overlay: Overlay): void {
  try {
    localStorage.setItem(OVERLAY_KEY, JSON.stringify(overlay))
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearOverlay(): void {
  try {
    localStorage.removeItem(OVERLAY_KEY)
  } catch {
    /* ignore */
  }
}

/** live.json only exists once the Yahoo sync has run at least once. */
async function loadOptionalJson<T>(file: string): Promise<T | null> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/${file}`, { cache: 'no-cache' })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

async function loadJson<T>(file: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${file}`, { cache: 'no-cache' })
  if (!response.ok) throw new Error(`Missing data file: ${file}`)
  return (await response.json()) as T
}

interface DataContextValue {
  data: LeagueData | null
  error: string | null
  loading: boolean
  reload: () => Promise<void>
  /** Commits to GitHub, then applies the same change locally. */
  save: <T>(file: WritableFile, update: (current: T) => T, message: string) => Promise<void>
  commissioner: boolean
  setCommissioner: (on: boolean) => void
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<LeagueData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [commissioner, setCommissioner] = useState(isCommissioner)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [
        league,
        managers,
        seasons,
        keepers,
        trades,
        tradeLedger,
        waivers,
        legacyTrades,
        rules,
        cash,
        faab,
        tradeQueue,
        live,
        playerPoints,
      ] = await Promise.all([
        loadJson<LeagueData['league']>(FILES.league),
        loadJson<LeagueData['managers']>(FILES.managers),
        loadJson<LeagueData['seasons']>(FILES.seasons),
        loadJson<LeagueData['keepers']>(FILES.keepers),
        loadJson<LeagueData['trades']>(FILES.trades),
        loadJson<LeagueData['tradeLedger']>(FILES.tradeLedger),
        loadJson<LeagueData['waivers']>(FILES.waivers),
        loadJson<LeagueData['legacyTrades']>(FILES.legacyTrades),
        loadJson<LeagueData['rules']>(FILES.rules),
        loadJson<CashFile>(FILES.cash),
        loadJson<FaabFile>(FILES.faab),
        loadJson<TradeQueueFile>(FILES.tradeQueue),
        loadOptionalJson<LiveStandings>(FILES.live),
        loadOptionalJson<import('./types').PlayerPoints>(FILES.playerPoints),
      ])

      const overlay = readOverlay()
      const next: LeagueData = {
        league,
        managers,
        seasons,
        keepers,
        trades,
        tradeLedger,
        waivers,
        legacyTrades,
        rules,
        cash: (overlay['cash.json'] as CashFile) ?? cash,
        faab: (overlay['faab.json'] as FaabFile) ?? faab,
        tradeQueue: (overlay['trade-queue.json'] as TradeQueueFile) ?? tradeQueue,
        live,
        playerPoints,
      }

      // Drop overlay entries the deployed site has caught up on.
      const pruned: Overlay = {}
      const served: Record<WritableFile, unknown> = {
        'cash.json': cash,
        'faab.json': faab,
        'trade-queue.json': tradeQueue,
      }
      for (const [file, value] of Object.entries(overlay) as [WritableFile, unknown][]) {
        if (JSON.stringify(served[file]) !== JSON.stringify(value)) pruned[file] = value
      }
      writeOverlay(pruned)

      setData(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load league data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const save = useCallback<DataContextValue['save']>(async (file, update, message) => {
    const next = await commitFile(file, update, message)
    const overlay = readOverlay()
    overlay[file] = next
    writeOverlay(overlay)
    setData((current) => {
      if (!current) return current
      if (file === 'cash.json') return { ...current, cash: next as CashFile }
      if (file === 'faab.json') return { ...current, faab: next as FaabFile }
      return { ...current, tradeQueue: next as TradeQueueFile }
    })
  }, [])

  const value = useMemo<DataContextValue>(
    () => ({ data, error, loading, reload, save, commissioner, setCommissioner }),
    [data, error, loading, reload, save, commissioner],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useLeague(): DataContextValue {
  const context = useContext(DataContext)
  if (!context) throw new Error('useLeague must be used inside <DataProvider>')
  return context
}

/** Throws if data has not loaded — use inside routes rendered after the gate. */
export function useLeagueData(): LeagueData {
  const { data } = useLeague()
  if (!data) throw new Error('League data is not ready')
  return data
}

export function managerMap(managers: Manager[]): Map<ManagerId, Manager> {
  return new Map(managers.map((manager) => [manager.id, manager]))
}

export function managerName(managers: Manager[], id: ManagerId | null | undefined): string {
  if (!id) return '—'
  const manager = managers.find((candidate) => candidate.id === id)
  return manager ? manager.displayName : id
}
