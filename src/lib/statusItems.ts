// What goes in the status bar at the top of the Home page (baseline rules,
// decided October 24, 2026 — to be refined after living with it):
//   - Order: device alerts first, then today's calendar items and games in time
//     order, then tomorrow's items labeled "Tomorrow", then big events further out.
//   - Look-ahead: today + tomorrow; big events (F1 races, golf majors) up to 3
//     days out, labeled with the day.
//   - Calendar and sports chips drop off when the event ends; alert chips drop
//     off when the alert clears (the server only sends current alerts).
//   - All Family calendar events (statusBar.calendars in src/config/home.ts). TV channel on games, except F1.

import { HOME, matchName } from '../config/home'
import type { AlertItem, Category, CalendarEvent, HomeState, SportsEvent } from '../types'

export type StatusKind = 'alert' | 'calendar' | 'sports'

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
  /** Sports: the game's page in The Brief */
  href?: string | null
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

export function statusItems(data: Pick<HomeState, 'alerts' | 'calendar' | 'sports'>, now = new Date()): StatusItem[] {
  const nowMs = now.getTime()
  const today = startOfDay(now), tomorrow = startOfDay(now, 1), dayAfter = startOfDay(now, 2), bigLimit = startOfDay(now, 4)

  // 1. Device alerts, newest first
  const alerts: StatusItem[] = [...data.alerts]
    .sort((a: AlertItem, b: AlertItem) => b.timestamp.localeCompare(a.timestamp))
    .map((a) => ({ id: `alert-${a.id}`, kind: 'alert', text: `${a.deviceName} · ${a.message}`, category: a.category }))

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

  timed.sort((a, b) => a.at - b.at)
  return [...alerts, ...timed.map((t) => t.item)]
}
