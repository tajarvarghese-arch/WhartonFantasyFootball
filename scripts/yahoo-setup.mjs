/**
 * Interactive Yahoo setup. Asks for everything it needs, so there is no
 * environment-variable incantation to get right:
 *
 *   node scripts/yahoo-setup.mjs
 *
 * Nothing is written to disk and nothing is sent anywhere except Yahoo. The
 * script finishes by printing the exact name/value pairs to paste into GitHub
 * repository secrets.
 */

import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const DEFAULT_REDIRECT = 'https://waclhq.github.io/'

/*
 * Yahoo rejects an explicit scope unless it exactly matches what the app was
 * provisioned with, and the console does not show the scope string anywhere.
 * Omitting the parameter makes Yahoo fall back to the app's own configured
 * permissions, which is what we want and what actually works. YAHOO_SCOPE can
 * still force one if a future app needs it.
 */
function buildAuthorizeUrl(clientId, redirectUri) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
  })
  if (process.env.YAHOO_SCOPE) params.set('scope', process.env.YAHOO_SCOPE)
  return `https://api.login.yahoo.com/oauth2/request_auth?${params}`
}

const rl = createInterface({ input: stdin, output: stdout })

const rule = (char = '─') => console.log(char.repeat(66))

function step(number, title) {
  console.log('')
  rule()
  console.log(`STEP ${number}  ${title}`)
  rule()
}

console.log('')
console.log('Yahoo Fantasy sync setup — Wharton Alum Champions League')
console.log('This asks four short questions and prints what to paste into GitHub.')

/* ------------------------------------------------------------------ */

step(1, 'Your Yahoo app credentials')
console.log('From https://developer.yahoo.com/apps/ — open your app to see these.')
console.log('')

const clientId = (await rl.question('  Client ID (long string): ')).trim()
const clientSecret = (await rl.question('  Client Secret: ')).trim()

if (!clientId || !clientSecret) {
  console.error('\nBoth values are required. Nothing was saved; run the script again.')
  rl.close()
  process.exit(1)
}

const redirectAnswer = (
  await rl.question(`\n  Redirect URI [press Enter for ${DEFAULT_REDIRECT}]: `)
).trim()
const redirectUri = redirectAnswer || DEFAULT_REDIRECT

/* ------------------------------------------------------------------ */

step(2, 'Approve access in your browser')

const authorizeUrl = buildAuthorizeUrl(clientId, redirectUri)

console.log('Open this link, sign in as the Yahoo account that runs the league,')
console.log('and click Agree:\n')
console.log(authorizeUrl)
console.log('')
console.log('If the address comes back with ?error=invalid_scope, your Yahoo app')
console.log('is missing the Fantasy Sports permission — re-check the app.\n')
console.log('Yahoo then sends you to your own site with ?code=... on the end of')
console.log('the address. Copy just the code — the part after "code=" and before')
console.log('any "&". It looks like: abc123def456\n')

const code = (await rl.question('  Paste the code here: ')).trim()
if (!code) {
  console.error('\nNo code entered. Run the script again when you have it.')
  rl.close()
  process.exit(1)
}

/* ------------------------------------------------------------------ */

step(3, 'Exchanging the code for a permanent token')

const response = await fetch('https://api.login.yahoo.com/oauth2/get_token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
    grant_type: 'authorization_code',
  }),
})

if (!response.ok) {
  const detail = await response.text()
  console.error(`\nYahoo rejected the exchange (HTTP ${response.status}).\n`)
  if (response.status === 400) {
    console.error('The usual causes, in order of likelihood:')
    console.error('  1. The code was already used — they are single-use. Redo step 2.')
    console.error('  2. The code expired (they last a few minutes). Redo step 2.')
    console.error('  3. The Redirect URI here does not exactly match the one on')
    console.error(`     your Yahoo app. This run used: ${redirectUri}`)
  } else if (response.status === 401) {
    console.error('The Client ID or Client Secret does not match your Yahoo app.')
  }
  console.error(`\nYahoo said: ${detail}`)
  rl.close()
  process.exit(1)
}

const tokens = await response.json()
console.log('Done — Yahoo issued a refresh token.')

/* ------------------------------------------------------------------ */

step(4, 'Finding your league key')

let leagueKey = ''
try {
  const leagues = await fetch(
    'https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games;game_codes=nfl/leagues?format=json',
    { headers: { Authorization: `Bearer ${tokens.access_token}` } },
  )
  if (!leagues.ok) throw new Error(`HTTP ${leagues.status}`)
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

  if (found.length === 0) {
    console.log('No NFL leagues found on this account.')
    console.log('Find the id in your league URL; the key is "<gameKey>.l.<leagueId>".')
  } else {
    found.sort((a, b) => Number(b.season ?? 0) - Number(a.season ?? 0))
    console.log('Leagues on this account, newest first:\n')
    found.forEach((league, index) => {
      console.log(
        `  ${String(index + 1).padStart(2)}. ${String(league.season ?? '?').padEnd(6)} ` +
          `${league.key.padEnd(18)} ${league.name}`,
      )
    })
    const pick = (await rl.question('\n  Which number is this league? [1]: ')).trim() || '1'
    leagueKey = found[Number(pick) - 1]?.key ?? found[0].key
  }
} catch (error) {
  console.log(`Could not list leagues automatically (${error.message}).`)
  console.log('Find the id in your league URL; the key is "<gameKey>.l.<leagueId>".')
}

/* ------------------------------------------------------------------ */

console.log('')
rule('═')
console.log('PASTE THESE INTO GITHUB REPOSITORY SECRETS')
rule('═')
console.log('https://github.com/waclhq/waclhq.github.io/settings/secrets/actions')
console.log('')
console.log('Click "New repository secret" once per row. Name on the left,')
console.log('value on the right. Names must match exactly.\n')

const secrets = [
  ['YAHOO_CLIENT_ID', clientId],
  ['YAHOO_CLIENT_SECRET', clientSecret],
  ['YAHOO_REFRESH_TOKEN', tokens.refresh_token],
  ['YAHOO_LEAGUE_KEY', leagueKey || '<paste your league key>'],
]
for (const [name, value] of secrets) {
  console.log(`  ${name}`)
  console.log(`  ${value}\n`)
}

rule()
console.log('Then: Actions tab → "Yahoo standings sync" → Run workflow.')
console.log('After that it runs itself every Tuesday morning.')
rule()
console.log('')
console.log('These values are secrets. They were printed to this terminal only —')
console.log('clear the scrollback when you are done.\n')

rl.close()
