import { useEffect, useState } from 'react'
import HeapScene, { HEAP_BOOT_SECONDS } from './HeapScene'
import PixelSign from './PixelSign'
import { Sparkles } from './effects'
import { animationsDisabled } from '../lib/motion'

/**
 * Title screen: King of the Heap. Eleven players brawl onto a dogpile and the
 * reigning champion climbs it to hoist the trophy. Plays on every real page
 * load, skippable by tap, absent entirely when animations are off.
 */
export default function Boot({
  onDone,
  championColor,
}: {
  onDone: () => void
  championColor?: string
}) {
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setClosing(true), HEAP_BOOT_SECONDS * 1000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!closing) return
    const timer = setTimeout(onDone, 280)
    return () => clearTimeout(timer)
  }, [closing, onDone])

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-center justify-center bg-arc-bg px-4 transition-opacity duration-200 ${
        closing ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={onDone}
      role="status"
      aria-label="Loading — tap to skip"
    >
      <div className="w-full max-w-md text-center">
        {/* pop-in and the tilt must live on different elements: the entrance
            animation's fill retains transform:none and would erase the lean */}
        <div className="pop-in inline-block">
          <div className="relative">
            <PixelSign
              words={[
                { text: 'WACL', palette: 'pink', size: 64 },
                { text: 'ARCADE', palette: 'gold', size: 30, tracking: 0.18, pixel: 2 },
              ]}
              pixel={4}
            />
            <Sparkles count={10} />
          </div>
        </div>
        <div
          className="arcade pop-in mt-3 text-[12px] leading-relaxed text-arc-ink-soft"
          style={{ animationDelay: '120ms' }}
        >
          WHARTON ALUM CHAMPIONS LEAGUE
        </div>

        <div className="mx-auto mt-2 flex justify-center">
          <HeapScene mode="boot" championColor={championColor} width={380} height={230} />
        </div>

        {/* timed to land as the trophy goes up */}
        <div
          className="arcade text-[15px] text-arc-yellow"
          style={{
            animation:
              'pop-in 0.3s steps(3) 3.9s both, pulse-dot 1.2s steps(1) 4.2s infinite',
          }}
        >
          PRESS START
        </div>
        <div
          className="arcade pop-in mt-3 text-[10px] text-arc-ink-faint"
          style={{ animationDelay: '4.1s' }}
        >
          22 SEASONS · 12 PLAYERS · 1 HEAP
        </div>
      </div>
    </div>
  )
}

export function shouldBoot(): boolean {
  try {
    return !animationsDisabled()
  } catch {
    return false
  }
}
