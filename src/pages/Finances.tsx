import { useMemo, useState } from 'react'
import { Bar, Chip, Empty, Panel, PageHeader, SegmentedControl, Stat } from '../components/ui'
import { managerName, useLeague, useLeagueData } from '../lib/data'
import { newId, useCash, useFaab, useLedger } from '../lib/derive'
import { money, pct, shortDate } from '../lib/format'
import { faabKeeperCost } from '../lib/rules'
import type { CashEntry, CashFile, CashType, FaabEntry, FaabFile } from '../lib/types'

type Tab = 'auction' | 'faab' | 'cash'

const CASH_TYPES: { id: CashType; label: string }[] = [
  { id: 'dues', label: 'Dues' },
  { id: 'payout', label: 'Payout' },
  { id: 'bet', label: 'Side bet' },
  { id: 'fee', label: 'Fee' },
  { id: 'adjustment', label: 'Adjustment' },
]

export default function Finances() {
  const [tab, setTab] = useState<Tab>('auction')
  const { league } = useLeagueData()

  return (
    <>
      <PageHeader
        path="~/finances"
        eyebrow="Balances"
        title="Finances"
        lede="Three separate books: auction dollars traded between managers, the season FAAB budget, and real cash owed around the league."
      />
      <div className="line-in mb-6">
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { id: 'auction', label: 'Auction $' },
            { id: 'faab', label: 'FAAB' },
            { id: 'cash', label: 'Cash' },
          ]}
        />
      </div>
      {tab === 'auction' && <AuctionBook />}
      {tab === 'faab' && <FaabBook season={league.currentSeason} />}
      {tab === 'cash' && <CashBook season={league.currentSeason} />}
    </>
  )
}

/* ------------------------------------------------------------------ */

