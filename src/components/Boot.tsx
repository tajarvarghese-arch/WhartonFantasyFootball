import { useEffect, useState } from 'react'
import { SpiralingBall } from './effects'

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
      <div className="relative w-full max-w-sm text-center">
        <SpiralingBall size={26} />
        <div
          className="arcade pop-in text-[40px] leading-tight text-arc-cyan"
          style={{ textShadow: '3px 3px 0 #04030a, 0 0 30px rgba(63,224,245,0.55)' }}
        >
          WACL
        </div>
        <div
          className="arcade pop-in mt-5 text-[13px] leading-relaxed text-arc-ink-soft"
          style={{ animationDelay: '120ms' }}
        >
          WHARTON ALUM
          <br />
          CHAMPIONS LEAGUE
        </div>

        <div
          aria-hidden
          className="dotbar pop-in mx-auto mt-7 w-full max-w-[220px] text-arc-cyan"
          style={{ animationDelay: '200ms', maskImage: 'none', WebkitMaskImage: 'none' }}
        />

        <div
          className="arcade pulse mt-8 text-[15px] text-arc-yellow"
          style={{ animationDelay: '320ms' }}
        >
          PRESS START
        </div>
        <div className="arcade mt-4 text-[11px] text-arc-ink-faint">22 SEASONS · 12 PLAYERS</div>
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
