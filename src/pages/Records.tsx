import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ChampionsWall from '../components/ChampionsWall'
import TradeFlow from '../components/TradeFlow'
import { ScoringChart } from '../components/charts'
import { Panel, PageHeader, SegmentedControl } from '../components/ui'
import { managerName, useLeagueData } from '../lib/data'
import { useTrades } from '../lib/derive'
import { num, pct, record } from '../lib/format'
import {
  careerTable,
  eraOptions,
  leagueScoringByYear,
  seasonExtremes,
  type CareerLine,
} from '../lib/stats'
import type { Manager } from '../lib/types'

export default function Records() {
  const { seasons, managers } = useLeagueData()
  const eras = eraOptions(seasons)
  const [eraId, setEraId] = useState('keeper')
  const era = eras.find((option) => option.id === eraId) ?? eras[0]

  const trades = useTrades()
  const table = careerTable(seasons, era)
  const scoring = useMemo(() => leagueScoringByYear(seasons), [seasons])
  const pointsFor = useMemo(
    () => seasonExtremes(seasons, era, 'avgPointsFor'),
    [seasons, era],
  )

  return (
    <>
      <PageHeader
        path="~/records"
        eyebrow="Rolling Statistics"
        title="Records"
        lede="Leaderboards recompute against whichever era you select, so a keeper-era record and an all-time record never get confused."
        action={
          <SegmentedControl
            value={eraId}
            onChange={setEraId}
            options={eras.map((option) => ({ id: option.id, label: option.label }))}
          />
        }
      />

      <Panel
        title="League scoring by season"
        subtitle="Average points per team per game. Kickers were removed in 2020, which moves the whole baseline — compare seasons against this line, not against each other."
        delay={60}
      >
        <div className="px-4 py-5">
          <ScoringChart data={scoring} height={230} />
        </div>
      </Panel>

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-2">
        <Board
          title="Titles"
          delay={100}
          rows={[...table].sort((a, b) => b.titles - a.titles || b.topThree - a.topThree).slice(0, 10)}
          managers={managers}
          columns={[
            { header: 'Titles', render: (line) => line.titles },
            { header: '2nd', render: (line) => line.runnerUps },
            { header: '3rd', render: (line) => line.thirds },
            { header: 'Top 3', render: (line) => line.topThree },
          ]}
        />

        <Board
          title="Regular season win %"
          delay={140}
          rows={[...table].sort((a, b) => b.winPct - a.winPct).slice(0, 10)}
          managers={managers}
          columns={[
            { header: 'Record', render: (line) => record(line.wins, line.losses) },
            { header: 'Win %', render: (line) => pct(line.winPct), highlight: true },
          ]}
        />

        <Board
          title="Playoff appearances"
          delay={180}
          rows={[...table].sort((a, b) => b.playoffRate - a.playoffRate).slice(0, 10)}
          managers={managers}
          columns={[
            { header: 'Apps', render: (line) => line.playoffAppearances },
            { header: 'Seasons', render: (line) => line.seasonsPlayed },
            { header: 'Rate', render: (line) => pct(line.playoffRate, 0), highlight: true },
          ]}
        />

        <Board
          title="Playoff wins"
          delay={220}
          rows={[...table].sort((a, b) => b.playoffWins - a.playoffWins).slice(0, 10)}
          managers={managers}
          columns={[
            { header: 'W', render: (line) => line.playoffWins, highlight: true },
            { header: 'L', render: (line) => line.playoffLosses },
          ]}
        />

        <Board
          title="Points per game"
          delay={260}
          rows={[...table]
            .filter((line) => line.avgPointsFor !== null)
            .sort((a, b) => (b.avgPointsFor ?? 0) - (a.avgPointsFor ?? 0))
            .slice(0, 10)}
          managers={managers}
          columns={[
            { header: 'For', render: (line) => num(line.avgPointsFor, 2), highlight: true },
            { header: 'Against', render: (line) => num(line.avgPointsAgainst, 2) },
          ]}
        />

        <Board
          title="Points against per game"
          delay={300}
          rows={[...table]
            .filter((line) => line.avgPointsAgainst !== null)
            .sort((a, b) => (a.avgPointsAgainst ?? 0) - (b.avgPointsAgainst ?? 0))
            .slice(0, 10)}
          managers={managers}
          columns={[
            { header: 'Against', render: (line) => num(line.avgPointsAgainst, 2), highlight: true },
            { header: 'Seasons', render: (line) => line.seasonsPlayed },
          ]}
        />
      </div>

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[1fr_1fr]">
        <Panel
          title="trade flow"
          subtitle="Auction dollars exchanged between every pair of managers since the structured ledger began."
          delay={320}
        >
          <div className="px-3 py-5">
            <TradeFlow trades={trades} />
          </div>
        </Panel>

        <Panel
          title="champions"
          subtitle="Twenty-two seasons. Repeat winners grow with each title."
          delay={340}
        >
          <div className="max-h-[560px] overflow-y-auto">
            <ChampionsWall />
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-2">
        <Panel
          title="Highest scoring seasons"
          subtitle="Points per game across a full regular season."
          delay={340}
        >
          <table className="out">
            <tbody>
              {pointsFor.best.map((row, index) => (
                <tr key={`${row.manager}-${row.year}`}>
                  <td className="tnum w-8 text-arc-ink-faint">{index + 1}</td>
                  <td>
                    <Link
                      to={`/managers/${row.manager}`}
                      className="transition-colors hover:text-arc-green"
                    >
                      {managerName(managers, row.manager)}
                    </Link>
                  </td>
                  <td className="n text-arc-ink-faint">{row.year}</td>
                  <td className="n text-arc-green">{num(row.value, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Lowest scoring seasons" subtitle="The other end of the book." delay={380}>
          <table className="out">
            <tbody>
              {pointsFor.worst.map((row, index) => (
                <tr key={`${row.manager}-${row.year}`}>
                  <td className="tnum w-8 text-arc-ink-faint">{index + 1}</td>
                  <td>
                    <Link
                      to={`/managers/${row.manager}`}
                      className="transition-colors hover:text-arc-green"
                    >
                      {managerName(managers, row.manager)}
                    </Link>
                  </td>
                  <td className="n text-arc-ink-faint">{row.year}</td>
                  <td className="n text-[var(--color-arc-red)]">{num(row.value, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  )
}

function Board({
  title,
  rows,
  columns,
  managers,
  delay,
}: {
  title: string
  rows: CareerLine[]
  columns: { header: string; render: (line: CareerLine) => React.ReactNode; highlight?: boolean }[]
  managers: Manager[]
  delay: number
}) {
  return (
    <Panel title={title} delay={delay}>
      <table className="out">
        <thead>
          <tr>
            <th className="n">#</th>
            <th>Manager</th>
            {columns.map((column) => (
              <th key={column.header} className="n">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((line, index) => (
            <tr key={line.manager}>
              <td className="n text-arc-ink-faint">{index + 1}</td>
              <td>
                <Link
                  to={`/managers/${line.manager}`}
                  className="transition-colors hover:text-arc-green"
                >
                  {managerName(managers, line.manager)}
                </Link>
              </td>
              {columns.map((column) => (
                <td
                  key={column.header}
                  className={`n ${column.highlight ? 'text-arc-green' : 'text-arc-ink-soft'}`}
                >
                  {column.render(line)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}
