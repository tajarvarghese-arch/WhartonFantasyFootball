import { Panel, PageHeader, Stat } from '../components/ui'
import { useLeagueData } from '../lib/data'
import { money } from '../lib/format'

export default function Rules() {
  const { rules, league } = useLeagueData()

  // The workbook's rule sheet is a flat list; bullets are items, the rest headings.
  const body = rules.filter(
    (line) => line !== league.name && !line.startsWith('Official Keeper Rules'),
  )

  return (
    <>
      <PageHeader
        path="~/rules"
        eyebrow="Constitution"
        title="Rules"
        lede="The official keeper rules as maintained by the commissioner, reproduced verbatim from the league workbook."
      />

      <div className="line-in mb-8 grid grid-cols-2 gap-6 lg:grid-cols-4">
        <Stat label="Keeper slots" value={league.keeperSlots} hint="Per team, since 2016" />
        <Stat
          label="Max contract"
          value={`${league.maxContractYears} yrs`}
          hint="Years A → D, since 2018"
        />
        <Stat label="Auction budget" value={money(league.baseDraftBudget)} hint="Less keeper salaries" />
        <Stat label="FAAB budget" value={money(league.baseFaabBudget)} hint="Per team per season" />
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <Panel title="Official keeper rules" delay={60}>
          <ul className="space-y-3 px-5 py-5">
            {body.map((line, index) => {
              const bullet = line.startsWith('-')
              return (
                <li
                  key={index}
                  className={
                    bullet
                      ? 'flex gap-3 text-[13px] leading-relaxed text-arc-ink-soft'
                      : 'pt-2 text-[13px] leading-relaxed font-semibold text-arc-ink'
                  }
                >
                  {bullet && (
                    <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-arc-lime" />
                  )}
                  <span>{bullet ? line.replace(/^-\s*/, '') : line}</span>
                </li>
              )
            })}
          </ul>
        </Panel>

        <div className="space-y-6">
          <Panel
            title="FAAB keeper scale"
            subtitle="Applied automatically to every waiver claim recorded in Finances."
            delay={100}
          >
            <table className="out">
              <thead>
                <tr>
                  <th>% of FAAB budget spent</th>
                  <th className="n">Keeper cost</th>
                </tr>
              </thead>
              <tbody>
                {league.faabScale.map((tier, index) => {
                  const from = index === 0 ? 0 : league.faabScale[index - 1].maxPct + 1
                  return (
                    <tr key={tier.maxPct}>
                      <td className="tnum">
                        {index === league.faabScale.length - 1
                          ? `> ${league.faabScale[index - 1].maxPct}%`
                          : `${from}–${tier.maxPct}%`}
                      </td>
                      <td className="n text-arc-green">{money(tier.keeperCost)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="border-t border-arc-line px-5 py-3.5 text-[12px] leading-relaxed text-arc-ink-faint">
              A player drafted in the auction and later re-acquired off waivers keeps the greater of
              the auction value and the waiver-scale cost. Undrafted free agents cost $5.
            </p>
          </Panel>

          <Panel
            title="Anti-dumping / market check"
            subtitle="Automated on every trade in the queue."
            delay={140}
          >
            <div className="space-y-3 px-5 py-5 text-[13px] leading-relaxed text-arc-ink-soft">
              <p>
                A trade moving less than <span className="text-arc-green">$10</span> in the
                subsequent year can be held 24 hours for a market check. By the rule's own example,
                a $5/$10 trade triggers it and a $10/$2 trade does not — the test is the first
                obligation year, not the total.
              </p>
              <p className="text-arc-ink-faint">
                During the window any manager may offer the seller a better proposal. When it
                closes, the seller owes the original buyer a right of first refusal before dealing
                elsewhere.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}
