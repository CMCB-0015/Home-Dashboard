// Google calendars, through Home Assistant. Refreshed every 5 minutes.
//
// The live state carries this month and next (plus a week either side) so the
// week and month views open instantly. Other months are fetched on demand
// through /api/calendar/range.
//
// Adding, editing and deleting go straight to Google (server/gcal.ts). Home
// Assistant only notices a change on its next sync, so until it does, each
// change is laid over Home Assistant's list here (marked "saving" for a new or
// changed event) and Home Assistant is asked to sync right away.

import type { CalendarEvent, CalendarInfo } from '../src/types.ts'
import { HOME, matchName } from '../src/config/home.ts'
import { ha } from './ha.ts'
import {
  cachedCalendars, deleteEvent, endSeriesBefore, findEvent, gcalLinked, getEvent, googleCalendarFor, insertEvent,
  listCalendars, moveEvent, patchEvent, toGoogle, type EventFields,
} from './gcal.ts'

// Picked so neighbouring calendars never look alike; Family is pinned blue in the config
const PALETTE = ['#6fa8ff', '#7fd1b9', '#e0a1c8', '#f2c14e', '#b49cf0', '#ef8f6f', '#5fd0e0', '#c5d36a']
const DAY = 86_400_000

let events: CalendarEvent[] | null = null
let shown: CalendarInfo[] = []
let range: { start: string; end: string } | null = null
let lastError: string | null = null
let onChanged: () => void = () => {}

export const calendarEvents = () => (events ? withChanges(events, range) : null)
export const calendarList = () => shown.map((c) => ({ ...c, writable: writable(c) }))
export const calendarRange = () => range
export const calendarError = () => lastError
/** Let open screens know when a change lands */
export function onCalendarChange(fn: () => void) { onChanged = fn }

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

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
/** Can Panel change events on this calendar? (Needs the Google link; holidays and read-only shares can't.) */
function writable(c: CalendarInfo): boolean {
  if (!gcalLinked()) return false
  const list = cachedCalendars()
  if (!list) return !/holiday|birthday/i.test(c.name)
  const slug = c.id.replace(/^calendar\./, '')
  const g = list.find((x) => norm(x.name) === norm(c.name)) ?? list.find((x) => norm(x.name) === norm(slug) || norm(x.id) === norm(slug))
  return !!g?.writable
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
      calendarId: cal.id,
      uid: e.uid ?? null,
      recurrenceId: e.recurrence_id ?? null,
      repeating: !!(e.recurrence_id || e.rrule),
    }))
  }))
  return lists.flat().sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
}

export async function refreshCalendar(): Promise<boolean> {
  if (ha.status !== 'connected') return false
  shown = pickCalendars()
  if (gcalLinked()) void listCalendars().catch(() => { /* shown when a change is tried */ })
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
    settleChanges(events)
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
  return withChanges(await fetchEvents(shown, start, end), { start: start.toISOString(), end: end.toISOString() })
}

// ── Changes made from the dashboard ─────────────────────────────────────────

/** A change Google has and Home Assistant may not have yet */
interface Change {
  at: number
  kind: 'add' | 'update' | 'delete'
  /** add / update: the event as Google now has it */
  event?: CalendarEvent
  /** update / delete: which of Home Assistant's events it replaces or removes */
  match: (e: CalendarEvent) => boolean
}
let changes: Change[] = []
const KEEP_MS = 15 * 60_000

/** A newer change to the same event replaces the older one */
const supersede = (uid: string | null, recurrenceId: string | null) => {
  if (uid) changes = changes.filter((c) => !(c.event && c.event.uid === uid && (recurrenceId === null || (c.event.recurrenceId ?? null) === recurrenceId)))
}

const sameEvent = (calId: string, uid: string | null | undefined, recurrenceId: string | null | undefined) =>
  (e: CalendarEvent) => e.calendarId === calId && !!uid && e.uid === uid && (e.recurrenceId ?? null) === (recurrenceId ?? null)

function withChanges(list: CalendarEvent[], span: { start: string; end: string } | null): CalendarEvent[] {
  changes = changes.filter((c) => Date.now() - c.at < KEEP_MS)
  if (!changes.length) return list
  let out = list
  for (const c of changes) {
    if (c.kind !== 'add') out = out.filter((e) => !c.match(e))
    if (c.event) {
      const e = c.event
      const inSpan = !span || (Date.parse(e.start) < Date.parse(span.end) && Date.parse(e.end ?? e.start) >= Date.parse(span.start))
      if (inSpan && !out.some(sameEvent(e.calendarId!, e.uid, e.recurrenceId))) out = [...out, e]
    }
  }
  return out.slice().sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
}

