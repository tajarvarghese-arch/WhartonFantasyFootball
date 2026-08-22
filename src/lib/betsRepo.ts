import { EMPTY_BETS, type BetsFile } from './bets'
import { openVault, type VaultBlob } from './vault'

/**
 * Side bets live in their own repo so the whole league can write them.
 *
 * The token sealed under the league password can only touch THIS repo — it
 * cannot reach keepers, trades, cash, or the commissioner vault in the main
 * repo. Worst case someone corrupts bets.json, which is one revert away and
 * carries nothing critical.
 *
 * Reads come straight from raw.githubusercontent rather than from the built
 * site, so a new bet is visible on the next refresh instead of waiting on a
 * Pages deploy.
 */

export const BETS_OWNER = 'waclhq'
export const BETS_REPO = 'bets'
export const BETS_BRANCH = 'main'
export const BETS_FILE = 'bets.json'

const TOKEN_KEY = 'wacl.league.token'
const API = 'https://api.github.com'
const RAW = `https://raw.githubusercontent.com/${BETS_OWNER}/${BETS_REPO}/${BETS_BRANCH}/${BETS_FILE}`

export function getLeagueToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setLeagueToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token.trim())
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* private browsing — the board simply stays read-only */
  }
}

export function canPostBets(): boolean {
  return Boolean(getLeagueToken())
}

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function fromBase64(base64: string): string {
  const binary = atob(base64.replace(/\n/g, ''))
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))
}

/**
 * Unseal the league token with the shared password and keep it on this
 * device. Verifies against the repo before storing so a wrong password or a
 * revoked token fails here rather than at the first attempted write.
 */
export async function unlockLeague(blob: VaultBlob, password: string): Promise<void> {
  const token = await openVault(blob, password)
  const response = await fetch(`${API}/repos/${BETS_OWNER}/${BETS_REPO}`, {
    headers: headers(token),
  })
  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? 'That token is no longer valid — ask the commissioner to reset it.'
        : `Could not reach the bets repo (${response.status}).`,
    )
  }
  const repo = (await response.json()) as { permissions?: { push?: boolean } }
  if (!repo.permissions?.push) {
    throw new Error('That token cannot write to the bets repo.')
  }
  setLeagueToken(token)
}

/** Public read. Cache-busted so a fresh bet shows up immediately. */
export async function readBets(): Promise<BetsFile> {
  try {
    const response = await fetch(`${RAW}?t=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) return EMPTY_BETS
    const parsed = (await response.json()) as Partial<BetsFile>
    return { bets: Array.isArray(parsed.bets) ? parsed.bets : [] }
  } catch {
    // Repo not created yet, offline, or rate limited — show an empty board.
    return EMPTY_BETS
  }
}

interface FileHandle {
  json: BetsFile
  sha: string | null
}

async function readForWrite(token: string): Promise<FileHandle> {
  const response = await fetch(
    `${API}/repos/${BETS_OWNER}/${BETS_REPO}/contents/${BETS_FILE}?ref=${BETS_BRANCH}`,
    { headers: headers(token), cache: 'no-store' },
  )
  if (response.status === 404) return { json: EMPTY_BETS, sha: null }
  if (!response.ok) throw new Error(`Could not read bets.json (${response.status}).`)
  const body = (await response.json()) as { content: string; sha: string }
  return { json: JSON.parse(fromBase64(body.content)) as BetsFile, sha: body.sha }
}

/**
 * Read-modify-write against the bets repo. Retries once on a 409 so two
 * people posting bets at the same moment don't clobber each other.
 */
export async function saveBets(
  update: (current: BetsFile) => BetsFile,
  message: string,
  attempt = 0,
): Promise<BetsFile> {
  const token = getLeagueToken()
  if (!token) throw new Error('Enter the league password first.')

  const { json, sha } = await readForWrite(token)
  const next = update(json)

  const response = await fetch(
    `${API}/repos/${BETS_OWNER}/${BETS_REPO}/contents/${BETS_FILE}`,
    {
      method: 'PUT',
      headers: { ...headers(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        content: toBase64(`${JSON.stringify(next, null, 2)}\n`),
        branch: BETS_BRANCH,
        ...(sha ? { sha } : {}),
      }),
    },
  )

  if (response.status === 409 && attempt < 1) return saveBets(update, message, attempt + 1)
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { message?: string } | null
    if (detail?.message?.includes('Resource not accessible')) {
      throw new Error(
        `The league token can read the ${BETS_REPO} repo but not write to it — it needs Contents: Read and write.`,
      )
    }
    throw new Error(detail?.message ?? `GitHub rejected the write (${response.status}).`)
  }
  return next
}

export function betsRepoUrl(): string {
  return `https://github.com/${BETS_OWNER}/${BETS_REPO}/commits/${BETS_BRANCH}`
}
