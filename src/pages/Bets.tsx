import { useEffect, useMemo, useState } from 'react'
import PixelMugshot from '../components/PixelMugshot'
import { Chip, Panel, PageHeader } from '../components/ui'
import { managerName, useLeague, useLeagueData } from '../lib/data'
import { managerColor } from '../lib/identity'
import { money, pct, shortDate } from '../lib/format'
import {
  betRecords,
  headToHead,
  loserOf,
  newBetId,
  openDebts,
  stakeLabel,
  venmoUrl,
  type Bet,
  type BetsFile,
  type Debt,
  type StakeKind,
} from '../lib/bets'
import {
  betsRepoUrl,
  canPostBets,
  readBets,
  saveBets,
  setLeagueToken,
  unlockLeague,
} from '../lib/betsRepo'
import type { ManagerId } from '../lib/types'

/**
 * The book. Anyone with the league password can propose a bet and accept one
 * against them; only the commissioner settles. Bets live in their own repo,
 * so posting one shows up on the next refresh rather than waiting on a
 * Pages deploy.
 */
export default function Bets() {
  const { league, managers, leagueVault } = useLeagueData()
  const { commissioner } = useLeague()
  const active = useMemo(() => managers.filter((m) => m.active), [managers])

  const [file, setFile] = useState<BetsFile | null>(null)
  const [unlocked, setUnlocked] = useState(canPostBets)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)

  useEffect(() => {
    void readBets().then(setFile)
  }, [])

  const bets = file?.bets ?? []
  const season = league.currentSeason
  const proposed = bets.filter((b) => b.status === 'proposed')
  const live = bets.filter((b) => b.status === 'live')
  const settled = bets
    .filter((b) => b.status === 'settled')
    .sort((a, b) => (b.settledAt ?? '').localeCompare(a.settledAt ?? ''))
  const records = useMemo(() => betRecords(bets), [bets])
  const h2h = useMemo(() => headToHead(bets), [bets])
  const debts = useMemo(() => openDebts(bets), [bets])
  const handleOf = (id: ManagerId) => managers.find((m) => m.id === id)?.venmo

  async function mutate(update: (current: BetsFile) => BetsFile, message: string, id: string) {
    setBusy(id)
    setError(null)
    try {
      setFile(await saveBets(update, message))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save that.')
    } finally {
      setBusy(null)
    }
  }

  async function unlock() {
    if (!leagueVault) return
    setBusy('unlock')
    setError(null)
    try {
      await unlockLeague(leagueVault, password)
      setUnlocked(true)
      setPassword('')
      // Now that we hold a token, re-read through the API — raw's CDN copy
      // can be up to five minutes behind.
      setFile(await readBets())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not unlock.')
    } finally {
      setBusy(null)
    }
  }

  const accept = (bet: Bet) =>
    mutate(
      (current) => ({
        ...current,
        bets: current.bets.map((b) =>
          b.id === bet.id ? { ...b, status: 'live', acceptedAt: new Date().toISOString() } : b,
        ),
      }),
      `Bet accepted: ${managerName(managers, bet.opponent)} vs ${managerName(managers, bet.proposer)}`,
      bet.id,
    )

  const settle = (bet: Bet, winner: ManagerId) =>
    mutate(
      (current) => ({
        ...current,
        bets: current.bets.map((b) =>
          b.id === bet.id
            ? { ...b, status: 'settled', winner, settledAt: new Date().toISOString() }
            : b,
        ),
      }),
      `Bet settled: ${managerName(managers, winner)} wins`,
      bet.id,
    )

  const settleUp = (debt: Debt) =>
    mutate(
      (current) => ({
        ...current,
        bets: current.bets.map((b) =>
          debt.betIds.includes(b.id) ? { ...b, paidAt: new Date().toISOString() } : b,
        ),
      }),
      `Bet debt paid: ${managerName(managers, debt.from)} → ${managerName(managers, debt.to)} ${money(debt.amount)}`,
      `debt-${debt.from}-${debt.to}`,
    )

  const drop = (bet: Bet) =>
    mutate(
      (current) => ({ ...current, bets: current.bets.filter((b) => b.id !== bet.id) }),
      `Bet withdrawn: ${managerName(managers, bet.proposer)} vs ${managerName(managers, bet.opponent)}`,
      bet.id,
    )

  const face = (id: ManagerId, size = 2) => (
    <span className="shrink-0 overflow-hidden rounded-md border border-arc-line">
      <PixelMugshot seed={id} scale={size} />
    </span>
  )

  /** A bet slip: two faces, the terms, and what's riding on it. */
  const Slip = ({ bet, children }: { bet: Bet; children?: React.ReactNode }) => (
    <div className="rounded-lg border border-arc-line bg-arc-panel p-4">
      <div className="flex items-center gap-3">
        {face(bet.proposer)}
        <span className="min-w-0 flex-1 truncate text-[15px]" style={{ color: managerColor(bet.proposer) }}>
          {managerName(managers, bet.proposer)}
        </span>
        <span className="arcade shrink-0 text-[13px] text-arc-ink-faint">VS</span>
        <span
          className="min-w-0 flex-1 truncate text-right text-[15px]"
          style={{ color: managerColor(bet.opponent) }}
        >
          {managerName(managers, bet.opponent)}
        </span>
        {face(bet.opponent)}
      </div>

      <p className="mt-3 text-[14px] leading-snug text-arc-ink">{bet.terms}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-arc-ink-faint">
        <span>
          Stake{' '}
          <b
            className={bet.stakeKind === 'cash' ? 'text-arc-green' : 'text-[var(--color-arc-orange)]'}
          >
            {stakeLabel(bet)}
          </b>
        </span>
        {bet.resolves && <span>Resolves {bet.resolves}</span>}
        {bet.status === 'settled' && bet.winner && (
          <span className="text-arc-green">
            {managerName(managers, bet.winner)} won · {managerName(managers, loserOf(bet)!)} paid
          </span>
        )}
      </div>

      {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
    </div>
  )

  return (
    <>
      <PageHeader
        path="~/bets"
        eyebrow="Side action"
        title="The Book"
        lede="Bets between managers, agreed in the open and settled on the record. Anyone with the league password can post one or take one; only the commissioner calls a winner."
        action={
          unlocked ? (
            <button type="button" className="btn btn-primary" onClick={() => setComposing((c) => !c)}>
              {composing ? 'Cancel' : 'Propose a bet'}
            </button>
          ) : undefined
        }
      />

      {/* Unlock */}
      {!unlocked && (
        <Panel
          title="league password"
          subtitle={
            leagueVault
              ? 'One password for the whole league. Enter it once on this device to post and accept bets.'
              : 'No league password has been set yet — the commissioner sets it from the commissioner panel.'
          }
        >
          {leagueVault && (
            <div className="flex flex-wrap items-end gap-3 px-5 py-5">
              <label className="min-w-[220px] flex-1">
                <span className="label">Password</span>
                <input
                  type="password"
                  className="field mt-1.5"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && password) void unlock()
                  }}
                />
              </label>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!password || busy === 'unlock'}
                onClick={() => void unlock()}
              >
                {busy === 'unlock' ? 'Unlocking…' : 'Unlock'}
              </button>
            </div>
          )}
        </Panel>
      )}

      {composing && unlocked && (
        <div className="mt-6">
          <Composer
            season={season}
            managers={active.map((m) => ({ id: m.id, name: m.displayName }))}
            busy={busy === 'new'}
            onSubmit={(bet) =>
              mutate(
                (current) => ({ ...current, bets: [...current.bets, bet] }),
                `Bet proposed: ${managerName(managers, bet.proposer)} vs ${managerName(managers, bet.opponent)}`,
                'new',
              ).then(() => setComposing(false))
            }
          />
        </div>
      )}

      {error && (
        <p className="mt-4 border-l-2 border-[var(--color-arc-red)] pl-3 text-[12.5px] text-[var(--color-arc-red)]">
          {error}
        </p>
      )}

      {file === null ? (
        <Panel title="loading">
          <p className="px-5 py-6 text-[13px] text-arc-ink-faint italic">Reading the book…</p>
        </Panel>
      ) : (
        <div className="mt-6 space-y-6">
          <Panel
            title="on the table"
            subtitle={
              proposed.length
                ? 'Proposed and waiting to be taken. Tap Accept if it is against you.'
                : 'Nothing pending. Propose one.'
            }
          >
            <div className="grid gap-3 px-5 py-5 lg:grid-cols-2">
              {proposed.map((bet) => (
                <Slip key={bet.id} bet={bet}>
                  <Chip tone="flag">Awaiting {managerName(managers, bet.opponent)}</Chip>
                  {unlocked && (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary min-h-[34px] px-3 py-1"
                        disabled={busy === bet.id}
                        onClick={() => void accept(bet)}
                      >
                        {busy === bet.id ? 'Saving…' : "I'm in"}
                      </button>
                      <button
                        type="button"
                        className="btn min-h-[34px] px-3 py-1"
                        disabled={busy === bet.id}
                        onClick={() => void drop(bet)}
                      >
                        Withdraw
                      </button>
                    </>
                  )}
                </Slip>
              ))}
              {proposed.length === 0 && (
                <p className="text-[13px] text-arc-ink-faint italic">No open proposals.</p>
              )}
            </div>
          </Panel>

          <Panel
            title="live action"
            subtitle={`${live.length} bet${live.length === 1 ? '' : 's'} riding. ${
              commissioner ? 'Tap a winner when it resolves.' : 'The commissioner calls these.'
            }`}
          >
            <div className="grid gap-3 px-5 py-5 lg:grid-cols-2">
              {live.map((bet) => (
                <Slip key={bet.id} bet={bet}>
                  {commissioner ? (
                    <>
                      <span className="text-[12px] text-arc-ink-faint">Winner:</span>
                      {[bet.proposer, bet.opponent].map((id) => (
                        <button
                          key={id}
                          type="button"
                          className="btn min-h-[34px] px-3 py-1"
                          disabled={busy === bet.id}
                          onClick={() => void settle(bet, id)}
                        >
                          {managerName(managers, id)}
                        </button>
                      ))}
                    </>
                  ) : (
                    <Chip tone="up">Live</Chip>
                  )}
                </Slip>
              ))}
              {live.length === 0 && (
                <p className="text-[13px] text-arc-ink-faint italic">Nothing riding right now.</p>
              )}
            </div>
          </Panel>

          {settled.length > 0 && (
            <Panel title="settled" subtitle="The record. Winners in green.">
              <table className="out">
                <thead>
                  <tr>
                    <th>Bet</th>
                    <th>Winner</th>
                    <th>Loser</th>
                    <th className="n">Stake</th>
                    <th className="n">Settled</th>
                  </tr>
                </thead>
                <tbody>
                  {settled.map((bet) => (
                    <tr key={bet.id}>
                      <td className="max-w-[280px] truncate">{bet.terms}</td>
                      <td className="text-arc-green">{managerName(managers, bet.winner!)}</td>
                      <td className="text-arc-ink-faint">
                        {managerName(managers, loserOf(bet)!)}
                      </td>
                      <td className="n">{stakeLabel(bet)}</td>
                      <td className="n text-arc-ink-faint">
                        {bet.settledAt ? shortDate(bet.settledAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}

          <Panel
            title="the tab"
            subtitle="Betting debts only — kept apart from league dues and payouts. Wins and losses between the same two people net down to one number."
          >
            {debts.length === 0 ? (
              <p className="px-5 py-6 text-[14px] text-arc-green">
                All square. Nobody owes anybody a dollar.
              </p>
            ) : (
              <ul>
                {debts.map((debt) => {
                  const key = `debt-${debt.from}-${debt.to}`
                  const pay = venmoUrl(
                    handleOf(debt.to),
                    debt.amount,
                    `WACL side bet — ${managerName(managers, debt.from)} to ${managerName(managers, debt.to)}`,
                  )
                  return (
                    <li
                      key={key}
                      className="flex flex-wrap items-center gap-3 border-b border-arc-line/40 px-5 py-3 last:border-b-0"
                    >
                      {face(debt.from, 1.6)}
                      <span className="min-w-0 flex-1 text-[14px]">
                        <b style={{ color: managerColor(debt.from) }}>
                          {managerName(managers, debt.from)}
                        </b>
                        <span className="text-arc-ink-faint"> owes </span>
                        <b style={{ color: managerColor(debt.to) }}>
                          {managerName(managers, debt.to)}
                        </b>
                        <span className="block text-[11px] text-arc-ink-faint">
                          across {debt.betIds.length} settled bet
                          {debt.betIds.length === 1 ? '' : 's'}
                        </span>
                      </span>
                      <span className="tnum shrink-0 text-[17px] text-[var(--color-arc-red)]">
                        {money(debt.amount)}
                      </span>
                      {pay && (
                        <a
                          href={pay}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="arcade shrink-0 rounded-md px-2.5 py-1 text-[12px]"
                          style={{ background: 'var(--color-arc-green)', color: '#06210a' }}
                        >
                          PAY
                        </a>
                      )}
                      {unlocked && (
                        <button
                          type="button"
                          className="btn min-h-[34px] shrink-0 px-3 py-1"
                          disabled={busy === key}
                          onClick={() => void settleUp(debt)}
                        >
                          {busy === key ? 'Saving…' : 'Mark paid'}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>

          {records.length > 0 && (
            <div className="grid min-w-0 gap-6 lg:grid-cols-2">
              <Panel title="the sharps" subtitle="Career betting records, by money won.">
                <table className="out">
                  <thead>
                    <tr>
                      <th>Manager</th>
                      <th className="n">W–L</th>
                      <th className="n">Win %</th>
                      <th className="n">Net</th>
                      <th className="n">Riding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((row) => (
                      <tr key={row.manager}>
                        <td style={{ color: managerColor(row.manager) }}>
                          {managerName(managers, row.manager)}
                        </td>
                        <td className="n">
                          {row.won}–{row.lost}
                        </td>
                        <td className="n text-arc-ink-faint">
                          {row.settled ? pct(row.winPct, 0) : '—'}
                        </td>
                        <td
                          className="n"
                          style={{
                            color:
                              row.net > 0
                                ? 'var(--color-arc-green)'
                                : row.net < 0
                                  ? 'var(--color-arc-red)'
                                  : undefined,
                          }}
                        >
                          {row.net === 0 ? '—' : money(row.net, { sign: true })}
                        </td>
                        <td className="n text-arc-ink-faint">
                          {row.live ? `${row.live} · ${money(row.exposure)}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>

              {h2h.length > 0 && (
                <Panel title="who owns whom" subtitle="Settled head-to-head records.">
                  <table className="out">
                    <thead>
                      <tr>
                        <th>Matchup</th>
                        <th className="n">Record</th>
                      </tr>
                    </thead>
                    <tbody>
                      {h2h.map((row) => (
                        <tr key={`${row.a}-${row.b}`}>
                          <td>
                            <span style={{ color: managerColor(row.a) }}>
                              {managerName(managers, row.a)}
                            </span>
                            <span className="text-arc-ink-faint"> vs </span>
                            <span style={{ color: managerColor(row.b) }}>
                              {managerName(managers, row.b)}
                            </span>
                          </td>
                          <td className="n">
                            {row.aWins}–{row.bWins}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Panel>
              )}
            </div>
          )}
        </div>
      )}

      <p className="mt-6 text-[12px] leading-relaxed text-arc-ink-faint">
        Bets live in their own repository, so the league password can only ever touch this board —
        never keepers, trades, or cash. Every post, acceptance, and ruling is a commit;{' '}
        <a
          className="text-arc-green underline underline-offset-2"
          href={betsRepoUrl()}
          target="_blank"
          rel="noreferrer noopener"
        >
          the full history is public
        </a>
        . The shared password carries no identity, so pick your own name honestly — the timestamps
        are the referee.
        {unlocked && (
          <>
            {' '}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => {
                setLeagueToken(null)
                setUnlocked(false)
              }}
            >
              Lock this device
            </button>
          </>
        )}
      </p>
    </>
  )
}

/* ------------------------------------------------------------------ */

const TEMPLATES = [
  'I beat you head-to-head in week __',
  'I finish above you in the final standings',
  'My first-round pick outscores yours this season',
  'You miss the playoffs',
]

function Composer({
  season,
  managers,
  busy,
  onSubmit,
}: {
  season: number
  managers: { id: ManagerId; name: string }[]
  busy: boolean
  onSubmit: (bet: Bet) => void
}) {
  const [proposer, setProposer] = useState('')
  const [opponent, setOpponent] = useState('')
  const [terms, setTerms] = useState('')
  const [stakeKind, setStakeKind] = useState<StakeKind>('cash')
  const [stake, setStake] = useState(20)
  const [forfeit, setForfeit] = useState('')
  const [resolves, setResolves] = useState('')

  const ready =
    proposer && opponent && proposer !== opponent && terms.trim() &&
    (stakeKind === 'cash' ? stake > 0 : forfeit.trim())

  return (
    <Panel title="propose a bet" subtitle="Pick your name, pick your mark, name the terms.">
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
        <label>
          <span className="label">You</span>
          <select className="field mt-1.5" value={proposer} onChange={(e) => setProposer(e.target.value)}>
            <option value="">Select…</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Against</span>
          <select className="field mt-1.5" value={opponent} onChange={(e) => setOpponent(e.target.value)}>
            <option value="">Select…</option>
            {managers.filter((m) => m.id !== proposer).map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>

        <label className="sm:col-span-2">
          <span className="label">The bet</span>
          <input
            className="field mt-1.5"
            placeholder="Say exactly what has to happen"
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
          />
          <span className="mt-2 flex flex-wrap gap-1.5">
            {TEMPLATES.map((t) => (
              <button
                key={t}
                type="button"
                className="rounded border border-arc-line px-2 py-1 text-[11px] text-arc-ink-faint hover:border-arc-green hover:text-arc-green"
                onClick={() => setTerms(t)}
              >
                {t}
              </button>
            ))}
          </span>
        </label>

        <label>
          <span className="label">Stake</span>
          <select
            className="field mt-1.5"
            value={stakeKind}
            onChange={(e) => setStakeKind(e.target.value as StakeKind)}
          >
            <option value="cash">Cash</option>
            <option value="forfeit">Forfeit / dare</option>
          </select>
        </label>
        {stakeKind === 'cash' ? (
          <label>
            <span className="label">Amount each</span>
            <input
              type="number"
              min={1}
              className="field tnum mt-1.5"
              value={stake}
              onChange={(e) => setStake(Number(e.target.value) || 0)}
            />
          </label>
        ) : (
          <label>
            <span className="label">Loser must…</span>
            <input
              className="field mt-1.5"
              placeholder="wear the jersey to the draft"
              value={forfeit}
              onChange={(e) => setForfeit(e.target.value)}
            />
          </label>
        )}

        <label className="sm:col-span-2">
          <span className="label">Resolves</span>
          <input
            className="field mt-1.5"
            placeholder="Week 3 · End of season · Draft night"
            value={resolves}
            onChange={(e) => setResolves(e.target.value)}
          />
        </label>
      </div>

      <div className="flex items-center gap-3 border-t border-arc-line px-5 py-4">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!ready || busy}
          onClick={() =>
            onSubmit({
              id: newBetId(),
              season,
              proposer,
              opponent,
              terms: terms.trim(),
              stakeKind,
              stake: stakeKind === 'cash' ? stake : 0,
              forfeit: stakeKind === 'forfeit' ? forfeit.trim() : '',
              resolves: resolves.trim(),
              status: 'proposed',
              winner: null,
              proposedAt: new Date().toISOString(),
            })
          }
        >
          {busy ? 'Posting…' : 'Post it'}
        </button>
        <span className="text-[12px] text-arc-ink-faint">
          It lands on the table until they take it.
        </span>
      </div>
    </Panel>
  )
}
