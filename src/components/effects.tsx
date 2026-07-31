/**
 * Football flourishes. CSS/SVG only — no animation libraries. Ambient effects
 * are disabled under prefers-reduced-motion by the rules in index.css (unless
 * the FX switch overrides); action-triggered moments are gated in JS where
 * they fire.
 */

import { useEffect } from 'react'

/** Pixel-art football. Sized by the caller. */
export function Football({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      aria-hidden
      shapeRendering="crispEdges"
    >
      <path d="M3 8 Q3 4 8 3 Q13 4 13 8 Q13 12 8 13 Q3 12 3 8 Z" fill="#8a4b2a" />
      <path d="M4 8 Q4 5 8 4 Q12 5 12 8 Q12 11 8 12 Q4 11 4 8 Z" fill="#a9714b" />
      <rect x="7" y="5" width="2" height="6" fill="#f4efe2" />
      <rect x="6" y="6" width="4" height="1" fill="#f4efe2" />
      <rect x="6" y="8" width="4" height="1" fill="#f4efe2" />
      <rect x="6" y="10" width="4" height="1" fill="#f4efe2" />
    </svg>
  )
}

/**
 * Confetti burst. Deterministic offsets so it never re-renders differently,
 * and only a dozen nodes so it stays cheap.
 */
export function Confetti({ count = 14 }: { count?: number }) {
  const colors = [
    'var(--color-arc-cyan)',
    'var(--color-arc-yellow)',
    'var(--color-arc-pink)',
    'var(--color-arc-lime)',
    'var(--color-arc-orange)',
    'var(--color-arc-purple)',
  ]
  return (
    <span className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: count }, (_, index) => {
        // Golden-ratio spacing spreads the pieces without random().
        const left = ((index * 61.8) % 100).toFixed(1)
        const delay = ((index * 137) % 1800) / 1000
        const drift = index % 2 === 0 ? '6px' : '-8px'
        return (
          <span
            key={index}
            className="confetti"
            style={{
              left: `${left}%`,
              background: colors[index % colors.length],
              animationDelay: `${delay}s`,
              ['--drift' as string]: drift,
            }}
          />
        )
      })}
    </span>
  )
}

/** Slowly scrolling yard lines, for use behind a hero figure. */
export function FieldStripes() {
  return <span className="field-stripes" aria-hidden />
}

/** A football that spirals across its container once. */
export function SpiralingBall({ size = 22 }: { size?: number }) {
  return (
    <span className="ball-spiral" aria-hidden>
      <span className="ball-spin inline-block">
        <Football size={size} />
      </span>
    </span>
  )
}


/** Pixel goalposts. Yellow, like every stadium since forever. */
export function Goalpost({ size = 64, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      aria-hidden
      shapeRendering="crispEdges"
    >
      <rect x="7" y="9" width="2" height="7" fill="#ffd84d" />
      <rect x="2" y="8" width="12" height="2" fill="#ffd84d" />
      <rect x="2" y="1" width="2" height="7" fill="#ffd84d" />
      <rect x="12" y="1" width="2" height="7" fill="#ffd84d" />
      <rect x="6" y="15" width="4" height="1" fill="#c98d5f" />
    </svg>
  )
}

/**
 * Two-frame touchdown dance. The jersey is currentColor, so the reigning
 * champion dances in their own team colour.
 */
export function PixelPlayer({ size = 26, color }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      style={{ color }}
      aria-hidden
      shapeRendering="crispEdges"
    >
      {/* frame A — arms straight up, the touchdown signal */}
      <g className="sprite-a">
        <rect x="6" y="0" width="4" height="3" fill="#efeafb" />
        <rect x="7" y="2" width="2" height="1" fill="#221a3a" />
        <rect x="5" y="4" width="6" height="4" fill="currentColor" />
        <rect x="3" y="0" width="2" height="4" fill="currentColor" />
        <rect x="11" y="0" width="2" height="4" fill="currentColor" />
        <rect x="6" y="8" width="4" height="3" fill="#221a3a" />
        <rect x="5" y="11" width="2" height="4" fill="#efeafb" />
        <rect x="9" y="11" width="2" height="4" fill="#efeafb" />
      </g>
      {/* frame B — arms wide, legs split */}
      <g className="sprite-b">
        <rect x="6" y="1" width="4" height="3" fill="#efeafb" />
        <rect x="7" y="3" width="2" height="1" fill="#221a3a" />
        <rect x="5" y="5" width="6" height="4" fill="currentColor" />
        <rect x="1" y="4" width="4" height="2" fill="currentColor" />
        <rect x="11" y="4" width="4" height="2" fill="currentColor" />
        <rect x="6" y="9" width="4" height="2" fill="#221a3a" />
        <rect x="3" y="11" width="2" height="4" fill="#efeafb" />
        <rect x="11" y="11" width="2" height="4" fill="#efeafb" />
      </g>
    </svg>
  )
}

/** Broadcast replay wipe, fired on route changes. Plays once per mount. */
export function ReplayWipe() {
  return <span className="wipe-stripes" aria-hidden />
}

export type MomentKind = 'td' | 'flag' | 'review'

const MOMENT: Record<MomentKind, { text: string; sub: string; color: string }> = {
  td: { text: 'TOUCHDOWN!', sub: 'trade approved', color: 'var(--color-arc-green)' },
  flag: { text: 'FLAG ON THE PLAY', sub: 'trade rejected', color: 'var(--color-arc-yellow)' },
  review: { text: 'UNDER REVIEW', sub: '24-hour market check opened', color: 'var(--color-arc-cyan)' },
}

/**
 * Full-screen ruling moment. Fires only from a commissioner action, never
 * ambiently, and only when animations are enabled — the caller gates it.
 */
export function PlayMoment({ kind, onDone }: { kind: MomentKind; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2100)
    return () => clearTimeout(timer)
  }, [onDone])

  const m = MOMENT[kind]
  return (
    <div
      className="moment pointer-events-none fixed inset-0 z-[95] flex items-center justify-center"
      role="status"
      aria-label={`${m.text} — ${m.sub}`}
    >
      {kind === 'td' && <Confetti count={24} />}
      {kind === 'flag' && (
        <span className="flag-drop absolute left-1/2 top-0" aria-hidden>
          <svg width="30" height="30" viewBox="0 0 16 16" shapeRendering="crispEdges">
            <rect x="2" y="2" width="12" height="12" fill="#ffd84d" />
            <rect x="6" y="6" width="4" height="4" fill="#c9a227" />
          </svg>
        </span>
      )}
      {kind === 'review' && <span className="wipe-stripes opacity-30" aria-hidden />}
      <div className="text-center">
        <div
          className="arcade slam text-[clamp(22px,7vw,52px)]"
          style={{ color: m.color, textShadow: '3px 3px 0 #04030a, 0 0 34px ' + m.color }}
        >
          {m.text}
        </div>
        <div
          className="arcade slam mt-3 text-[13px] text-arc-ink-soft"
          style={{ animationDelay: '0.18s' }}
        >
          {m.sub}
        </div>
      </div>
    </div>
  )
}
