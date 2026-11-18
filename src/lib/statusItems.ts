// What goes in the status bar at the top of the Home page (baseline rules,
// decided October 24, 2026 — to be refined after living with it):
//   - Order: device alerts first, then today's calendar items and games in time
//     order, then tomorrow's items labeled "Tomorrow", then big events further out.
//   - Look-ahead: today + tomorrow; big events (F1 races, golf majors) up to 3
//     days out, labeled with the day.
//   - Calendar and sports chips drop off when the event ends; alert chips drop
//     off when the alert clears (the server only sends current alerts).
//   - All Family calendar events (statusBar.calendars in src/config/home.ts). TV channel on games, except F1.
//   - Vandenberg launches from Twilight (added Nov 3, 2026): today + the next 3 days
//     (statusBar.launchDays), in time order with everything else.
//     "Falcon 9 · Starlink · Thu 6:42 PM", or "Falcon 9 · Thu · time TBD" when only the day is known.
//     A launch drops off an hour after its time (or at the end of its day when the time isn't firm);
//     Twilight's feed already leaves out launched and scrubbed ones.

import { HOME, matchName } from '../config/home'
import { whenLabel, runLabel } from '../components/irrigation/scheduled'
import type { AlertItem, Category, CalendarEvent, HomeState, LaunchEvent, SportsEvent } from '../types'

export type StatusKind = 'alert' | 'calendar' | 'sports' | 'launch' | 'motion' | 'quickrun' | 'vacrun'

export interface StatusItem {
  id: string
  kind: StatusKind
  /** Small bold label before the text: "Now", "Tomorrow", "Sun" */
  label?: string
  text: string
  /** Time, channel… shown dimmer after the text */
  detail?: string
  /** Device category of an alert (decides where tapping goes) */
  category?: Category
  /** Sports: the game's page in The Brief. Launch: Twilight opened to that launch. Quick run: its details */
  href?: string | null
  /** Quick run waiting / missed: amber */
  warn?: boolean
}

const HOUR = 3_600_000
const startOfDay = (d: Date, plusDays = 0) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + plusDays); return x.getTime() }

