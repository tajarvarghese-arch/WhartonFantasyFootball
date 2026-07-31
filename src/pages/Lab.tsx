import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ManagerTag from '../components/ManagerTag'
import { Chip, Panel, PageHeader } from '../components/ui'
import { managerName, useLeagueData } from '../lib/data'
import { managerColor } from '../lib/identity'
import { money, num, pct } from '../lib/format'
import {
  careerLuck,
  contractRuns,
  eloTimeline,
  goatIndex,
  luckRows,
  tortureBoard,
  vegasBoard,
} from '../lib/analytics'

export default function Lab() {
  const data = useLeagueData()
  const { seasons, managers, keepers, league } = data
  const activeIds = useMemo(
    () => managers.filter((manager) => manager.active).map((manager) => manager.id),
    [managers],
  )

  const luck = useMemo(() => luckRows(seasons), [seasons])
  const career = useMemo(() => careerLuck(luck), [luck])
  const goat = useMemo(() => goatIndex(seasons), [seasons])
  const elo = useMemo(() => eloTimeline(seasons), [seasons])
  const torture = useMemo(
    () => tortureBoard(seasons, league.currentSeason).filter((row) => activeIds.includes(row.manager)),
    [seasons, league.currentSeason, activeIds],
  )
  const contracts = useMemo(() => contractRuns(keepers), [keepers])
  const odds = useMemo(() => vegasBoard(seasons, activeIds), [seasons, activeIds])

  const eloRows = useMemo(
    () =>
      elo.map((point) => ({
        year: point.year,
        ...point.ratings,
      })),
    [elo],
  )

  const singleSeasonLuck = useMemo(() => {
    const sorted = [...luck].sort((a, b) => b.luck - a.luck)
    return { blessed: sorted.slice(0, 8), cursed: sorted.slice(-8).reverse() }
  }, [luck])

  return (
    <>
      <PageHeader
        eyebrow="The numbers nobody asked for"
        title="The Lab"
        lede="Twenty-two seasons put under the microscope: who was lucky, who was robbed, who was actually great, and who Vegas would take in 2026."
      />

      {/* Vegas board */}
      <Panel
        title={`${league.currentSeason} title odds`}
        subtitle="Monte Carlo on each manager's keeper-era scoring history — 5,000 simulated seasons, no schedules, no mercy. A toy, but a fair toy."
      >
        <div className="grid grid-cols-2 gap-0 sm:grid-cols-3 lg:grid-cols-4">
          {odds.map((row, index) => (
            <div
              key={row.manager}
              className="flex items-center justify-between gap-2 border-b-2 border-arc-line/60 px-4 py-3"
            >
              <ManagerTag id={row.manager} size={22} />
              <span className="text-right">
                <span
                  className="tnum block text-[16px] font-bold"
                  style={{ color: index === 0 ? 'var(--color-arc-yellow)' : 'var(--color-arc-ink)' }}
                >
                  {row.american}
                </span>
                <span className="text-[11px] text-arc-ink-faint">{pct(row.probability)}</span>
              </span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Elo timeline */}
      <div className="mt-6">
        <Panel
          title="empires rise and fall"
          subtitle="Season-granularity Elo, 2004–2025. Watch Baugh's three-peat dynasty crest and Stu's fifteen-year gap between rings."
        >
          <div className="px-2 py-5">
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={eloRows} margin={{ top: 8, right: 14, bottom: 0, left: -10 }}>
                <CartesianGrid stroke="rgba(239,234,251,0.08)" vertical={false} />
                <XAxis
                  dataKey="year"
                  stroke="#6b6089"
                  tickLine={false}
                  tick={{ fill: '#6b6089', fontSize: 11 }}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />
                <YAxis
                  stroke="#6b6089"
                  tickLine={false}
                  tick={{ fill: '#6b6089', fontSize: 11 }}
                  domain={['dataMin - 15', 'dataMax + 15']}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    background: '#171128',
                    border: '2px solid #3a2f5c',
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#a79cc4' }}
                  formatter={(value, name) => [String(value), managerName(managers, String(name))]}
                />
                {activeIds.map((id) => (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={id}
                    stroke={managerColor(id)}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    animationDuration={900}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 px-2">
              {activeIds.map((id) => (
                <span key={id} className="flex items-center gap-1.5 text-[12px] text-arc-ink-soft">
                  <span
                    aria-hidden
                    className="inline-block h-2.5 w-2.5"
                    style={{ background: managerColor(id) }}
                  />
                  {managerName(managers, id)}
                </span>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {/* Luck */}
      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-2">
        <Panel
          title="the luck index"
          subtitle="Pythagorean expectation: how many wins the points earned vs how many arrived. Positive = the schedule loved you."
        >
          <table className="out">
            <thead>
              <tr>
                <th>Manager</th>
                <th className="n">Seasons</th>
                <th className="n">Career luck</th>
                <th className="n">Peak fortune</th>
              </tr>
            </thead>
            <tbody>
              {career
                .filter((row) => activeIds.includes(row.manager))
                .map((row) => (
                  <tr key={row.manager}>
                    <td>
                      <ManagerTag id={row.manager} size={22} />
                    </td>
                    <td className="n text-arc-ink-faint">{row.seasons}</td>
                    <td
                      className="n"
                      style={{
                        color:
                          row.totalLuck > 0 ? 'var(--color-arc-green)' : 'var(--color-arc-red)',
                      }}
                    >
                      {row.totalLuck > 0 ? '+' : ''}
                      {num(row.totalLuck, 1)} W
                    </td>
                    <td className="n text-arc-ink-faint">
                      {row.luckiestYear.year} ({row.luckiestYear.luck > 0 ? '+' : ''}
                      {num(row.luckiestYear.luck, 1)})
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="most blessed & most cursed seasons" subtitle="Single-season gaps between record and points, all-time.">
          <table className="out">
            <thead>
              <tr>
                <th>Manager</th>
                <th className="n">Year</th>
                <th className="n">Record</th>
                <th className="n">Deserved</th>
                <th className="n">Luck</th>
              </tr>
            </thead>
            <tbody>
              {[...singleSeasonLuck.blessed, ...singleSeasonLuck.cursed].map((row, index) => (
                <tr key={`${row.manager}-${row.year}`}>
                  <td>
                    <ManagerTag id={row.manager} size={22} />
                  </td>
                  <td className="n text-arc-ink-faint">{row.year}</td>
                  <td className="n">
                    {row.wins}–{row.losses}
                  </td>
                  <td className="n text-arc-ink-faint">{num(row.expectedWins, 1)}W</td>
                  <td
                    className="n"
                    style={{
                      color: index < 8 ? 'var(--color-arc-green)' : 'var(--color-arc-red)',
                    }}
                  >
                    {row.luck > 0 ? '+' : ''}
                    {num(row.luck, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      {/* GOAT + Torture */}
      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-2">
        <Panel
          title="the goat index"
          subtitle="Scoring measured against each season's own field (z-scores), so eras compare honestly. Sum rewards dominance and longevity together."
        >
          <table className="out">
            <thead>
              <tr>
                <th className="n">#</th>
                <th>Manager</th>
                <th className="n">Seasons</th>
                <th className="n">GOAT pts</th>
                <th className="n">Per season</th>
                <th className="n">Rings</th>
              </tr>
            </thead>
            <tbody>
              {goat.map((row, index) => (
                <tr key={row.manager}>
                  <td className="n text-arc-ink-faint">{index + 1}</td>
                  <td>
                    <ManagerTag id={row.manager} size={22} />
                  </td>
                  <td className="n text-arc-ink-faint">{row.seasons}</td>
                  <td
                    className="n"
                    style={{ color: index === 0 ? 'var(--color-arc-yellow)' : undefined }}
                  >
                    {num(row.sumZ, 1)}
                  </td>
                  <td className="n text-arc-ink-faint">{num(row.avgZ, 2)}</td>
                  <td className="n">{row.titles || '·'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel
          title="the torture board"
          subtitle="Championship droughts among the current twelve, measured to the coming season. Runner-ups shown because they hurt more."
        >
          <table className="out">
            <thead>
              <tr>
                <th>Manager</th>
                <th className="n">Drought</th>
                <th className="n">Last ring</th>
                <th className="n">2nd places</th>
                <th className="n">Playoffs</th>
              </tr>
            </thead>
            <tbody>
              {torture.map((row) => (
                <tr key={row.manager}>
                  <td>
                    <ManagerTag id={row.manager} size={22} />
                    {row.neverWon && (
                      <span className="ml-2">
                        <Chip tone="down">never</Chip>
                      </span>
                    )}
                  </td>
                  <td
                    className="n"
                    style={{
                      color:
                        row.drought >= 15
                          ? 'var(--color-arc-red)'
                          : row.drought >= 8
                            ? 'var(--color-arc-orange)'
                            : 'var(--color-arc-ink)',
                    }}
                  >
                    {row.drought} yrs
                  </td>
                  <td className="n text-arc-ink-faint">{row.lastTitleYear ?? '—'}</td>
                  <td className="n">{row.runnerUps || '·'}</td>
                  <td className="n text-arc-ink-faint">
                    {row.playoffAppearances}/{row.seasonsPlayed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      {/* Contracts */}
      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-2">
        <Panel
          title="best contracts ever"
          subtitle="Keeper runs valued against each season's median keeper salary. The all-time bargain bin."
        >
          <ContractTable rows={contracts.steals} positive />
        </Panel>
        <Panel title="worst contracts ever" subtitle="The same math, pointed the other way.">
          <ContractTable rows={contracts.overpays} positive={false} />
        </Panel>
      </div>

      <p className="mt-6 text-[12px] leading-relaxed text-arc-ink-faint">
        Methods: luck is wins minus Pythagorean expected wins (exponent 2.37) from season points
        for/against. GOAT is the sum of within-season scoring z-scores. Elo updates once per season
        on win% against the field's average rating (K=6/game, +14 for a title). Odds resample
        keeper-era scoring with noise; they know nothing about 2026 rosters.
      </p>
    </>
  )
}

function ContractTable({
  rows,
  positive,
}: {
  rows: { manager: string; player: string; years: number[]; salaries: number[]; valueVsMedian: number }[]
  positive: boolean
}) {
  return (
    <table className="out">
      <thead>
        <tr>
          <th>Player</th>
          <th>Manager</th>
          <th className="n">Years</th>
          <th className="n">Paid</th>
          <th className="n">Value</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.manager}-${row.player}`}>
            <td>{row.player}</td>
            <td>
              <ManagerTag id={row.manager} size={22} />
            </td>
            <td className="n text-arc-ink-faint">
              {row.years[0]}
              {row.years.length > 1 ? `–${String(row.years[row.years.length - 1]).slice(2)}` : ''}
            </td>
            <td className="n text-arc-ink-faint">{row.salaries.map((s) => money(s)).join(' ')}</td>
            <td
              className="n"
              style={{ color: positive ? 'var(--color-arc-green)' : 'var(--color-arc-red)' }}
            >
              {row.valueVsMedian > 0 ? '+' : ''}
              {money(row.valueVsMedian)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
