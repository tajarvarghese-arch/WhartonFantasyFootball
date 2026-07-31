/** Money is always whole auction/real dollars in this league. */
export function money(value: number | null | undefined, opts: { sign?: boolean } = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const rounded = Math.round(value)
  const sign = opts.sign && rounded > 0 ? '+' : rounded < 0 ? '−' : ''
  return `${sign}$${Math.abs(rounded).toLocaleString('en-US')}`
}

export function num(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function pct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${(value * 100).toFixed(digits)}%`
}

export function record(wins: number, losses: number): string {
  return `${wins}–${losses}`
}

export function ordinal(n: number): string {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

export function shortDate(iso: string | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** "in 6h 12m" / "expired" — used for the 24-hour anti-dumping market check. */
export function countdown(iso: string | undefined, now = Date.now()): string {
  if (!iso) return '—'
  const remaining = new Date(iso).getTime() - now
  if (Number.isNaN(remaining)) return '—'
  if (remaining <= 0) return 'expired'
  const hours = Math.floor(remaining / 3_600_000)
  const minutes = Math.floor((remaining % 3_600_000) / 60_000)
  return `${hours}h ${minutes}m`
}

export function toneClass(value: number): string {
  if (value > 0) return 'text-term-green'
  if (value < 0) return 'text-term-red'
  return 'text-term-faint'
}
