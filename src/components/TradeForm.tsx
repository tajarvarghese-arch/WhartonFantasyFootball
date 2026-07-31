import { useMemo, useState } from 'react'
import { useLeagueData } from '../lib/data'
import { newId, useBudgets } from '../lib/derive'
import { money } from '../lib/format'
import { antiDumpingCheck, validateTrade } from '../lib/rules'
import type { Trade, TradeObligation } from '../lib/types'
import { Chip } from './ui'

interface Props {
  onSubmit: (trade: Trade) => Promise<void>
  onCancel: () => void
  canSave: boolean
}

/**
 * Records a trade the way the league writes them: a seller gives up a player,
 * the buyer pays auction dollars spread across future seasons.
 */
export default function TradeForm({ onSubmit, onCancel, canSave }: Props) {
  const { league, managers } = useLeagueData()
  const active = managers.filter((manager) => manager.active)
  const budgets = useBudgets(league.currentSeason)

  const [seller, setSeller] = useState('')
  const [buyer, setBuyer] = useState('')
  const [players, setPlayers] = useState('')
  const [note, setNote] = useState('')
  const [obligations, setObligations] = useState<TradeObligation[]>([
    { year: league.currentSeason, amount: 0 },
  ])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const draft = useMemo(
    () => ({ seller, buyer, players, obligations, season: league.currentSeason }),
    [seller, buyer, players, obligations, league.currentSeason],
  )
  const issues = validateTrade(draft, league, budgets)
  const blocking = issues.filter((issue) => issue.level === 'error')
  const verdict = antiDumpingCheck(draft)
  const total = obligations.reduce((sum, obligation) => sum + obligation.amount, 0)

  const summary = useMemo(() => {
    const sellerName = active.find((m) => m.id === seller)?.displayName ?? '?'
    const buyerName = active.find((m) => m.id === buyer)?.displayName ?? '?'
    const terms = obligations
      .filter((obligation) => obligation.amount > 0)
      .map((obligation) => `$${obligation.amount} in ${obligation.year}`)
      .join('; ')
    return `${sellerName} trades ${players || '…'} to ${buyerName} for ${terms || 'no cash'}`
  }, [active, seller, buyer, players, obligations])

  function updateObligation(index: number, patch: Partial<TradeObligation>) {
    setObligations((current) =>
      current.map((obligation, i) => (i === index ? { ...obligation, ...patch } : obligation)),
    )
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const cleaned = obligations.filter((obligation) => obligation.amount > 0)
      const trade: Trade = {
        id: newId('t'),
        batch: `${league.currentSeason} Preseason`,
        season: league.currentSeason,
        preseason: true,
        seller,
        buyer,
        players: players.trim(),
        terms:
          cleaned
            .map((obligation) => `$${obligation.amount} in ${obligation.year}`)
            .join('; ') || '(player-for-player, no cash)',
        totalDollars: cleaned.reduce((sum, obligation) => sum + obligation.amount, 0),
        obligations: cleaned,
        status: 'pending',
        source: 'app',
        proposedAt: new Date().toISOString(),
        commissionerNote: note.trim() || undefined,
      }
      await onSubmit(trade)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not record the trade.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5 px-5 py-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow">Seller — gives up the player</span>
          <select
            className="field mt-2"
            value={seller}
            onChange={(event) => setSeller(event.target.value)}
          >
            <option value="">Select…</option>
            {active.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.displayName} · {manager.team}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="eyebrow">Buyer — pays auction dollars</span>
          <select
            className="field mt-2"
            value={buyer}
            onChange={(event) => setBuyer(event.target.value)}
          >
            <option value="">Select…</option>
            {active.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.displayName} · {manager.team}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="eyebrow">Players included</span>
        <input
          className="field mt-2"
          placeholder="Jahmyr Gibbs  ·  or  George Kittle &lt;-&gt; Kendrick Bourne"
          value={players}
          onChange={(event) => setPlayers(event.target.value)}
        />
      </label>

      <div>
        <div className="flex items-center justify-between">
          <span className="eyebrow">Auction dollars by year</span>
          <button
            type="button"
            className="text-[11px] font-semibold tracking-[0.09em] text-gold-400 uppercase hover:text-gold-500"
            onClick={() =>
              setObligations((current) => [
                ...current,
                {
                  year: (current.at(-1)?.year ?? league.currentSeason) + 1,
                  amount: 0,
                },
              ])
            }
          >
            + Add year
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {obligations.map((obligation, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="number"
                className="field tnum w-28"
                value={obligation.year}
                min={league.currentSeason}
                max={league.currentSeason + 6}
                onChange={(event) =>
                  updateObligation(index, { year: Number(event.target.value) || 0 })
                }
                aria-label="Season"
              />
              <div className="relative flex-1">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-parchment-faint">
                  $
                </span>
                <input
                  type="number"
                  className="field tnum pl-6"
                  value={obligation.amount}
                  min={0}
                  onChange={(event) =>
                    updateObligation(index, { amount: Number(event.target.value) || 0 })
                  }
                  aria-label="Amount"
                />
              </div>
              {obligations.length > 1 && (
                <button
                  type="button"
                  className="px-2 text-[18px] leading-none text-parchment-faint hover:text-[var(--color-ledger-down)]"
                  onClick={() =>
                    setObligations((current) => current.filter((_, i) => i !== index))
                  }
                  aria-label={`Remove ${obligation.year}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[12px]">
          <span className="text-parchment-faint">Total consideration</span>
          <span className="tnum text-gold-400">{money(total)}</span>
        </div>
      </div>

      <label className="block">
        <span className="eyebrow">Commissioner note (optional)</span>
        <input
          className="field mt-2"
          placeholder="Context, ROFR history, deadline proximity…"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      {(issues.length > 0 || verdict.triggered) && (
        <ul className="space-y-1.5 border-l-2 border-gold-600/40 pl-3 text-[12px]">
          {issues.map((issue, index) => (
            <li
              key={index}
              className={
                issue.level === 'error'
                  ? 'text-[var(--color-ledger-down)]'
                  : 'text-[var(--color-ledger-flag)]'
              }
            >
              {issue.message}
            </li>
          ))}
        </ul>
      )}

      <div className="border-t rule-gold pt-4">
        <div className="eyebrow">Reads as</div>
        <p className="mt-1.5 text-[13px] text-parchment-dim italic">{summary}</p>
      </div>

      {error && <p className="text-[12px] text-[var(--color-ledger-down)]">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        {canSave ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={blocking.length > 0 || busy}
            onClick={() => void save()}
          >
            {busy ? 'Recording…' : 'Add to queue'}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn"
              onClick={() => void navigator.clipboard.writeText(summary)}
            >
              Copy for the commissioner
            </button>
            <Chip tone="neutral">Read-only — unlock commissioner mode to record</Chip>
          </>
        )}
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
