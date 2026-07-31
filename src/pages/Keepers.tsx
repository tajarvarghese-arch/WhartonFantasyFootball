import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Chip, Empty, Panel, PageHeader } from '../components/ui'
import { managerName, useLeagueData } from '../lib/data'
import { useBudgets } from '../lib/derive'
import { money } from '../lib/format'
import { contractYearsRemaining, keeperEligibility } from '../lib/rules'
import type { ContractYear } from '../lib/types'

const CONTRACT_TONE: Record<ContractYear, string> = {
  A: 'text-[var(--color-ledger-up)]',
  B: 'text-gold-400',
  C: 'text-[var(--color-ledger-flag)]',
  D: 'text-[var(--color-ledger-down)]',
}

export default function Keepers() {
  const { league, managers, keepers } = useLeagueData()
  const years = useMemo(
    () =>
      Object.keys(keepers)
        .map(Number)
        .sort((a, b) => b - a),
    [keepers],
  )
  const [year, setYear] = useState(years[0] ?? league.currentSeason)
  const [expanded, setExpanded] = useState<string | null>(null)

  const blocks = keepers[String(year)] ?? []
  const budgets = useBudgets(year)
  const budgetFor = (manager: string | null) =>
    budgets.find((budget) => budget.manager === manager)

  return (
    <>
      <PageHeader
        eyebrow="Contracts & Rosters"
        title="Keepers"
        lede={`Each team retains up to ${league.keeperSlots} players for a maximum ${league.maxContractYears}-year contract. Salary comes off the $${league.baseDraftBudget} auction budget.`}
        action={
          <select
            className="field w-auto"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            aria-label="Keeper season"
          >
            {years.map((option) => (
              <option key={option} value={option}>
                {option} keepers
              </option>
            ))}
          </select>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {blocks.map((block, index) => {
          const budget = budgetFor(block.manager)
          const salary = block.keepers.reduce((total, pick) => total + (pick.salary ?? 0), 0)
          const open = expanded === block.team
          const eligible = keeperEligibility(block)

          return (
            <Panel key={block.team} delay={index * 40}>
              <div className="px-5 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-[family-name:var(--font-display)] text-[24px] leading-tight text-parchment">
                      {block.team}
                    </div>
                    {block.manager && (
                      <Link
                        to={`/managers/${block.manager}`}
                        className="eyebrow transition-colors hover:text-gold-300"
                      >
                        {managerName(managers, block.manager)}
                      </Link>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="eyebrow">Draft budget</div>
                    <div
                      className={`tnum text-[24px] leading-none ${
                        (budget?.available ?? block.draftBudget ?? 0) < 0
                          ? 'text-[var(--color-ledger-down)]'
                          : 'text-gold-400'
                      }`}
                    >
                      {money(budget?.available ?? block.draftBudget)}
                    </div>
                  </div>
                </div>

                <table className="ledger mt-4">
                  <thead>
                    <tr>
                      <th>Keeper</th>
                      <th className="num">Salary</th>
                      <th className="num">Contract</th>
                    </tr>
                  </thead>
                  <tbody>
                    {block.keepers.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-parchment-faint italic">
                          No keepers selected.
                        </td>
                      </tr>
                    ) : (
                      block.keepers.map((pick) => (
                        <tr key={`${pick.player}-${pick.salary}`}>
                          <td>{pick.player}</td>
                          <td className="num text-parchment-dim">{money(pick.salary)}</td>
                          <td className="num">
                            <span
                              className={
                                pick.contractYear ? CONTRACT_TONE[pick.contractYear] : undefined
                              }
                            >
                              {pick.contractYear ?? '—'}
                            </span>
                            <span className="ml-2 text-[11px] text-parchment-faint">
                              {contractYearsRemaining(pick.contractYear) === 0
                                ? 'final year'
                                : `${contractYearsRemaining(pick.contractYear)} left`}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                <dl className="mt-4 grid grid-cols-3 gap-3 border-t rule-gold pt-4 text-[12px]">
                  <div>
                    <dt className="text-parchment-faint">Base</dt>
                    <dd className="tnum mt-0.5 text-parchment-dim">
                      {money(league.baseDraftBudget)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-parchment-faint">Keeper salary</dt>
                    <dd className="tnum mt-0.5 text-[var(--color-ledger-down)]">
                      {money(-salary)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-parchment-faint">Traded cash</dt>
                    <dd
                      className={`tnum mt-0.5 ${
                        (budget?.cashNet ?? block.cashTraded) > 0
                          ? 'text-[var(--color-ledger-up)]'
                          : (budget?.cashNet ?? block.cashTraded) < 0
                            ? 'text-[var(--color-ledger-down)]'
                            : 'text-parchment-faint'
                      }`}
                    >
                      {money(budget?.cashNet ?? block.cashTraded, { sign: true })}
                    </dd>
                  </div>
                </dl>

                <button
                  type="button"
                  className="mt-4 text-[11px] font-semibold tracking-[0.09em] text-gold-400 uppercase hover:text-gold-500"
                  onClick={() => setExpanded(open ? null : block.team)}
                >
                  {open ? '− Hide' : '+ Show'} {year - 1} ending roster ({block.endingRoster.length})
                </button>
              </div>

              {open && (
                <div className="border-t rule-gold">
                  <table className="ledger">
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th className="num">Cost</th>
                        <th className="num">Yr</th>
                        <th>Keeper status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eligible.map((spot) => (
                        <tr key={`${spot.player}-${spot.cost}`}>
                          <td>{spot.player}</td>
                          <td className="num text-parchment-dim">{money(spot.cost)}</td>
                          <td className="num">
                            <span
                              className={
                                spot.contractYear ? CONTRACT_TONE[spot.contractYear] : undefined
                              }
                            >
                              {spot.contractYear ?? '—'}
                            </span>
                          </td>
                          <td className="text-[12px]">
                            {spot.eligible ? (
                              <span className="text-parchment-faint">{spot.reason}</span>
                            ) : (
                              <Chip tone="down">{spot.reason}</Chip>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )
        })}
        {blocks.length === 0 && (
          <Panel>
            <Empty>No keeper records for {year}.</Empty>
          </Panel>
        )}
      </div>
    </>
  )
}
