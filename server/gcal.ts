// Panel's own link to Google Calendar, for adding, editing and deleting events.
//
// Reading events still comes from Home Assistant (server/calendar.ts). Home
// Assistant's Google connection can't change an existing event, so every
// change (add, edit, delete) goes straight to Google from here, one path for all.
//
// Linking is a one-time step (Calendar page → +): Panel opens Google's sign-in,
// Google sends the browser to a 127.0.0.1 address that doesn't load, and you
// paste that address back into Panel. (Google doesn't send its sign-in back to a
// plain home address like 192.168.86.207, and its TV-style code sign-in doesn't
// allow Calendar, so this copy-paste is the standard way for a home server.)
//
// The lasting sign-in is saved in Panel's /data folder (google-calendar.json),
// never in GitHub. Only outgoing calls to Google; nothing comes into the house.

import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DATA_DIR, env } from './env.ts'

// The addresses can be pointed at a stand-in Google while testing
const AUTH_URL = () => env('GOOGLE_AUTH_URL') ?? 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = () => env('GOOGLE_TOKEN_URL') ?? 'https://oauth2.googleapis.com/token'
const API = () => env('GOOGLE_CALENDAR_API') ?? 'https://www.googleapis.com/calendar/v3'
const SCOPE = 'https://www.googleapis.com/auth/calendar'
/** A "Desktop app" Google client accepts any 127.0.0.1 address; nothing needs to answer there */
const REDIRECT = 'http://127.0.0.1:8099/google-linked'
const FILE = join(DATA_DIR, 'google-calendar.json')

interface Saved { refreshToken: string; account: string | null; linkedAt: string }
export interface GCalendar { id: string; name: string; writable: boolean; timeZone: string | null; primary: boolean }

let saved: Saved | null = readSaved()
let access: { token: string; until: number } | null = null
let pending: { verifier: string; state: string; at: number } | null = null
let calendars: { at: number; list: GCalendar[] } | null = null
let problem: string | null = null

function readSaved(): Saved | null {
  try { return existsSync(FILE) ? (JSON.parse(readFileSync(FILE, 'utf8')) as Saved) : null } catch { return null }
}
function writeSaved(s: Saved | null) {
  saved = s
  access = null
  calendars = null
  if (!s) { try { unlinkSync(FILE) } catch { /* already gone */ } return }
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(FILE + '.tmp', JSON.stringify(s), { mode: 0o600 })
  renameSync(FILE + '.tmp', FILE)
}

const clientId = () => env('GOOGLE_CLIENT_ID')
const clientSecret = () => env('GOOGLE_CLIENT_SECRET')
export const gcalConfigured = () => !!(clientId() && clientSecret())
export const gcalLinked = () => gcalConfigured() && !!saved

/** For the dashboard: can Panel change events, and if not, why */
export function gcalStatus() {
  return {
    configured: gcalConfigured(),
    linked: gcalLinked(),
    account: saved?.account ?? null,
    problem,
  }
}

const b64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** Step 1 of linking: the Google sign-in address to open */
export function linkStart(): { url: string } {
  if (!gcalConfigured()) throw new Error('Add the Google client ID and secret in Panel’s Configuration tab first')
  const verifier = b64url(randomBytes(48))
  const state = b64url(randomBytes(12))
  pending = { verifier, state, at: Date.now() }
  const q = new URLSearchParams({
    client_id: clientId()!, redirect_uri: REDIRECT, response_type: 'code', scope: SCOPE,
    access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true',
    code_challenge: b64url(createHash('sha256').update(verifier).digest()), code_challenge_method: 'S256', state,
  })
  return { url: `${AUTH_URL()}?${q}` }
}

/** Pull the one-time code out of whatever was pasted: the whole address, part of it, or just the code */
export function codeFromPaste(text: string): { code: string; state: string | null } {
  const t = text.trim()
  if (!t) throw new Error('Paste the address Google sent you to')
  const query = t.includes('?') ? t.slice(t.indexOf('?') + 1) : t.includes('code=') ? t : ''
  if (query) {
    const p = new URLSearchParams(query.split('#')[0])
    if (p.get('error')) throw new Error(p.get('error') === 'access_denied' ? 'Google sign-in was cancelled — start again' : `Google said: ${p.get('error')}`)
    const code = p.get('code')
    if (!code) throw new Error('That address has no sign-in code in it — copy the whole address from the top of the page Google opened')
    return { code, state: p.get('state') }
  }
  if (/\s/.test(t) || t.length < 10) throw new Error('That doesn’t look like the address Google sent you to')
  return { code: t, state: null }
}

