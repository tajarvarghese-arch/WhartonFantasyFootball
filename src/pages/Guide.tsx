import type { ReactNode } from 'react'
import { Panel, PageHeader } from '../components/ui'
import { useLeagueData } from '../lib/data'

/**
 * The Commissioner's Manual — written for a commissioner who did not build
 * this site and never wants to hear the word "repository". Every instruction
 * names the exact buttons on screen. Anyone can read it; the tasks it
 * describes only work after commissioner sign-in.
 */

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="arcade mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border-2 border-arc-line bg-arc-raised text-[11px]">
        {n}
      </span>
      <span className="text-[14px] leading-relaxed text-arc-ink-soft">{children}</span>
    </li>
  )
}

function B({ children }: { children: ReactNode }) {
  return <span className="font-bold text-arc-ink">{children}</span>
}

export default function Guide() {
  const { league } = useLeagueData()

  return (
    <>
      <PageHeader
        eyebrow="Read me first"
        title="Commissioner's Manual"
        lede="Everything a commissioner does on this site, in plain steps. No technical anything — if you can use a group chat, you can run the league here."
      />

      <div className="space-y-6">
        <Panel title="1 · signing in" subtitle="One password. That's the entire login system.">
          <ol className="space-y-3 px-5 py-5">
            <Step n={1}>
              On a phone: tap <B>Menu</B> (top right), then <B>Commissioner sign-in</B> at the
              bottom. On a computer: click the <B>sign-in button at the bottom of the left
              sidebar</B>.
            </Step>
            <Step n={2}>
              Type the commissioner password and press <B>Unlock</B>. You get the password from
              whoever runs the site — not from this page.
            </Step>
            <Step n={3}>
              That's it. The bottom bar now shows <B>2 CREDITS</B> instead of 1, and editing
              buttons appear across the site. Each device remembers until you sign out.
            </Step>
          </ol>
        </Panel>

        <Panel
          title="2 · approving or rejecting a trade"
          subtitle="The main event. Trades wait in a queue until you rule."
        >
          <ol className="space-y-3 px-5 py-5">
            <Step n={1}>
              Go to <B>Trades</B>. Anything waiting for you is under the <B>Queue</B> tab — the
              nav shows a number badge when something's waiting.
            </Step>
            <Step n={2}>
              Each trade shows who sells, who buys, the players, and a table of exactly how each
              manager's draft money changes, year by year. The site checks the league rules for
              you — if the anti-dumping rule applies, a <B>Market check</B> warning appears on its
              own.
            </Step>
            <Step n={3}>
              Press <B>Approve</B>, <B>Reject</B>, or — when the warning is showing —{' '}
              <B>Hold 24h for market check</B>, which starts the timer automatically.
            </Step>
            <Step n={4}>
              Done. Budgets everywhere on the site update instantly, and the decision is recorded
              permanently with your name on it. To enter a brand-new trade yourself, use{' '}
              <B>New trade</B> on the same page — pick the two managers, type the players, enter
              the dollars per year, and it reads the trade back to you in a sentence before you
              save.
            </Step>
          </ol>
        </Panel>

        <Panel
          title="3 · logging a waiver claim (faab)"
          subtitle="Type the bid; the site does the keeper math."
        >
          <ol className="space-y-3 px-5 py-5">
            <Step n={1}>
              Go to <B>Finances</B>, tap the <B>FAAB</B> tab, press <B>Log claim</B>.
            </Step>
            <Step n={2}>
              Pick the manager, type the player and the bid amount. The{' '}
              <B>keeper cost appears by itself</B> — the ${league.baseFaabBudget} budget sliding
              scale is built in, so there is nothing to calculate.
            </Step>
            <Step n={3}>
              Press <B>Record claim</B>. Budgets update for everyone.
            </Step>
          </ol>
        </Panel>

        <Panel
          title="4 · money between humans"
          subtitle="Dues, payouts, side bets — the who-owes-who ledger."
        >
          <ol className="space-y-3 px-5 py-5">
            <Step n={1}>
              <B>Finances → Cash → Add</B>. Pick the manager, the type (dues, payout, bet…), the
              amount, and a one-line description.
            </Step>
            <Step n={2}>
              Money <B>a manager owes the league</B> goes in as a negative number; money{' '}
              <B>the league owes them</B> is positive. The form reminds you.
            </Step>
            <Step n={3}>
              When someone actually pays, click their entry's <B>Open</B> tag to flip it to{' '}
              <B>Settled</B>. The standing-balances table always shows who still owes what.
            </Step>
          </ol>
        </Panel>

        <Panel
          title="5 · updating a keeper list"
          subtitle="After draft night, or to fix a mistake in any season."
        >
          <ol className="space-y-3 px-5 py-5">
            <Step n={1}>
              Go to <B>Keepers</B>, pick the season from the dropdown, find the team's card, and
              press <B>✎ Edit keepers</B>.
            </Step>
            <Step n={2}>
              Use <B>+ Add from roster…</B> to pick a player — the salary and contract year fill
              in from the league rules by themselves. Press <B>×</B> to drop one, or edit any
              name, dollar amount, or contract letter directly. <B>Blank row</B> is for the rare
              player the roster list doesn't know about.
            </Step>
            <Step n={3}>
              Press <B>Save keepers</B>. Draft budgets, the contract board, and the war room all
              update everywhere, instantly. The counter above the rows warns you if a team is
              over the keeper limit.
            </Step>
          </ol>
        </Panel>

        <Panel
          title="6 · things that need no work at all"
          subtitle="Most of the site runs itself."
        >
          <div className="space-y-2.5 px-5 py-5 text-[14px] leading-relaxed text-arc-ink-soft">
            <p>
              <B>Standings, records, the Lab, the Almanac, player pages, trading cards, roasts</B>{' '}
              — all computed automatically from the data. Approving a trade updates every number
              that depends on it, everywhere, including 22 years of history math.
            </p>
            <p>
              <B>The Keeper War Room</B> (top of the Keepers page) is a sandbox — click keeper
              combinations and watch the draft budget move. It never changes anything real, so
              play freely.
            </p>
            <p>
              <B>Every change you make is kept forever</B> in a tamper-proof history with the
              date and time. Nothing can be silently lost or edited — if a manager disputes a
              ruling, the receipt exists.
            </p>
          </div>
        </Panel>

        <Panel title="7 · if something looks wrong" subtitle="The two-step fix, then the human.">
          <ol className="space-y-3 px-5 py-5">
            <Step n={1}>
              Refresh the page. Changes take a minute or two to show up on other devices — yours
              shows them instantly, everyone else's after the next refresh.
            </Step>
            <Step n={2}>
              If the password stops unlocking, or anything else misbehaves: <B>message the person
              who built the site</B>. Nothing you can press here can break anything permanently —
              every change is reversible from the history.
            </Step>
          </ol>
        </Panel>
      </div>
    </>
  )
}