function AuctionBook() {
  const { managers } = useLeagueData()
  const ledger = useLedger()
  const years = useMemo(
    () =>
      Object.keys(ledger)
        .map(Number)
        .sort((a, b) => a - b),
    [ledger],
  )
  const active = managers.filter((manager) => manager.active)

  return (
    <Panel
      title="Auction dollars traded"
      subtitle="Sellers receive draft dollars in the listed season; buyers pay them. Every column nets to zero."
    >
      <div className="overflow-x-auto">
        <table className="out">
          <thead>
            <tr>
              <th className="sticky left-0 bg-arc-panel">Manager</th>
              {years.map((year) => (
                <th key={year} className="n">
                  {year}
                </th>
              ))}
              <th className="n">Career net</th>
            </tr>
          </thead>
          <tbody>
            {active.map((manager) => {
              const career = years.reduce(
                (total, year) => total + (ledger[String(year)]?.[manager.id]?.net ?? 0),
                0,
              )
              return (
                <tr key={manager.id}>
                  <td className="sticky left-0 bg-arc-panel whitespace-nowrap">
                    {manager.displayName}
                  </td>
                  {years.map((year) => {
                    const entry = ledger[String(year)]?.[manager.id]
                    const net = entry?.net ?? 0
                    return (
                      <td
                        key={year}
                        className={`n ${
                          net > 0
                            ? 'text-[var(--color-arc-green)]'
                            : net < 0
                              ? 'text-[var(--color-arc-red)]'
                              : 'text-arc-ink-faint'
                        }`}
                        title={
                          entry
                            ? `Received ${money(entry.received)} · Sent ${money(entry.sent)}`
                            : undefined
                        }
                      >
                        {net === 0 ? '·' : money(net, { sign: true })}
                      </td>
                    )
                  })}
                  <td
                    className={`n ${
                      career > 0
                        ? 'text-[var(--color-arc-green)]'
                        : career < 0
                          ? 'text-[var(--color-arc-red)]'
                          : 'text-arc-ink-faint'
                    }`}
                  >
                    {money(career, { sign: true })}
                  </td>
                </tr>
              )
            })}
            <tr>
              <td className="sticky left-0 bg-arc-panel text-arc-ink-faint">League total</td>
              {years.map((year) => {
                const total = Object.values(ledger[String(year)] ?? {}).reduce(
                  (sum, entry) => sum + entry.net,
                  0,
                )
                return (
                  <td key={year} className="n text-arc-ink-faint">
                    {Math.abs(total) < 0.01 ? '0' : money(total)}
                  </td>
                )
              })}
              <td className="n text-arc-ink-faint">0</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

/* ------------------------------------------------------------------ */

function FaabBook({ season }: { season: number }) {
  const { league, managers, faab, waivers, live } = useLeagueData()
  const { commissioner, save } = useLeague()
  const positions = useFaab(season)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const seasonEntries = faab.entries.filter((entry) => entry.season === season)
  // Claims Yahoo already knows about. Shown read-only so the sync and the
  // commissioner's own entries never fight over the same record.
  const synced = (live?.claims ?? []).filter((claim) => claim.player)
  const history = waivers.filter((claim) => claim.season === season - 1)
  const spent = positions.reduce((total, row) => total + row.spent, 0)

  async function addEntry(entry: FaabEntry) {
    setError(null)
    try {
      await save<FaabFile>(
        'faab.json',
        (current) => ({ ...current, season, entries: [...current.entries, entry] }),
        `FAAB: ${managerName(managers, entry.manager)} $${entry.bid} on ${entry.player}`,
      )
      setAdding(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the claim.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="line-in grid grid-cols-2 gap-6 lg:grid-cols-4">
        <Stat label={`${season} budget each`} value={money(league.baseFaabBudget)} />
        <Stat label="League spend" value={money(spent)} hint={`${seasonEntries.length} claims`} />
        <Stat
          label="Prior season claims"
          value={history.length}
          hint={`${season - 1} waiver wire`}
        />
        <Stat label="Tiebreaker" value="Reverse standings" hint="Weekly, per league rules" />
      </div>

      <Panel
        title={`${season} FAAB positions`}
        subtitle={`$${league.baseFaabBudget} per team. Keeper cost of any pickup follows the sliding scale automatically.`}
        action={
          commissioner ? (
            <button type="button" className="btn" onClick={() => setAdding((open) => !open)}>
              {adding ? 'Cancel' : 'Log claim'}
            </button>
          ) : undefined
        }
      >
        {adding && <FaabForm season={season} onSubmit={addEntry} />}
        {error && (
          <p className="px-5 pb-3 text-[12px] text-[var(--color-arc-red)]">{error}</p>
        )}
        <table className="out">
          <thead>
            <tr>
              <th>Manager</th>
              <th className="n">Claims</th>
              <th className="n">Spent</th>
              <th className="n">Remaining</th>
              <th className="w-40">Used</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((row) => (
              <tr key={row.manager}>
                <td>{managerName(managers, row.manager)}</td>
                <td className="n text-arc-ink-soft">{row.claims || '·'}</td>
                <td className="n text-arc-ink-soft">{money(row.spent)}</td>
                <td className="n text-arc-green">{money(row.remaining)}</td>
                <td>
                  <Bar value={row.spent} max={league.baseFaabBudget} />
                  <span className="tnum mt-1 block text-[10px] text-arc-ink-faint">
                    {pct(row.pctUsed, 0)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {seasonEntries.length > 0 && (
        <Panel title={`${season} claims`}>
          <table className="out">
            <thead>
              <tr>
                <th>Player</th>
                <th>Manager</th>
                <th className="n">Bid</th>
                <th className="n">% of budget</th>
                <th className="n">Keeper cost</th>
                <th>On ending roster</th>
              </tr>
            </thead>
            <tbody>
              {seasonEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.player}</td>
                  <td className="text-arc-ink-soft">{managerName(managers, entry.manager)}</td>
                  <td className="n">{money(entry.bid)}</td>
                  <td className="n text-arc-ink-faint">
                    {pct(entry.bid / league.baseFaabBudget, 0)}
                  </td>
                  <td className="n text-arc-green">{money(faabKeeperCost(entry.bid, league))}</td>
                  <td>
                    {entry.onEndingRoster ? <Chip tone="up">Yes</Chip> : <Chip>No</Chip>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {synced.length > 0 && (
        <Panel
          title={`synced from yahoo · ${live?.season ?? season}`}
          subtitle="Waiver adds pulled from the league's transaction log. Keeper cost is computed from the same sliding scale."
        >
          <table className="out">
            <thead>
              <tr>
                <th>Player</th>
                <th>Manager</th>
                <th className="n">Bid</th>
                <th className="n">% of budget</th>
                <th className="n">Keeper cost</th>
              </tr>
            </thead>
            <tbody>
              {[...synced]
                .sort((a, b) => b.bid - a.bid)
                .map((claim, index) => (
                  <tr key={`${claim.player}-${index}`}>
                    <td>{claim.player}</td>
                    <td className="text-arc-ink-soft">
                      {claim.manager ? managerName(managers, claim.manager) : (claim.teamName ?? '—')}
                    </td>
                    <td className="n">{money(claim.bid)}</td>
                    <td className="n text-arc-ink-faint">
                      {pct(claim.bid / league.baseFaabBudget, 0)}
                    </td>
                    <td className="n text-arc-green">
                      {money(faabKeeperCost(claim.bid, league))}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Panel>
      )}

      <Panel
        title={`${season - 1} waiver wire`}
        subtitle="Carried in from the workbook. Keeper cost is computed from the same sliding scale."
      >
        {history.length === 0 ? (
          <Empty>No recorded claims.</Empty>
        ) : (
          <table className="out">
            <thead>
              <tr>
                <th>Player</th>
                <th>Claimed by</th>
                <th className="n">Bid</th>
                <th className="n">% of budget</th>
                <th className="n">Keeper cost</th>
              </tr>
            </thead>
            <tbody>
              {[...history]
                .sort((a, b) => b.bid - a.bid)
                .map((claim, index) => (
                  <tr key={`${claim.player}-${index}`}>
                    <td>{claim.player}</td>
                    <td className="text-arc-ink-soft">
                      {claim.manager ? managerName(managers, claim.manager) : claim.team}
                    </td>
                    <td className="n">{money(claim.bid)}</td>
                    <td className="n text-arc-ink-faint">
                      {pct(claim.bid / league.baseFaabBudget, 0)}
                    </td>
                    <td className="n text-arc-green">{money(faabKeeperCost(claim.bid, league))}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}

function FaabForm({
  season,
  onSubmit,
}: {
  season: number
  onSubmit: (entry: FaabEntry) => Promise<void>
}) {
  const { league, managers } = useLeagueData()
  const active = managers.filter((manager) => manager.active)
  const [manager, setManager] = useState('')
  const [player, setPlayer] = useState('')
  const [bid, setBid] = useState(0)
  const [week, setWeek] = useState('')
  const [onRoster, setOnRoster] = useState(true)
  const [busy, setBusy] = useState(false)

  const cost = faabKeeperCost(bid, league)

  return (
    <div className="grid gap-3 border-b border-arc-line px-5 py-5 sm:grid-cols-2 lg:grid-cols-6">
      <label className="lg:col-span-2">
        <span className="label">Manager</span>
        <select
          className="field mt-1.5"
          value={manager}
          onChange={(event) => setManager(event.target.value)}
        >
          <option value="">Select…</option>
          {active.map((option) => (
            <option key={option.id} value={option.id}>
              {option.displayName}
            </option>
          ))}
        </select>
      </label>
      <label className="lg:col-span-2">
        <span className="label">Player</span>
        <input
          className="field mt-1.5"
          value={player}
          onChange={(event) => setPlayer(event.target.value)}
        />
      </label>
      <label>
        <span className="label">Bid</span>
        <input
          type="number"
          min={0}
          max={league.baseFaabBudget}
          className="field tnum mt-1.5"
          value={bid}
          onChange={(event) => setBid(Number(event.target.value) || 0)}
        />
      </label>
      <label>
        <span className="label">Week</span>
        <input
          type="number"
          min={1}
          max={18}
          className="field tnum mt-1.5"
          value={week}
          onChange={(event) => setWeek(event.target.value)}
        />
      </label>
      <label className="flex items-center gap-2 lg:col-span-2">
        <input
          type="checkbox"
          checked={onRoster}
          onChange={(event) => setOnRoster(event.target.checked)}
          className="accent-[var(--color-arc-green)]"
        />
        <span className="text-[12px] text-arc-ink-soft">Finished the season on their roster</span>
      </label>
      <div className="lg:col-span-2">
        <span className="label">Keeper cost</span>
        <div className="tnum mt-1.5 text-[20px] text-arc-green">{money(cost)}</div>
      </div>
      <div className="flex items-end lg:col-span-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!manager || !player.trim() || bid <= 0 || busy}
          onClick={() => {
            setBusy(true)
            void onSubmit({
              id: newId('faab'),
              season,
              manager,
              player: player.trim(),
              bid,
              week: week ? Number(week) : null,
              onEndingRoster: onRoster,
            }).finally(() => setBusy(false))
          }}
        >
          {busy ? 'Saving…' : 'Record claim'}
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function CashBook({ season }: { season: number }) {
  const { managers, cash } = useLeagueData()
  const { commissioner, save } = useLeague()
  const [scope, setScope] = useState<'season' | 'all'>('season')
  const positions = useCash(scope === 'all' ? 'all' : season)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const entries = cash.entries
    .filter((entry) => scope === 'all' || entry.season === season)
    .sort((a, b) => b.date.localeCompare(a.date))
  const owedToLeague = positions
    .filter((row) => row.outstanding < 0)
    .reduce((total, row) => total + row.outstanding, 0)
  const owedByLeague = positions
    .filter((row) => row.outstanding > 0)
    .reduce((total, row) => total + row.outstanding, 0)

  async function mutate(update: (current: CashFile) => CashFile, message: string) {
    setError(null)
    try {
      await save<CashFile>('cash.json', update, message)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="line-in grid grid-cols-2 gap-6 lg:grid-cols-4">
        <Stat label="Owed to the league" value={money(Math.abs(owedToLeague))} tone="down" />
        <Stat label="Owed by the league" value={money(owedByLeague)} tone="up" />
        <Stat label="Entries" value={entries.length} />
        <Stat
          label="Net position"
          value={money(owedByLeague + owedToLeague, { sign: true })}
          hint="Should settle to zero once the season closes"
        />
      </div>

      <Panel
        title="Standing balances"
        subtitle="Positive means the league owes the manager. Negative means they owe the league."
        action={
          <div className="flex gap-2">
            <SegmentedControl<'season' | 'all'>
              value={scope}
              onChange={setScope}
              options={[
                { id: 'season', label: String(season) },
                { id: 'all', label: 'All' },
              ]}
            />
            {commissioner && (
              <button type="button" className="btn" onClick={() => setAdding((open) => !open)}>
                {adding ? 'Cancel' : 'Add'}
              </button>
            )}
          </div>
        }
      >
        {adding && (
          <CashForm
            season={season}
            onSubmit={async (entry) => {
              await mutate(
                (current) => ({ ...current, entries: [...current.entries, entry] }),
                `Cash: ${entry.description} (${managerName(managers, entry.manager)})`,
              )
              setAdding(false)
            }}
          />
        )}
        {error && <p className="px-5 pb-3 text-[12px] text-[var(--color-arc-red)]">{error}</p>}
        <table className="out">
          <thead>
            <tr>
              <th>Manager</th>
              <th className="n">Entries</th>
              <th className="n">Total</th>
              <th className="n">Settled</th>
              <th className="n">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((row) => (
              <tr key={row.manager}>
                <td>{managerName(managers, row.manager)}</td>
                <td className="n text-arc-ink-faint">{row.entries || '·'}</td>
                <td className="n text-arc-ink-soft">{money(row.owed, { sign: true })}</td>
                <td className="n text-arc-ink-faint">{money(row.settled, { sign: true })}</td>
                <td
                  className={`n ${
                    row.outstanding > 0
                      ? 'text-[var(--color-arc-green)]'
                      : row.outstanding < 0
                        ? 'text-[var(--color-arc-red)]'
                        : 'text-arc-ink-faint'
                  }`}
                >
                  {row.outstanding === 0 ? '·' : money(row.outstanding, { sign: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Ledger entries">
        {entries.length === 0 ? (
          <Empty>
            Nothing recorded yet. Dues, payouts, and side bets you log here roll into the balances
            above.
          </Empty>
        ) : (
          <table className="out">
            <thead>
              <tr>
                <th>Date</th>
                <th>Manager</th>
                <th>Type</th>
                <th>Description</th>
                <th className="n">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="tnum whitespace-nowrap text-arc-ink-faint">
                    {shortDate(entry.date)}
                  </td>
                  <td>{managerName(managers, entry.manager)}</td>
                  <td className="text-[12px] text-arc-ink-soft capitalize">{entry.type}</td>
                  <td className="text-arc-ink-soft">{entry.description}</td>
                  <td
                    className={`n ${
                      entry.amount > 0
                        ? 'text-[var(--color-arc-green)]'
                        : 'text-[var(--color-arc-red)]'
                    }`}
                  >
                    {money(entry.amount, { sign: true })}
                  </td>
                  <td>
                    {commissioner ? (
                      <button
                        type="button"
                        className="tag text-arc-ink-faint transition-colors hover:text-arc-green"
                        onClick={() =>
                          void mutate(
                            (current) => ({
                              ...current,
                              entries: current.entries.map((row) =>
                                row.id === entry.id ? { ...row, settled: !row.settled } : row,
                              ),
                            }),
                            `Cash: mark ${entry.description} ${entry.settled ? 'unsettled' : 'settled'}`,
                          )
                        }
                      >
                        {entry.settled ? 'Settled' : 'Open'}
                      </button>
                    ) : (
                      <Chip tone={entry.settled ? 'up' : 'flag'}>
                        {entry.settled ? 'Settled' : 'Open'}
                      </Chip>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}

function CashForm({
  season,
  onSubmit,
}: {
  season: number
  onSubmit: (entry: CashEntry) => Promise<void>
}) {
  const { managers } = useLeagueData()
  const active = managers.filter((manager) => manager.active)
  const [manager, setManager] = useState('')
  const [type, setType] = useState<CashType>('dues')
  const [amount, setAmount] = useState(0)
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <div className="grid gap-3 border-b border-arc-line px-5 py-5 sm:grid-cols-2 lg:grid-cols-6">
      <label className="lg:col-span-2">
        <span className="label">Manager</span>
        <select
          className="field mt-1.5"
          value={manager}
          onChange={(event) => setManager(event.target.value)}
        >
          <option value="">Select…</option>
          {active.map((option) => (
            <option key={option.id} value={option.id}>
              {option.displayName}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="label">Type</span>
        <select
          className="field mt-1.5"
          value={type}
          onChange={(event) => setType(event.target.value as CashType)}
        >
          {CASH_TYPES.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="label">Amount</span>
        <input
          type="number"
          className="field tnum mt-1.5"
          value={amount}
          onChange={(event) => setAmount(Number(event.target.value) || 0)}
          placeholder="-150"
        />
      </label>
      <label className="lg:col-span-2">
        <span className="label">Description</span>
        <input
          className="field mt-1.5"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="2026 entry fee"
        />
      </label>
      <div className="flex items-end lg:col-span-6">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!manager || amount === 0 || !description.trim() || busy}
          onClick={() => {
            setBusy(true)
            void onSubmit({
              id: newId('cash'),
              season,
              date: new Date().toISOString(),
              manager,
              type,
              amount,
              description: description.trim(),
              settled: false,
            }).finally(() => setBusy(false))
          }}
        >
          {busy ? 'Saving…' : 'Record entry'}
        </button>
        <p className="ml-4 text-[11px] text-arc-ink-faint">
          Negative = the manager owes the league. Positive = the league owes them.
        </p>
      </div>
    </div>
  )
}
