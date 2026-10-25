// Sports for the status bar, from Connor's sports app "The Brief".
//
// The Brief publishes a small schedule feed. The Lenovo reads it every 15
// minutes — an outgoing request, so the house stays local-only. The feed is
// protected by a shared key: The Brief has it as the Netlify variable
// PANEL_FEED_KEY, and Panel sends it in the x-feed-key header from the app's
// Configuration tab (brief_feed_key). The key never goes into GitHub.
//
// No key, or the feed answers with an error → no sports chips; the bar shows
// calendar items and alerts only, and /api/setup-check says why.
//
// The parser is forgiving about field names, so small changes on The Brief's
// side don't break the bar. Each item needs a title and a start time; it can
// have an end, a TV channel, a "major" flag and a link into The Brief.

import type { SportsEvent } from '../src/types.ts'
import { HOME } from '../src/config/home.ts'
import { env } from './env.ts'

let events: SportsEvent[] = []
let lastError: string | null = null
let lastOk: string | null = null

export const sportsEvents = () => events
export const sportsError = () => lastError

const feedUrl = () => env('SPORTS_FEED_URL') || HOME.statusBar.sportsFeedUrl
const feedKey = () => env('BRIEF_FEED_KEY')

const str = (v: unknown, max = 120) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : typeof v === 'number' ? String(v) : null)
const first = (o: any, keys: string[]) => { for (const k of keys) if (o?.[k] !== undefined && o[k] !== null && o[k] !== '') return o[k]; return null }
const time = (v: unknown) => { const s = str(v, 60); return s && !Number.isNaN(Date.parse(s)) ? s : null }

/** suns · dbacks · f1 · golf · major — from whatever The Brief calls the sport or league */
function kindOf(raw: string, title: string): string {
  const t = `${raw} ${title}`.toLowerCase()
  if (/\bf1\b|formula/.test(t)) return 'f1'
  if (/suns|\bnba\b/.test(t)) return 'suns'
  if (/d-?backs|diamondbacks|\bmlb\b/.test(t)) return 'dbacks'
  if (/golf|pga|masters|open championship|ryder|lpga|dp world/.test(t)) return 'golf'
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20) || 'major'
}

/** Read one feed item, or null if it's missing a title or start time */
export function parseSportsItem(e: any): SportsEvent | null {
  const title = str(first(e, ['title', 'shortTitle', 'short_title', 'name', 'label']))
  const start = time(first(e, ['start', 'startTime', 'start_time', 'startsAt', 'starts_at', 'time', 'date']))
  if (!title || !start) return null
  const kind = kindOf(String(first(e, ['kind', 'sport', 'league', 'category', 'type']) ?? ''), title)
  const majorRaw = first(e, ['big', 'major', 'isMajor', 'is_major'])
  const link = str(first(e, ['link', 'url', 'href']), 500)
  return {
    id: str(first(e, ['id', 'key', 'uid']), 80) ?? `${title}-${start}`,
    kind,
    title,
    start,
    end: time(first(e, ['end', 'endTime', 'end_time', 'expectedEnd', 'expected_end', 'endsAt', 'ends_at'])),
    channel: kind === 'f1' ? null : str(first(e, ['channel', 'tv', 'network', 'broadcast']), 30),
    big: majorRaw === true || majorRaw === 'true' || kind === 'f1',
    link: link && /^https:\/\//.test(link) ? link : null,
  }
}

export function parseSportsFeed(body: any): SportsEvent[] {
  const list = Array.isArray(body) ? body : first(body, ['items', 'events', 'schedule', 'games']) ?? []
  return (Array.isArray(list) ? list : []).map(parseSportsItem).filter((x): x is SportsEvent => !!x).slice(0, 100)
}

export async function refreshSports(): Promise<boolean> {
  const url = feedUrl()
  if (!url) { lastError = 'No schedule feed address in src/config/home.ts'; return false }
  const key = feedKey()
  if (!key) {
    const had = events.length > 0
    events = []
    lastError = "No brief_feed_key in the app's Configuration tab, so sports chips are off"
    return had
  }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { Accept: 'application/json', 'x-feed-key': key } })
    if (res.status === 401) throw new Error("The Brief didn't accept the feed key — check brief_feed_key against PANEL_FEED_KEY in The Brief's Netlify settings")
    if (res.status === 503) throw new Error("The Brief's PANEL_FEED_KEY isn't set in its Netlify settings")
    if (!res.ok) throw new Error(`The Brief's schedule answered ${res.status}`)
    events = parseSportsFeed(await res.json())
    lastError = null
    lastOk = new Date().toISOString()
  } catch (e) {
    lastError = e instanceof Error ? e.message : 'Couldn’t read The Brief’s schedule'
    // Keep the last good list for a while, but drop it if the feed stays down for hours
    if (!lastOk || Date.now() - Date.parse(lastOk) > 6 * 3_600_000) events = []
    console.warn('[sports]', lastError)
  }
  return true
}

export function sportsNotes(): string[] {
  return lastError ? [lastError] : []
}