/** Step 2 of linking: swap the pasted code for a lasting sign-in */
export async function linkFinish(pasted: string) {
  if (!gcalConfigured()) throw new Error('Add the Google client ID and secret in Panel’s Configuration tab first')
  const { code, state } = codeFromPaste(pasted)
  if (!pending || Date.now() - pending.at > 20 * 60_000) throw new Error('That sign-in took too long — tap “Open Google sign-in” again')
  if (state && state !== pending.state) throw new Error('That address is from an older sign-in — use the newest one')
  const res = await fetch(TOKEN_URL(), {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId()!, client_secret: clientSecret()!, redirect_uri: REDIRECT, grant_type: 'authorization_code', code_verifier: pending.verifier }),
  })
  const body = await res.json().catch(() => ({})) as any
  if (!res.ok) throw new Error(body.error === 'invalid_grant' ? 'Google didn’t accept that code (each one works once) — start again' : `Google said: ${body.error_description ?? body.error ?? res.status}`)
  if (!body.refresh_token) throw new Error('Google didn’t give Panel a lasting sign-in. Remove Panel at myaccount.google.com/permissions, then link again.')
  pending = null
  writeSaved({ refreshToken: body.refresh_token, account: null, linkedAt: new Date().toISOString() })
  access = { token: body.access_token, until: Date.now() + (Number(body.expires_in) || 3600) * 1000 - 60_000 }
  problem = null
  // Which Google account it is (the primary calendar's id is the account's address)
  try {
    const primary = (await listCalendars(true)).find((c) => c.primary)
    if (primary && saved) writeSaved({ ...saved, account: primary.id })
  } catch { /* shown later if it matters */ }
}

export function unlink() { writeSaved(null); problem = null }

async function token(): Promise<string> {
  if (!gcalConfigured()) throw new Error('Add the Google client ID and secret in Panel’s Configuration tab')
  if (!saved) throw new Error('Link Google Calendar first')
  if (access && Date.now() < access.until) return access.token
  const res = await fetch(TOKEN_URL(), {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: saved.refreshToken, client_id: clientId()!, client_secret: clientSecret()!, grant_type: 'refresh_token' }),
  }).catch(() => { throw new Error('Couldn’t reach Google — check the internet connection') })
  const body = await res.json().catch(() => ({})) as any
  if (!res.ok) {
    if (body.error === 'invalid_grant') {
      writeSaved(null)
      problem = 'The Google sign-in expired or was removed — link Google Calendar again'
      throw new Error(problem)
    }
    throw new Error(`Google sign-in failed: ${body.error_description ?? body.error ?? res.status}`)
  }
  access = { token: body.access_token, until: Date.now() + (Number(body.expires_in) || 3600) * 1000 - 60_000 }
  problem = null
  return access.token
}

/** Google's reasons, in plain words */
function reason(status: number, body: any): string {
  const msg: string = body?.error?.message ?? ''
  if (status === 403 && /writer access|access|forbidden|permission/i.test(msg)) return 'You can’t change events on that calendar'
  if (status === 404 || status === 410) return 'Google couldn’t find that event — it may have been changed or deleted elsewhere'
  if (status === 409) return 'Google says that event already exists'
  if (status === 429 || /rate limit/i.test(msg)) return 'Google is busy — try again in a minute'
  return msg ? `Google said: ${msg}` : `Google returned ${status}`
}

async function api<T = any>(method: string, path: string, body?: unknown, query?: Record<string, string>): Promise<T> {
  const url = `${API()}${path}${query ? `?${new URLSearchParams(query)}` : ''}`
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${await token()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => { throw new Error('Couldn’t reach Google — check the internet connection') })
    if (res.status === 401 && attempt === 0) { access = null; continue }
    if (res.status === 204) return undefined as T
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(reason(res.status, json))
    return json as T
  }
  throw new Error('Google sign-in failed — link Google Calendar again')
}

/** The Google calendars this account can see (kept 10 minutes) */
export async function listCalendars(force = false): Promise<GCalendar[]> {
  if (!force && calendars && Date.now() - calendars.at < 10 * 60_000) return calendars.list
  const out: GCalendar[] = []
  let pageToken: string | undefined
  do {
    const r: any = await api('GET', '/users/me/calendarList', undefined, { maxResults: '250', ...(pageToken ? { pageToken } : {}) })
    for (const c of r.items ?? []) {
      out.push({
        id: c.id, name: String(c.summaryOverride ?? c.summary ?? c.id),
        writable: c.accessRole === 'owner' || c.accessRole === 'writer',
        timeZone: c.timeZone ?? null, primary: !!c.primary,
      })
    }
    pageToken = r.nextPageToken
  } while (pageToken)
  calendars = { at: Date.now(), list: out }
  return out
}

export const cachedCalendars = () => calendars?.list ?? null

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

/** The Google calendar behind one of Home Assistant's calendars (matched by name) */
export async function googleCalendarFor(haId: string, haName: string): Promise<GCalendar> {
  const list = await listCalendars()
  const slug = haId.replace(/^calendar\./, '')
  const found = list.find((c) => norm(c.name) === norm(haName))
    ?? list.find((c) => norm(c.name) === norm(slug))
    ?? list.find((c) => norm(c.id) === norm(slug))
  if (!found) throw new Error(`Couldn’t find “${haName}” in your Google calendars`)
  return found
}

