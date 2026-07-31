import { useMemo } from 'react'
import { managerName, useLeagueData } from '../lib/data'
import { money } from '../lib/format'
import type { Trade } from '../lib/types'

/**
 * Transaction tape. The content is duplicated so the marquee can loop
 * seamlessly at -50%; hovering pauses it so a line can actually be read.
 */
export default function Ticker({ trades }: { trades: Trade[] }) {
  const { managers } = useLeagueData()

  const items = useMemo(
    () =>
      trades
        .filter((trade) => trade.status === 'approved' && trade.totalDollars > 0)
        .slice(0, 22)
        .map((trade) => ({
          id: trade.id,
          seller: managerName(managers, trade.seller),
          buyer: managerName(managers, trade.buyer),
          total: trade.totalDollars,
          players: trade.players.length > 34 ? `${trade.players.slice(0, 33)}…` : trade.players,
          season: trade.season,
        })),
    [trades, managers],
  )

  if (items.length === 0) return null

  const run = [...items, ...items]
  // Pace the loop by content length so a long tape doesn't race past.
  const duration = Math.max(40, items.length * 4.5)

  return (
    <div className="marquee-host relative overflow-hidden border-y border-term-line bg-term-surface/60">
      <div
        className="marquee flex w-max items-center gap-7 py-2"
        style={{ ['--marquee-duration' as string]: `${duration}s` }}
      >
        {run.map((item, index) => (
          <span
            key={`${item.id}-${index}`}
            className="flex shrink-0 items-center gap-2 text-[11px] whitespace-nowrap"
            aria-hidden={index >= items.length}
          >
            <span className="text-term-faint">{item.season}</span>
            <span className="text-term-mid">{item.seller}</span>
            <span className="text-term-green">→</span>
            <span className="text-term-mid">{item.buyer}</span>
            <span className="tnum text-term-text">{money(item.total)}</span>
            <span className="text-term-faint">{item.players}</span>
            <span className="text-term-line-bright">·</span>
          </span>
        ))}
      </div>
      {/* fade the edges so items enter and leave rather than pop */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-term-bg to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-term-bg to-transparent" />
    </div>
  )
}
