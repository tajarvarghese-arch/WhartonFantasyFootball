import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useLeague } from '../lib/data'
import { usePendingTrades } from '../lib/derive'
import CommandPalette from './CommandPalette'
import CommissionerPanel from './CommissionerPanel'

const NAV = [
  { to: '/', label: 'ledger', hint: 'overview', end: true },
  { to: '/trades', label: 'trades', hint: 'approve / history' },
  { to: '/keepers', label: 'keepers', hint: 'rosters + contracts' },
  { to: '/finances', label: 'finances', hint: 'auction / faab / cash' },
  { to: '/standings', label: 'standings', hint: '22 seasons' },
  { to: '/managers', label: 'managers', hint: 'career records' },
  { to: '/records', label: 'records', hint: 'leaderboards' },
  { to: '/rules', label: 'rules', hint: 'constitution' },
]

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  return (
    <span className="tabular-nums">
      {now.toLocaleTimeString('en-US', { hour12: false })}
    </span>
  )
}

export default function Shell({ children }: { children: ReactNode }) {
  const { data, commissioner } = useLeague()
  const pending = usePendingTrades()
  const [panelOpen, setPanelOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const location = useLocation()

  // Close the mobile command menu whenever navigation happens.
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // Lock body scroll behind the full-screen menu.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  // Cmd/Ctrl-K anywhere, and "/" when not already typing in a field.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const typing =
        event.target instanceof HTMLElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      } else if (event.key === '/' && !typing && !paletteOpen) {
        event.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteOpen])

  const current = NAV.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
  )

  const navList = (
    <nav className="flex flex-col">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `group flex min-h-[42px] items-center justify-between gap-3 px-3 py-2 transition-colors ${
              isActive
                ? 'bg-term-green/10 text-term-green'
                : 'text-term-dim hover:bg-term-raised hover:text-term-text'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className="flex min-w-0 items-baseline gap-2">
                <span
                  aria-hidden
                  className={isActive ? 'text-term-green' : 'text-term-faint'}
                >
                  {isActive ? '>' : ' '}
                </span>
                <span className="text-[13px]">{item.label}</span>
                <span className="truncate text-[10.5px] text-term-faint lg:hidden xl:inline">
                  {item.hint}
                </span>
              </span>
              {item.label === 'trades' && pending.length > 0 && (
                <span className="tag text-term-amber">{pending.length}</span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="min-h-dvh pb-7 lg:grid lg:grid-cols-[214px_1fr]">
      {/* Mobile command bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-term-line bg-term-bg/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="flex min-w-0 items-baseline gap-1.5 text-[13px]">
          <span className="font-semibold text-term-green glow">wacl</span>
          <span className="text-term-faint">:</span>
          <span className="truncate text-term-cyan">{current?.label ?? 'ledger'}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="btn min-h-[34px] px-2.5 py-1"
          aria-label="Search"
        >
          search
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="btn min-h-[34px] px-2.5 py-1"
          aria-expanded={menuOpen}
          aria-label="Commands"
        >
          {menuOpen ? 'esc' : 'menu'}
          {pending.length > 0 && !menuOpen && (
            <span className="ml-1 text-term-amber">·{pending.length}</span>
          )}
        </button>
        </div>
      </div>

      {/* Mobile full-screen command list */}
      {menuOpen && (
        <div className="fixed inset-0 top-[49px] z-40 overflow-y-auto bg-term-bg lg:hidden">
          <div className="px-3 py-3">
            <div className="label px-3 pb-2">select command</div>
            {navList}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                setPanelOpen(true)
              }}
              className="mt-3 flex min-h-[42px] w-full items-center gap-2 border-t border-term-line px-3 pt-3 text-left text-[13px] text-term-dim"
            >
              <span
                aria-hidden
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  commissioner ? 'bg-term-green pulse' : 'bg-term-faint'
                }`}
              />
              {commissioner ? 'commissioner — signed in' : 'sudo — unlock commissioner'}
            </button>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden border-r border-term-line lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="border-b border-term-line px-4 py-4">
          <div className="text-[15px] leading-tight font-semibold text-term-green glow">
            wacl<span className="text-term-faint">://</span>terminal
          </div>
          <div className="mt-1.5 text-[10.5px] leading-snug text-term-faint">
            wharton alum champions
            <br />
            est. 2004 · 12 teams
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="mx-3 mt-3 flex min-h-[34px] items-center justify-between gap-2 border border-term-line-bright px-2.5 text-[11.5px] text-term-faint transition-colors hover:border-term-dim hover:text-term-mid"
        >
          <span>search…</span>
          <kbd>⌘K</kbd>
        </button>
        <div className="flex-1 overflow-y-auto py-2">{navList}</div>
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="flex min-h-[42px] items-center gap-2 border-t border-term-line px-4 py-2.5 text-left text-[11.5px] transition-colors hover:bg-term-raised"
        >
          <span
            aria-hidden
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              commissioner ? 'bg-term-green pulse' : 'bg-term-faint'
            }`}
          />
          <span className={commissioner ? 'text-term-green' : 'text-term-faint'}>
            {commissioner ? 'commissioner' : 'read-only'}
          </span>
        </button>
      </aside>

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-9 lg:py-9">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      {/* Status bar */}
      <footer className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-term-line bg-term-raised px-3 py-1 text-[10.5px] text-term-faint">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="bg-term-green px-1.5 font-semibold text-term-bg">
            {commissioner ? 'RW' : 'RO'}
          </span>
          <span className="hidden sm:inline">main</span>
          <span className="truncate">
            <span className="text-term-dim">{data?.managers.filter((m) => m.active).length ?? 0}</span>{' '}
            mgrs
          </span>
          {pending.length > 0 && (
            <span className="text-term-amber">{pending.length} pending</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="hidden sm:inline">{data?.league.currentSeason}</span>
          <Clock />
        </div>
      </footer>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {panelOpen && <CommissionerPanel onClose={() => setPanelOpen(false)} />}
    </div>
  )
}
