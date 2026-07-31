import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import ManagerTag from '../components/ManagerTag'
import { Panel, PageHeader } from '../components/ui'
import { managerName, useLeagueData } from '../lib/data'
import { num } from '../lib/format'
import { almanac, type AlmanacEntry } from '../lib/analytics'

/**
 * The league's record book: one written entry per season, generated from the
 * data. Template prose varies by year so the book doesn't read as a form
 * letter, and every claim in it is a number from the standings.
 */
export default function Almanac() {
  const data = useLeagueData()
  const { managers } = data
  const entries = useMemo(() => almanac(data.seasons), [data.seasons])

  const name = (id: string | null | undefined) => managerName(managers, id)

  const prose = (entry: AlmanacEntry): string => {
    const champ = name(entry.champion)
    const ru = name(entry.runnerUp)
    const record = `${entry.champWins}–${entry.champLosses}`
    const avg = entry.champAvg !== null ? num(entry.champAvg, 1) : null
    const lg = entry.leagueAvg !== null ? num(entry.leagueAvg, 1) : null

    const openers = [
      `${champ} took the crown at ${record}, leaving ${ru} to spend another offseason rehearsing what might have been.`,
      `The ${entry.year} title went to ${champ} — ${record}, and no apologies offered to ${ru} in the final.`,
      `${champ} closed the year on top at ${record}; ${ru} got the silver and the long drive home.`,
      `A ${record} campaign delivered ${champ} the championship, with ${ru} runner-up and reportedly fine about it.`,
    ]
    let text = openers[entry.year % openers.length]

    if (avg && lg) {
      text += ` The champion averaged ${avg} a week against a league mean of ${lg}.`
    }
    if (entry.topScorer && entry.topScorer.manager !== entry.champion) {
      text += ` The season's heaviest scoring actually belonged to ${name(entry.topScorer.manager)} at ${num(entry.topScorer.avg, 1)} — proof, again, that points and rings are different currencies.`
    }
    if (entry.luckiest && entry.luckiest.luck > 1.4) {
      text += ` The schedule owed ${name(entry.luckiest.manager)} nothing after gifting them ${num(entry.luckiest.luck, 1)} wins beyond what their points earned.`
    }
    if (entry.unluckiest && entry.unluckiest.luck < -1.4) {
      text += ` Spare a thought for ${name(entry.unluckiest.manager)}, shorted ${num(Math.abs(entry.unluckiest.luck), 1)} wins by the fixture list.`
    }
    return text
  }

  return (
    <>
      <PageHeader
        eyebrow="The official record, machine-written"
        title="The Almanac"
        lede="Twenty-two seasons of the Wharton Alum Champions League, one entry per year. Every sentence is computed from the standings — the prose is decoration, the numbers are the record."
      />

      <div className="space-y-6">
        {entries.map((entry, index) => (
          <Panel key={entry.year} delay={Math.min(index * 30, 300)}>
            <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:gap-6">
              <div className="shrink-0 sm:w-36">
                <div className="arcade text-[26px] text-arc-ink">{entry.year}</div>
                <div className="mt-2">
                  <ManagerTag id={entry.champion} size={30} />
                </div>
                <div className="arcade mt-2 text-[10px] text-arc-yellow">CHAMPION</div>
                {!entry.keeperEra && (
                  <div className="mt-1 text-[11px] text-arc-ink-faint">pre-keeper era</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-relaxed text-arc-ink-soft">{prose(entry)}</p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-arc-ink-faint">
                  <span>
                    2nd:{' '}
                    <Link to={`/managers/${entry.runnerUp}`} className="text-arc-ink-soft hover:underline">
                      {name(entry.runnerUp)}
                    </Link>
                  </span>
                  {entry.third && (
                    <span>
                      3rd:{' '}
                      <Link to={`/managers/${entry.third}`} className="text-arc-ink-soft hover:underline">
                        {name(entry.third)}
                      </Link>
                    </span>
                  )}
                  {entry.topScorer && (
                    <span>
                      Top scorer: {name(entry.topScorer.manager)} ({num(entry.topScorer.avg, 1)}/wk)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </>
  )
}
