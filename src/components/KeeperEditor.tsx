import { useMemo, useState } from 'react'
import { useLeague, useLeagueData } from '../lib/data'
import { money } from '../lib/format'
import { faabKeeperCost, keeperEligibility } from '../lib/rules'
import { Chip } from './ui'
import type { KeeperBlock, KeeperPick, LeagueData } from '../lib/types'

/**
 * Commissioner editing for one team's keeper list. The commissioner chooses
 * WHO is kept; every dollar and contract year is computed by the rules and
 * shown read-only — roster players carry their draft value (waiver-derived
 * costs are already baked into roster costs by the sheet), typed-in pickups
 * price off the FAAB sliding scale, and an undrafted free agent is the $5
 * floor. Saving replaces the block's keepers and recomputes keeperSalary;
 * draft budgets everywhere follow automatically.
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
  const { league, waivers, faab } = useLeagueData()
  const { save } = useLeague()
  const [picks, setPicks] = useState<KeeperPick[]>(block.keepers.map((pick) => ({ ...pick })))
  const [freeName, setFreeName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const eligible = useMemo(() => keeperEligibility(block), [block])
  const taken = new Set(picks.map((pick) => pick.player.trim().toLowerCase()))
  const addable = eligible.filter(
    (spot) => spot.eligible && !taken.has(spot.player.trim().toLowerCase()),
  )

  const totalSalary = picks.reduce((sum, pick) => sum + (pick.salary ?? 0), 0)
  const overSlots = picks.length > league.keeperSlots

  function addFromRoster(player: string) {
    const spot = addable.find((candidate) => candidate.player === player)
    if (!spot) return
    setPicks((current) => [
      ...current,
      { player: spot.player, salary: spot.cost ?? 5, contractYear: spot.nextYear },
    ])
  }

  /** Waiver pickups price off the FAAB scale; anyone else is the $5 FA floor. */
  function addFreeAgent() {
    const name = freeName.trim()
    if (!name || taken.has(name.toLowerCase())) return
    const needle = name.toLowerCase()
    const claimed = [
      ...waivers.filter(
        (claim) => claim.season === year - 1 && claim.player.trim().toLowerCase() === needle,
      ),
      ...faab.entries.filter(
        (entry) => entry.season === year - 1 && entry.player.trim().toLowerCase() === needle,
      ),
    ]
    const bid = claimed.length > 0 ? Math.max(...claimed.map((claim) => claim.bid)) : null
    const salary = bid !== null ? faabKeeperCost(bid, league) : 5
    setPicks((current) => [...current, { player: name, salary, contractYear: 'A' }])
    setFreeName('')
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
                  keepers: picks,
                  keeperSalary: picks.reduce((sum, pick) => sum + (pick.salary ?? 0), 0),
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
          {picks.length}/{league.keeperSlots} slots · {money(totalSalary)}
        </span>
      </div>

      {picks.length === 0 && (
        <p className="text-[13px] text-arc-ink-faint italic">
          No keepers — add from the roster below.
        </p>
      )}
      {picks.map((pick, index) => (
        <div
          key={`${pick.player}-${index}`}
          className="flex min-h-[38px] items-center gap-3 rounded-lg border border-arc-line/60 bg-arc-panel px-3 py-1.5"
        >
          <span className="min-w-0 flex-1 truncate text-[14px]">{pick.player}</span>
          <span className="tnum w-14 shrink-0 text-right text-[13.5px] text-arc-ink-soft">
            {money(pick.salary)}
          </span>
          <span className="w-8 shrink-0 text-right text-[12px] text-arc-ink-faint">
            {pick.contractYear ?? '—'}
          </span>
          <button
            type="button"
            className="shrink-0 px-1 text-[18px] leading-none text-arc-ink-faint hover:text-[var(--color-arc-red)]"
            onClick={() => setPicks((current) => current.filter((_, i) => i !== index))}
            aria-label={`Remove ${pick.player}`}
          >
            ×
          </button>
        </div>
      ))}

      <select
        className="field min-h-[38px] w-full"
        value=""
        onChange={(event) => addFromRoster(event.target.value)}
        aria-label="Add keeper from ending roster"
      >
        <option value="">+ Add from {year - 1} roster…</option>
        {addable.map((spot) => (
          <option key={spot.player} value={spot.player}>
            {spot.player} — {money(spot.cost ?? 5)} · year {spot.nextYear}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-2">
        <input
          className="field min-h-[38px] flex-1"
          placeholder="Player missing from the roster list…"
          value={freeName}
          onChange={(event) => setFreeName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') addFreeAgent()
          }}
        />
        <button
          type="button"
          className="btn min-h-[38px]"
          disabled={!freeName.trim()}
          onClick={addFreeAgent}
        >
          Add
        </button>
      </div>

      {overSlots && (
        <Chip tone="flag">
          {picks.length} keepers exceeds the {league.keeperSlots}-slot limit — saving anyway is a
          commissioner override.
        </Chip>
      )}
      {error && <p className="text-[12.5px] text-[var(--color-arc-red)]">{error}</p>}

      <div className="flex flex-wrap items-center gap-2 border-t border-arc-line pt-3">
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
        <span className="text-[11px] leading-snug text-arc-ink-faint">
          Salaries and contract years follow the league rules and can't be typed over — remove and
          re-add a player to recompute.
        </span>
      </div>
    </div>
  )
}
