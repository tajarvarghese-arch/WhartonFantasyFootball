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
      className={`win line-in ${className}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {(title || action) && (
        <header className="win-head flex-wrap">
          <div className="min-w-0">
            {title && (
              <h2 className="label flex items-center gap-1.5">
                <span aria-hidden className="text-term-line-bright">$</span>
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-1 text-[12px] leading-snug text-term-dim">{subtitle}</p>
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
    default: 'text-term-text',
    up: 'text-term-green',
    down: 'text-term-red',
    gold: 'text-term-amber',
  }[tone]

  const counted = useCountUp(countTo ?? 0, countTo !== undefined)

  return (
    <div className="border-l border-term-line-bright pl-3">
      <div className="label">{label}</div>
      <div className={`mt-1 text-[23px] leading-none font-medium tabular-nums ${toneClass}`}>
        {countTo !== undefined ? (format ? format(counted) : Math.round(counted)) : value}
      </div>
      {hint && <div className="mt-1.5 text-[11px] leading-snug text-term-faint">{hint}</div>}
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
  accent = false,
}: {
  label: string
  value: string
  countTo?: number
  format?: (value: number) => string
  caption?: ReactNode
  accent?: boolean
}) {
  const counted = useCountUp(countTo ?? 0, countTo !== undefined)
  return (
    <div className="rise-in">
      <div className="label">{label}</div>
      <div
        className={`hero-num mt-2.5 ${accent ? 'text-term-green glow' : ''}`}
      >
        {countTo !== undefined && format ? format(counted) : value}
      </div>
      {caption && (
        <div className="mt-3 max-w-md text-[12px] leading-relaxed text-term-dim">{caption}</div>
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
  const toneClass = {
    neutral: 'text-term-faint',
    gold: 'text-term-amber',
    up: 'text-term-green',
    down: 'text-term-red',
    flag: 'text-term-amber',
  }[tone]
  return <span className={`tag ${toneClass}`}>{children}</span>
}

/** Command-prompt page header. */
export function PageHeader({
  eyebrow,
  title,
  lede,
  action,
  path = '~',
}: {
  eyebrow: string
  title: string
  lede?: string
  action?: ReactNode
  path?: string
}) {
  return (
    <header className="line-in mb-6 border-b border-term-line pb-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <div className="flex flex-wrap items-center gap-x-1.5 text-[11px]">
            <span className="text-term-green">commish@wacl</span>
            <span className="text-term-faint">:</span>
            <span className="text-term-cyan">{path}</span>
            <span className="text-term-faint">$</span>
            <span className="type-in text-term-dim">{eyebrow}</span>
          </div>
          <h1 className="cursor mt-2 text-[30px] leading-[1.05] font-semibold tracking-tight text-term-text sm:text-[38px]">
            {title}
          </h1>
          {lede && (
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-term-dim">
              <span className="text-term-faint select-none"># </span>
              {lede}
            </p>
          )}
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
      <div className="scroll-x flex border border-term-line-bright">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={value === option.id}
            className={`min-h-[34px] px-3 py-1 text-[11px] font-medium tracking-wide whitespace-nowrap transition-colors ${
              value === option.id
                ? 'bg-term-green text-term-bg'
                : 'text-term-dim hover:bg-term-raised hover:text-term-green'
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
    <div className="px-4 py-10 text-center text-[12.5px] text-term-faint">
      <span className="text-term-line-bright">--- </span>
      {children}
      <span className="text-term-line-bright"> ---</span>
    </div>
  )
}

/** Meter drawn as terminal blocks rather than a solid bar. */
export function Bar({
  value,
  max,
  tone = 'var(--color-term-green)',
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
      <span className="text-term-line-bright">{'░'.repeat(cells - filled)}</span>
    </span>
  )
}

/**
 * Inline block sparkline. Reads at any size and costs nothing to render, which
 * makes it the right chart for a table cell on a phone.
 */
export function Sparkline({
  values,
  tone = 'text-term-green',
}: {
  values: (number | null)[]
  tone?: string
}) {
  const blocks = '▁▂▃▄▅▆▇█'
  const present = values.filter((value): value is number => value !== null)
  if (present.length === 0) return <span className="text-term-faint">—</span>
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
