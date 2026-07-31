import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useLeague } from '../lib/data'
import { usePendingTrades } from '../lib/derive'
import CommandPalette from './CommandPalette'
import PixelSign from './PixelSign'
import { Sparkles } from './effects'
import HelmetField from './HelmetField'
import CommissionerPanel from './CommissionerPanel'
import { ReplayWipe } from './effects'
import { animationsDisabled, motionForcedOn, setMotionForcedOn, systemPrefersReduced } from '../lib/motion'

// Each destination owns a colour, so the nav reads as a row of cabinet buttons.
const NAV = [
  { to: '/', label: 'Ledger', color: 'var(--color-arc-blue)', end: true },
  { to: '/trades', label: 'Trades', color: 'var(--color-arc-red)' },
  { to: '/keepers', label: 'Keepers', color: 'var(--color-arc-lime)' },
  { to: '/finances', label: 'Finances', color: 'var(--color-arc-orange)' },
  { to: '/standings', label: 'Standings', color: 'var(--color-arc-purple)' },
  { to: '/managers', label: 'Managers', color: 'var(--color-arc-cyan)' },
  { to: '/records', label: 'Records', color: 'var(--color-arc-pink)' },
  { to: '/lab', label: 'The Lab', color: 'var(--color-arc-navy)' },
  { to: '/almanac', label: 'Almanac', color: 'var(--color-arc-brown)' },
  { to: '/rules', label: 'Rules', color: 'var(--color-arc-teal)' },
]

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  return <span className="tabular-nums">{now.toLocaleTimeString('en-US', { hour12: false })}</span>
}

