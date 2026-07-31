import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useLeague } from '../lib/data'
import CommissionerPanel from './CommissionerPanel'

const NAV = [
  { to: '/', label: 'Ledger', end: true },
  { to: '/trades', label: 'Trades' },
  { to: '/keepers', label: 'Keepers' },
  { to: '/finances', label: 'Finances' },
  { to: '/standings', label: 'Standings' },
  { to: '/managers', label: 'Managers' },
  { to: '/records', label: 'Records' },
  { to: '/rules', label: 'Rules' },
]

export default function Shell({ children }: { children: ReactNode }) {
  const { data, commissioner } = useLeague()
  const [panelOpen, setPanelOpen] = useState(false)
  const pending = data?.tradeQueue.proposals.filter((p) => p.status !== 'approved' && p.status !== 'rejected').length ?? 0

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="border-b rule-gold lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:border-r lg:border-b-0">
        <div className="flex h-full flex-col">
          <div className="border-b rule-gold px-6 py-7">
            <div className="font-[family-name:var(--font-display)] text-[27px] leading-[0.9] tracking-tight text-parchment">
              Wharton
              <br />
              <span className="text-gold-400 italic">Alum</span> Champions
            </div>
            <div className="mt-3 text-[10px] font-semibold tracking-[0.18em] text-parchment-faint uppercase">
              Est. 2004 · Commissioner's Ledger
            </div>
          </div>

          <nav className="flex flex-wrap gap-x-1 gap-y-0.5 px-3 py-4 lg:flex-col lg:gap-0">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `group flex items-center justify-between gap-2 px-3 py-2 text-[12px] font-semibold tracking-[0.1em] uppercase transition-colors ${
                    isActive
                      ? 'bg-gold-500/12 text-gold-400'
                      : 'text-parchment-dim hover:bg-parchment/5 hover:text-parchment'
                  }`
                }
              >
                <span className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="h-px w-3 bg-current opacity-40 transition-all group-hover:w-5"
                  />
                  {item.label}
                </span>
                {item.label === 'Trades' && pending > 0 && (
                  <span className="tnum bg-[var(--color-ledger-flag)] px-1.5 text-[10px] font-bold text-ink-950">
                    {pending}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto border-t rule-gold p-4">
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className="flex w-full items-center gap-2.5 px-2 py-1.5 text-left text-[11px] font-semibold tracking-[0.1em] uppercase transition-colors hover:text-gold-400"
            >
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${
                  commissioner ? 'bg-[var(--color-ledger-up)]' : 'bg-parchment-faint'
                }`}
              />
              <span className={commissioner ? 'text-parchment' : 'text-parchment-faint'}>
                {commissioner ? 'Commissioner' : 'Read only'}
              </span>
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      {panelOpen && <CommissionerPanel onClose={() => setPanelOpen(false)} />}
    </div>
  )
}
