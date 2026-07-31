/**
 * One-time helper to obtain a Yahoo refresh token for the sync action.
 *
 *   YAHOO_CLIENT_ID=… YAHOO_CLIENT_SECRET=… node scripts/yahoo-auth.mjs
 *
 * Yahoo refresh tokens are long-lived, so this is run once by hand and the
 * result is stored as the YAHOO_REFRESH_TOKEN repository secret.
 */

import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const CLIENT_ID = process.env.YAHOO_CLIENT_ID
const CLIENT_SECRET = process.env.YAHOO_CLIENT_SECRET
// Must match the Redirect URI on your Yahoo app exactly.
const REDIRECT_URI = process.env.YAHOO_REDIRECT_URI ?? 'oob'

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET first.')
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
console.log('\nSuccess. Add this as the YAHOO_REFRESH_TOKEN repository secret:\n')
console.log(`   ${tokens.refresh_token}\n`)
console.log('You will also need YAHOO_LEAGUE_KEY, which looks like "461.l.123456".')
console.log('Find it at: https://football.fantasysports.yahoo.com — the league id is in the URL,')
console.log('and the game key for the season prefixes it.\n')
