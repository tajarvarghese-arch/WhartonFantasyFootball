import { useMemo, useState } from 'react'
import { useLeague, useLeagueData } from '../lib/data'
import { money } from '../lib/format'
import { keeperEligibility } from '../lib/rules'
import { Chip } from './ui'
import type { ContractYear, KeeperBlock, KeeperPick, LeagueData } from '../lib/types'

const CONTRACT_CHOICES: (ContractYear | '')[] = ['', 'A', 'B', 'C', 'D']

/**
 * Commissioner editing for one team's keeper list. Rows are picked from the
 * ending roster (salary and contract year prefill from the rules) or typed
 * free-form for corrections the roster doesn't cover. Saving replaces the
 * block's keepers and recomputes its keeperSalary; draft budgets everywhere
 * follow automatically.
 */
export default function KeeperEditor({
  year,
  block,
  onDone,
}: {
  year: number
  block: KeeperBlock
  onDone: () => void
}) {
  const { league } = useLeagueData()
  const { save } = useLeague()
  const [picks, setPicks] = useState<KeeperPick[]>(block.keepers.map((pick) => ({ ...pick })))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const eligible = useMemo(() => keeperEligibility(block), [block])
  const taken = new Set(picks.map((pick) => pick.player.trim().toLowerCase()))
  const addable = eligible.filter(
    (spot) => spot.eligible && !taken.has(spot.player.trim().toLowerCase()),
  )

  const cleaned = picks
    .map((pick) => ({ ...pick, player: pick.player.trim() }))
    .filter((pick) => pick.player)
  const totalSalary = cleaned.reduce((sum, pick) => sum + (pick.salary ?? 0), 0)
  const overSlots = cleaned.length > league.keeperSlots

  function update(index: number, patch: Partial<KeeperPick>) {
    setPicks((current) =>
      current.map((pick, i) => (i === index ? { ...pick, ...patch } : pick)),
    )
  }

  function addFromRoster(player: string) {
    const spot = addable.find((candidate) => candidate.player === player)
    if (!spot) return
    setPicks((current) => [
      ...current,
      { player: spot.player, salary: spot.cost, contractYear: spot.nextYear },
    ])
  }

  async function commit() {
    setBusy(true)
    setError(null)
    try {
      await save<LeagueData['keepers']>(
        'keepers.json',
        (current) => ({
          ...current,
          [String(year)]: (current[String(year)] ?? []).map((candidate) =>
            candidate.team === block.team
              ? {
                  ...candidate,
                  keepers: cleaned,
                  keeperSalary: cleaned.reduce((sum, pick) => sum + (pick.salary ?? 0), 0),
                }
              : candidate,
          ),
        }),
        `Keepers updated: ${block.team} (${year})`,
      )
      onDone()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the keepers.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-arc-line bg-arc-bg-deep p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="label">Editing keepers — {year}</span>
        <span className="tnum text-[12.5px] text-arc-ink-soft">
          {cleaned.length}/{league.keeperSlots} slots · {money(totalSalary)}
        </span>
      </div>

      {picks.length === 0 && (
        <p className="text-[13px] text-arc-ink-faint italic">
          No keepers — add from the roster below.
        </p>
      )}
      {picks.map((pick, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            className="field min-h-[38px] flex-1"
            placeholder="Player"
            value={pick.player}
            onChange={(event) => update(index, { player: event.target.value })}
          />
          <div className="relative w-24 shrink-0">
            <span className="absolute top-1/2 left-3 -translate-y-1/2 text-arc-ink-faint">$</span>
            <input
              type="number"
              className="field tnum min-h-[38px] pl-6"
              min={0}
              value={pick.salary ?? ''}
              onChange={(event) =>
                update(index, {
                  salary: event.target.value === '' ? null : Number(event.target.value),
                })
              }
              aria-label="Salary"
            />
          </div>
          <select
            className="field min-h-[38px] w-16 shrink-0"
            value={pick.contractYear ?? ''}
            onChange={(event) =>
              update(index, {
                contractYear: (event.target.value || null) as ContractYear | null,
              })
            }
            aria-label="Contract year"
          >
            {CONTRACT_CHOICES.map((choice) => (
              <option key={choice} value={choice}>
                {choice || '—'}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="px-1.5 text-[18px] leading-none text-arc-ink-faint hover:text-[var(--color-arc-red)]"
            onClick={() => setPicks((current) => current.filter((_, i) => i !== index))}
            aria-label={`Remove ${pick.player || 'row'}`}
          >
            ×
          </button>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="field min-h-[38px] w-auto flex-1"
          value=""
          onChange={(event) => addFromRoster(event.target.value)}
          aria-label="Add keeper from ending roster"
        >
          <option value="">+ Add from {year - 1} roster…</option>
          {addable.map((spot) => (
            <option key={spot.player} value={spot.player}>
              {spot.player} — {money(spot.cost)} · year {spot.nextYear}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn min-h-[38px]"
          onClick={() =>
            setPicks((current) => [...current, { player: '', salary: null, contractYear: 'A' }])
          }
        >
          Blank row
        </button>
      </div>

      {overSlots && (
        <Chip tone="flag">
          {cleaned.length} keepers exceeds the {league.keeperSlots}-slot limit — saving anyway is a
          commissioner override.
        </Chip>
      )}
      {error && <p className="text-[12.5px] text-[var(--color-arc-red)]">{error}</p>}

      <div className="flex gap-2 border-t border-arc-line pt-3">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void commit()}
        >
          {busy ? 'Saving…' : 'Save keepers'}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  )
}
