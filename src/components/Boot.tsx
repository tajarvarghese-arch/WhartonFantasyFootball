import { useEffect, useState } from 'react'

const SEEN_KEY = 'wacl.booted'

/**
 * Attract screen. Runs once per browser session, skippable by tap, and
 * bypassed entirely for reduced-motion users.
 */
export default function Boot({ onDone }: { onDone: () => void }) {
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setClosing(true), 1500)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!closing) return
    const timer = setTimeout(() => {
      sessionStorage.setItem(SEEN_KEY, '1')
      onDone()
    }, 260)
    return () => clearTimeout(timer)
  }, [closing, onDone])

  function skip() {
    sessionStorage.setItem(SEEN_KEY, '1')
    onDone()
  }

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-center justify-center bg-arc-bg px-6 transition-opacity duration-200 ${
        closing ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={skip}
      role="status"
      aria-label="Loading"
    >
      <div className="w-full max-w-sm text-center">
        <div
          className="arcade pop-in text-[26px] leading-tight text-arc-red"
          style={{ textShadow: '4px 4px 0 var(--color-arc-ink)' }}
        >
          WACL
        </div>
        <div
          className="arcade pop-in mt-4 text-[9px] leading-relaxed text-arc-ink"
          style={{ animationDelay: '120ms' }}
        >
          WHARTON ALUM
          <br />
          CHAMPIONS LEAGUE
        </div>

        <div
          aria-hidden
          className="pop-in mx-auto mt-6 h-2 w-full max-w-[240px]"
          style={{
            animationDelay: '200ms',
            backgroundImage:
              'repeating-linear-gradient(90deg, var(--color-arc-red) 0 20px, var(--color-arc-orange) 20px 40px, var(--color-arc-yellow) 40px 60px, var(--color-arc-lime) 60px 80px, var(--color-arc-cyan) 80px 100px, var(--color-arc-blue) 100px 120px)',
          }}
        />

        <div
          className="arcade pulse mt-7 text-[10px] text-arc-ink"
          style={{ animationDelay: '320ms' }}
        >
          PRESS START
        </div>
        <div className="arcade mt-3 text-[7px] text-arc-ink-faint">22 SEASONS · 12 PLAYERS</div>
      </div>
    </div>
  )
}

export function shouldBoot(): boolean {
  try {
    if (sessionStorage.getItem(SEEN_KEY)) return false
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