/** Drop changes Home Assistant now shows on its own */
function settleChanges(fresh: CalendarEvent[]) {
  // Same series and same start (a moved series gives its occurrences new ids)
  const shownInHa = (e: CalendarEvent) => fresh.some((f) => f.calendarId === e.calendarId && !!e.uid && f.uid === e.uid
    && f.title === e.title && Date.parse(f.start) === Date.parse(e.start) && (f.location ?? null) === (e.location ?? null))
  changes = changes.filter((c) => {
    if (Date.now() - c.at >= KEEP_MS) return false
    if (c.kind === 'delete') return fresh.some(c.match)
    return !(c.event && shownInHa(c.event))
  })
}

/** Ask Home Assistant to sync with Google now, then read its list again */
function syncSoon(haId: string) {
  void ha.callService('homeassistant', 'update_entity', {}, [haId]).catch(() => { /* its own sync catches up */ })
  for (const ms of [2_500, 10_000, 45_000]) setTimeout(() => { void refreshCalendar().then(() => onChanged()) }, ms)
  onChanged()
}

function calInfo(haId: string): CalendarInfo {
  const cal = (shown.length ? shown : (shown = pickCalendars())).find((c) => c.id === haId)
  if (!cal) throw new Error('That calendar isn’t on the dashboard')
  return cal
}

async function googleCal(haId: string, forWriting = true) {
  const cal = calInfo(haId)
  const g = await googleCalendarFor(cal.id, cal.name)
  if (forWriting && !g.writable) throw new Error(`You can’t change events on ${cal.name}`)
  return { cal, g }
}

/** Google's event → the dashboard's */
function fromGoogle(g: any, cal: CalendarInfo): CalendarEvent {
  return {
    id: `${cal.id}-${g.iCalUID}-${g.recurringEventId ? g.id : ''}-${when(g.start)}`,
    title: String(g.summary ?? '(No title)'),
    location: typeof g.location === 'string' && g.location.trim() ? g.location.trim() : null,
    description: plain(g.description),
    start: when(g.start) ?? new Date().toISOString(),
    end: when(g.end),
    allDay: !g.start?.dateTime,
    color: cal.color, calendar: cal.name, calendarId: cal.id,
    uid: g.iCalUID ?? null,
    recurrenceId: g.recurringEventId ? g.id : null,
    repeating: !!(g.recurringEventId || g.recurrence?.length),
    saving: true,
  }
}

const fields = (b: any): EventFields => ({
  title: String(b?.title ?? '').slice(0, 500),
  allDay: !!b?.allDay,
  start: String(b?.start ?? ''),
  end: String(b?.end ?? ''),
  location: typeof b?.location === 'string' ? b.location.slice(0, 1000) : null,
  description: typeof b?.description === 'string' ? b.description.slice(0, 8000) : null,
  timeZone: typeof b?.timeZone === 'string' && /^[A-Za-z_]+\/[A-Za-z_\/+-]+$|^UTC$/.test(b.timeZone) ? b.timeZone : 'America/Los_Angeles',
})

interface Key { calendarId?: unknown; uid?: unknown; recurrenceId?: unknown }
const keyOf = (k: Key) => ({
  calendarId: String(k?.calendarId ?? ''),
  uid: typeof k?.uid === 'string' ? k.uid : null,
  recurrenceId: typeof k?.recurrenceId === 'string' ? k.recurrenceId : null,
})

/** New event */
export async function createEvent(b: { calendarId?: unknown } & Record<string, unknown>): Promise<CalendarEvent> {
  const { cal, g } = await googleCal(String(b.calendarId ?? ''))
  const made = await insertEvent(g.id, fields(b))
  const ev = fromGoogle(made, cal)
  changes.push({ at: Date.now(), kind: 'add', event: ev, match: () => false })
  syncSoon(cal.id)
  return ev
}

