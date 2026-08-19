import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Chip, Empty, Panel, PageHeader, SegmentedControl, Stat } from '../components/ui'
import { managerName, useLeagueData } from '../lib/data'
import { normalizePlayer } from '../lib/analytics'
import { money } from '../lib/format'
import { playerSlug } from '../lib/search'

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DST'] as const
type Position = (typeof POSITIONS)[number]

/**
 * The Draft Board: third-party consensus rankings with everyone already kept
 * struck off, so the whole league can see what talent is actually reaching
 * auction night. Rankings are a committed snapshot (scripts/draft_pool.py);
 * availability recomputes live against the keeper lists.
 */
export default function Draft() {
  const { league, managers, keepers, draftPool } = useLeagueData()
  const [position, setPosition] = useState<Position>('ALL')
  const [showKept, setShowKept] = useState(false)

  const season = league.currentSeason

  // Every keeper this season, by normalized name -> who has him and for what.
  const kept = useMemo(() => {
    const map = new Map<string, { manager: string | null; salary: number | null }>()
    for (const block of keepers[String(season)] ?? []) {
      for (const pick of block.keepers) {
        map.set(normalizePlayer(pick.player), { manager: block.manager, salary: pick.salary })
      }
    }
    return map
  }, [keepers, season])

  if (!draftPool) {
    return (
      <>
        <PageHeader
          path="~/draft"
          eyebrow="Auction night"
          title="Draft Board"
          lede="Consensus rankings with the kept players struck off."
        />
        <Panel>
          <Empty>
            No rankings snapshot yet — run <code>python scripts/draft_pool.py</code> and commit.
          </Empty>
        </Panel>
      </>
    )
  }

  const rows = draftPool.players.map((player) => ({
    ...player,
    keeper: kept.get(normalizePlayer(player.player)),
  }))
  const availableCount = rows.filter((row) => !row.keeper).length
  // Bodies left at each position, so a filter button advertises what's actually
  // reaching the auction instead of how deep the rankings go. ALL carries the
  // total, so the position counts sum to it.
  const availableByPos = new Map<string, number>()
  for (const row of rows) {
    if (row.keeper) continue
    availableByPos.set(row.pos, (availableByPos.get(row.pos) ?? 0) + 1)
  }
  const visible = rows.filter(
    (row) =>
      (position === 'ALL' || row.pos === position) && (showKept || !row.keeper),
  )

  return (
    <>
      <PageHeader
        path="~/draft"
        eyebrow="Auction night"
        title="Draft Board"
        lede={`The top-ranked veterans still reaching the ${season} auction. Rankings are expert consensus; every player already locked up as a keeper is struck off the moment the commissioner saves a list.`}
      />

      <div className="line-in mb-6 grid grid-cols-2 gap-6 lg:grid-cols-4">
        <Stat label="Ranked players" value={draftPool.players.length} hint="Rookies excluded" />
        <Stat label="Still available" value={availableCount} tone="up" />
        <Stat
          label="Off the board"
          value={draftPool.players.length - availableCount}
          hint="Kept before the draft"
        />
        <Stat label="Experts polled" value={draftPool.experts} hint={draftPool.source} />
      </div>

      <Panel
        title={`${season} board`}
        subtitle={`${draftPool.scoring} scoring. Tiers and ranks straight from the source — the league adds only who's gone.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl<Position>
              value={position}
              onChange={setPosition}
              options={POSITIONS.map((id) => ({
                id,
                label: `${id} (${id === 'ALL' ? availableCount : (availableByPos.get(id) ?? 0)})`,
              }))}
            />
            <button type="button" className="btn" onClick={() => setShowKept((on) => !on)}>
              {showKept ? 'Hide kept' : 'Show kept'}
            </button>
          </div>
        }
      >
        <table className="out">
          <thead>
            <tr>
              <th className="n">Rank</th>
              <th>Player</th>
              <th>Pos</th>
              <th>Team</th>
              <th className="n">Bye</th>
              <th className="n">Tier</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.rank} className={row.keeper ? 'opacity-50' : ''}>
                <td className="n text-arc-ink-soft">{row.rank}</td>
                <td>
                  <Link
                    to={`/players/${playerSlug(row.player)}`}
                    className="transition-colors hover:text-arc-green"
                  >
                    {row.player}
                  </Link>
                </td>
                <td className="text-arc-ink-soft">{row.posRank}</td>
                <td className="text-arc-ink-faint">{row.team}</td>
                <td className="n text-arc-ink-faint">{row.bye}</td>
                <td className="n text-arc-ink-faint">{row.tier}</td>
                <td>
                  {row.keeper ? (
                    <Chip tone="down">
                      Kept — {managerName(managers, row.keeper.manager)}
                      {row.keeper.salary !== null ? ` ${money(row.keeper.salary)}` : ''}
                    </Chip>
                  ) : (
                    <Chip tone="up">Available</Chip>
                  )}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="text-arc-ink-faint italic">
                  Nothing matches this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="border-t border-arc-line px-5 py-3.5 text-[12px] leading-relaxed text-arc-ink-faint">
          Source:{' '}
          <a
            className="text-arc-green underline underline-offset-2"
            href={draftPool.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            {draftPool.source}
          </a>{' '}
          — {draftPool.season} draft, {draftPool.scoring.toLowerCase()}, {draftPool.experts}{' '}
          experts, source updated {draftPool.sourceUpdated}, retrieved {draftPool.retrieved}.
          Rookies are excluded by league preference (no NFL history in the record). Availability
          is computed against this site's keeper lists and updates as they change.
        </p>
      </Panel>
    </>
  )
}
