import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ContractBoard from '../components/ContractBoard'
import KeeperEditor from '../components/KeeperEditor'
import WarRoom from '../components/WarRoom'
import { Chip, Empty, Panel, PageHeader } from '../components/ui'
import { managerName, useLeague, useLeagueData } from '../lib/data'
import { useBudgets } from '../lib/derive'
import { money } from '../lib/format'
import { contractYearsRemaining, keeperEligibility } from '../lib/rules'
import type { ContractYear } from '../lib/types'

// A fresh -> D expiring, so the colour reads as a fuse burning down.
const CONTRACT_TONE: Record<ContractYear, string> = {
  A: 'text-arc-green',
  B: 'text-arc-cyan',
  C: 'text-arc-orange',
  D: 'text-arc-red',
}

export default function Keepers() {
  const { league, managers, keepers } = useLeagueData()
  const { commissioner } = useLeague()
  const years = useMemo(
    () =>
      Object.keys(keepers)
        .map(Number)
        .sort((a, b) => b - a),
    [keepers],
  )
  const [year, setYear] = useState(years[0] ?? league.currentSeason)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)

  const blocks = keepers[String(year)] ?? []
  const budgets = useBudgets(year)
  const budgetFor = (manager: string | null) =>
    budgets.find((budget) => budget.manager === manager)

  return (
    <>
      <PageHeader
        path="~/keepers"
        eyebrow="Contracts & Rosters"
        title="Keepers"
        lede={`Each team retains up to ${league.keeperSlots} players for a maximum ${league.maxContractYears}-year contract. Salary comes off the $${league.baseDraftBudget} auction budget.`}
        action={
          <select
            className="field w-auto"
            value={year}
            onChange={(event) => {
              setYear(Number(event.target.value))
              setEditing(null)
            }}
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

      <div className="mb-6">
        <Panel
          title="war room"
          subtitle="Try any keeper combination and watch the draft budget move. Costs and contract years follow the league rules automatically."
        >
          <WarRoom year={year} />
        </Panel>
      </div>

      <div className="mb-6">
        <Panel
          title="contract board"
          subtitle="Every keeper contract from this season to its expiry. Read down a column to see how much of the league is already committed in that year."
        >
          <div className="px-2 py-4 sm:px-4">
            <ContractBoard year={year} />
          </div>
        </Panel>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
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
                    <div className="text-[24px] leading-tight text-arc-ink">
                      {block.team}
                    </div>
                    {block.manager && (
                      <Link
                        to={`/managers/${block.manager}`}
                        className="label transition-colors hover:text-arc-green"
                      >
                        {managerName(managers, block.manager)}
                      </Link>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="label">Draft budget</div>
                    <div
                      className={`tnum text-[24px] leading-none ${
                        (budget?.available ?? block.draftBudget ?? 0) < 0
                          ? 'text-[var(--color-arc-red)]'
                          : 'text-arc-green'
                      }`}
                    >
                      {money(budget?.available ?? block.draftBudget)}
                    </div>
                  </div>
                </div>

                {editing === block.team ? (
                  <KeeperEditor
                    key={`${year}-${block.team}`}
                    year={year}
                    block={block}
                    onDone={() => setEditing(null)}
                  />
                ) : (
                  <table className="out mt-4">
                    <thead>
                      <tr>
                        <th>Keeper</th>
                        <th className="n">Salary</th>
                        <th className="n">Contract</th>
                      </tr>
                    </thead>
                    <tbody>
                      {block.keepers.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-arc-ink-faint italic">
                            No keepers selected.
                          </td>
                        </tr>
                      ) : (
                        block.keepers.map((pick) => (
                          <tr key={`${pick.player}-${pick.salary}`}>
                            <td>{pick.player}</td>
                            <td className="n text-arc-ink-soft">{money(pick.salary)}</td>
                            <td className="n">
                              <span
                                className={
                                  pick.contractYear ? CONTRACT_TONE[pick.contractYear] : undefined
                                }
                              >
                                {pick.contractYear ?? '—'}
                              </span>
                              <span className="ml-2 text-[11px] text-arc-ink-faint">
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
                )}

                <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-arc-line pt-4 text-[12px]">
                  <div>
                    <dt className="text-arc-ink-faint">Base</dt>
                    <dd className="tnum mt-0.5 text-arc-ink-soft">
                      {money(league.baseDraftBudget)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-arc-ink-faint">Keeper salary</dt>
                    <dd className="tnum mt-0.5 text-[var(--color-arc-red)]">
                      {money(-salary)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-arc-ink-faint">Traded cash</dt>
                    <dd
                      className={`tnum mt-0.5 ${
                        (budget?.cashNet ?? block.cashTraded) > 0
                          ? 'text-[var(--color-arc-green)]'
                          : (budget?.cashNet ?? block.cashTraded) < 0
                            ? 'text-[var(--color-arc-red)]'
                            : 'text-arc-ink-faint'
                      }`}
                    >
                      {money(budget?.cashNet ?? block.cashTraded, { sign: true })}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setExpanded(open ? null : block.team)}
                  >
                    {open ? '− Hide' : '+ Show'} {year - 1} ending roster (
                    {block.endingRoster.length})
                  </button>
                  {commissioner && editing !== block.team && (
                    <button type="button" className="btn" onClick={() => setEditing(block.team)}>
                      ✎ Edit keepers
                    </button>
                  )}
                </div>
              </div>

              {open && (
                <div className="border-t border-arc-line">
                  <table className="out">
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th className="n">Cost</th>
                        <th className="n">Yr</th>
                        <th>Keeper status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eligible.map((spot) => (
                        <tr key={`${spot.player}-${spot.cost}`}>
                          <td>{spot.player}</td>
                          <td className="n text-arc-ink-soft">{money(spot.cost)}</td>
                          <td className="n">
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
                              <span className="text-arc-ink-faint">{spot.reason}</span>
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
