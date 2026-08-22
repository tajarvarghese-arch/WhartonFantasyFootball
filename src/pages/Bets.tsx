import { Fragment, useEffect, useMemo, useState } from 'react'
import PixelMugshot from '../components/PixelMugshot'
import { Chip, Panel, PageHeader, Stat } from '../components/ui'
import { Confetti } from '../components/effects'
import { play } from '../lib/sfx'
import { animationsDisabled } from '../lib/motion'
import { managerName, useLeague, useLeagueData } from '../lib/data'
import { managerColor } from '../lib/identity'
import { dateInputValue, isoFromDateInput, money, pct, shortDate } from '../lib/format'
import {
  applyEdit,
  applyResults,
  betRecords,
  editComplete,
  editFrom,
  headToHead,
  loserOf,
  newBetId,
  openDebts,
  rulingChanged,
  slipChanged,
  stakeLabel,
  venmoUrl,
  type Bet,
  type BetEdit,
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
import type { BetResultsFile, Manager, ManagerId } from '../lib/types'

/**
 * The book. Anyone with the league password can propose a bet and accept one
 * against them; only the commissioner settles. Bets live in their own repo,
 * so posting one shows up on the next refresh rather than waiting on a
 * Pages deploy.
 */
export default function Bets() {
  const { league, managers, leagueVault, betResults } = useLeagueData()
  const { commissioner, save } = useLeague()
  const active = useMemo(() => managers.filter((m) => m.active), [managers])

  const [file, setFile] = useState<BetsFile | null>(null)
  const [unlocked, setUnlocked] = useState(canPostBets)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  // Which settled bet the commissioner has open for correction.
  const [editing, setEditing] = useState<string | null>(null)
  // Bumped on a settle so the confetti remounts and fires again.
  const [celebrate, setCelebrate] = useState(0)

  useEffect(() => {
    void readBets().then(setFile)
  }, [])

  // Winners come only from the commissioner-only results file.
  const bets = useMemo(
    () => applyResults(file?.bets ?? [], betResults.results),
    [file, betResults],
  )
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

  const riding = live.reduce((sum, b) => sum + (b.stakeKind === 'cash' ? b.stake : 0), 0)
  const biggest = [...bets]
    .filter((b) => b.stakeKind === 'cash')
    .sort((a, b) => b.stake - a.stake)[0]
  const hottest = [...records].sort((a, b) => b.streak - a.streak)[0]

  // Recent action, newest first, for the tape.
  const tape = [...bets]
    .filter((b) => b.status === 'settled' || b.status === 'live')
    .sort((a, b) => (b.settledAt ?? b.acceptedAt ?? '').localeCompare(a.settledAt ?? a.acceptedAt ?? ''))
    .slice(0, 18)

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

  /**
   * Settling writes to the MAIN repo, not the bets repo — so it needs the
   * commissioner's token. The league password cannot reach this file.
   */
  const settle = async (bet: Bet, winner: ManagerId) => {
    setBusy(bet.id)
    setError(null)
    try {
      await save<BetResultsFile>(
        'bet-results.json',
        (current) => ({
          results: [
            ...current.results.filter((r) => r.betId !== bet.id),
            { betId: bet.id, winner, settledAt: new Date().toISOString() },
          ],
        }),
        `Bet settled: ${managerName(managers, winner)} wins`,
      )
      play('roar')
      if (!animationsDisabled()) setCelebrate((n) => n + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not record the result.')
    } finally {
      setBusy(null)
    }
  }

  const versus = (bet: Bet) =>
    `${managerName(managers, bet.proposer)} vs ${managerName(managers, bet.opponent)}`

  /**
   * Correct a settled bet. An edit can straddle both files, so each half is
   * written only if it actually changed: the slip goes to the bets repo
   * (league token), the ruling to bet-results.json (commissioner token). A
   * commissioner who has not entered the league password on this device can
   * still fix a winner or a date — just not the terms of the bet.
   */
  const amend = async (bet: Bet, edit: BetEdit) => {
    setBusy(bet.id)
    setError(null)
    try {
      if (slipChanged(bet, edit)) {
        if (!unlocked) {
          throw new Error(
            'Enter the league password above to change the terms of a bet. The winner and the date can be corrected without it.',
          )
        }
        const now = new Date().toISOString()
        setFile(
          await saveBets(
            (current) => ({
              ...current,
              bets: current.bets.map((b) => (b.id === bet.id ? applyEdit(b, edit, now) : b)),
            }),
            `Bet corrected: ${versus(bet)}`,
          ),
        )
      }
      if (rulingChanged(bet, edit)) {
        await save<BetResultsFile>(
          'bet-results.json',
          (current) => ({
            results: [
              ...current.results.filter((r) => r.betId !== bet.id),
              { betId: bet.id, winner: edit.winner, settledAt: edit.settledAt },
            ],
          }),
          `Bet result amended: ${managerName(managers, edit.winner)} wins`,
        )
      }
      setEditing(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save that correction.')
    } finally {
      setBusy(null)
    }
  }

  /** Take the ruling back off a bet. The slip survives and returns to live. */
  const reopen = async (bet: Bet) => {
    setBusy(bet.id)
    setError(null)
    try {
      await save<BetResultsFile>(
        'bet-results.json',
        (current) => ({ results: current.results.filter((r) => r.betId !== bet.id) }),
        `Bet reopened: ${versus(bet)}`,
      )
      setEditing(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reopen that bet.')
    } finally {
      setBusy(null)
    }
  }

  /**
   * Erase a bet completely — the slip from the bets repo, then the ruling
   * from the results file. The slip goes first because it is the write most
   * likely to fail; a leftover result with no slip is ignored by
   * `applyResults`, whereas a slip with no result would reappear as live.
   */
  const remove = async (bet: Bet) => {
    setBusy(bet.id)
    setError(null)
    try {
      if (!unlocked) {
        throw new Error(
          'Enter the league password above to delete a bet — the slip itself lives in the bets repo.',
        )
      }
      setFile(
        await saveBets(
          (current) => ({ ...current, bets: current.bets.filter((b) => b.id !== bet.id) }),
          `Bet deleted: ${versus(bet)}`,
        ),
      )
      if (betResults.results.some((r) => r.betId === bet.id)) {
        await save<BetResultsFile>(
          'bet-results.json',
          (current) => ({ results: current.results.filter((r) => r.betId !== bet.id) }),
          `Bet result removed: ${versus(bet)}`,
        )
      }
      setEditing(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete that bet.')
    } finally {
      setBusy(null)
    }
  }

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

  /**
   * A matchup card in the sportsbook idiom: the two managers as opposing
   * sides under their own colours, the stake as a big tile, action beneath.
   */
  const Slip = ({ bet, children }: { bet: Bet; children?: React.ReactNode }) => {
    const won = (id: ManagerId) => bet.status === 'settled' && bet.winner === id
    const lost = (id: ManagerId) => bet.status === 'settled' && bet.winner !== null && !won(id)
    const halves = [bet.proposer, bet.opponent] as const

    return (
      <div className="overflow-hidden rounded-xl border border-arc-line bg-arc-panel transition-colors hover:border-arc-ink-faint">
        {/* team colours across the top, like a game card */}
        <div className="flex h-1">
          {halves.map((id) => (
            <span key={id} className="flex-1" style={{ background: managerColor(id) }} />
          ))}
        </div>

        <div className="relative flex items-stretch">
          {halves.map((id, i) => (
            <div
              key={id}
              className={`flex flex-1 items-center gap-2.5 p-3 ${i ? 'flex-row-reverse text-right' : ''}`}
              style={{ opacity: lost(id) ? 0.45 : 1 }}
            >
              {face(id, 2)}
              <span className="min-w-0">
                <span
                  className="block truncate text-[15px] leading-tight"
                  style={{ color: managerColor(id) }}
                >
                  {managerName(managers, id)}
                </span>
                {won(id) && (
                  <span className="arcade text-[11px] text-arc-green">WON</span>
                )}
              </span>
            </div>
          ))}
          <span className="arcade absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-arc-line bg-arc-bg px-2 py-0.5 text-[11px] text-arc-ink-faint">
            VS
          </span>
        </div>

        <p className="px-3 pb-3 text-[14px] leading-snug text-arc-ink">{bet.terms}</p>

        <div className="flex items-stretch border-t border-arc-line">
          <div className="flex min-w-[104px] flex-col justify-center border-r border-arc-line px-3 py-2">
            <span className="text-[10px] tracking-[0.14em] text-arc-ink-faint uppercase">
              {bet.stakeKind === 'cash' ? 'Each' : 'Forfeit'}
            </span>
            <span
              className={`tnum text-[20px] leading-tight ${
                bet.stakeKind === 'cash' ? 'text-arc-green' : 'text-[var(--color-arc-orange)]'
              }`}
            >
              {stakeLabel(bet)}
            </span>
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-2 px-3 py-2">
            {bet.resolves && (
              <span className="text-[11px] text-arc-ink-faint">{bet.resolves}</span>
            )}
            {children}
          </div>
        </div>
      </div>
    )
  }

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

      {tape.length > 0 && (
        <div className="marquee-host relative -mx-4 mb-6 overflow-hidden border-y border-arc-line bg-arc-panel sm:-mx-6 lg:-mx-9">
          <div
            className="marquee flex w-max items-center gap-7 py-2"
            style={{ ['--marquee-duration' as string]: `${Math.max(40, tape.length * 4.5)}s` }}
          >
            {[...tape, ...tape].map((b, i) => (
              <span
                key={`${b.id}-${i}`}
                className="flex shrink-0 items-center gap-2 text-[11px] whitespace-nowrap"
                aria-hidden={i >= tape.length}
              >
                {b.status === 'settled' && b.winner ? (
                  <>
                    <span className="text-arc-green">✓</span>
                    <span className="text-arc-ink-soft">{managerName(managers, b.winner)}</span>
                    <span className="text-arc-ink-faint">beat</span>
                    <span className="text-arc-ink-soft">
                      {managerName(managers, loserOf(b)!)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[var(--color-arc-orange)]">●</span>
                    <span className="text-arc-ink-soft">
                      {managerName(managers, b.proposer)} v {managerName(managers, b.opponent)}
                    </span>
                  </>
                )}
                <span className="tnum text-arc-ink">{stakeLabel(b)}</span>
                <span className="text-arc-ink-faint">·</span>
              </span>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-arc-panel to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-arc-panel to-transparent" />
        </div>
      )}

      {bets.length > 0 && (
        <div className="line-in mb-6 grid grid-cols-2 gap-6 lg:grid-cols-4">
          <Stat
            label="Riding right now"
            countTo={riding}
            format={(v) => money(v)}
            value={money(riding)}
            hint={`${live.length} live bet${live.length === 1 ? '' : 's'}`}
            tone={riding ? 'up' : 'default'}
          />
          <Stat label="On the table" value={proposed.length} hint="Awaiting a taker" />
          <Stat
            label="Biggest pot"
            value={biggest ? money(biggest.stake) : '—'}
            hint={
              biggest
                ? `${managerName(managers, biggest.proposer)} v ${managerName(managers, biggest.opponent)}`
                : undefined
            }
          />
          <Stat
            label="Hot hand"
            value={hottest && hottest.streak > 0 ? managerName(managers, hottest.manager) : '—'}
            hint={
              hottest && hottest.streak > 0
                ? `${hottest.streak} straight`
                : 'Nobody on a run'
            }
            tone={hottest && hottest.streak > 0 ? 'gold' : 'default'}
          />
        </div>
      )}

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
            <Panel
              title="settled"
              subtitle={
                commissioner
                  ? 'The record. Winners in green. Yours to correct — Fix re-calls a bet, changes its terms, or takes it off the board entirely.'
                  : 'The record. Winners in green.'
              }
            >
              <table className="out">
                <thead>
                  <tr>
                    <th>Bet</th>
                    <th>Winner</th>
                    <th>Loser</th>
                    <th className="n">Stake</th>
                    <th className="n">Settled</th>
                    {commissioner && <th className="n">Fix</th>}
                  </tr>
                </thead>
                <tbody>
                  {settled.map((bet) => (
                    <Fragment key={bet.id}>
                      <tr>
                        <td className="max-w-[280px] truncate">{bet.terms}</td>
                        <td className="text-arc-green">{managerName(managers, bet.winner!)}</td>
                        <td className="text-arc-ink-faint">
                          {managerName(managers, loserOf(bet)!)}
                        </td>
                        <td className="n">{stakeLabel(bet)}</td>
                        <td className="n text-arc-ink-faint">
                          {bet.settledAt ? shortDate(bet.settledAt) : '—'}
                        </td>
                        {commissioner && (
                          <td className="n">
                            <button
                              type="button"
                              className="btn min-h-[30px] px-2.5 py-0.5 text-[13px]"
                              aria-expanded={editing === bet.id}
                              onClick={() => setEditing(editing === bet.id ? null : bet.id)}
                            >
                              {editing === bet.id ? 'Close' : 'Edit'}
                            </button>
                          </td>
                        )}
                      </tr>
                      {commissioner && editing === bet.id && (
                        <tr>
                          <td colSpan={6} style={{ padding: 0, whiteSpace: 'normal' }}>
                            <HistoryEditor
                              bet={bet}
                              managers={managers}
                              unlocked={unlocked}
                              busy={busy === bet.id}
                              onSave={(edit) => void amend(bet, edit)}
                              onReopen={() => void reopen(bet)}
                              onDelete={() => void remove(bet)}
                              onCancel={() => setEditing(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
                          {row.streak >= 3 && (
                            <span title={`${row.streak} straight`} className="ml-1.5">
                              🔥
                            </span>
                          )}
                          {row.streak <= -3 && (
                            <span title={`${-row.streak} straight losses`} className="ml-1.5 opacity-60">
                              🧊
                            </span>
                          )}
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

      {celebrate > 0 && (
        <div key={celebrate} className="pointer-events-none fixed inset-0 z-40">
          <Confetti count={22} />
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

/**
 * The commissioner's correction desk for one settled bet: re-call the
 * winner, move the date, fix the terms, unwind a payment, put the bet back
 * in play, or delete it outright. Deleting asks twice — the second press is
 * a different button, so a mis-tap cannot erase the record.
 */
function HistoryEditor({
  bet,
  managers,
  unlocked,
  busy,
  onSave,
  onReopen,
  onDelete,
  onCancel,
}: {
  bet: Bet
  managers: Manager[]
  unlocked: boolean
  busy: boolean
  onSave: (edit: BetEdit) => void
  onReopen: () => void
  onDelete: () => void
  onCancel: () => void
}) {
  const [edit, setEdit] = useState<BetEdit>(() => editFrom(bet))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = <K extends keyof BetEdit>(key: K, value: BetEdit[K]) =>
    setEdit((current) => ({ ...current, [key]: value }))

  const touchedSlip = slipChanged(bet, edit)
  const dirty = touchedSlip || rulingChanged(bet, edit)
  const locked = touchedSlip && !unlocked

  return (
    <div className="border-y border-arc-line bg-arc-bg-deep px-5 py-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label>
          <span className="label">Winner</span>
          <select
            className="field mt-1.5"
            value={edit.winner}
            onChange={(e) => set('winner', e.target.value)}
          >
            {[bet.proposer, bet.opponent].map((id) => (
              <option key={id} value={id}>
                {managerName(managers, id)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="label">Settled on</span>
          <input
            type="date"
            className="field tnum mt-1.5"
            value={dateInputValue(edit.settledAt)}
            onChange={(e) => set('settledAt', isoFromDateInput(e.target.value, bet.settledAt))}
          />
        </label>

        <label>
          <span className="label">Stake</span>
          <select
            className="field mt-1.5"
            value={edit.stakeKind}
            onChange={(e) => set('stakeKind', e.target.value as StakeKind)}
          >
            <option value="cash">Cash</option>
            <option value="forfeit">Forfeit / dare</option>
          </select>
        </label>

        <label className="sm:col-span-2">
          <span className="label">The bet</span>
          <input
            className="field mt-1.5"
            value={edit.terms}
            onChange={(e) => set('terms', e.target.value)}
          />
        </label>

        {edit.stakeKind === 'cash' ? (
          <label>
            <span className="label">Amount each</span>
            <input
              type="number"
              min={1}
              className="field tnum mt-1.5"
              value={edit.stake}
              onChange={(e) => set('stake', Number(e.target.value) || 0)}
            />
          </label>
        ) : (
          <label>
            <span className="label">Loser must…</span>
            <input
              className="field mt-1.5"
              value={edit.forfeit}
              onChange={(e) => set('forfeit', e.target.value)}
            />
          </label>
        )}

        <label className="sm:col-span-2">
          <span className="label">Resolves</span>
          <input
            className="field mt-1.5"
            value={edit.resolves}
            onChange={(e) => set('resolves', e.target.value)}
          />
        </label>

        <label className="flex items-center gap-2.5 self-end pb-2 text-[13.5px] text-arc-ink-soft">
          <input
            type="checkbox"
            checked={edit.paid}
            onChange={(e) => set('paid', e.target.checked)}
          />
          Loser has paid up
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-arc-line pt-4">
        <button
          type="button"
          className="btn btn-primary min-h-[36px] px-3 py-1"
          disabled={busy || !dirty || !editComplete(edit) || locked}
          onClick={() => onSave(edit)}
        >
          {busy ? 'Saving…' : 'Save correction'}
        </button>
        <button
          type="button"
          className="btn min-h-[36px] px-3 py-1"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn min-h-[36px] px-3 py-1"
          disabled={busy}
          onClick={onReopen}
          title="Removes the result and puts the bet back in live action"
        >
          Put back in play
        </button>
        <span className="flex-1" />
        {confirmDelete ? (
          <>
            <span className="text-[12.5px] text-[var(--color-arc-red)]">Delete for good?</span>
            <button
              type="button"
              className="btn min-h-[36px] px-3 py-1"
              style={{ borderColor: 'var(--color-arc-red)', color: 'var(--color-arc-red)' }}
              disabled={busy}
              onClick={onDelete}
            >
              {busy ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button
              type="button"
              className="btn min-h-[36px] px-3 py-1"
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
            >
              Keep it
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn min-h-[36px] px-3 py-1"
            disabled={busy || !unlocked}
            title={unlocked ? undefined : 'Needs the league password'}
            onClick={() => setConfirmDelete(true)}
          >
            Delete bet
          </button>
        )}
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-arc-ink-faint">
        {unlocked
          ? 'Putting a bet back in play only removes the result; the slip stays and returns to live action. Deleting removes the slip too. Either way the change is a commit, so nothing is truly lost.'
          : 'The winner, the date, and putting a bet back in play need only your commissioner sign-in. Changing the terms, the stake, or the payment tick — and deleting a bet outright — also needs the league password at the top of this page, because the slip itself lives in the bets repo.'}
      </p>
    </div>
  )
}

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
            <span className="mt-2 flex flex-wrap gap-1.5">
              {[10, 20, 50, 100].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className="tnum rounded-md border px-2.5 py-1 text-[12px] transition-colors"
                  style={
                    stake === amount
                      ? { borderColor: 'var(--color-arc-green)', color: '#06210a', background: 'var(--color-arc-green)' }
                      : { borderColor: 'var(--color-arc-line)', color: 'var(--color-arc-ink-soft)' }
                  }
                  onClick={() => setStake(amount)}
                >
                  ${amount}
                </button>
              ))}
            </span>
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
