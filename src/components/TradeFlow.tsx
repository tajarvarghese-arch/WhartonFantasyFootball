import { useMemo, useState } from 'react'
import { managerName, useLeagueData } from '../lib/data'
import { money } from '../lib/format'
import type { ManagerId, Trade } from '../lib/types'

interface Link {
  from: ManagerId
  to: ManagerId
  dollars: number
}

/**
 * Who deals with whom. Managers sit on a circle; each arc carries the auction
 * dollars that moved between a pair, thickness scaled to the amount. Hovering
 * a manager isolates their trades.
 */
export default function TradeFlow({ trades }: { trades: Trade[] }) {
  const { managers } = useLeagueData()
  const [focus, setFocus] = useState<ManagerId | null>(null)

  const { nodes, links, max } = useMemo(() => {
    const totals = new Map<string, Link>()
    const involved = new Set<ManagerId>()

    for (const trade of trades) {
      if (trade.status !== 'approved' || trade.totalDollars <= 0) continue
      involved.add(trade.seller)
      involved.add(trade.buyer)
      // Undirected pair key so A→B and B→A stack into one arc.
      const key = [trade.seller, trade.buyer].sort().join('|')
      const existing = totals.get(key)
      if (existing) existing.dollars += trade.totalDollars
      else
        totals.set(key, {
          from: trade.seller,
          to: trade.buyer,
          dollars: trade.totalDollars,
        })
    }

    const order = managers
      .filter((manager) => involved.has(manager.id))
      .map((manager) => manager.id)
    const linkList = [...totals.values()]
    return {
      nodes: order,
      links: linkList,
      max: Math.max(...linkList.map((link) => link.dollars), 1),
    }
  }, [trades, managers])

  const size = 460
  const cx = size / 2
  const cy = size / 2
  const radius = size / 2 - 74

  const positions = new Map<ManagerId, { x: number; y: number; angle: number }>()
  nodes.forEach((id, index) => {
    const angle = (index / nodes.length) * Math.PI * 2 - Math.PI / 2
    positions.set(id, {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      angle,
    })
  })

  if (nodes.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-[12.5px] text-term-faint">
        No trades recorded yet.
      </div>
    )
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="mx-auto block h-auto w-full max-w-[460px]"
        role="img"
        aria-label="Trade relationships between managers, arc thickness scaled to auction dollars exchanged"
      >
        <g>
          {links.map((link) => {
            const a = positions.get(link.from)
            const b = positions.get(link.to)
            if (!a || !b) return null
            const dimmed = focus !== null && focus !== link.from && focus !== link.to
            const width = 0.8 + (link.dollars / max) * 7
            // Pull the curve toward the centre so heavy pairs read as chords.
            const mx = cx + (a.x + b.x - 2 * cx) * 0.12
            const my = cy + (a.y + b.y - 2 * cy) * 0.12
            return (
              <path
                key={`${link.from}-${link.to}`}
                d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
                fill="none"
                stroke={dimmed ? 'var(--color-term-line-bright)' : 'var(--color-term-green)'}
                strokeWidth={width}
                strokeLinecap="round"
                opacity={dimmed ? 0.18 : focus ? 0.85 : 0.34}
                style={{ transition: 'opacity 160ms ease, stroke 160ms ease' }}
              >
                <title>
                  {managerName(managers, link.from)} ↔ {managerName(managers, link.to)}:{' '}
                  {money(link.dollars)}
                </title>
              </path>
            )
          })}
        </g>

        <g>
          {nodes.map((id) => {
            const point = positions.get(id)
            if (!point) return null
            const dimmed = focus !== null && focus !== id
            const flipped = Math.cos(point.angle) < -0.01
            const labelX = cx + Math.cos(point.angle) * (radius + 14)
            const labelY = cy + Math.sin(point.angle) * (radius + 14)
            return (
              <g
                key={id}
                onMouseEnter={() => setFocus(id)}
                onMouseLeave={() => setFocus(null)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={focus === id ? 5 : 3.5}
                  fill={dimmed ? 'var(--color-term-faint)' : 'var(--color-term-green)'}
                  style={{ transition: 'r 160ms ease, fill 160ms ease' }}
                />
                <text
                  x={labelX}
                  y={labelY}
                  fill={dimmed ? 'var(--color-term-faint)' : 'var(--color-term-text)'}
                  fontSize="11"
                  fontFamily="IBM Plex Mono, monospace"
                  dominantBaseline="middle"
                  textAnchor={flipped ? 'end' : 'start'}
                  style={{ transition: 'fill 160ms ease' }}
                >
                  {managerName(managers, id)}
                </text>
                {/* generous invisible hit area for touch */}
                <circle cx={point.x} cy={point.y} r={16} fill="transparent" />
              </g>
            )
          })}
        </g>
      </svg>

      <p className="mt-2 text-center text-[11px] text-term-faint">
        {focus ? (
          <>
            <span className="text-term-text">{managerName(managers, focus)}</span> —{' '}
            {links.filter((link) => link.from === focus || link.to === focus).length} trading
            partners,{' '}
            {money(
              links
                .filter((link) => link.from === focus || link.to === focus)
                .reduce((total, link) => total + link.dollars, 0),
            )}{' '}
            exchanged
          </>
        ) : (
          'Hover a manager to isolate their trades'
        )}
      </p>
    </div>
  )
}
