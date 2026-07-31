/**
 * Football flourishes. Everything here is CSS/SVG only — no libraries, no
 * timers — and every animation is disabled under prefers-reduced-motion by the
 * rules in index.css.
 */

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
