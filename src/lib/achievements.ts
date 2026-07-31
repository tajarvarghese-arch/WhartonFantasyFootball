import { careerLuck, contractRuns, goatIndex, luckRows, tortureBoard } from './analytics'
import { buildLedger } from './rules'
import { careerTable, eraOptions } from './stats'
import type { LeagueData, ManagerId } from './types'

/**
 * Auto-computed badges. Every one is earned by the record — no participation
 * trophies except the one explicitly named Participation Trophy.
 */

export interface Badge {
  id: string
  emoji: string
  name: string
  /** the receipt: why the badge was earned, with numbers */
  reason: string
}

export function achievements(data: LeagueData): Map<ManagerId, Badge[]> {
  const out = new Map<ManagerId, Badge[]>()
  const give = (id: ManagerId | null | undefined, badge: Badge) => {
    if (!id) return
    const list = out.get(id) ?? []
    if (!list.some((b) => b.id === badge.id)) list.push(badge)
    out.set(id, list)
  }

  const seasons = data.seasons
  const career = careerTable(seasons, eraOptions(seasons)[0])
  const luck = careerLuck(luckRows(seasons))
  const goat = goatIndex(seasons)
  const torture = tortureBoard(seasons, data.league.currentSeason)
  const contracts = contractRuns(data.keepers, data.playerPoints, data.playerPositions)
  const ledger = buildLedger(data.trades)
  const activeIds = new Set(data.managers.filter((m) => m.active).map((m) => m.id))

  // ---- dynasty: back-to-back titles (or longer) ----
  const chronological = [...seasons].sort((a, b) => a.year - b.year)
  let streak = 1
  for (let i = 1; i < chronological.length; i++) {
    if (chronological[i].champion === chronological[i - 1].champion) {
      streak += 1
      if (streak >= 2) {
        give(chronological[i].champion, {
          id: 'dynasty',
          emoji: '🏰',
          name: 'Dynasty',
          reason: `${streak} straight titles, ending ${chronological[i].year}`,
        })
      }
    } else {
      streak = 1
    }
  }

  // ---- rings ----
  for (const line of career) {
    if (line.titles >= 3)
      give(line.manager, {
        id: 'rings',
        emoji: '💍',
        name: 'Ring Collector',
        reason: `${line.titles} championships`,
      })
  }

  // ---- GOAT ----
  if (goat[0])
    give(goat[0].manager, {
      id: 'goat',
      emoji: '🐐',
      name: 'The GOAT',
      reason: `#1 era-adjusted scorer, ${goat[0].sumZ.toFixed(1)} GOAT points`,
    })

  // ---- luck poles ----
  const activeLuck = luck.filter((row) => activeIds.has(row.manager))
  if (activeLuck[0] && activeLuck[0].totalLuck > 5)
    give(activeLuck[0].manager, {
      id: 'blessed',
      emoji: '🍀',
      name: 'House Favourite',
      reason: `+${activeLuck[0].totalLuck.toFixed(1)} career wins of pure schedule luck`,
    })
  const cursed = activeLuck[activeLuck.length - 1]
  if (cursed && cursed.totalLuck < -5)
    give(cursed.manager, {
      id: 'cursed',
      emoji: '💀',
      name: 'Cursed',
      reason: `${cursed.totalLuck.toFixed(1)} wins stolen by the schedule, all-time low`,
    })

  // ---- silver collection ----
  for (const row of torture) {
    if (row.runnerUps >= 3)
      give(row.manager, {
        id: 'bridesmaid',
        emoji: '🥈',
        name: 'Always the Bridesmaid',
        reason: `${row.runnerUps} runner-up finishes`,
      })
    if (row.neverWon && row.seasonsPlayed >= 15)
      give(row.manager, {
        id: 'participation',
        emoji: '🎗️',
        name: 'Participation Trophy',
        reason: `${row.seasonsPlayed} seasons, still waiting on a title`,
      })
  }
  const droughtiest = torture.filter((row) => activeIds.has(row.manager))[0]
  if (droughtiest && droughtiest.drought >= 10)
    give(droughtiest.manager, {
      id: 'drought',
      emoji: '🌵',
      name: 'The Drought',
      reason: `${droughtiest.drought} years since ${droughtiest.lastTitleYear ?? 'ever'}`,
    })

  // ---- market badges ----
  if (contracts.steals[0])
    give(contracts.steals[0].manager, {
      id: 'bargain',
      emoji: '💎',
      name: 'Bargain Hunter',
      reason: `${contracts.steals[0].player}: +${Math.round(contracts.steals[0].netPoints)} net points on $${contracts.steals[0].totalPaid}`,
    })
  if (contracts.overpays[0])
    give(contracts.overpays[0].manager, {
      id: 'whale',
      emoji: '🐋',
      name: 'The Whale',
      reason: `$${contracts.overpays[0].totalPaid} for ${contracts.overpays[0].player}'s ${Math.round(contracts.overpays[0].totalPoints)} points`,
    })

  // biggest net auction-dollar spender / banker across all recorded years
  const netByManager = new Map<ManagerId, number>()
  for (const year of Object.values(ledger)) {
    for (const [id, entry] of Object.entries(year)) {
      netByManager.set(id, (netByManager.get(id) ?? 0) + entry.net)
    }
  }
  const nets = [...netByManager.entries()].sort((a, b) => a[1] - b[1])
  if (nets[0] && nets[0][1] < -50)
    give(nets[0][0], {
      id: 'spender',
      emoji: '💸',
      name: 'Win-Now Mode',
      reason: `$${Math.abs(Math.round(nets[0][1]))} net auction dollars shipped out for talent`,
    })
  const banker = nets[nets.length - 1]
  if (banker && banker[1] > 50)
    give(banker[0], {
      id: 'banker',
      emoji: '🏦',
      name: 'The Bank',
      reason: `$${Math.round(banker[1])} net auction dollars collected from the league`,
    })

  // ---- scoring iron ----
  const topScorerCounts = new Map<ManagerId, number>()
  for (const season of seasons) {
    const scored = season.teams.filter((t) => t.avgPointsFor !== null)
    if (!scored.length) continue
    const top = scored.reduce((best, t) => (t.avgPointsFor! > best.avgPointsFor! ? t : best))
    topScorerCounts.set(top.manager, (topScorerCounts.get(top.manager) ?? 0) + 1)
  }
  for (const [id, count] of topScorerCounts) {
    if (count >= 4)
      give(id, {
        id: 'flamethrower',
        emoji: '🔥',
        name: 'Flamethrower',
        reason: `league's top scorer ${count} different seasons`,
      })
  }

  // ---- longevity ----
  const most = Math.max(...career.map((line) => line.seasonsPlayed))
  for (const line of career) {
    if (line.seasonsPlayed === most && most >= 20)
      give(line.manager, {
        id: 'ironman',
        emoji: '🛡️',
        name: 'Iron Man',
        reason: `${line.seasonsPlayed} seasons and never missed one`,
      })
  }

  return out
}
