import { careerLuck, contractRuns, goatIndex, luckRows, tortureBoard } from './analytics'
import { careerTable, eraOptions } from './stats'
import { managerName } from './data'
import type { LeagueData, ManagerId } from './types'

/**
 * The Roast Button. Every burn is backed by a number from the record — the
 * engine only says things the data can prove, which is what makes it hurt.
 * Reroll bumps the seed for a fresh assembly.
 */

const pick = <T,>(pool: T[], seed: number) => pool[Math.abs(seed) % pool.length]

export function roast(data: LeagueData, id: ManagerId, seed: number): string[] {
  const seasons = data.seasons
  const career = careerTable(seasons, eraOptions(seasons)[0]).find((row) => row.manager === id)
  const torture = tortureBoard(seasons, data.league.currentSeason).find(
    (row) => row.manager === id,
  )
  const luck = careerLuck(luckRows(seasons)).find((row) => row.manager === id)
  const goat = goatIndex(seasons)
  const goatRank = goat.findIndex((row) => row.manager === id) + 1
  const contracts = contractRuns(data.keepers, data.playerPoints, data.playerPositions)
  const myOverpay = contracts.overpays.find((run) => run.manager === id)
  const displayName = managerName(data.managers, id)

  if (!career || !torture) return [`${displayName} has no record to roast, which is its own roast.`]

  const lines: string[] = []

  // ---- opener ----
  lines.push(
    pick(
      [
        `${displayName}. Let's go to the numbers, since the numbers can't be blocked in the group chat.`,
        `The record book on ${displayName} is public, which is unfortunate for ${displayName}.`,
        `${displayName} asked for feedback. The spreadsheet obliges.`,
      ],
      seed,
    ),
  )

  // ---- title situation ----
  if (torture.neverWon && torture.seasonsPlayed >= 10) {
    lines.push(
      pick(
        [
          `${torture.seasonsPlayed} seasons. Zero titles. The trophy isn't hiding — it just doesn't know your name.`,
          `You've been chasing this championship for ${torture.seasonsPlayed} years. At this point it legally qualifies as a hobby.`,
          `${torture.seasonsPlayed} seasons without a ring. The league constitution predates smartphones; so does your last realistic shot.`,
        ],
        seed + 1,
      ),
    )
  } else if (torture.drought >= 10 && torture.lastTitleYear) {
    lines.push(
      pick(
        [
          `Last ring: ${torture.lastTitleYear}. Players drafted that year are retired and doing podcasts now.`,
          `You last won in ${torture.lastTitleYear}. That trophy has been legal to drive for a while.`,
          `${torture.drought} years since ${torture.lastTitleYear}. The banner's still up; the dynasty checked out.`,
        ],
        seed + 1,
      ),
    )
  } else if (career.titles >= 2) {
    lines.push(
      pick(
        [
          `Yes, ${career.titles} titles — mentioned so often the group chat auto-collapses it.`,
          `${career.titles} rings, and somehow the same number of humble seasons: zero.`,
        ],
        seed + 1,
      ),
    )
  }

  // ---- silver ----
  if (torture.runnerUps >= 3) {
    lines.push(
      pick(
        [
          `${torture.runnerUps} runner-up finishes. The second-place photo guy knows your good side by heart.`,
          `${torture.runnerUps} silvers. You've spent more time on the podium's second step than some champions spent in the league.`,
        ],
        seed + 2,
      ),
    )
  }

  // ---- luck ----
  if (luck) {
    if (luck.totalLuck > 8) {
      lines.push(
        pick(
          [
            `The schedule has gifted you +${luck.totalLuck.toFixed(1)} wins over your career. Send it a card; it's done more for you than your draft board.`,
            `+${luck.totalLuck.toFixed(1)} career wins of pure luck. Your points object to being associated with your record.`,
          ],
          seed + 3,
        ),
      )
    } else if (luck.totalLuck < -8) {
      lines.push(
        pick(
          [
            `${luck.totalLuck.toFixed(1)} wins stolen by the schedule. Unlucky, yes — but the schedule didn't set your lineup either.`,
            `You're ${Math.abs(luck.totalLuck).toFixed(1)} wins short of what your points earned. The universe apologizes; it will not be changing its behaviour.`,
          ],
          seed + 3,
        ),
      )
    }
  }

  // ---- the contract ----
  if (myOverpay) {
    lines.push(
      pick(
        [
          `You paid $${myOverpay.totalPaid} for ${myOverpay.player} and received ${Math.round(myOverpay.totalPoints)} points. A vending machine returns more.`,
          `$${myOverpay.totalPaid} on ${myOverpay.player}, ${Math.round(myOverpay.totalPoints)} points back. That's not a contract, it's a donation.`,
        ],
        seed + 4,
      ),
    )
  }

  // ---- scoring ----
  if (goatRank > goat.length * 0.6) {
    lines.push(
      `Era-adjusted scoring rank: #${goatRank} of ${goat.length} all-time. Consistency is a virtue; this is not the consistency they meant.`,
    )
  } else if (career.playoffRate < 0.4) {
    lines.push(
      `Playoffs in ${career.playoffAppearances} of ${career.seasonsPlayed} seasons. Your October rivals are the waiver wire and acceptance.`,
    )
  }

  // ---- closer ----
  lines.push(
    pick(
      [
        `Anyway — see you at the auction. Bring the usual optimism; the league will supply the usual result.`,
        `The good news: every stat above resets to zero never. Good luck in ${data.league.currentSeason}.`,
        `Printed, framed, and legally admissible. The Almanac sends its regards.`,
      ],
      seed + 5,
    ),
  )

  return lines
}
