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
        eyebrow={`${season} Pre-Season · Commissioner's Desk`}
        title="The Ledger"
        lede={`Twenty-two seasons of ${league.name}, from the 2004 charter to the ${season} auction. Every dollar, contract, and decision in one book.`}
      />

      <div className="rise mb-8 grid grid-cols-2 gap-6 lg:grid-cols-4" style={{ animationDelay: '60ms' }}>
        <Stat
          label="Awaiting ruling"
          value={pending.length}
          hint={pending.length ? 'Trades need your decision' : 'Queue is clear'}
          tone={pending.length ? 'gold' : 'default'}
        />
        <Stat
          label={`${season} defending champ`}
          value={
            <span className="font-[family-name:var(--font-display)] text-[28px]">
              {managerName(managers, champion)}
            </span>
          }
          hint={lastSeason ? `${lastSeason.year} title` : undefined}
        />
        <Stat
          label="Committed forward"
          value={money(committed)}
          hint={`Auction dollars owed ${season}–${horizon.at(-1)?.year ?? season}`}
        />
        <Stat
          label="Cash outstanding"
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
              <table className="ledger">
                <thead>
                  <tr>
                    <th className="num">#</th>
                    <th>Team</th>
                    <th>Manager</th>
                    <th className="num">Record</th>
                    <th className="num">PF</th>
                    <th className="num">PA</th>
                  </tr>
                </thead>
                <tbody>
                  {data.live.teams.map((team) => (
                    <tr key={team.teamKey ?? team.teamName}>
                      <td className="num text-parchment-faint">{team.rank ?? '—'}</td>
                      <td>{team.teamName}</td>
                      <td className="text-parchment-dim">
                        {team.manager ? managerName(managers, team.manager) : '—'}
                      </td>
                      <td className="num">
                        {team.wins}–{team.losses}
                        {team.ties ? `–${team.ties}` : ''}
                      </td>
                      <td className="num text-gold-400">{num(team.pointsFor, 0)}</td>
                      <td className="num text-parchment-faint">{num(team.pointsAgainst, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.live.unmapped.length > 0 && (
              <p className="border-t rule-gold px-5 py-3 text-[12px] text-[var(--color-ledger-flag)]">
                Unmapped Yahoo teams: {data.live.unmapped.join(', ')} — add them to{' '}
                <code>public/data/yahoo-map.json</code>.
              </p>
            )}
          </Panel>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
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
            <table className="ledger">
              <thead>
                <tr>
                  <th>Manager</th>
                  <th>Team</th>
                  <th className="num">Keepers</th>
                  <th className="num">Salary</th>
                  <th className="num">Trades</th>
                  <th className="num">Available</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((budget) => (
                  <tr key={budget.manager}>
                    <td>
                      <Link
                        to={`/managers/${budget.manager}`}
                        className="font-medium text-parchment transition-colors hover:text-gold-400"
                      >
                        {managerName(managers, budget.manager)}
                      </Link>
                    </td>
                    <td className="text-[12px] text-parchment-faint">{budget.team}</td>
                    <td className="num text-parchment-dim">{budget.keeperCount}</td>
                    <td className="num text-parchment-dim">{money(-budget.keeperSalary)}</td>
                    <td
                      className={`num ${
                        budget.cashNet > 0
                          ? 'text-[var(--color-ledger-up)]'
                          : budget.cashNet < 0
                            ? 'text-[var(--color-ledger-down)]'
                            : 'text-parchment-faint'
                      }`}
                    >
                      {budget.cashNet === 0 ? '—' : money(budget.cashNet, { sign: true })}
                    </td>
                    <td className="num">
                      <div
                        className={
                          budget.overCommitted ? 'text-[var(--color-ledger-down)]' : 'text-gold-400'
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
                              ? 'var(--color-ledger-down)'
                              : 'var(--color-gold-500)'
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
            <div className="border-t rule-gold px-5 py-3.5 text-[12px] text-[var(--color-ledger-down)]">
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
              <ul className="divide-y divide-parchment/7">
                {pending.slice(0, 5).map((trade) => {
                  const verdict = antiDumpingCheck(trade)
                  return (
                    <li key={trade.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[13px] text-parchment">
                            <span className="text-parchment-dim">
                              {managerName(managers, trade.seller)}
                            </span>
                            <span className="mx-1.5 text-gold-600">→</span>
                            <span className="text-parchment-dim">
                              {managerName(managers, trade.buyer)}
                            </span>
                          </div>
                          <div className="mt-1 truncate text-[12px] text-parchment-faint">
                            {trade.players}
                          </div>
                        </div>
                        <div className="tnum shrink-0 text-right text-[13px] text-gold-400">
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
            <table className="ledger">
              <thead>
                <tr>
                  <th>Season</th>
                  <th className="num">Gross moved</th>
                  <th className="num">Managers</th>
                </tr>
              </thead>
              <tbody>
                {horizon.map((row) => (
                  <tr key={row.year}>
                    <td className="tnum">{row.year}</td>
                    <td className="num text-gold-400">{money(row.gross)}</td>
                    <td className="num text-parchment-dim">{row.managers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title={`${lastSeason?.year ?? ''} final table`} delay={300}>
            <table className="ledger">
              <tbody>
                {lastSeason?.teams.slice(0, 6).map((team) => (
                  <tr key={team.manager}>
                    <td className="tnum w-8 text-parchment-faint">{team.rank}</td>
                    <td>
                      <Link
                        to={`/managers/${team.manager}`}
                        className="transition-colors hover:text-gold-400"
                      >
                        {managerName(managers, team.manager)}
                      </Link>
                    </td>
                    <td className="num text-parchment-dim">{record(team.wins, team.losses)}</td>
                    <td className="num text-parchment-faint">{num(team.avgPointsFor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t rule-gold px-5 py-3">
              <Link to="/standings" className="eyebrow hover:text-gold-400">
                All 22 seasons →
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}
