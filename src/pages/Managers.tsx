import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Chip, Panel, PageHeader, SegmentedControl, Scroller, Sparkline } from '../components/ui'
import { managerName, useLeagueData } from '../lib/data'
import { num, pct, record } from '../lib/format'
import { careerTable, eraOptions, managerSeasons } from '../lib/stats'

export default function Managers() {
  const { seasons, managers } = useLeagueData()
  const eras = eraOptions(seasons)
  const [eraId, setEraId] = useState(eras[0].id)
  const era = eras.find((option) => option.id === eraId) ?? eras[0]
  const table = careerTable(seasons, era)

  return (
    <>
      <PageHeader
        path="~/managers"
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
        <Scroller>
          <table className="out">
            <thead>
              <tr>
                <th>Manager</th>
                <th className="n">Sea</th>
                <th className="n">Record</th>
                <th className="n">Win %</th>
                <th className="n">Titles</th>
                <th className="n">Top 3</th>
                <th className="n">Playoffs</th>
                <th className="n">Rate</th>
                <th className="n">Avg PF</th>
                <th className="n">Avg PA</th>
                <th>Form</th>
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
                        className="font-medium transition-colors hover:text-term-green"
                      >
                        {managerName(managers, line.manager)}
                      </Link>
                      {manager && !manager.active && (
                        <span className="ml-2">
                          <Chip>Former</Chip>
                        </span>
                      )}
                    </td>
                    <td className="n text-term-faint">{line.seasonsPlayed}</td>
                    <td className="n">{record(line.wins, line.losses)}</td>
                    <td className="n text-term-green">{pct(line.winPct)}</td>
                    <td className="n">
                      {line.titles > 0 ? (
                        <span className="text-term-green">
                          {'★'.repeat(Math.min(line.titles, 4))}
                          {line.titles > 4 ? ` ${line.titles}` : ''}
                        </span>
                      ) : (
                        <span className="text-term-faint">·</span>
                      )}
                    </td>
                    <td className="n text-term-dim">{line.topThree || '·'}</td>
                    <td className="n text-term-dim">
                      {line.playoffAppearances}/{line.seasonsPlayed}
                    </td>
                    <td className="n text-term-faint">{pct(line.playoffRate, 0)}</td>
                    <td className="n text-term-dim">{num(line.avgPointsFor)}</td>
                    <td className="n text-term-faint">{num(line.avgPointsAgainst)}</td>
                    <td title="Win % by season, oldest to newest">
                      <Sparkline
                        values={managerSeasons(seasons, line.manager)
                          .slice(0, 10)
                          .reverse()
                          .map((row) =>
                            row.team.wins + row.team.losses
                              ? row.team.wins / (row.team.wins + row.team.losses)
                              : null,
                          )}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Scroller>
      </Panel>
    </>
  )
}
