import { useEffect, useState } from 'react'

const LINES = [
  'WACL/OS 26.1 — commissioner terminal',
  'mounting /data ................. ok',
  'seasons 2004-2025 ............. 22',
  'keeper contracts .............. ok',
  'auction ledger ......... reconciled',
  'ready.',
]

const SEEN_KEY = 'wacl.booted'

/**
 * Cold-open boot sequence. Runs once per browser session, is skippable by tap,
 * and is bypassed entirely for reduced-motion users.
 */
export default function Boot({ onDone }: { onDone: () => void }) {
  const [shown, setShown] = useState(0)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (shown >= LINES.length) {
      const timer = setTimeout(() => setClosing(true), 260)
      return () => clearTimeout(timer)
    }
    const timer = setTimeout(() => setShown((count) => count + 1), shown === 0 ? 90 : 130)
    return () => clearTimeout(timer)
  }, [shown])

  useEffect(() => {
    if (!closing) return
    const timer = setTimeout(() => {
      sessionStorage.setItem(SEEN_KEY, '1')
      onDone()
    }, 280)
    return () => clearTimeout(timer)
  }, [closing, onDone])

  function skip() {
    sessionStorage.setItem(SEEN_KEY, '1')
    onDone()
  }

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-center justify-center bg-term-bg px-6 transition-opacity duration-300 ${
        closing ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={skip}
      role="status"
      aria-label="Loading"
    >
      <div className="w-full max-w-md">
        {LINES.slice(0, shown).map((line, index) => (
          <div
            key={line}
            className={`line-in text-[12.5px] leading-6 ${
              index === LINES.length - 1 ? 'mt-2 text-term-green glow' : 'text-term-dim'
            }`}
          >
            <span className="text-term-faint select-none">{index === 0 ? '' : '> '}</span>
            {line}
          </div>
        ))}
        <div className="cursor mt-1 h-4" />
        <div className="mt-6 text-[10.5px] tracking-widest text-term-faint uppercase">
          tap to skip
        </div>
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