// ── Events ─────────────────────────────────────────────────────────────────

export interface EventFields {
  title: string
  allDay: boolean
  /** Timed: ISO date-time with offset. All-day: YYYY-MM-DD (end is the last day, inclusive) */
  start: string
  end: string
  location: string | null
  description: string | null
  timeZone: string
}

const plusDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Our fields → Google's event body */
export function toGoogle(f: EventFields) {
  const title = f.title.trim() || '(No title)'
  if (f.allDay) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.start) || !/^\d{4}-\d{2}-\d{2}$/.test(f.end) || f.end < f.start) throw new Error('Pick a start and end day')
    return {
      summary: title, location: f.location?.trim() || null, description: f.description?.trim() || null,
      start: { date: f.start, dateTime: null, timeZone: null }, end: { date: plusDays(f.end, 1), dateTime: null, timeZone: null },
    }
  }
  const s = Date.parse(f.start), e = Date.parse(f.end)
  if (Number.isNaN(s) || Number.isNaN(e)) throw new Error('Pick a start and end time')
  if (e <= s) throw new Error('The event has to end after it starts')
  return {
    summary: title, location: f.location?.trim() || null, description: f.description?.trim() || null,
    start: { dateTime: f.start, timeZone: f.timeZone, date: null }, end: { dateTime: f.end, timeZone: f.timeZone, date: null },
  }
}

export const getEvent = (calId: string, eventId: string) => api('GET', `/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}`)

/** The event Home Assistant calls uid (+ recurrence id) */
export async function findEvent(calId: string, uid: string | null, recurrenceId: string | null): Promise<any> {
  if (recurrenceId) {
    try { return await getEvent(calId, recurrenceId) } catch { /* fall back to the series' id below */ }
  }
  if (!uid) throw new Error('Google couldn’t find that event — it may have been changed or deleted elsewhere')
  const r: any = await api('GET', `/calendars/${encodeURIComponent(calId)}/events`, undefined, { iCalUID: uid, maxResults: '5' })
  const items: any[] = (r.items ?? []).filter((e: any) => e.status !== 'cancelled')
  const ev = items.find((e) => !e.recurringEventId) ?? items[0]
  if (!ev) throw new Error('Google couldn’t find that event — it may have been changed or deleted elsewhere')
  return ev
}

/** Leave out empty fields (a patch keeps them, as null clears a field there) */
function dropNulls<T>(o: T): T {
  if (Array.isArray(o) || o === null || typeof o !== 'object') return o
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => [k, dropNulls(v)])) as T
}

export async function insertEvent(calId: string, f: EventFields) {
  return api('POST', `/calendars/${encodeURIComponent(calId)}/events`, dropNulls(toGoogle(f)))
}

export async function patchEvent(calId: string, eventId: string, body: Record<string, unknown>) {
  return api('PATCH', `/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}`, body)
}

export async function deleteEvent(calId: string, eventId: string) {
  return api('DELETE', `/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}`)
}

/** Move an event to another calendar (keeps its id) */
export async function moveEvent(fromCal: string, eventId: string, toCal: string) {
  return api('POST', `/calendars/${encodeURIComponent(fromCal)}/events/${encodeURIComponent(eventId)}/move`, undefined, { destination: toCal })
}

/** Stop a repeating series before this occurrence ("this and following"). Returns false when it's the first one. */
export async function endSeriesBefore(calId: string, instance: any): Promise<boolean> {
  const master = await getEvent(calId, instance.recurringEventId)
  const firstStart = master.start?.dateTime ?? master.start?.date
  const thisStart = instance.originalStartTime?.dateTime ?? instance.originalStartTime?.date ?? instance.start?.dateTime ?? instance.start?.date
  if (!thisStart || !firstStart) throw new Error('Google didn’t say when this repeat starts')
  if (Date.parse(thisStart) <= Date.parse(firstStart)) return false
  const allDay = !!instance.originalStartTime?.date || !!instance.start?.date
  // The day before (all-day) or the second before (timed) this occurrence
  const until = allDay
    ? plusDays(String(thisStart).slice(0, 10), -1).replace(/-/g, '')
    : new Date(Date.parse(thisStart) - 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const recurrence: string[] = (master.recurrence ?? []).map((line: string) => {
    if (!line.startsWith('RRULE:')) return line
    const parts = line.slice(6).split(';').filter((p) => !/^(UNTIL|COUNT)=/.test(p))
    return `RRULE:${[...parts, `UNTIL=${until}`].join(';')}`
  })
  await patchEvent(calId, master.id, { recurrence })
  return true
}
