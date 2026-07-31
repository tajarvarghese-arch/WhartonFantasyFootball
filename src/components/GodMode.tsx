import { useEffect } from 'react'
import { Football } from './effects'
import { PixelPlayer } from './effects'
import { MANAGER_COLOR } from '../lib/identity'
import { play } from '../lib/sfx'

/**
 * The Konami payoff: helmets-off chaos. Footballs and dancing pixel players
 * rain from the sky under a GOD MODE banner, then it all clears itself up.
 * Triggered by ↑↑↓↓←→←→BA or five quick taps on the logo.
 */
export default function GodMode({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    play('fanfare')
    const timer = setTimeout(onDone, 6000)
    return () => clearTimeout(timer)
  }, [onDone])

  const colors = Object.values(MANAGER_COLOR).slice(0, 12)
  const drops = Array.from({ length: 34 }, (_, i) => ({
    left: (i * 61.8 + 7) % 100,
    delay: ((i * 137) % 2400) / 1000,
    duration: 2.6 + ((i * 53) % 140) / 100,
    spin: i % 2 === 0,
    kind: i % 3, // 0/1 football, 2 dancer
    color: colors[i % colors.length],
    size: 22 + ((i * 7) % 18),
  }))

  return (
    <div className="pointer-events-none fixed inset-0 z-[85] overflow-hidden" aria-hidden>
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="arcade slam text-[clamp(30px,9vw,64px)] text-arc-yellow"
          style={{ textShadow: '4px 4px 0 #04030a, 0 0 40px rgba(255,216,77,0.8)' }}
        >
          GOD MODE
        </div>
      </div>
      {drops.map((drop, i) => (
        <span
          key={i}
          className="god-drop absolute"
          style={{
            left: `${drop.left}%`,
            animationDelay: `${drop.delay}s`,
            animationDuration: `${drop.duration}s`,
          }}
        >
          <span className={drop.spin ? 'ball-spin inline-block' : 'inline-block'}>
            {drop.kind === 2 ? (
              <PixelPlayer size={drop.size + 6} color={drop.color} />
            ) : (
              <Football size={drop.size} />
            )}
          </span>
        </span>
      ))}
    </div>
  )
}
