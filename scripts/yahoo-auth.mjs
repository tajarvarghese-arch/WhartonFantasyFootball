/**
 * One-time helper: exchanges a Yahoo authorisation code for a refresh token,
 * then lists the fantasy football leagues that account can see so the league
 * key can be copied straight out rather than hunted for.
 *
 *   YAHOO_CLIENT_ID=… YAHOO_CLIENT_SECRET=… node scripts/yahoo-auth.mjs
 *
 * Refresh tokens are long-lived, so this is run once by hand and the result is
 * stored as the YAHOO_REFRESH_TOKEN repository secret.
 */

import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const CLIENT_ID = process.env.YAHOO_CLIENT_ID
const CLIENT_SECRET = process.env.YAHOO_CLIENT_SECRET
// Must match the Redirect URI on your Yahoo app exactly.
const REDIRECT_URI = process.env.YAHOO_REDIRECT_URI ?? 'oob'

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET first.\n')
  console.error('  YAHOO_CLIENT_ID=xxx YAHOO_CLIENT_SECRET=yyy node scripts/yahoo-auth.mjs')
  process.exit(1)
}

const authorizeUrl = `https://api.login.yahoo.com/oauth2/request_auth?${new URLSearchParams({
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: 'fspt-r',
})}`

console.log('\n1. Open this URL and approve access:\n')
console.log(`   ${authorizeUrl}\n`)
console.log(
  REDIRECT_URI === 'oob'
    ? '2. Yahoo shows a code on screen. Copy it.\n'
    : `2. Yahoo redirects to ${REDIRECT_URI}?code=… — copy the code parameter.\n`,
)

const rl = createInterface({ input: stdin, output: stdout })
const code = (await rl.question('Paste the code here: ')).trim()
rl.close()

const response = await fetch('https://api.login.yahoo.com/oauth2/get_token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    code,
    grant_type: 'authorization_code',
  }),
})

if (!response.ok) {
  console.error(`\nYahoo rejected the exchange (${response.status}):`)
  console.error(await response.text())
  process.exit(1)
}

const tokens = await response.json()

console.log('\n' + '='.repeat(64))
console.log('YAHOO_REFRESH_TOKEN')
console.log('='.repeat(64))
console.log(tokens.refresh_token)

// Look up the account's leagues so the league key does not have to be guessed.
try {
  const leagues = await fetch(
    'https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games;game_codes=nfl/leagues?format=json',
    { headers: { Authorization: `Bearer ${tokens.access_token}` } },
  )
  if (!leagues.ok) throw new Error(`status ${leagues.status}`)
  const body = await leagues.json()

  const found = []
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    if (node.league_key && node.name) {
      found.push({ key: node.league_key, name: node.name, season: node.season })
    }
    Object.values(node).forEach(walk)
  }
  walk(body)

  console.log('\n' + '='.repeat(64))
  console.log('YAHOO_LEAGUE_KEY  — pick the row for this season')
  console.log('='.repeat(64))
  if (found.length === 0) {
    console.log('No NFL leagues found on this account.')
  } else {
    for (const league of found) {
      console.log(`${String(league.season ?? '?').padEnd(6)} ${league.key.padEnd(18)} ${league.name}`)
    }
  }
} catch (error) {
  console.log('\nCould not list leagues automatically:', error.message)
  console.log('Find the id in your league URL — the key is "<gameKey>.l.<leagueId>".')
}

console.log('\nAdd both values as repository secrets:')
console.log('  https://github.com/tajarvarghese-arch/WhartonFantasyFootball/settings/secrets/actions\n')