/** Change an event. scope 'one' = this event (or this occurrence); 'all' = every occurrence of a repeating event. */
export async function updateEvent(b: { key?: Key; scope?: unknown; moveTo?: unknown } & Record<string, unknown>): Promise<CalendarEvent> {
  const key = keyOf(b.key ?? {})
  const { cal, g } = await googleCal(key.calendarId)
  const f = fields(b)
  const body = toGoogle(f)
  let ev = await findEvent(g.id, key.uid, key.recurrenceId)

  // Another calendar: only for one-time events (Google can't move one occurrence)
  const moveTo = typeof b.moveTo === 'string' && b.moveTo !== cal.id ? b.moveTo : null
  let target = { cal, g }
  if (moveTo) {
    if (ev.recurringEventId || ev.recurrence?.length) throw new Error('A repeating event can’t move to another calendar from here — do it in Google Calendar')
    target = await googleCal(moveTo)
    ev = await moveEvent(g.id, ev.id, target.g.id)
  }

  supersede(key.uid, b.scope === 'all' ? null : key.recurrenceId)
  let result: any
  if (b.scope === 'all' && ev.recurringEventId) {
    // Every occurrence: shift the series by however much this occurrence moved
    const master = await getEvent(g.id, ev.recurringEventId)
    const orig = ev.originalStartTime?.dateTime ?? ev.originalStartTime?.date ?? ev.start?.dateTime ?? ev.start?.date
    const patch: Record<string, unknown> = { summary: body.summary, location: body.location, description: body.description }
    if (f.allDay === !!master.start?.date) {
      if (f.allDay) {
        const shift = Math.round((Date.parse(`${f.start}T12:00:00Z`) - Date.parse(`${String(orig).slice(0, 10)}T12:00:00Z`)) / DAY)
        const days = Math.round((Date.parse(`${f.end}T12:00:00Z`) - Date.parse(`${f.start}T12:00:00Z`)) / DAY) + 1
        const s = new Date(Date.parse(`${master.start.date}T12:00:00Z`) + shift * DAY).toISOString().slice(0, 10)
        const e = new Date(Date.parse(`${s}T12:00:00Z`) + days * DAY).toISOString().slice(0, 10)
        patch.start = { date: s }; patch.end = { date: e }
      } else {
        const shift = Date.parse(f.start) - Date.parse(orig)
        const length = Date.parse(f.end) - Date.parse(f.start)
        const s = Date.parse(master.start.dateTime) + shift
        const tz = master.start.timeZone ?? f.timeZone
        patch.start = { dateTime: new Date(s).toISOString(), timeZone: tz }
        patch.end = { dateTime: new Date(s + length).toISOString(), timeZone: tz }
      }
    } else {
      throw new Error('Switching a repeating event between all-day and timed has to be done in Google Calendar')
    }
    result = await patchEvent(g.id, master.id, patch)
    // Show this occurrence changed right away; the rest follow when Home Assistant syncs (seconds)
    const inst = { ...ev, summary: body.summary, location: body.location, description: body.description, start: body.start, end: body.end }
    changes.push({ at: Date.now(), kind: 'update', event: fromGoogle(inst, cal), match: sameEvent(cal.id, key.uid, key.recurrenceId) })
  } else {
    result = await patchEvent(target.g.id, ev.id, body)
    changes.push({ at: Date.now(), kind: 'update', event: fromGoogle(result, target.cal), match: sameEvent(cal.id, key.uid, key.recurrenceId) })
  }
  syncSoon(cal.id)
  if (target.cal.id !== cal.id) syncSoon(target.cal.id)
  return fromGoogle(result, target.cal)
}

/** Delete an event. scope 'one' = this event (or this occurrence); 'following' = this and later occurrences. */
export async function removeEvent(b: { key?: Key; scope?: unknown }) {
  const key = keyOf(b.key ?? {})
  const { cal, g } = await googleCal(key.calendarId)
  const ev = await findEvent(g.id, key.uid, key.recurrenceId)
  supersede(key.uid, b.scope === 'following' ? null : key.recurrenceId)
  if (b.scope === 'following' && ev.recurringEventId) {
    const from = Date.parse(ev.originalStartTime?.dateTime ?? ev.originalStartTime?.date ?? ev.start?.dateTime ?? ev.start?.date)
    const kept = await endSeriesBefore(g.id, ev)
    if (!kept) await deleteEvent(g.id, ev.recurringEventId)
    changes.push({ at: Date.now(), kind: 'delete', match: (e) => e.calendarId === cal.id && e.uid === key.uid && Date.parse(e.start) >= from })
  } else {
    await deleteEvent(g.id, ev.id)
    changes.push({ at: Date.now(), kind: 'delete', match: sameEvent(cal.id, key.uid, key.recurrenceId) })
  }
  syncSoon(cal.id)
}