export default function Shell({ children }: { children: ReactNode }) {
  const { data, commissioner } = useLeague()
  const pending = usePendingTrades()
  const [panelOpen, setPanelOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  // The OS is requesting reduced motion; offer an in-app override so the
  // animations the commissioner asked for are one tap away.
  const [fxOn, setFxOn] = useState(motionForcedOn)
  const reducedByOS = systemPrefersReduced()
  const location = useLocation()

  // Broadcast-style replay wipe on every page change (not the first load).
  const [wipe, setWipe] = useState(0)
  const firstNav = useRef(true)
  useEffect(() => {
    setMenuOpen(false)
    if (firstNav.current) {
      firstNav.current = false
      return
    }
    if (!animationsDisabled()) setWipe((count) => count + 1)
  }, [location.pathname])

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
    <nav className="flex flex-col gap-2">
      {NAV.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className="block no-underline">
          {({ isActive }) => (
            <span
              className="arcade flex min-h-[44px] items-center justify-between gap-2 border-[3px] border-arc-line px-3 py-2 text-[13px]"
              style={{
                background: isActive ? item.color : 'var(--color-arc-panel)',
                color: isActive ? 'var(--color-arc-panel)' : 'var(--color-arc-ink)',
                boxShadow: isActive ? 'none' : 'var(--shadow-hard-sm)',
                transform: isActive ? 'translate(2px, 2px)' : 'none',
                textShadow: isActive ? '1px 1px 0 rgba(0,0,0,0.4)' : 'none',
              }}
            >
              {item.label}
              {item.label === 'Trades' && pending.length > 0 && (
                <span
                  className="pulse flex h-5 min-w-[20px] items-center justify-center border-2 border-arc-line px-1 text-[11px]"
                  style={{ background: 'var(--color-arc-yellow)', color: 'var(--color-arc-ink)' }}
                >
                  {pending.length}
                </span>
              )}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="min-h-dvh pb-10 lg:grid lg:grid-cols-[228px_1fr]">
      <HelmetField enabled={!animationsDisabled()} />
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b-[3px] border-arc-line bg-arc-panel px-3 py-2 lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <div className="retro relative -my-1 shrink-0">
            <PixelSign
              words={[
                { text: 'WACL', palette: 'pink', size: 21 },
                { text: 'ARCADE', palette: 'gold', size: 8, tracking: 0.24, pixel: 2 },
              ]}
              pixel={2}
            />
          </div>
          <span className="arcade truncate text-[12px] text-arc-ink-soft">
            {current?.label ?? 'Ledger'}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="btn min-h-[36px] px-2.5 py-1"
            aria-label="Search"
          >
            Find
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="btn min-h-[36px] px-2.5 py-1"
            aria-expanded={menuOpen}
            aria-label="Menu"
          >
            {menuOpen ? 'X' : 'Menu'}
            {pending.length > 0 && !menuOpen && (
              <span className="text-arc-red">·{pending.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile full-screen menu */}
      {menuOpen && (
        <div className="fixed inset-0 top-[53px] z-40 overflow-y-auto bg-arc-bg lg:hidden">
          <div className="px-4 py-5">
            <div className="label mb-3">Select</div>
            {navList}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                setPanelOpen(true)
              }}
              className="btn mt-5 w-full"
            >
              {commissioner ? '● Commissioner' : '○ Unlock Commish'}
            </button>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden border-r-[3px] border-arc-line bg-arc-bg-deep lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="border-b-[3px] border-arc-line bg-arc-bg-deep px-4 py-5 text-center">
          <div className="retro relative inline-block">
            <PixelSign
              words={[
                { text: 'WACL', palette: 'pink', size: 34 },
                { text: 'ARCADE', palette: 'gold', size: 14, tracking: 0.2, pixel: 2 },
              ]}
              pixel={3}
            />
            <Sparkles count={5} />
          </div>
          <div className="arcade mt-3 text-[11px] leading-relaxed text-arc-ink-soft">
            WHARTON ALUM
            <br />
            CHAMPIONS
          </div>
          <div className="arcade mt-2 text-[10px] text-arc-yellow">EST. 2004</div>
        </div>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="btn mx-3 mt-3 justify-between"
        >
          <span>Find</span>
          <kbd>⌘K</kbd>
        </button>

        <div className="flex-1 overflow-y-auto p-3">{navList}</div>

        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="arcade flex min-h-[44px] items-center gap-2 border-t-[3px] border-arc-line px-4 py-3 text-left text-[11px] transition-colors hover:bg-arc-panel"
        >
          <span
            aria-hidden
            className={`inline-block h-2.5 w-2.5 border-2 border-arc-line ${commissioner ? 'pulse' : ''}`}
            style={{
              background: commissioner ? 'var(--color-arc-lime)' : 'var(--color-arc-ink-faint)',
            }}
          />
          {commissioner ? 'COMMISH' : 'READ ONLY'}
        </button>
      </aside>

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-9 lg:py-9">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      {/* Credits bar, bottom of the cabinet */}
      <footer className="arcade fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t-[3px] border-arc-line bg-arc-bg-deep px-3 py-2 text-[11px] text-arc-ink-soft">
        <span className="flex min-w-0 items-center gap-2.5">
          <span style={{ color: 'var(--color-arc-yellow)' }}>
            {commissioner ? '2 CREDITS' : '1 CREDIT'}
          </span>
          <span className="hidden sm:inline">
            {data?.managers.filter((manager) => manager.active).length ?? 0}P
          </span>
          {pending.length > 0 && (
            <span style={{ color: 'var(--color-arc-red)' }}>{pending.length} PENDING</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2.5">
          {reducedByOS && (
            <button
              type="button"
              onClick={() => {
                const next = !fxOn
                setMotionForcedOn(next)
                setFxOn(next)
              }}
              className="border-2 border-arc-line px-1.5 py-0.5 transition-colors"
              style={{
                background: fxOn ? 'var(--color-arc-green)' : 'transparent',
                color: fxOn ? '#04120b' : 'var(--color-arc-orange)',
              }}
              title="Your system requests reduced motion; this turns the site's animations on anyway"
            >
              FX {fxOn ? 'ON' : 'OFF'}
            </button>
          )}
          <span className="hidden sm:inline">{data?.league.currentSeason}</span>
          <Clock />
        </span>
      </footer>

      {wipe > 0 && <ReplayWipe key={wipe} />}
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {panelOpen && <CommissionerPanel onClose={() => setPanelOpen(false)} />}
    </div>
  )
}
