import { useState } from 'react'
import { Link } from 'react-router-dom'
import { managerName, useLeagueData } from '../lib/data'
import { money } from '../lib/format'
import { contractYearsRemaining } from '../lib/rules'
import { playerSlug } from '../lib/search'
import type { ContractYear, KeeperBlock } from '../lib/types'

/**
 * Every keeper contract as a bar running from the current season to its
 * expiry. Reading down a column shows how much of the league is committed in a
 * given year; reading across a team shows who is about to lose their core.
 */
export default function ContractBoard({ year }: { year: number }) {
  const { keepers, managers } = useLeagueData()
  const [hovered, setHovered] = useState<string | null>(null)
  const blocks = keepers[String(year)] ?? []

  // Only show seasons a contract can actually reach. A kept player has already
  // advanced past year A, so the horizon is usually three columns, not four.
  const maxRemaining = Math.max(
    0,
    ...blocks.flatMap((block) =>
      block.keepers.map((pick) =>
        contractYearsRemaining(pick.contractYear as ContractYear | null),
      ),
    ),
  )
  const horizon = Array.from({ length: maxRemaining + 1 }, (_, offset) => year + offset)

  // A/B/C/D advanced by n seasons; null once the contract has expired.
  const ORDER: ContractYear[] = ['A', 'B', 'C', 'D']
  const letterAt = (current: ContractYear | null, offset: number): ContractYear | null => {
    if (!current) return null
    const index = ORDER.indexOf(current) + offset
    return index < ORDER.length ? ORDER[index] : null
  }

  const toneFor = (remaining: number) =>
    remaining >= 3
      ? 'var(--color-arc-green)'
      : remaining === 2
        ? 'var(--color-arc-cyan)'
        : remaining === 1
          ? 'var(--color-arc-orange)'
          : 'var(--color-arc-red)'

  // Total salary committed per future season, for the footer summary.
  const committed = horizon.map((target) =>
    blocks.reduce(
      (total, block) =>
        total +
        block.keepers.reduce((sum, pick) => {
          const remaining = contractYearsRemaining(pick.contractYear as ContractYear | null)
          return target <= year + remaining ? sum + (pick.salary ?? 0) : sum
        }, 0),
      0,
    ),
  )

  return (
    <div>
      <div className="scroll-x">
        <div className="min-w-0 sm:min-w-[540px]">
          {/* year ruler */}
          <div className="sticky top-0 z-10 flex border-b border-arc-line bg-arc-panel pb-1.5">
            <div className="label w-[100px] shrink-0 sm:w-[168px]">Player</div>
            {horizon.map((target) => (
              <div key={target} className="label flex-1 text-center">
                {target}
              </div>
            ))}
            <div className="label w-14 shrink-0 text-right">Left</div>
          </div>

          {blocks.map((block: KeeperBlock) => (
            <div key={block.team} className="border-b border-arc-line/60 py-2.5 last:border-b-0">
              <div className="mb-1.5 flex items-baseline gap-2 pl-1">
                <span className="text-[12px] text-arc-ink">
                  {block.manager ? (
                    <Link
                      to={`/managers/${block.manager}`}
                      className="transition-colors hover:text-arc-green"
                    >
                      {managerName(managers, block.manager)}
                    </Link>
                  ) : (
                    block.team
                  )}
                </span>
                <span className="truncate text-[10px] text-arc-ink-faint">{block.team}</span>
              </div>

              {block.keepers.map((pick) => {
                const remaining = contractYearsRemaining(pick.contractYear as ContractYear | null)
                const key = `${block.team}-${pick.player}`
                const dim = hovered !== null && hovered !== key
                return (
                  <div
                    key={key}
                    className="flex items-center transition-opacity duration-150"
                    style={{ opacity: dim ? 0.32 : 1 }}
                    onMouseEnter={() => setHovered(key)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <div className="flex w-[100px] shrink-0 items-baseline justify-between gap-1 pr-1.5 sm:w-[168px] sm:gap-1.5 sm:pr-2.5">
                      <Link
                        to={`/players/${playerSlug(pick.player)}`}
                        className="truncate text-[11px] text-arc-ink-soft transition-colors hover:text-arc-blue sm:text-[13px]"
                        title={pick.player}
                      >
                        {pick.player}
                      </Link>
                      <span className="tnum shrink-0 text-[11px] text-arc-ink sm:text-[12px]">
                        {money(pick.salary)}
                      </span>
                    </div>
                    <div className="flex flex-1 items-center">
                      {horizon.map((target, offset) => {
                        const letter = letterAt(pick.contractYear as ContractYear | null, offset)
                        const remainingThen = remaining - offset
                        return (
                          <div key={target} className="flex flex-1 justify-center">
                            {letter ? (
                              <span
                                className="arcade flex h-6 w-7 items-center justify-center border-2 text-[11px]"
                                style={{
                                  borderColor: toneFor(remainingThen),
                                  color: offset === 0 ? '#06040d' : toneFor(remainingThen),
                                  background: offset === 0 ? toneFor(remainingThen) : 'transparent',
                                }}
                                title={`${pick.player}: year ${letter} in ${target}`}
                              >
                                {letter}
                              </span>
                            ) : (
                              <span className="text-[13px] text-arc-ink-faint" aria-hidden>
                                ·
                              </span>
                            )}
                          </div>
                        )
                      })}
                      <span
                        className="arcade w-14 shrink-0 text-right text-[9px]"
                        style={{ color: toneFor(remaining) }}
                      >
                        {remaining === 0 ? 'LAST YR' : `${remaining} LEFT`}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

          {/* committed salary per season */}
          <div className="flex border-t border-arc-line pt-2">
            <div className="label w-[100px] shrink-0 pr-1.5 text-right sm:w-[168px] sm:pr-2.5">Committed</div>
            {committed.map((total, index) => (
              <div key={horizon[index]} className="flex-1 text-center">
                <span className="tnum text-[12px] text-arc-ink">{money(total)}</span>
              </div>
            ))}
            <div className="w-14 shrink-0" />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-arc-ink-faint">
        <span>Chip = contract year (A–D) in that season · solid = this year</span>
        {/* Derived from the contracts actually on the board, so the key never
            advertises a tier that cannot appear. */}
        {[
          { remaining: 3, label: '3 yrs left', tone: 'var(--color-arc-green)' },
          { remaining: 2, label: '2 yrs', tone: 'var(--color-arc-cyan)' },
          { remaining: 1, label: '1 yr', tone: 'var(--color-arc-orange)' },
          { remaining: 0, label: 'final year', tone: 'var(--color-arc-red)' },
        ]
          .filter((item) => item.remaining <= maxRemaining)
          .map((item) => (
            <span key={item.label} className="flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-3.5" style={{ background: item.tone }} />
              {item.label}
            </span>
          ))}
      </div>
    </div>
  )
}
