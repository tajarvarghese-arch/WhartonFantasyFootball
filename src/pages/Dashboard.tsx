import { Link } from 'react-router-dom'
import ManagerTag from '../components/ManagerTag'
import Ticker from '../components/Ticker'
import { Confetti, FieldGoalStrip, FieldStripes } from '../components/effects'
import { Bar, Chip, Empty, Hero, Panel, PageHeader, Stat } from '../components/ui'
import { managerName, useLeagueData } from '../lib/data'
import { useBudgets, useCash, useObligationHorizon, usePendingTrades, useTrades } from '../lib/derive'
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
  const allTrades = useTrades()

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

      <div className="-mx-4 mb-8 sm:-mx-6 lg:-mx-9">
        <Ticker trades={allTrades} />
      </div>

      <div className="mb-10 grid min-w-0 items-end gap-8 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <div className="relative isolate">
            <FieldStripes />
            <Hero
          label={`Committed through ${horizon.at(-1)?.year ?? season}`}
          countTo={committed}
          format={(value) => money(value)}
          value={money(committed)}
          accent
            caption={`Auction dollars already promised across future drafts by trades that are on the books. Every dollar here is one a manager cannot spend on draft day.`}
            />
          </div>
          <FieldGoalStrip />
        </div>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          <Stat
            label="Awaiting ruling"
            countTo={pending.length}
            value={pending.length}
            hint={pending.length ? 'Needs your decision' : 'Queue clear'}
            tone={pending.length ? 'gold' : 'default'}
          />
          <div className="relative overflow-hidden">
            <Confetti count={10} />
            <Stat
              label="Defending champ"
              value={managerName(managers, champion)}
              hint={lastSeason ? `${lastSeason.year} title` : undefined}
            />
          </div>
          <Stat
            label="Cash open"
            countTo={cashOutstanding}
            format={(value) => money(value)}
            value={money(cashOutstanding)}
            hint={cashOutstanding ? 'Dues, payouts, bets' : 'All square'}
            tone={cashOutstanding ? 'down' : 'default'}
          />
        </div>
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
                      <td className="n text-arc-ink-faint">{team.rank ?? '—'}</td>
                      <td>{team.teamName}</td>
                      <td className="text-arc-ink-soft">
                        {team.manager ? managerName(managers, team.manager) : '—'}
                      </td>
                      <td className="n">
                        {team.wins}–{team.losses}
                        {team.ties ? `–${team.ties}` : ''}
                      </td>
                      <td className="n text-arc-green">{num(team.pointsFor, 0)}</td>
                      <td className="n text-arc-ink-faint">{num(team.pointsAgainst, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.live.unmapped.length > 0 && (
              <p className="border-t border-arc-line px-5 py-3 text-[12px] text-[var(--color-arc-orange)]">
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
                      <ManagerTag id={budget.manager} />
                    </td>
                    <td className="text-[12px] text-arc-ink-faint">{budget.team}</td>
                    <td className="n text-arc-ink-soft">{budget.keeperCount}</td>
                    <td className="n text-arc-ink-soft">{money(-budget.keeperSalary)}</td>
                    <td
                      className={`n ${
                        budget.cashNet > 0
                          ? 'text-[var(--color-arc-green)]'
                          : budget.cashNet < 0
                            ? 'text-[var(--color-arc-red)]'
                            : 'text-arc-ink-faint'
                      }`}
                    >
                      {budget.cashNet === 0 ? '—' : money(budget.cashNet, { sign: true })}
                    </td>
                    <td className="n">
                      <div
                        className={
                          budget.overCommitted ? 'text-[var(--color-arc-red)]' : 'text-arc-green'
                        }
                      >
                        {money(budget.available)}
                        {budget.overCommitted && (
                          <span className="redzone tag ml-2 align-middle">Red zone</span>
                        )}
                      </div>
                      <div className="mt-1.5 ml-auto w-24">
                        <Bar
                          value={Math.max(budget.available, 0)}
                          max={maxBudget}
                          tone={
                            budget.overCommitted
                              ? 'var(--color-arc-red)'
                              : 'var(--color-arc-green)'
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
            <div className="border-t border-arc-line px-5 py-3.5 text-[12px] text-[var(--color-arc-red)]">
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
              <ul className="divide-y divide-arc-ink">
                {pending.slice(0, 5).map((trade) => {
                  const verdict = antiDumpingCheck(trade)
                  return (
                    <li key={trade.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[13px] text-arc-ink">
                            <span className="text-arc-ink-soft">
                              {managerName(managers, trade.seller)}
                            </span>
                            <span className="mx-1.5 text-arc-ink-faint">→</span>
                            <span className="text-arc-ink-soft">
                              {managerName(managers, trade.buyer)}
                            </span>
                          </div>
                          <div className="mt-1 truncate text-[12px] text-arc-ink-faint">
                            {trade.players}
                          </div>
                        </div>
                        <div className="tnum shrink-0 text-right text-[13px] text-arc-green">
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
                    <td className="n text-arc-green">{money(row.gross)}</td>
                    <td className="n text-arc-ink-soft">{row.managers}</td>
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
                    <td className="tnum w-8 text-arc-ink-faint">{team.rank}</td>
                    <td>
                      <Link
                        to={`/managers/${team.manager}`}
                        className="transition-colors hover:text-arc-green"
                      >
                        {managerName(managers, team.manager)}
                      </Link>
                    </td>
                    <td className="n text-arc-ink-soft">{record(team.wins, team.losses)}</td>
                    <td className="n text-arc-ink-faint">{num(team.avgPointsFor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-arc-line px-5 py-3">
              <Link to="/standings" className="label hover:text-arc-green">
                All 22 seasons →
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}
