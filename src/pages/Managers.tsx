import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Chip, Panel, PageHeader, SegmentedControl } from '../components/ui'
import { managerName, useLeagueData } from '../lib/data'
import { num, pct, record } from '../lib/format'
import { careerTable, eraOptions } from '../lib/stats'

export default function Managers() {
  const { seasons, managers } = useLeagueData()
  const eras = eraOptions(seasons)
  const [eraId, setEraId] = useState(eras[0].id)
  const era = eras.find((option) => option.id === eraId) ?? eras[0]
  const table = careerTable(seasons, era)

  return (
    <>
      <PageHeader
        eyebrow="Career Records"
        title="Managers"
        lede="Sixteen managers have played in this league. Win percentage is regular season; titles count finishing first after the playoffs."
        action={
          <SegmentedControl
            value={eraId}
            onChange={setEraId}
            options={eras.map((option) => ({ id: option.id, label: option.label }))}
          />
        }
      />

      <Panel title={`${era.label} career table`} subtitle={`${table.length} managers`}>
        <div className="overflow-x-auto">
          <table className="ledger">
            <thead>
              <tr>
                <th>Manager</th>
                <th className="num">Sea</th>
                <th className="num">Record</th>
                <th className="num">Win %</th>
                <th className="num">Titles</th>
                <th className="num">Top 3</th>
                <th className="num">Playoffs</th>
                <th className="num">Rate</th>
                <th className="num">Avg PF</th>
                <th className="num">Avg PA</th>
              </tr>
            </thead>
            <tbody>
              {table.map((line) => {
                const manager = managers.find((candidate) => candidate.id === line.manager)
                return (
                  <tr key={line.manager}>
                    <td className="whitespace-nowrap">
                      <Link
                        to={`/managers/${line.manager}`}
                        className="font-medium transition-colors hover:text-gold-400"
                      >
                        {managerName(managers, line.manager)}
                      </Link>
                      {manager && !manager.active && (
                        <span className="ml-2">
                          <Chip>Former</Chip>
                        </span>
                      )}
                    </td>
                    <td className="num text-parchment-faint">{line.seasonsPlayed}</td>
                    <td className="num">{record(line.wins, line.losses)}</td>
                    <td className="num text-gold-400">{pct(line.winPct)}</td>
                    <td className="num">
                      {line.titles > 0 ? (
                        <span className="text-gold-400">
                          {'★'.repeat(Math.min(line.titles, 4))}
                          {line.titles > 4 ? ` ${line.titles}` : ''}
                        </span>
                      ) : (
                        <span className="text-parchment-faint">·</span>
                      )}
                    </td>
                    <td className="num text-parchment-dim">{line.topThree || '·'}</td>
                    <td className="num text-parchment-dim">
                      {line.playoffAppearances}/{line.seasonsPlayed}
                    </td>
                    <td className="num text-parchment-faint">{pct(line.playoffRate, 0)}</td>
                    <td className="num text-parchment-dim">{num(line.avgPointsFor)}</td>
                    <td className="num text-parchment-faint">{num(line.avgPointsAgainst)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
