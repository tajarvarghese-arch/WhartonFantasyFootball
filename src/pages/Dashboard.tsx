import { Link } from 'react-router-dom'
import { Bar, Chip, Empty, Panel, PageHeader, Stat } from '../components/ui'
import { managerName, useLeagueData } from '../lib/data'
import { useBudgets, useCash, useObligationHorizon, usePendingTrades } from '../lib/derive'
import { money, num, record, shortDate } from '../lib/format'
import { antiDumpingCheck } from '../lib/rules'

export default function Dashboard() {
  const data = useLeagueData()
  const { league, managers, seasons } = data
  const season = league.currentSeason
  const budgets = useBudgets(season)
  const pending = usePendingTrades()
  const cash = useCash(season)
  const horizon = useObligationHorizon(season)

  const lastSeason = seasons[0]
  const champion = lastSeason?.champion
  const underwater = budgets.filter((budget) => budget.overCommitted)
  const cashOutstanding = cash.reduce((total, row) => total + Math.abs(row.outstanding), 0)
  const committed = horizon.reduce((total, row) => total + row.gross, 0)
  const maxBudget = Math.max(...budgets.map((budget) => budget.available), 1)

  return (
    <>
      <PageHeader
        path="~"
        eyebrow={`${season} Pre-Season · Commissioner's Desk`}
        title="The Ledger"
        lede={`Twenty-two seasons of ${league.name}, from the 2004 charter to the ${season} auction. Every dollar, contract, and decision in one book.`}
      />

      <div className="rise mb-8 grid grid-cols-2 gap-6 lg:grid-cols-4" style={{ animationDelay: '60ms' }}>
        <Stat
          label="Awaiting ruling"
          countTo={pending.length}
          value={pending.length}
          hint={pending.length ? 'Trades need your decision' : 'Queue is clear'}
          tone={pending.length ? 'gold' : 'default'}
        />
        <Stat
          label={`${season} defending champ`}
          value={
            <span className="text-[28px]">
              {managerName(managers, champion)}
            </span>
          }
          hint={lastSeason ? `${lastSeason.year} title` : undefined}
        />
        <Stat
          label="Committed forward"
          countTo={committed}
          format={(value) => money(value)}
          value={money(committed)}
          hint={`Auction dollars owed ${season}–${horizon.at(-1)?.year ?? season}`}
        />
        <Stat
          label="Cash outstanding"
          countTo={cashOutstanding}
          format={(value) => money(value)}
          value={money(cashOutstanding)}
          hint={cashOutstanding ? 'Unsettled dues, payouts, bets' : 'All square'}
          tone={cashOutstanding ? 'down' : 'up'}
        />
      </div>

      {data.live && data.live.teams.length > 0 && (
        <div className="mb-6">
          <Panel
            title={`Live · ${data.live.season} week ${data.live.week ?? '—'}`}
            subtitle={`Pulled from Yahoo ${shortDate(data.live.updatedAt)}.`}
            delay={90}
          >
            <div className="overflow-x-auto">
              <table className="out">
                <thead>
                  <tr>
                    <th className="n">#</th>
                    <th>Team</th>
                    <th>Manager</th>
                    <th className="n">Record</th>
                    <th className="n">PF</th>
                    <th className="n">PA</th>
                  </tr>
                </thead>
                <tbody>
                  {data.live.teams.map((team) => (
                    <tr key={team.teamKey ?? team.teamName}>
                      <td className="n text-term-faint">{team.rank ?? '—'}</td>
                      <td>{team.teamName}</td>
                      <td className="text-term-dim">
                        {team.manager ? managerName(managers, team.manager) : '—'}
                      </td>
                      <td className="n">
                        {team.wins}–{team.losses}
                        {team.ties ? `–${team.ties}` : ''}
                      </td>
                      <td className="n text-term-green">{num(team.pointsFor, 0)}</td>
                      <td className="n text-term-faint">{num(team.pointsAgainst, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.live.unmapped.length > 0 && (
              <p className="border-t border-term-line px-5 py-3 text-[12px] text-[var(--color-term-amber)]">
                Unmapped Yahoo teams: {data.live.unmapped.join(', ')} — add them to{' '}
                <code>public/data/yahoo-map.json</code>.
              </p>
            )}
          </Panel>
        </div>
      )}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[1.55fr_1fr]">
        <Panel
          title={`${season} Draft Budgets`}
          subtitle={`$${league.baseDraftBudget} base, less keeper salaries, plus or minus traded auction dollars.`}
          action={
            <Link to="/finances" className="btn">
              Full ledger
            </Link>
          }
          delay={120}
        >
          <div className="overflow-x-auto">
            <table className="out">
              <thead>
                <tr>
                  <th>Manager</th>
                  <th>Team</th>
                  <th className="n">Keepers</th>
                  <th className="n">Salary</th>
                  <th className="n">Trades</th>
                  <th className="n">Available</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((budget) => (
                  <tr key={budget.manager}>
                    <td>
                      <Link
                        to={`/managers/${budget.manager}`}
                        className="font-medium text-term-text transition-colors hover:text-term-green"
                      >
                        {managerName(managers, budget.manager)}
                      </Link>
                    </td>
                    <td className="text-[12px] text-term-faint">{budget.team}</td>
                    <td className="n text-term-dim">{budget.keeperCount}</td>
                    <td className="n text-term-dim">{money(-budget.keeperSalary)}</td>
                    <td
                      className={`n ${
                        budget.cashNet > 0
                          ? 'text-[var(--color-term-green)]'
                          : budget.cashNet < 0
                            ? 'text-[var(--color-term-red)]'
                            : 'text-term-faint'
                      }`}
                    >
                      {budget.cashNet === 0 ? '—' : money(budget.cashNet, { sign: true })}
                    </td>
                    <td className="n">
                      <div
                        className={
                          budget.overCommitted ? 'text-[var(--color-term-red)]' : 'text-term-green'
                        }
                      >
                        {money(budget.available)}
                      </div>
                      <div className="mt-1.5 w-24">
                        <Bar
                          value={Math.max(budget.available, 0)}
                          max={maxBudget}
                          tone={
                            budget.overCommitted
                              ? 'var(--color-term-red)'
                              : 'var(--color-term-green)'
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {underwater.length > 0 && (
            <div className="border-t border-term-line px-5 py-3.5 text-[12px] text-[var(--color-term-red)]">
              {underwater.map((budget) => managerName(managers, budget.manager)).join(', ')}{' '}
              {underwater.length === 1 ? 'enters' : 'enter'} the auction underwater — keeper
              selections must be trimmed before draft day.
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel
            title="Trade queue"
            subtitle={pending.length ? 'Awaiting a commissioner ruling.' : undefined}
            action={
              <Link to="/trades" className="btn">
                Open
              </Link>
            }
            delay={180}
          >
            {pending.length === 0 ? (
              <Empty>No trades awaiting a ruling.</Empty>
            ) : (
              <ul className="divide-y divide-term-line">
                {pending.slice(0, 5).map((trade) => {
                  const verdict = antiDumpingCheck(trade)
                  return (
                    <li key={trade.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[13px] text-term-text">
                            <span className="text-term-dim">
                              {managerName(managers, trade.seller)}
                            </span>
                            <span className="mx-1.5 text-term-faint">→</span>
                            <span className="text-term-dim">
                              {managerName(managers, trade.buyer)}
                            </span>
                          </div>
                          <div className="mt-1 truncate text-[12px] text-term-faint">
                            {trade.players}
                          </div>
                        </div>
                        <div className="tnum shrink-0 text-right text-[13px] text-term-green">
                          {money(trade.totalDollars)}
                        </div>
                      </div>
                      {verdict.triggered && (
                        <div className="mt-2">
                          <Chip tone="flag">Market check</Chip>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Obligations on the books" delay={240}>
            <table className="out">
              <thead>
                <tr>
                  <th>Season</th>
                  <th className="n">Gross moved</th>
                  <th className="n">Managers</th>
                </tr>
              </thead>
              <tbody>
                {horizon.map((row) => (
                  <tr key={row.year}>
                    <td className="tnum">{row.year}</td>
                    <td className="n text-term-green">{money(row.gross)}</td>
                    <td className="n text-term-dim">{row.managers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title={`${lastSeason?.year ?? ''} final table`} delay={300}>
            <table className="out">
              <tbody>
                {lastSeason?.teams.slice(0, 6).map((team) => (
                  <tr key={team.manager}>
                    <td className="tnum w-8 text-term-faint">{team.rank}</td>
                    <td>
                      <Link
                        to={`/managers/${team.manager}`}
                        className="transition-colors hover:text-term-green"
                      >
                        {managerName(managers, team.manager)}
                      </Link>
                    </td>
                    <td className="n text-term-dim">{record(team.wins, team.losses)}</td>
                    <td className="n text-term-faint">{num(team.avgPointsFor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-term-line px-5 py-3">
              <Link to="/standings" className="label hover:text-term-green">
                All 22 seasons →
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}
