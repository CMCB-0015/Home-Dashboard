// The Google Family calendar, through Home Assistant. Refreshed every 5 minutes.

import type { CalendarEvent } from '../src/types.ts'
import { HOME, matchName } from '../src/config/home.ts'
import { ha } from './ha.ts'

const COLORS = ['#6fa8ff', '#7fd1b9', '#d6a0e0', '#d6b46a']
let events: CalendarEvent[] | null = null
let lastError: string | null = null

export const calendarEvents = () => events
export const calendarError = () => lastError

// All-day events come as "2026-10-22". Leave the time zone off so the
// tablet reads it as local midnight.
const when = (t: { dateTime?: string; date?: string } | undefined) => t?.dateTime ?? (t?.date ? `${t.date}T00:00:00` : null)

export async function refreshCalendar(): Promise<boolean> {
  if (ha.status !== 'connected') return false
  const cals = ha.all('calendar').map((c) => ({ id: c.entity_id, name: ha.name(c) }))
  const chosen = HOME.calendars.map((n) => matchName(n, cals).item).filter((c): c is { id: string; name: string } => !!c)
  if (!chosen.length) { lastError = `No calendar named ${HOME.calendars.join(' or ')} in Home Assistant`; events = null; return true }

  const start = new Date(); start.setHours(0, 0, 0, 0)
  const end = new Date(start.getTime() + 8 * 86_400_000)
  try {
    const lists = await Promise.all(chosen.map(async (cal, i) => {
      const res = await ha.rest(`/api/calendars/${cal.id}?start=${start.toISOString()}&end=${end.toISOString()}`)
      if (!res.ok) throw new Error(`Home Assistant returned ${res.status} for ${cal.name}`)
      const items = (await res.json()) as any[]
      return items.map((e, j): CalendarEvent => ({
        id: `${cal.id}-${e.uid ?? j}-${e.recurrence_id ?? ''}-${when(e.start)}`,
        title: String(e.summary ?? '(No title)'),
        location: e.location || null,
        start: when(e.start) ?? start.toISOString(),
        end: when(e.end),
        allDay: !e.start?.dateTime,
        color: COLORS[i % COLORS.length],
      }))
    }))
    events = lists.flat().sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    lastError = null
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e)
    console.warn('[calendar]', lastError)
  }
  return true
}
