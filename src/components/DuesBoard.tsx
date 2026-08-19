import { useState } from 'react'
import PixelMugshot from './PixelMugshot'
import { Panel } from './ui'
import { managerName, useLeague, useLeagueData } from '../lib/data'
import { managerColor } from '../lib/identity'
import { duesRows, venmoPayUrl, type DuesRow } from '../lib/dues'
import { money } from '../lib/format'
import type { CashFile } from '../lib/types'

/**
 * The wanted board. Unpaid managers get a poster with a bounty and a
 * one-tap Venmo link; the settled sit quietly underneath. Everything is
 * derived from the dues rows in the cash ledger, so the board empties
 * itself as the commissioner marks entries settled.
 */

const TIER_COPY: Record<string, { banner: string; tone: string; note: string }> = {
  pending: { banner: 'WANTED', tone: 'var(--color-arc-orange)', note: 'Payment outstanding' },
  overdue: { banner: 'WANTED', tone: 'var(--color-arc-red)', note: 'Past due' },
  delinquent: { banner: 'DELINQUENT', tone: 'var(--color-arc-red)', note: 'Long overdue' },
}

export default function DuesBoard({ season }: { season: number }) {
  const { league, managers, cash } = useLeagueData()
  const { commissioner, save } = useLeague()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const rows = duesRows(cash.entries, league, season)
  const unpaid = rows.filter((row) => !row.settled).sort((a, b) => b.owed - a.owed)
  const paid = rows.filter((row) => row.settled)
  const total = unpaid.reduce((sum, row) => sum + row.owed, 0)

  async function settle(row: DuesRow) {
    setBusy(row.manager)
    setError(null)
    try {
      await save<CashFile>(
        'cash.json',
        (current) => ({
          ...current,
          entries: current.entries.map((entry) =>
            row.entryIds.includes(entry.id) ? { ...entry, settled: true } : entry,
          ),
        }),
        `Dues settled: ${managerName(managers, row.manager)} (${season})`,
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not mark it settled.')
    } finally {
      setBusy(null)
    }
  }

  if (rows.length === 0) {
    return (
      <Panel title={`${season} dues`}>
        <p className="px-5 py-6 text-[13.5px] text-arc-ink-faint italic">
          No dues recorded for {season}. Add them from the Cash tab and they'll appear here.
        </p>
      </Panel>
    )
  }

  return (
    <div className="space-y-6">
      <Panel
        title={unpaid.length ? 'wanted — for non-payment of league dues' : 'all square'}
        subtitle={
          unpaid.length
            ? `${unpaid.length} of ${rows.length} managers owe ${money(total)}. Tap a bounty to pay by Venmo.`
            : 'Every manager has settled. The board rests until next season.'
        }
      >
        {unpaid.length === 0 ? (
          <p className="px-5 py-8 text-center text-[15px] text-arc-green">
            Nobody owes the league a dime.
          </p>
        ) : (
          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
            {unpaid.map((row) => {
              const copy = TIER_COPY[row.tier] ?? TIER_COPY.pending
              const href = venmoPayUrl(league, row.owed, season)
              const days = row.daysOverdue
              return (
                <div
                  key={row.manager}
                  className="relative overflow-hidden rounded-sm border-2 shadow-lg"
                  style={{
                    borderColor: '#8a7a56',
                    background: 'linear-gradient(160deg, #efe4c8 0%, #ded0ac 60%, #cdbd95 100%)',
                    color: '#241c10',
                  }}
                >
                  {row.tier === 'delinquent' && (
                    <span
                      className="arcade pointer-events-none absolute top-1/2 -right-2 z-10 -rotate-12 border-4 px-2 py-0.5 text-[13px] opacity-70"
                      style={{ borderColor: '#9d1c1c', color: '#9d1c1c' }}
                    >
                      DELINQUENT
                    </span>
                  )}
                  <div
                    className="arcade border-b-2 px-3 py-1.5 text-center text-[19px] tracking-[0.22em]"
                    style={{ borderColor: '#8a7a56', color: copy.tone === 'var(--color-arc-red)' ? '#9d1c1c' : '#7a4a12' }}
                  >
                    {copy.banner}
                  </div>

                  <div className="flex items-center gap-3 px-3 pt-3">
                    <div className="shrink-0 border-2" style={{ borderColor: '#8a7a56' }}>
                      <PixelMugshot seed={row.manager} scale={3} />
                    </div>
                    <div className="min-w-0">
                      <div
                        className="truncate text-[20px] leading-tight font-bold"
                        style={{ color: managerColor(row.manager) }}
                      >
                        {managerName(managers, row.manager)}
                      </div>
                      <div className="text-[11px] leading-snug tracking-wide uppercase opacity-70">
                        {copy.note}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 border-y-2 px-3 py-2 text-center" style={{ borderColor: '#8a7a56' }}>
                    <div className="text-[10px] tracking-[0.2em] uppercase opacity-70">Bounty</div>
                    <div className="tnum text-[30px] leading-none font-bold">{money(row.owed)}</div>
                    <div className="mt-1 text-[11px] opacity-70">
                      {days === null
                        ? 'Due before draft night'
                        : days > 0
                          ? `${days} day${days === 1 ? '' : 's'} past due`
                          : days === 0
                            ? 'Due today'
                            : `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} remaining`}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 px-3 py-3">
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="arcade rounded-md px-3 py-2 text-center text-[14px] tracking-wider"
                        style={{ background: '#1f8f3a', color: '#f2ffe9' }}
                      >
                        PAY BOUNTY · VENMO
                      </a>
                    ) : (
                      <span className="text-center text-[11px] opacity-60">
                        No Venmo handle configured
                      </span>
                    )}
                    {commissioner && (
                      <button
                        type="button"
                        className="arcade rounded-md border-2 px-3 py-1.5 text-[12px] tracking-wider disabled:opacity-40"
                        style={{ borderColor: '#8a7a56', color: '#241c10' }}
                        disabled={busy === row.manager}
                        onClick={() => void settle(row)}
                      >
                        {busy === row.manager ? 'RECORDING…' : 'MARK PAID'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {error && <p className="px-5 pb-4 text-[12px] text-[var(--color-arc-red)]">{error}</p>}
      </Panel>

      <Panel title="settled" subtitle={`${paid.length} of ${rows.length} paid up.`}>
        {paid.length === 0 ? (
          <p className="px-5 py-5 text-[13px] text-arc-ink-faint italic">
            Nobody yet. Somebody has to go first.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 px-5 py-5">
            {paid.map((row) => (
              <span
                key={row.manager}
                className="flex items-center gap-2 rounded-lg border border-arc-line bg-arc-raised px-3 py-1.5 text-[13px]"
              >
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: managerColor(row.manager) }}
                />
                {managerName(managers, row.manager)}
                <span className="arcade text-[11px] text-arc-green">PAID</span>
              </span>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
