// Helpers for quick runs set to start later ("Start at…").
import type { IrrigationSummary, ScheduledQuickRun } from '../../types'

export const MINUTE = 60_000
const pad = (n: number) => String(n).padStart(2, '0')
/** Local date key, same as the week strip's (YYYY-MM-DD) */
export const dayKey = (t: number | Date) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

/** "6:00 AM" */
export const timeOf = (t: number) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

/** "6:00 AM" today, "Tomorrow 6:00 AM", "Thu 6:00 AM", "Nov 28 6:00 AM" */
export function whenLabel(t: number, now = Date.now()) {
  const days = Math.round((new Date(dayKey(t) + 'T00:00').getTime() - new Date(dayKey(now) + 'T00:00').getTime()) / 86_400_000)
  const d = new Date(t)
  if (days === 0) return timeOf(t)
  if (days === 1) return `Tomorrow ${timeOf(t)}`
  if (days > 1 && days < 7) return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${timeOf(t)}`
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${timeOf(t)}`
}

/** "in 19 h", "in 4 min", "in 2 days" */
export function inLabel(t: number, now = Date.now()) {
  const m = Math.round((t - now) / MINUTE)
  if (m < 1) return 'now'
  if (m < 60) return `in ${m} min`
  const h = Math.round(m / 60)
  if (h < 36) return `in ${h} h`
  return `in ${Math.round(h / 24)} days`
}

/** "Back Lawn 10m" or "2 zones · 15m" */
export function zonesLabel(zones: { name: string; minutes: number }[]) {
  const total = zones.reduce((n, z) => n + z.minutes, 0)
  return zones.length === 1 ? `${zones[0].name} ${total}m` : `${zones.length} zones · ${total}m`
}

export const totalMinutes = (zones: { minutes: number }[]) => zones.reduce((n, z) => n + z.minutes, 0)

/** Pending (not missed) runs, soonest first */
export const upcomingScheduled = (s: IrrigationSummary) => (s.scheduled ?? []).filter((r) => r.state !== 'missed')

export interface Overlap { name: string; start: number; end: number }

/**
 * Rachio runs (not skipped) and other scheduled quick runs that would be
 * watering at the same time as a run from `start` lasting `minutes`.
 */
export function overlaps(s: IrrigationSummary, start: number, minutes: number, ignoreId?: string): Overlap[] {
  const end = start + minutes * MINUTE
  const out: Overlap[] = []
  for (const d of s.week ?? []) {
    for (const r of d.runs) {
      if (r.skipped) continue
      const a = Date.parse(r.at), b = a + Math.max(1, r.minutes ?? 10) * MINUTE
      if (a < end && b > start) out.push({ name: r.name, start: a, end: b })
    }
  }
  for (const q of upcomingScheduled(s)) {
    if (q.id === ignoreId) continue
    const a = Date.parse(q.at), b = a + totalMinutes(q.zones) * MINUTE
    if (a < end && b > start) out.push({ name: 'Another quick run', start: a, end: b })
  }
  return out.sort((x, y) => x.start - y.start)
}

const roundUp5 = (t: number) => Math.ceil(t / (5 * MINUTE)) * 5 * MINUTE
const roundDown5 = (t: number) => Math.floor(t / (5 * MINUTE)) * 5 * MINUTE

/** Nearest clear times: just after the overlapping runs end, or ending just before they start */
export function clearTimes(s: IrrigationSummary, start: number, minutes: number, ignoreId?: string, now = Date.now()) {
  let after = start
  for (let k = 0; k < 12; k++) {
    const o = overlaps(s, after, minutes, ignoreId)
    if (!o.length) break
    after = roundUp5(Math.max(...o.map((x) => x.end)) + MINUTE)
  }
  let before: number | null = start
  for (let k = 0; k < 12 && before !== null; k++) {
    const o = overlaps(s, before, minutes, ignoreId)
    if (!o.length) break
    before = roundDown5(Math.min(...o.map((x) => x.start)) - minutes * MINUTE - MINUTE)
    if (before < now + 5 * MINUTE) before = null
  }
  return { after: after !== start ? after : null, before: before !== start ? before : null }
}

/** The run that should show as "Next run" on the card: a scheduled quick run if it comes first */
export function firstScheduled(s: IrrigationSummary): ScheduledQuickRun | null {
  const q = upcomingScheduled(s)[0]
  if (!q) return null
  if (q.state === 'waiting') return q
  return !s.nextRun || Date.parse(q.at) <= Date.parse(s.nextRun.at) ? q : null
}
