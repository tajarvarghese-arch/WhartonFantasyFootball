import type { ReactNode } from 'react'

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
      className={`panel rise ${className}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b rule-gold px-5 py-4">
          <div>
            {title && <h2 className="eyebrow">{title}</h2>}
            {subtitle && (
              <p className="mt-1.5 text-[13px] leading-snug text-parchment-dim">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: 'default' | 'up' | 'down' | 'gold'
}) {
  const toneClass = {
    default: 'text-parchment',
    up: 'text-[var(--color-ledger-up)]',
    down: 'text-[var(--color-ledger-down)]',
    gold: 'text-gold-400',
  }[tone]

  return (
    <div className="border-l-2 border-gold-600/40 pl-3.5">
      <div className="eyebrow">{label}</div>
      <div className={`tnum mt-1.5 text-[26px] leading-none font-medium ${toneClass}`}>{value}</div>
      {hint && <div className="mt-1.5 text-[11px] text-parchment-faint">{hint}</div>}
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
    neutral: 'text-parchment-faint',
    gold: 'text-gold-400',
    up: 'text-[var(--color-ledger-up)]',
    down: 'text-[var(--color-ledger-down)]',
    flag: 'text-[var(--color-ledger-flag)]',
  }[tone]
  return <span className={`chip ${toneClass}`}>{children}</span>
}

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
}) {
  return (
    <header className="rise mb-8 flex flex-wrap items-end justify-between gap-5 border-b rule-gold pb-6">
      <div className="max-w-2xl">
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-[42px] leading-[0.95] tracking-tight text-parchment sm:text-[52px]">
          {title}
        </h1>
        {lede && <p className="mt-3 text-[14px] leading-relaxed text-parchment-dim">{lede}</p>}
      </div>
      {action && <div className="shrink-0 pb-1">{action}</div>}
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
    <div className="flex items-center gap-3">
      {label && <span className="eyebrow">{label}</span>}
      <div className="flex border rule-gold">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={value === option.id}
            className={`px-3 py-1.5 text-[11px] font-semibold tracking-[0.09em] uppercase transition-colors ${
              value === option.id
                ? 'bg-gold-500 text-ink-950'
                : 'text-parchment-dim hover:bg-gold-500/12 hover:text-parchment'
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
    <div className="px-5 py-12 text-center text-[13px] text-parchment-faint italic">{children}</div>
  )
}

export function Bar({ value, max, tone = 'gold' }: { value: number; max: number; tone?: string }) {
  const width = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  const color = tone === 'gold' ? 'var(--color-gold-500)' : tone
  return (
    <div className="h-1.5 w-full bg-ink-700">
      <div className="h-full transition-all" style={{ width: `${width}%`, background: color }} />
    </div>
  )
}
