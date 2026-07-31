import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Chip, Empty, Hero, Panel, PageHeader, Sparkline } from '../components/ui'
import { managerName, useLeagueData } from '../lib/data'
import { money } from '../lib/format'
import { playerDossier } from '../lib/search'

export default function PlayerDetail() {
  const { name = '' } = useParams()
  const data = useLeagueData()
  const decoded = useMemo(() => decodeURIComponent(name), [name])
  const dossier = useMemo(() => playerDossier(data, decoded), [data, decoded])
  const { managers } = data

  if (dossier.stints.length === 0 && dossier.trades.length === 0) {
    return (
      <>
        <PageHeader path="~/players" eyebrow="player history" title="Not found" />
        <Panel>
          <Empty>
            No roster record for “{decoded}”. Try the{' '}
            <span className="text-arc-green">⌘K</span> search.
          </Empty>
        </Panel>
      </>
    )
  }

  const owners = [...new Set(dossier.stints.map((stint) => stint.manager))].filter(Boolean)
  const chronological = [...dossier.stints].sort((a, b) => a.year - b.year)

  return (
    <>
      <PageHeader
        path="~/players"
        eyebrow={`grep "${dossier.name}" rosters/*`}
        title={dossier.name}
        lede={`On league rosters from ${dossier.firstSeen} to ${dossier.lastSeen} across ${owners.length} ${owners.length === 1 ? 'manager' : 'managers'}.`}
      />

      <div className="mb-8 grid min-w-0 gap-8 lg:grid-cols-[1fr_1.1fr]">
        <Hero
          label="Peak keeper cost"
          value={money(dossier.peakCost)}
          accent
          caption={
            <>
              Highest salary this player ever carried against a $200 auction budget.{' '}
              {dossier.trades.length > 0 &&
                `Moved in ${dossier.trades.length} recorded ${dossier.trades.length === 1 ? 'trade' : 'trades'}.`}
            </>
          }
        />
        <div className="self-end">
          <div className="label mb-2">Salary by season</div>
          <div className="text-[26px]">
            <Sparkline values={chronological.map((stint) => stint.cost)} />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-arc-ink-faint">
            <span>{chronological[0]?.year}</span>
            <span>{chronological.at(-1)?.year}</span>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <Panel title="roster history" subtitle="Every keeper sheet this player appears on.">
          <table className="out">
            <thead>
              <tr>
                <th>Season</th>
                <th>Manager</th>
                <th className="n">Cost</th>
                <th className="n">Yr</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {dossier.stints.map((stint) => (
                <tr key={`${stint.year}-${stint.team}`}>
                  <td className="tnum">{stint.year}</td>
                  <td>
                    {stint.manager ? (
                      <Link
                        to={`/managers/${stint.manager}`}
                        className="transition-colors hover:text-arc-green"
                      >
                        {managerName(managers, stint.manager)}
                      </Link>
                    ) : (
                      stint.team
                    )}
                  </td>
                  <td className="n">{money(stint.cost)}</td>
                  <td className="n text-arc-ink-faint">{stint.contractYear ?? '—'}</td>
                  <td>
                    {stint.kept ? <Chip tone="up">kept</Chip> : <Chip>rostered</Chip>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="trades" subtitle="Deals in the structured ledger naming this player.">
          {dossier.trades.length === 0 ? (
            <Empty>Never traded.</Empty>
          ) : (
            <table className="out">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>From</th>
                  <th>To</th>
                  <th className="n">Total</th>
                </tr>
              </thead>
              <tbody>
                {dossier.trades.map((trade) => (
                  <tr key={trade.id}>
                    <td className="tnum text-arc-ink-faint">{trade.batch}</td>
                    <td>{managerName(managers, trade.seller)}</td>
                    <td>{managerName(managers, trade.buyer)}</td>
                    <td className="n text-arc-green">{money(trade.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </>
  )
}
