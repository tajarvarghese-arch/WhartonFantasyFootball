/**
 * Motion preference with an explicit override.
 *
 * The OS reduced-motion setting is honoured by default — but the commissioner
 * asked for the animations, and iPhones very commonly ship with Reduce Motion
 * on. So when the OS requests reduced motion, the site shows an FX toggle and
 * a stored "on" beats the OS default. The choice is per-browser.
 */

const KEY = 'wacl.motion'

export function systemPrefersReduced(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function motionForcedOn(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

/** True when every animation should stay off. */
export function animationsDisabled(): boolean {
  return systemPrefersReduced() && !motionForcedOn()
}

/** Stamp the root so the CSS reduced-motion rules know about the override. */
export function applyMotionPreference(): void {
  const root = document.documentElement
  if (motionForcedOn()) root.setAttribute('data-motion', 'on')
  else root.removeAttribute('data-motion')
}

export function setMotionForcedOn(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, 'on')
    else localStorage.removeItem(KEY)
  } catch {
    /* private browsing — the attribute still applies for this page view */
  }
  applyMotionPreference()
}
