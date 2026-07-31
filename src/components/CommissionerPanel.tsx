import { useState } from 'react'
import { useLeague, clearOverlay } from '../lib/data'
import {
  commitUrl,
  getToken,
  isCommissioner,
  REPO_NAME,
  REPO_OWNER,
  setToken,
  verifyToken,
} from '../lib/github'

/**
 * Commissioner mode is a GitHub fine-grained PAT held in localStorage. Anyone
 * can read the site; only a token with push rights can write league data.
 */
export default function CommissionerPanel({ onClose }: { onClose: () => void }) {
  const { setCommissioner, reload } = useLeague()
  const [token, setTokenValue] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const active = isCommissioner()

  async function connect() {
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      const identity = await verifyToken(token)
      if (!identity.canWrite) {
        throw new Error(`${identity.login} does not have push access to ${REPO_NAME}.`)
      }
      setToken(token)
      setCommissioner(true)
      setStatus(`Connected as ${identity.login}. Commissioner mode is on.`)
      setTokenValue('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not verify that token.')
    } finally {
      setBusy(false)
    }
  }

  function disconnect() {
    setToken(null)
    setCommissioner(false)
    clearOverlay()
    setStatus('Signed out. The site is read-only on this device again.')
    void reload()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/85 p-4 backdrop-blur-sm sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Commissioner access"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="panel w-full max-w-xl">
        <header className="flex items-start justify-between gap-4 border-b rule-gold px-6 py-5">
          <div>
            <div className="eyebrow">Access</div>
            <h2 className="mt-1.5 font-[family-name:var(--font-display)] text-[28px] leading-none text-parchment">
              Commissioner mode
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[22px] leading-none text-parchment-faint transition-colors hover:text-parchment"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="space-y-5 px-6 py-6 text-[13px] leading-relaxed text-parchment-dim">
          {active ? (
            <>
              <p>
                Commissioner mode is <span className="text-[var(--color-ledger-up)]">on</span> for
                this browser. Approvals, FAAB entries, and cash records commit straight to{' '}
                <code className="text-gold-400">
                  {REPO_OWNER}/{REPO_NAME}
                </code>
                .
              </p>
              <p className="text-parchment-faint">
                GitHub Pages republishes a minute or two after each change. Until it does, your edits
                are held locally so the numbers here stay correct.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  className="btn"
                  href={commitUrl()}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Audit log
                </a>
                <button type="button" className="btn btn-danger" onClick={disconnect}>
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <>
              <p>
                The league site is public and read-only. To record decisions you need a GitHub
                fine-grained personal access token with{' '}
                <span className="text-parchment">Contents: Read and write</span> on{' '}
                <code className="text-gold-400">{REPO_NAME}</code>.
              </p>
              <ol className="ml-4 list-decimal space-y-1.5 text-parchment-faint marker:text-gold-600">
                <li>
                  <a
                    className="text-gold-400 underline decoration-gold-600/50 underline-offset-2 hover:decoration-gold-400"
                    href="https://github.com/settings/personal-access-tokens/new"
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Create a fine-grained token
                  </a>{' '}
                  scoped to this one repository.
                </li>
                <li>Grant it Repository permissions → Contents → Read and write.</li>
                <li>Paste it below. It stays in this browser only.</li>
              </ol>
              <div className="space-y-3">
                <label className="eyebrow block" htmlFor="pat">
                  Personal access token
                </label>
                <input
                  id="pat"
                  type="password"
                  className="field tnum"
                  placeholder="github_pat_…"
                  autoComplete="off"
                  value={token}
                  onChange={(event) => setTokenValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && token && !busy) void connect()
                  }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!token || busy}
                  onClick={() => void connect()}
                >
                  {busy ? 'Verifying…' : 'Unlock'}
                </button>
              </div>
            </>
          )}

          {status && <p className="text-[var(--color-ledger-up)]">{status}</p>}
          {error && <p className="text-[var(--color-ledger-down)]">{error}</p>}
          {!active && getToken() && (
            <p className="text-[var(--color-ledger-flag)]">A token is stored but was not accepted.</p>
          )}
        </div>
      </div>
    </div>
  )
}
