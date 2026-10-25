// ── Irrigation quick runs ───────────────────────────────────────────────────
// The one-tap buttons on the Irrigation card. Edit this list to change them.
//
// Names are matched loosely against what's in the Rachio app (capitals,
// spaces and a trailing "s" don't matter). If a name doesn't match exactly
// one zone or schedule, its button shows as unavailable instead of guessing.
//
//   zone + minutes  → runs one zone for that many minutes
//   schedule        → runs that whole schedule now, with its usual zones and times
//
// Pausing a running zone uses PAUSE_MINUTES (Rachio allows up to 60).

export const PAUSE_MINUTES = 60

/** Time buttons in the hold-to-set panel */
export const QUICK_MINUTES = [2, 5, 10, 15]

/** Decorative rain on the card while a zone waters. false = plain card. */
export const RAIN_EFFECT = true

export interface QuickRunConfig {
  id: string
  label: string
  zone?: string
  minutes?: number
  schedule?: string
}

export const QUICK_RUNS: QuickRunConfig[] = [
  { id: 'back-slope-2', label: 'Back slope', zone: 'Back slope', minutes: 2 },
  { id: 'lawns', label: 'Lawns', schedule: 'Lawns' },
  { id: 'back-lawn-5', label: 'Back lawn', zone: 'Back lawn', minutes: 5 },
]

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Find the one item whose name matches. Exact match wins; otherwise every word must appear. */
export function matchByName<T extends { name: string }>(target: string, items: T[]): { item?: T; reason?: string } {
  const exact = items.filter((i) => squash(i.name) === squash(target) || squash(i.name).replace(/s$/, '') === squash(target).replace(/s$/, ''))
  if (exact.length === 1) return { item: exact[0] }
  const want = words(target).map((w) => w.replace(/s$/, ''))
  const loose = items.filter((i) => want.every((w) => squash(i.name).includes(w)))
  if (loose.length === 1) return { item: loose[0] }
  if (loose.length > 1) return { reason: `"${target}" matches ${loose.length}: ${loose.map((i) => i.name).join(', ')}` }
  return { reason: `No match for "${target}"` }
}
