import type { Manager, ManagerId } from './types'

/**
 * Every manager owns one colour for the life of the league. It appears on their
 * badge, their standings row, their contract bars — so the league reads as
 * twelve identities rather than twelve rows of grey.
 *
 * All values are mid-to-dark enough to carry white badge text.
 */
export const MANAGER_COLOR: Record<ManagerId, string> = {
  varghese: '#3b6bff',
  waldman: '#ff4d3d',
  tollinche: '#5aa832',
  buzik: '#9b5de5',
  bernstein: '#e07b00',
  baugh: '#1394b4',
  velamoor: '#ff5da2',
  mukheja: '#17bebb',
  snyder: '#2a3990',
  incognito: '#14a06a',
  konciak: '#a9714b',
  lalwani: '#c9860b',
  // Former managers sit in muted tones so the active twelve stay loudest.
  evans: '#7a7490',
  banerjee: '#6b6480',
  kim: '#8d8698',
  kurucz: '#5d5770',
}

export const FALLBACK_COLOR = '#4b4360'

export function managerColor(id: ManagerId | null | undefined): string {
  if (!id) return FALLBACK_COLOR
  return MANAGER_COLOR[id] ?? FALLBACK_COLOR
}

/** Two letters for the badge — distinct across the whole league. */
export function managerInitials(manager: Manager | undefined, id?: ManagerId): string {
  const source = manager?.displayName ?? id ?? '?'
  const parts = source.trim().split(/\s+/)
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}
