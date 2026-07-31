import { Link } from 'react-router-dom'
import { useLeagueData } from '../lib/data'
import { managerColor, managerInitials } from '../lib/identity'
import type { ManagerId } from '../lib/types'

/** Colour badge + name. The league's identity unit, used everywhere. */
export default function ManagerTag({
  id,
  link = true,
  showName = true,
  size = 26,
}: {
  id: ManagerId | null | undefined
  link?: boolean
  showName?: boolean
  size?: number
}) {
  const { managers } = useLeagueData()
  const manager = managers.find((candidate) => candidate.id === id)
  const name = manager?.displayName ?? id ?? '—'
  const color = managerColor(id)

  const inner = (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span
        className="badge"
        style={{ background: color, width: size, height: size, fontSize: size * 0.33 }}
        aria-hidden
      >
        {managerInitials(manager, id ?? undefined)}
      </span>
      {showName && <span className="truncate">{name}</span>}
    </span>
  )

  if (!link || !id) return inner
  return (
    <Link to={`/managers/${id}`} className="inline-flex min-w-0 hover:underline">
      {inner}
    </Link>
  )
}

/** Just the colour swatch, for charts and legends. */
export function ManagerSwatch({ id }: { id: ManagerId | null | undefined }) {
  return (
    <span
      aria-hidden
      className="inline-block h-3 w-3 border-2 border-arc-ink"
      style={{ background: managerColor(id) }}
    />
  )
}
