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

/** yyyy-mm-dd for an <input type="date">, read in the viewer's own timezone. */
export function dateInputValue(iso: string | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Back from a date input to a full stamp. An untouched day returns the
 * original string verbatim, so opening an editor and saving nothing never
 * rewrites the time of day — which is what orders the settled record.
 */
export function isoFromDateInput(day: string, previous?: string): string {
  if (!day) return previous ?? ''
  if (previous && dateInputValue(previous) === day) return previous
  const [year, month, date] = day.split('-').map(Number)
  if (!year || !month || !date) return previous ?? ''
  const before = previous ? new Date(previous) : null
  const keepTime = before && !Number.isNaN(before.getTime())
  return new Date(
    year,
    month - 1,
    date,
    keepTime ? before.getHours() : 12,
    keepTime ? before.getMinutes() : 0,
  ).toISOString()
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
