// Vandenberg launches for the status bar, from Connor's launch app "Twilight".
//
// Twilight publishes a small feed (/api/panel). The Lenovo reads it with an
// outgoing request, so the house stays local-only. The feed is protected by a
// shared key: Twilight has it as the Netlify variable PANEL_FEED_KEY, and Panel
// sends it in the x-feed-key header from the app's Configuration tab
// (twilight_feed_key). The key never goes into GitHub or browser code.
//
// How often: every 15 minutes; every 5 minutes within 6 hours of a firm launch
// time; every minute in the last hour (Twilight's own schedule). After an
// error, try again in a minute.
//
// No key, or the feed answers with an error → no launch chips; /api/setup-check
// says why.
//
// Feed: { timeZone, launches: [{ id?, mission, vehicle, status, t0, firm, url }] }
//   status: Go · Hold · TBD · Scrubbed · launched
//   firm:   false = date only (NET), shown as "time TBD"
//   url:    Twilight opened to that launch (?launch=<id>)

import type { LaunchEvent } from '../src/types.ts'
import { HOME } from '../src/config/home.ts'
import { env } from './env.ts'

let launches: LaunchEvent[] = []
let lastError: string | null = null
let lastOk: string | null = null

export const launchEvents = () => launches
export const launchNotes = (): string[] => (lastError ? [lastError] : [])

const feedUrl = () => env('TWILIGHT_FEED_URL') || HOME.statusBar.launchFeedUrl
const feedKey = () => env('TWILIGHT_FEED_KEY')

const MIN = 60_000
const HOUR = 60 * MIN

const str = (v: unknown, max = 80) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : typeof v === 'number' ? String(v) : null)

/** Read one feed item, or null if it's missing a vehicle/mission or a launch time */
export function parseLaunch(l: any): LaunchEvent | null {
  const vehicle = str(l?.vehicle ?? l?.rocket)
  const mission = str(l?.mission ?? l?.name)
  const t0 = str(l?.t0 ?? l?.net ?? l?.time, 60)
  if ((!vehicle && !mission) || !t0 || Number.isNaN(Date.parse(t0))) return null
  const url = str(l?.url ?? l?.link, 500)
  const status = str(l?.status, 20) ?? 'TBD'
  return {
    id: str(l?.id) ?? `${vehicle ?? mission}-${t0}`,
    vehicle: vehicle ?? mission!,
    mission: mission && mission !== vehicle ? mission : null,
    t0,
    firm: l?.firm === true || l?.firm === 'true',
    status,
    url: url && /^https:\/\//.test(url) ? url : null,
  }
}

export function parseLaunchFeed(body: any): LaunchEvent[] {
  const list = Array.isArray(body) ? body : body?.launches ?? []
  return (Array.isArray(list) ? list : [])
    .map(parseLaunch)
    .filter((x): x is LaunchEvent => !!x)
    .filter((x) => !/^(launched|scrubbed)$/i.test(x.status))
    .slice(0, 50)
}

/** Twilight's schedule: closer to a firm T-0 = check more often */
export function nextCheckIn(list: LaunchEvent[], now = Date.now()): number {
  const soon = list
    .filter((l) => l.firm)
    .map((l) => Date.parse(l.t0) - now)
    .filter((d) => d > 0)
    .sort((a, b) => a - b)[0]
  if (soon === undefined) return 15 * MIN
  if (soon < HOUR) return MIN
  if (soon < 6 * HOUR) return 5 * MIN
  return 15 * MIN
}

/** Returns whether anything changed */
async function refresh(): Promise<boolean> {
  const before = JSON.stringify(launches)
  const url = feedUrl()
  const key = feedKey()
  if (!url) { lastError = 'No launch feed address in src/config/home.ts'; launches = [] }
  else if (!key) { lastError = "No twilight_feed_key in the app's Configuration tab, so launch chips are off"; launches = [] }
  else {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { Accept: 'application/json', 'x-feed-key': key } })
      if (res.status === 401) throw new Error("Twilight didn't accept the feed key — check twilight_feed_key against PANEL_FEED_KEY in Twilight's Netlify settings")
      if (res.status === 503) throw new Error("Twilight's PANEL_FEED_KEY isn't set in its Netlify settings")
      if (!res.ok) throw new Error(`Twilight's launch feed answered ${res.status}`)
      launches = parseLaunchFeed(await res.json())
      lastError = null
      lastOk = new Date().toISOString()
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'Couldn’t read Twilight’s launch feed'
      // Keep the last good list for a while, but drop it if the feed stays down for hours
      if (!lastOk || Date.now() - Date.parse(lastOk) > 6 * HOUR) launches = []
      console.warn('[launches]', lastError)
    }
  }
  return JSON.stringify(launches) !== before
}

export function startLaunches(changed: () => void) {
  const tick = async () => {
    if (await refresh()) changed()
    setTimeout(tick, lastError && feedKey() ? MIN : nextCheckIn(launches))
  }
  void tick()
}
