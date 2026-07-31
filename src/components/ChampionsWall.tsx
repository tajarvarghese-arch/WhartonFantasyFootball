import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { managerName, useLeagueData } from '../lib/data'

/**
 * Twenty-two title seasons as a typographic wall rather than a table. Repeat
 * champions grow with each title, so a dynasty is visible at a glance.
 */
export default function ChampionsWall() {
  const { seasons, managers } = useLeagueData()

  const rows = useMemo(() => {
    const running = new Map<string, number>()
    // Count forward through history so each row shows the title number earned
    // in that season, not the manager's career total.
    return [...seasons]
      .sort((a, b) => a.year - b.year)
      .map((season) => {
        const count = (running.get(season.champion) ?? 0) + 1
        running.set(season.champion, count)
        return { season, nth: count }
      })
      .reverse()
  }, [seasons])

  return (
    <div>
      {rows.map(({ season, nth }, index) => (
        <Link
          key={season.year}
          to={`/managers/${season.champion}`}
          className="group flex items-baseline gap-3 border-b border-term-line/60 px-4 py-2.5 transition-colors last:border-b-0 hover:bg-white/[0.03] sm:gap-5 sm:px-5"
          style={{ animationDelay: `${index * 18}ms` }}
        >
          <span className="tnum w-10 shrink-0 text-[11px] text-term-faint sm:w-12">
            {season.year}
          </span>
          <span className="min-w-0 flex-1">
            <span
              className={`block truncate leading-none tracking-tight text-term-text transition-colors group-hover:text-term-green ${
                nth >= 3 ? 'text-[28px] sm:text-[34px]' : nth === 2 ? 'text-[23px] sm:text-[27px]' : 'text-[19px] sm:text-[22px]'
              }`}
            >
              {managerName(managers, season.champion)}
            </span>
            <span className="mt-1 block truncate text-[10.5px] text-term-faint">
              def. {managerName(managers, season.runnerUp)}
              {season.keeperEra && (
                <span className="ml-2 text-term-line-bright">· keeper era</span>
              )}
            </span>
          </span>
          {nth > 1 && (
            <span
              className="tnum shrink-0 text-[11px] text-term-green"
              title={`Title number ${nth} for this manager`}
            >
              ×{nth}
            </span>
          )}
        </Link>
      ))}
    </div>
  )
}
