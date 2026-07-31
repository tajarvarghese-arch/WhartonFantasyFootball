import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Framed block of terminal output. */
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = '',
  delay = 0,
}: {
  title?: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  delay?: number
}) {
  return (
    <section
      className={`win pop-in ${className}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {(title || action) && (
        <header className="win-head flex-wrap">
          <div className="min-w-0">
            {title && <h2 className="label">{title}</h2>}
            {subtitle && (
              <p className="mt-1 text-[12px] leading-snug text-arc-ink-soft">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

/**
 * Counts a numeric readout up on mount. Static values (names, strings) pass
 * straight through.
 */
function useCountUp(target: number, run: boolean): number {
  const [value, setValue] = useState(run ? 0 : target)
  const frame = useRef(0)

  useEffect(() => {
    if (!run) {
      setValue(target)
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    const start = performance.now()
    const duration = 780
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      // Overshoot slightly past the target, then settle — matches --ease-spring.
      const eased =
        progress === 1
          ? 1
          : 1 + 2.2 * Math.pow(progress - 1, 3) + 1.2 * Math.pow(progress - 1, 2)
      setValue(target * eased)
      if (progress < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)

    // rAF is paused in background tabs, which would strand the readout at zero.
    // A timer still fires there, so the true value always lands.
    const settle = setTimeout(() => setValue(target), duration + 260)

    return () => {
      cancelAnimationFrame(frame.current)
      clearTimeout(settle)
    }
  }, [target, run])

  return value
}

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
  countTo,
  format,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: 'default' | 'up' | 'down' | 'gold'
  /** When set, the readout animates from zero to this number on mount. */
  countTo?: number
  format?: (value: number) => string
}) {
  const toneClass = {
    default: 'text-arc-ink',
    up: 'text-arc-green',
    down: 'text-arc-red',
    gold: 'text-arc-ink',
  }[tone]

  const counted = useCountUp(countTo ?? 0, countTo !== undefined)

  return (
    <div className="win px-3 py-3">
      <div className="label">{label}</div>
      <div className={`arcade mt-2 text-[17px] leading-none ${toneClass}`}>
        {countTo !== undefined ? (format ? format(counted) : Math.round(counted)) : value}
      </div>
      {hint && <div className="mt-2 text-[13px] leading-snug text-arc-ink-soft">{hint}</div>}
    </div>
  )
}

/**
 * The one figure a screen is about. Everything else is subordinate to it, so
 * there is exactly one of these per view.
 */
export function Hero({
  label,
  value,
  countTo,
  format,
  caption,
}: {
  label: string
  value: string
  countTo?: number
  format?: (value: number) => string
  caption?: ReactNode
  /** Retained for callers written against the previous design. */
  accent?: boolean
}) {
  const counted = useCountUp(countTo ?? 0, countTo !== undefined)
  return (
    <div className="rise-in">
      <div className="label">{label}</div>
      <div className="hero-num mt-3">
        {countTo !== undefined && format ? format(counted) : value}
      </div>
      {caption && (
        <div className="mt-4 max-w-md text-[14px] leading-relaxed text-arc-ink-soft">{caption}</div>
      )}
    </div>
  )
}

export function Chip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'gold' | 'up' | 'down' | 'flag'
}) {
  const bg = {
    neutral: 'var(--color-arc-bg-deep)',
    gold: 'var(--color-arc-yellow)',
    up: 'var(--color-arc-lime)',
    down: 'var(--color-arc-red)',
    flag: 'var(--color-arc-orange)',
  }[tone]
  const fg = tone === 'down' ? 'var(--color-arc-panel)' : 'var(--color-arc-ink)'
  return (
    <span className="tag" style={{ background: bg, color: fg }}>
      {children}
    </span>
  )
}

/** Command-prompt page header. */
export function PageHeader({
  eyebrow,
  title,
  lede,
  action,
}: {
  eyebrow: string
  title: string
  lede?: string
  action?: ReactNode
  /** Retained so callers written for the previous layout still compile. */
  path?: string
}) {
  return (
    <header className="pop-in mb-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <div className="label type-in">{eyebrow}</div>
          <h1 className="display cursor mt-3 text-arc-ink">{title}</h1>
          <div
            aria-hidden
            className="mt-3 h-1.5 w-full max-w-sm"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, var(--color-arc-red) 0 22px, var(--color-arc-orange) 22px 44px, var(--color-arc-yellow) 44px 66px, var(--color-arc-lime) 66px 88px, var(--color-arc-cyan) 88px 110px, var(--color-arc-blue) 110px 132px)',
            }}
          />
          {lede && <p className="mt-3 text-[14px] leading-relaxed text-arc-ink-soft">{lede}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  )
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: string }[]
  value: T
  onChange: (next: T) => void
  label?: string
}) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="label">{label}</span>}
      <div className="scroll-x flex border-[3px] border-arc-ink shadow-hard-sm">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={value === option.id}
            className={`arcade min-h-[38px] px-3 py-1 text-[9px] whitespace-nowrap transition-colors ${
              value === option.id
                ? 'bg-arc-blue text-arc-panel'
                : 'bg-arc-panel text-arc-ink hover:bg-arc-yellow'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="arcade px-4 py-10 text-center text-[10px] leading-relaxed text-arc-ink-soft">
      {children}
    </div>
  )
}

/** Meter drawn as terminal blocks rather than a solid bar. */
export function Bar({
  value,
  max,
  tone = 'var(--color-arc-blue)',
  cells = 12,
}: {
  value: number
  max: number
  tone?: string
  cells?: number
}) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const filled = Math.round(ratio * cells)
  return (
    <span
      className="text-[11px] leading-none tracking-[-0.5px] tabular-nums"
      aria-hidden
      title={`${Math.round(ratio * 100)}%`}
    >
      <span style={{ color: tone }}>{'█'.repeat(filled)}</span>
      <span className="text-arc-ink-faint">{'░'.repeat(cells - filled)}</span>
    </span>
  )
}

/**
 * Inline block sparkline. Reads at any size and costs nothing to render, which
 * makes it the right chart for a table cell on a phone.
 */
export function Sparkline({
  values,
  tone = 'text-arc-blue',
}: {
  values: (number | null)[]
  tone?: string
}) {
  const blocks = '▁▂▃▄▅▆▇█'
  const present = values.filter((value): value is number => value !== null)
  if (present.length === 0) return <span className="text-arc-ink-faint">—</span>
  const min = Math.min(...present)
  const max = Math.max(...present)
  const span = max - min || 1
  return (
    <span className={`text-[13px] leading-none tracking-[-0.5px] ${tone}`} aria-hidden>
      {values
        .map((value) =>
          value === null ? ' ' : blocks[Math.round(((value - min) / span) * (blocks.length - 1))],
        )
        .join('')}
    </span>
  )
}

/** Horizontally scrollable wrapper for wide tables on small screens. */
export function Scroller({ children }: { children: ReactNode }) {
  return <div className="scroll-x">{children}</div>
}
