import { useMemo, useState } from 'react'
import { useLeagueData } from '../lib/data'
import { useLedger } from '../lib/derive'
import { money } from '../lib/format'
import { keeperEligibility } from '../lib/rules'
import ManagerTag from './ManagerTag'
import { Chip } from './ui'

/**
 * Keeper War Room: toggle any combination of a roster's eligible players and
 * watch the draft budget recompute live, traded cash included. Scratchpad
 * only — nothing here writes anywhere.
 */
export default function WarRoom({ year }: { year: number }) {
  const { league, keepers } = useLeagueData()
  const ledger = useLedger()
  const blocks = useMemo(
    () => (keepers[String(year)] ?? []).filter((block) => block.manager),
    [keepers, year],
  )
  const [teamIndex, setTeamIndex] = useState(0)
  const block = blocks[teamIndex]

  const eligibility = useMemo(() => (block ? keeperEligibility(block) : []), [block])

  // Start from the keepers actually selected on the sheet.
  const [picked, setPicked] = useState<Record<number, Set<string>>>({})
  const selected =
    picked[teamIndex] ??
    new Set(block?.keepers.map((pick) => pick.player.toLowerCase()) ?? [])

  const toggle = (player: string) => {
    const next = new Set(selected)
    const key = player.toLowerCase()
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setPicked((current) => ({ ...current, [teamIndex]: next }))
  }

  if (!block) return null

  const chosen = eligibility.filter((spot) => selected.has(spot.player.toLowerCase()))
  const salary = chosen.reduce((total, spot) => total + (spot.cost ?? 5), 0)
  const cashNet = ledger[String(year)]?.[block.manager!]?.net ?? 0
  const budget = league.baseDraftBudget - salary + cashNet
  const overSlots = chosen.length > league.keeperSlots

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b-[3px] border-arc-line px-4 py-3">
        <select
          className="field w-auto"
          value={teamIndex}
          onChange={(event) => setTeamIndex(Number(event.target.value))}
          aria-label="Team"
        >
          {blocks.map((candidate, index) => (
            <option key={candidate.team} value={index}>
              {candidate.team}
            </option>
          ))}
        </select>
        <ManagerTag id={block.manager} />
      </div>

      <div className="grid gap-0 lg:grid-cols-[1fr_260px]">
        <div className="max-h-[420px] overflow-y-auto">
          {eligibility.map((spot) => {
            const key = spot.player.toLowerCase()
            const isOn = selected.has(key)
            return (
              <label
                key={spot.player}
                className={`flex min-h-[44px] cursor-pointer items-center gap-3 border-b-2 border-arc-line/50 px-4 py-2 transition-colors ${
                  isOn ? 'bg-arc-raised' : ''
                } ${spot.eligible ? '' : 'opacity-45'}`}
              >
                <input
                  type="checkbox"
                  checked={isOn}
                  disabled={!spot.eligible}
                  onChange={() => toggle(spot.player)}
                  className="h-4 w-4 accent-[var(--color-arc-green)]"
                />
                <span className="min-w-0 flex-1 truncate text-[14px]">{spot.player}</span>
                <span className="tnum text-[13px] text-arc-ink-soft">{money(spot.cost ?? 5)}</span>
                {spot.eligible ? (
                  <span className="w-8 text-right text-[11px] text-arc-ink-faint">
                    {spot.nextYear}
                  </span>
                ) : (
                  <Chip tone="down">D out</Chip>
                )}
              </label>
            )
          })}
        </div>

        <div className="border-t-[3px] border-arc-line p-4 lg:border-t-0 lg:border-l-[3px]">
          <div className="label">Keepers picked</div>
          <div
            className="arcade mt-1 text-[20px]"
            style={{ color: overSlots ? 'var(--color-arc-red)' : 'var(--color-arc-ink)' }}
          >
            {chosen.length}/{league.keeperSlots}
          </div>
          {overSlots && (
            <div className="mt-1 text-[12px] text-arc-red">Over the limit — drop {chosen.length - league.keeperSlots}.</div>
          )}

          <div className="label mt-4">Keeper salary</div>
          <div className="arcade mt-1 text-[20px] text-arc-ink">{money(-salary)}</div>

          <div className="label mt-4">Traded cash ({year})</div>
          <div
            className="arcade mt-1 text-[20px]"
            style={{
              color:
                cashNet > 0
                  ? 'var(--color-arc-green)'
                  : cashNet < 0
                    ? 'var(--color-arc-red)'
                    : 'var(--color-arc-ink)',
            }}
          >
            {cashNet === 0 ? '$0' : money(cashNet, { sign: true })}
          </div>

          <div className="label mt-4">Draft budget</div>
          <div
            className="arcade mt-1 text-[30px]"
            style={{ color: budget < 0 ? 'var(--color-arc-red)' : 'var(--color-arc-green)' }}
          >
            {money(budget)}
          </div>
          <div className="mt-2 text-[11px] leading-relaxed text-arc-ink-faint">
            {money(league.baseDraftBudget)} base − salary ± traded cash. Scratchpad only — the
            sheet doesn't change.
          </div>
        </div>
      </div>
    </div>
  )
}
