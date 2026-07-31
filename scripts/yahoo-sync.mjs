/**
 * Pulls live standings from the Yahoo Fantasy API and writes
 * public/data/live.json. Runs from a GitHub Action on a schedule so the
 * credentials stay in GitHub Secrets and never reach the browser.
 *
 * Required environment:
 *   YAHOO_CLIENT_ID      Consumer key from your Yahoo developer app
 *   YAHOO_CLIENT_SECRET  Consumer secret
 *   YAHOO_REFRESH_TOKEN  Long-lived refresh token (see README)
 *   YAHOO_LEAGUE_KEY     e.g. "461.l.123456"  (gameKey.l.leagueId)
 *
 * Team-to-manager mapping lives in public/data/yahoo-map.json so renaming a
 * team on Yahoo never breaks the join.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = join(ROOT, 'public', 'data')

const TOKEN_URL = 'https://api.login.yahoo.com/oauth2/get_token'
const API_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2'

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable ${name}`)
  return value
}

async function accessToken() {
  const body = new URLSearchParams({
    client_id: required('YAHOO_CLIENT_ID'),
    client_secret: required('YAHOO_CLIENT_SECRET'),
    refresh_token: required('YAHOO_REFRESH_TOKEN'),
    grant_type: 'refresh_token',
    redirect_uri: 'oob',
  })
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!response.ok) {
    throw new Error(`Yahoo token refresh failed (${response.status}): ${await response.text()}`)
  }
  const { access_token: token } = await response.json()
  return token
}

async function api(path, token) {
  const response = await fetch(`${API_BASE}/${path}?format=json`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    throw new Error(`Yahoo API ${path} failed (${response.status}): ${await response.text()}`)
  }
  return response.json()
}

/**
 * Yahoo returns arrays of single-key objects mixed with numeric-keyed maps.
 * Flatten one of those arrays into a plain object.
 */
function flatten(chunk) {
  const out = {}
  const visit = (node) => {
    if (Array.isArray(node)) {
      node.forEach(visit)
    } else if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        if (value !== null && typeof value === 'object') visit(value)
        else out[key] = value
      }
    }
  }
  visit(chunk)
  return out
}

function parseStandings(payload) {
  const league = payload?.fantasy_content?.league
  if (!league) throw new Error('Unexpected Yahoo payload: no league node')

  const meta = league[0] ?? {}
  const standings = league[1]?.standings?.[0]?.teams
  if (!standings) throw new Error('Unexpected Yahoo payload: no standings node')

  const teams = []
  for (const [key, value] of Object.entries(standings)) {
    if (key === 'count' || !value?.team) continue
    const info = flatten(value.team[0])
    const stats = value.team[1]?.team_standings ?? {}
    const outcome = stats.outcome_totals ?? {}
    teams.push({
      teamKey: info.team_key ?? null,
      teamName: info.name ?? null,
      rank: Number(stats.rank) || null,
      wins: Number(outcome.wins) || 0,
      losses: Number(outcome.losses) || 0,
      ties: Number(outcome.ties) || 0,
      pointsFor: Number(stats.points_for) || 0,
      pointsAgainst: Number(stats.points_against) || 0,
    })
  }

  return {
    leagueKey: meta.league_key ?? null,
    leagueName: meta.name ?? null,
    season: Number(meta.season) || null,
    currentWeek: Number(meta.current_week) || null,
    teams: teams.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)),
  }
}

async function loadMap() {
  try {
    return JSON.parse(await readFile(join(DATA, 'yahoo-map.json'), 'utf8'))
  } catch {
    return {}
  }
}

async function main() {
  const leagueKey = required('YAHOO_LEAGUE_KEY')
  const token = await accessToken()
  const payload = await api(`league/${leagueKey}/standings`, token)
  const parsed = parseStandings(payload)
  const map = await loadMap()

  const unmapped = []
  const teams = parsed.teams.map((team) => {
    const manager = map[team.teamKey] ?? map[team.teamName] ?? null
    if (!manager) unmapped.push(`${team.teamName} (${team.teamKey})`)
    const games = team.wins + team.losses + team.ties
    return {
      ...team,
      manager,
      avgPointsFor: games ? Number((team.pointsFor / games).toFixed(2)) : null,
      avgPointsAgainst: games ? Number((team.pointsAgainst / games).toFixed(2)) : null,
    }
  })

  const output = {
    season: parsed.season,
    week: parsed.currentWeek,
    leagueName: parsed.leagueName,
    leagueKey: parsed.leagueKey,
    updatedAt: new Date().toISOString(),
    unmapped,
    teams,
  }

  await writeFile(join(DATA, 'live.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  console.log(`Wrote live.json — ${parsed.season} week ${parsed.currentWeek}, ${teams.length} teams`)

  if (unmapped.length) {
    console.warn(
      `\n${unmapped.length} team(s) not mapped to a manager. Add them to public/data/yahoo-map.json:`,
    )
    for (const team of unmapped) console.warn(`  ${team}`)
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
