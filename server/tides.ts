// Tide predictions from NOAA (tidesandcurrents.noaa.gov) — free, no account or key.
// Only the highs and lows are fetched (every NOAA station has them); the dashboard
// draws the curve between them the way NOAA's own charts do (a cosine between each
// high and low). Heights are feet above mean lower low water (MLLW) = the 0 ft line.
import type { Tides, TideEvent } from '../src/types.ts'
import { env } from './env.ts'

// San Clemente on NOAA's tide predictions page; a nearby station if that one sends nothing
const DEFAULT_STATIONS = ['TWC0419', '9410580']
const FRESH_MS = 6 * 3_600_000

let cache: Tides | null = null
let cachedAt = 0
let problem: string | null = null
const names = new Map<string, string | null>()

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`

async function fetchStation(id: string): Promise<TideEvent[]> {
  // From a day and a half ago (so there's a tide before midnight to draw from) through the next 9+ days
  const q = new URLSearchParams({
    product: 'predictions', application: 'Panel', begin_date: ymd(new Date(Date.now() - 36 * 3_600_000)), range: '264',
    datum: 'MLLW', station: id, time_zone: 'gmt', units: 'english', interval: 'hilo', format: 'json',
  })
  const res = await fetch(`${env('NOAA_TIDES_URL') ?? 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter'}?${q}`)
  if (!res.ok) throw new Error(`NOAA returned ${res.status} for station ${id}`)
  const j = await res.json() as { predictions?: { t: string; v: string; type: string }[]; error?: { message?: string } }
  if (j.error) throw new Error(`NOAA, station ${id}: ${j.error.message ?? 'error'}`)
  const events = (j.predictions ?? [])
    .map((p) => ({ time: new Date(`${p.t.replace(' ', 'T')}:00Z`).toISOString(), ft: Math.round(Number(p.v) * 100) / 100, high: p.type.toUpperCase().startsWith('H') }))
    .filter((e) => Number.isFinite(e.ft) && !Number.isNaN(Date.parse(e.time)))
  if (events.length < 8) throw new Error(`NOAA sent no tide predictions for station ${id}`)
  return events
}

async function stationName(id: string): Promise<string | null> {
  if (names.has(id)) return names.get(id) ?? null
  try {
    const res = await fetch(`${env('NOAA_STATIONS_URL') ?? 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations'}/${encodeURIComponent(id)}.json`)
    const j = res.ok ? await res.json() as { stations?: { name?: string }[] } : null
    const name = j?.stations?.[0]?.name?.trim() || null
    names.set(id, name)
    return name
  } catch { return null }
}

/** Tide highs and lows for the next week+. Refreshed every 6 hours; keeps the last good copy if NOAA is down. */
export async function getTides(): Promise<Tides | null> {
  if (cache && Date.now() - cachedAt < FRESH_MS) return cache
  const chosen = env('TIDE_STATION')?.trim()
  const stations = chosen ? [chosen] : DEFAULT_STATIONS
  const errors: string[] = []
  for (const id of stations) {
    try {
      const events = await fetchStation(id)
      cache = { station: id, stationName: await stationName(id), events, updatedAt: new Date().toISOString() }
      cachedAt = Date.now()
      problem = errors.length ? `Used ${id}: ${errors.join('; ')}` : null
      return cache
    } catch (e) { errors.push(e instanceof Error ? e.message : String(e)) }
  }
  problem = errors.join('; ')
  console.warn('[tides]', problem)
  return cache
}

export function tideNotes() {
  const now = Date.now()
  const next = cache?.events.find((e) => Date.parse(e.time) > now)
  return {
    station: cache?.station ?? null,
    stationName: cache?.stationName ?? null,
    predictions: cache?.events.length ?? 0,
    through: cache?.events.at(-1)?.time ?? null,
    next: next ? `${next.high ? 'High' : 'Low'} ${next.ft} ft at ${next.time}` : null,
    problem,
    setting: env('TIDE_STATION') ? `tide_station = ${env('TIDE_STATION')}` : `tide_station empty: trying ${DEFAULT_STATIONS.join(', then ')}`,
  }
}