/** "5 PM", "4:45 PM" */
function time(t: number) {
  const d = new Date(t)
  const h = d.getHours(), m = d.getMinutes()
  return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h >= 12 ? 'PM' : 'AM'}`
}

/** "4:45–5 PM", "11 AM–1 PM" */
function range(a: number, b: number | null) {
  if (b === null || b <= a) return time(a)
  const sameHalf = (new Date(a).getHours() >= 12) === (new Date(b).getHours() >= 12)
  return sameHalf ? `${time(a).replace(/ [AP]M$/, '')}–${time(b)}` : `${time(a)}–${time(b)}`
}

const weekday = (t: number) => new Date(t).toLocaleDateString('en-US', { weekday: 'short' })

/** How long a game or race lasts when the feed doesn't say */
const DEFAULT_LENGTH: Record<string, number> = { suns: 2.5 * HOUR, dbacks: 3 * HOUR, f1: 2 * HOUR }

interface Timed { item: StatusItem; at: number }

/** The Cameras page, opening that camera's live view (alert ids are cam-now-<camera> / cam-night-<camera>) */
function liveLink(alertId: string): string {
  const cam = /^cam-(?:now|night)-(camera\.[a-z0-9_]+)$/.exec(alertId)?.[1]
  return cam ? `/cameras?live=${encodeURIComponent(cam)}` : '/cameras'
}

export function statusItems(data: Pick<HomeState, 'alerts' | 'calendar' | 'sports' | 'launches'> & Partial<Pick<HomeState, 'irrigation' | 'vacuum'>>, now = new Date()): StatusItem[] {
  const nowMs = now.getTime()
  const today = startOfDay(now), tomorrow = startOfDay(now, 1), dayAfter = startOfDay(now, 2), bigLimit = startOfDay(now, 4)

  // 1. Device alerts, newest first
  const alerts: StatusItem[] = [...data.alerts]
    .sort((a: AlertItem, b: AlertItem) => b.timestamp.localeCompare(a.timestamp))
    .map((a): StatusItem => a.category === 'cameras' && a.severity === 'info'
      // Camera motion: its own camera-colored chip, not an amber alert. Tap = that camera's live view.
      ? (/ detected at /.test(a.message)
        // Overnight motion (10 PM–6 AM) stays until 9 AM: "Garage · Pet detected at 2:43 AM last night"
        ? { id: `alert-${a.id}`, kind: 'motion', label: a.deviceName, text: a.message, category: a.category, href: liveLink(a.id) }
        : { id: `alert-${a.id}`, kind: 'motion', text: `${a.message} · ${a.deviceName}`, detail: 'just now', category: a.category, href: liveLink(a.id) })
      : { id: `alert-${a.id}`, kind: 'alert', text: `${a.deviceName} · ${a.message}`, category: a.category })

  alerts.sort((a, b) => Number(b.kind === 'motion') - Number(a.kind === 'motion'))

  const timed: Timed[] = []

  // 2. Family calendar: today and tomorrow, until each event ends
  const inBar = (cal?: string) => !cal || HOME.statusBar.calendars.some((n) => !!matchName(n, [{ name: cal }]).item)
  for (const e of data.calendar as CalendarEvent[]) {
    if (!inBar(e.calendar)) continue
    const start = Date.parse(e.start)
    if (Number.isNaN(start)) continue
    const parsedEnd = e.end ? Date.parse(e.end) : NaN
    const end = e.allDay ? (Number.isNaN(parsedEnd) ? startOfDay(new Date(start), 1) : parsedEnd) : (Number.isNaN(parsedEnd) ? start + HOUR : parsedEnd)
    if (end <= nowMs || start >= dayAfter) continue
    const isTomorrow = start >= tomorrow
    const happening = start <= nowMs && !e.allDay
    timed.push({
      at: e.allDay ? Math.max(start, today) : start,
      item: {
        id: `cal-${e.id}`, kind: 'calendar',
        label: isTomorrow ? 'Tomorrow' : happening ? 'Now' : undefined,
        text: e.title,
        detail: e.allDay ? (isTomorrow ? 'All day' : 'Today') : happening ? `until ${time(end)}` : range(start, Number.isNaN(parsedEnd) ? null : parsedEnd),
      },
    })
  }

  // 3. Games and races from The Brief
  for (const g of (data.sports ?? []) as SportsEvent[]) {
    const start = Date.parse(g.start)
    if (Number.isNaN(start)) continue
    const end = g.end ? Date.parse(g.end) : start + (DEFAULT_LENGTH[g.kind] ?? 3 * HOUR)
    const big = g.big || g.kind === 'f1'
    if (end <= nowMs || start >= (big ? bigLimit : dayAfter)) continue
    const live = start <= nowMs
    const label = live ? 'Live' : start >= dayAfter ? weekday(start) : start >= tomorrow ? 'Tomorrow' : undefined
    const showChannel = g.channel && g.kind !== 'f1'
    timed.push({
      at: start,
      item: {
        id: `sport-${g.id}`, kind: 'sports', label, text: g.title, href: g.link ?? null,
        detail: [live ? null : time(start), showChannel ? g.channel : null].filter(Boolean).join(' · ') || undefined,
      },
    })
  }

  // 4. Vandenberg launches from Twilight
  const launchLimit = startOfDay(now, HOME.statusBar.launchDays + 1)
  for (const l of (data.launches ?? []) as LaunchEvent[]) {
    const t0 = Date.parse(l.t0)
    if (Number.isNaN(t0) || t0 >= launchLimit) continue
    const gone = l.firm ? t0 + HOUR : startOfDay(new Date(t0), 1)
    if (gone <= nowMs) continue
    const day = t0 < tomorrow ? 'Today' : t0 < dayAfter ? 'Tomorrow' : weekday(t0)
    const text = l.firm
      ? [l.vehicle, l.mission, `${day} ${time(t0)}`].filter(Boolean).join(' · ')
      : `${l.vehicle} · ${day} · time TBD`
    timed.push({ at: t0, item: { id: `launch-${l.id}`, kind: 'launch', text, href: l.url ?? HOME.statusBar.twilightUrl } })
  }

  timed.sort((a, b) => a.at - b.at)
  // Scheduled quick runs (kept by Panel): right after alerts, soonest first. Tap = details.
  //   "Quick run scheduled · Back Lawn 10m · Tomorrow 6:00 AM", "Quick run in 4 min",
  //   "Quick run waiting · Lawns is watering · starts after", "Quick run missed · Panel was off at 6:00 AM · Run now?"
  const quick: StatusItem[] = (data.irrigation?.scheduled ?? []).map((q) => {
    const at = Date.parse(q.at), mins = Math.round((at - nowMs) / 60_000)
    const what = runLabel(q)
    const href = `/irrigation?scheduled=${encodeURIComponent(q.id)}`
    if (q.state === 'missed') return { id: `quick-${q.id}`, kind: 'quickrun', label: 'Quick run missed', text: q.reason ?? what, detail: 'Run now?', href, warn: true }
    if (q.state === 'waiting') return { id: `quick-${q.id}`, kind: 'quickrun', label: 'Quick run waiting', text: q.reason ? `${q.reason} · starts after` : what, href, warn: true }
    if (mins <= 60) return { id: `quick-${q.id}`, kind: 'quickrun', label: mins <= 0 ? 'Quick run starting' : `Quick run in ${mins} min`, text: what, href }
    return { id: `quick-${q.id}`, kind: 'quickrun', label: 'Quick run scheduled', text: what, detail: whenLabel(at, nowMs), href }
  })

  // Scheduled vacuum cleans (kept by Panel): "Vacuum scheduled · Bedrooms · Wed 10:00 AM", "Vacuum in 4 min",
  //   amber "Vacuum skipped · clean water empty · Run now?", "Vacuum missed · Panel was off at 10:00 AM · Run now?"
  const vac: StatusItem[] = (data.vacuum?.scheduled ?? []).map((q) => {
    const at = Date.parse(q.at), mins = Math.round((at - nowMs) / 60_000)
    const href = `/vacuum?scheduled=${encodeURIComponent(q.id)}`
    if (q.state === 'skipped') return { id: `vac-${q.id}`, kind: 'vacrun', label: 'Vacuum skipped', text: q.reason ?? q.name, detail: 'Run now?', href, warn: true }
    if (q.state === 'missed') return { id: `vac-${q.id}`, kind: 'vacrun', label: 'Vacuum missed', text: q.reason ?? q.name, detail: 'Run now?', href, warn: true }
    if (mins <= 60) return { id: `vac-${q.id}`, kind: 'vacrun', label: mins <= 0 ? 'Vacuum starting' : `Vacuum in ${mins} min`, text: q.name, href }
    return { id: `vac-${q.id}`, kind: 'vacrun', label: 'Vacuum scheduled', text: q.name, detail: whenLabel(at, nowMs), href }
  })

  return [...alerts, ...quick, ...vac, ...timed.map((t) => t.item)]
}
