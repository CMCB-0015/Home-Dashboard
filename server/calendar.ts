// Google calendars, through Home Assistant. Refreshed every 5 minutes.
//
// The live state carries this month and next (plus a week either side) so the
// week and month views open instantly. Other months are fetched on demand
// through /api/calendar/range.

import type { CalendarEvent, CalendarInfo } from '../src/types.ts'
import { HOME, matchName } from '../src/config/home.ts'
import { ha } from './ha.ts'

// Picked so neighbouring calendars never look alike; Family is pinned blue in the config
const PALETTE = ['#6fa8ff', '#7fd1b9', '#e0a1c8', '#f2c14e', '#b49cf0', '#ef8f6f', '#5fd0e0', '#c5d36a']
const DAY = 86_400_000

let events: CalendarEvent[] | null = null
let shown: CalendarInfo[] = []
let range: { start: string; end: string } | null = null
let lastError: string | null = null

export const calendarEvents = () => events
export const calendarList = () => shown
export const calendarRange = () => range
export const calendarError = () => lastError

// All-day events come as "2026-10-22". Leave the time zone off so the
// tablet reads it as local midnight.
const when = (t: { dateTime?: string; date?: string } | undefined) => t?.dateTime ?? (t?.date ? `${t.date}T00:00:00` : null)

/** Google sends some descriptions as HTML: keep the words and links, drop the markup */
function plain(text: unknown): string | null {
  if (typeof text !== 'string' || !text.trim()) return null
  const s = text
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n').replace(/<li>/gi, '• ')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, (_m, href: string, label: string) => {
      const bare = (u: string) => u.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '').toLowerCase()
      const text = label.replace(/<[^>]+>/g, '').trim()
      return text && bare(text) !== bare(href) ? `${text} (${href})` : href
    })
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n').trim()
  return s.slice(0, 4000) || null
}

/** Which calendars to show, each with its color */
function pickCalendars(): CalendarInfo[] {
  const all = ha.all('calendar').map((c) => ({ id: c.entity_id, name: ha.name(c), platform: ha.platform(c.entity_id) }))
  const hidden = (n: string) => HOME.hiddenCalendars.some((h) => matchName(h, [{ name: n }]).item)
  let chosen: { id: string; name: string }[]
  if (HOME.calendars.includes('*')) {
    // Every Google calendar (other integrations' calendars, like Rachio or Todoist, stay out)
    chosen = all.filter((c) => (c.platform ?? 'google') === 'google' && !hidden(c.name))
  } else {
    chosen = HOME.calendars.map((n) => matchName(n, all).item).filter((c): c is (typeof all)[number] => !!c)
  }
  chosen.sort((a, b) => (/family/i.test(a.name) ? -1 : /family/i.test(b.name) ? 1 : a.name.localeCompare(b.name)))
  const used = new Set(Object.values(HOME.calendarColors))
  const free = PALETTE.filter((c) => !used.has(c))
  let k = 0
  return chosen.map((c) => {
    const pinned = Object.entries(HOME.calendarColors).find(([n]) => matchName(n, [c]).item)?.[1]
    return { id: c.id, name: c.name, color: pinned ?? free[k++ % free.length] }
  })
}

async function fetchEvents(cals: CalendarInfo[], start: Date, end: Date): Promise<CalendarEvent[]> {
  const lists = await Promise.all(cals.map(async (cal) => {
    const res = await ha.rest(`/api/calendars/${cal.id}?start=${start.toISOString()}&end=${end.toISOString()}`)
    if (!res.ok) throw new Error(`Home Assistant returned ${res.status} for ${cal.name}`)
    const items = (await res.json()) as any[]
    return items.map((e, j): CalendarEvent => ({
      id: `${cal.id}-${e.uid ?? j}-${e.recurrence_id ?? ''}-${when(e.start)}`,
      title: String(e.summary ?? '(No title)'),
      location: typeof e.location === 'string' && e.location.trim() ? e.location.trim() : null,
      description: plain(e.description),
      start: when(e.start) ?? start.toISOString(),
      end: when(e.end),
      allDay: !e.start?.dateTime,
      color: cal.color,
      calendar: cal.name,
    }))
  }))
  return lists.flat().sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
}

export async function refreshCalendar(): Promise<boolean> {
  if (ha.status !== 'connected') return false
  shown = pickCalendars()
  if (!shown.length) {
    lastError = HOME.calendars.includes('*') ? 'No Google calendars in Home Assistant' : `No calendar named ${HOME.calendars.join(' or ')} in Home Assistant`
    events = null
    return true
  }
  // From a week before this month to a week after next month
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const start = new Date(today.getFullYear(), today.getMonth(), 1 - 7)
  const end = new Date(today.getFullYear(), today.getMonth() + 2, 1 + 7)
  try {
    events = await fetchEvents(shown, start, end)
    range = { start: start.toISOString(), end: end.toISOString() }
    lastError = null
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e)
    console.warn('[calendar]', lastError)
  }
  return true
}

/** Events for any stretch of up to about 3 months (the month view, when you page away) */
export async function calendarRangeEvents(startIso: string, endIso: string): Promise<CalendarEvent[]> {
  const start = new Date(startIso), end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || end.getTime() - start.getTime() > 100 * DAY) {
    throw new Error('Pick a range of up to 3 months')
  }
  if (!shown.length) shown = pickCalendars()
  return fetchEvents(shown, start, end)
}
