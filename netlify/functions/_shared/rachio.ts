// Rachio sprinkler controller — official public API (https://rachio.readme.io).
//
// Rachio allows 1,700 requests a day. The dashboard refreshes every minute on
// every open screen, so results are cached:
//   • zones + watering status: 5 minutes (refreshed right after you press a button)
//   • upcoming scheduled runs: 30 minutes
//   • your Rachio account id: kept until the API key changes
// That's roughly 650 requests a day no matter how many screens are open.

import type { IrrigationZone, IrrigationSummary, QuickRun } from '../../../src/types.ts'
import { QUICK_RUNS, PAUSE_MINUTES, matchByName } from '../../../src/config/irrigation.ts'
import { env } from './http.ts'
import { cached, cacheDelete, cacheGet, cacheSet } from './cache.ts'

const BASE = 'https://api.rach.io/1/public'
const STATE_KEY = 'rachio-state'
const STATE_MAX_AGE = 5 * 60_000
const UPCOMING_MAX_AGE = 30 * 60_000

export function rachioConfigured(): boolean {
  return !!env('RACHIO_API_KEY')
}

async function api<T = any>(path: string, init?: { method: 'PUT'; body: unknown }): Promise<T> {
  const key = env('RACHIO_API_KEY')
  if (!key) throw new Error('RACHIO_API_KEY not set')
  const res = await fetch(`${BASE}${path}`, {
    method: init?.method ?? 'GET',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: init ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(6000),
  })
  if (res.status === 401) throw new Error('Rachio rejected the API key — check RACHIO_API_KEY')
  if (res.status === 429) throw new Error('Rachio daily request limit reached')
  if (!res.ok) throw new Error(`Rachio ${path} returned ${res.status}`)
  const text = await res.text()
  return (text ? JSON.parse(text) : {}) as T
}

// A short fingerprint of the key, so a new key means fresh cached data.
function keyTag(): string {
  const k = env('RACHIO_API_KEY') ?? ''
  return k.slice(-6)
}

async function personId(): Promise<string> {
  return cached(`rachio-person-${keyTag()}`, 365 * 24 * 3_600_000, async () => (await api<{ id: string }>('/person/info')).id)
}

const iso = (ms: unknown) => (typeof ms === 'number' && ms > 0 ? new Date(ms).toISOString() : null)

// The upcoming-runs response isn't fully documented, so read it defensively:
// find every object with a future start time, plus the zones and schedule it covers.
interface Upcoming { at: string; zoneIds: string[]; scheduleId?: string; name?: string }

function readUpcoming(data: unknown): Upcoming[] {
  const out: Upcoming[] = []
  const startOf = (o: Record<string, unknown>) => {
    for (const k of ['startDate', 'startTime', 'start', 'scheduledStartDate', 'startAt']) {
      const v = o[k]
      if (typeof v === 'number') return new Date(v).toISOString()
      if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) return new Date(v).toISOString()
    }
    return null
  }
  const zoneIdsIn = (o: Record<string, unknown>): string[] => {
    const ids: string[] = []
    if (typeof o.zoneId === 'string') ids.push(o.zoneId)
    for (const k of ['zones', 'zoneIds', 'zoneRuns']) {
      const v = o[k]
      if (Array.isArray(v)) for (const z of v) {
        if (typeof z === 'string') ids.push(z)
        else if (z && typeof z === 'object') {
          const zz = z as Record<string, unknown>
          const id = zz.zoneId ?? zz.id
          if (typeof id === 'string') ids.push(id)
        }
      }
    }
    return ids
  }
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
  const walk = (node: unknown) => {
    if (Array.isArray(node)) { node.forEach(walk); return }
    if (!node || typeof node !== 'object') return
    const o = node as Record<string, unknown>
    const at = startOf(o)
    if (at && new Date(at).getTime() > Date.now()) {
      out.push({
        at,
        zoneIds: zoneIdsIn(o),
        scheduleId: str(o.scheduleRuleId) ?? str(o.scheduleId) ?? str(o.flexScheduleRuleId),
        name: str(o.scheduleName) ?? str(o.scheduleRuleName) ?? str(o.name),
      })
    }
    Object.values(o).forEach(walk)
  }
  walk(data)
  return out.sort((a, b) => a.at.localeCompare(b.at))
}

interface Schedule { id: string; name: string; zoneIds: string[] }

interface RachioState {
  zones: IrrigationZone[]
  summary: IrrigationSummary
  zoneDevice: Record<string, string>      // zone id → controller id (needed to stop watering)
  quick: Record<string, { zoneId?: string; scheduleId?: string; seconds?: number }>
  tomorrow: string                        // local date, YYYY-MM-DD
  skipTargets: string[]                   // schedules whose next run is tomorrow
}

// Small bits of state the dashboard remembers itself (Rachio doesn't report them clearly)
interface PauseFlag { zoneId: string; deviceId: string; until: number }
interface SkipFlag { date: string; scheduleIds: string[] }
const pauseKey = () => `rachio-pause-${keyTag()}`
const skipKey = () => `rachio-skipped-${keyTag()}`

// Rachio works in your local time zone; Netlify's servers run on UTC.
function localDate(ms: number, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms)
}

function schedulesOf(d: any): Schedule[] {
  const rules = [...(d.scheduleRules ?? []), ...(d.flexScheduleRules ?? [])]
  return rules
    .filter((r: any) => r && typeof r.id === 'string')
    .map((r: any) => ({
      id: r.id,
      name: r.name ?? 'Schedule',
      zoneIds: Array.isArray(r.zones) ? r.zones.map((z: any) => z?.zoneId ?? z?.id).filter(Boolean) : [],
    }))
}

async function loadState(): Promise<RachioState> {
  const pid = await personId()
  const person = await api<{ devices?: any[] }>(`/person/${pid}`)
  const devices = (person.devices ?? []).filter((d) => d && Array.isArray(d.zones))

  const zones: IrrigationZone[] = []
  const zoneDevice: Record<string, string> = {}
  const schedules: Schedule[] = []
  const upcomingAll: Upcoming[] = []

  const tz: string = devices[0]?.timeZone ?? env('TIMEZONE') ?? 'America/Los_Angeles'
  const tomorrow = localDate(Date.now() + 86_400_000, tz)
  const pause = await cacheGet<PauseFlag>(pauseKey())
  const paused = pause && pause.until > Date.now() ? pause : null
  const skip = await cacheGet<SkipFlag>(skipKey())
  const skipped = skip?.date === tomorrow ? skip.scheduleIds : []
  // Runs you've skipped no longer count as "next"
  const notSkipped = (u: Upcoming) => !(u.scheduleId && skipped.includes(u.scheduleId) && localDate(Date.parse(u.at), tz) === tomorrow)

  for (const d of devices) {
    const [current, upcomingRaw] = await Promise.all([
      api(`/device/${d.id}/current_schedule`).catch(() => ({})),
      cached(`rachio-upcoming-${d.id}`, UPCOMING_MAX_AGE, () => api(`/device/${d.id}/upcoming_runs`).catch(() => null)),
    ])
    const deviceSchedules = schedulesOf(d)
    schedules.push(...deviceSchedules)
    const upcomingRawList = readUpcoming(upcomingRaw)
    upcomingAll.push(...upcomingRawList)
    const upcoming = upcomingRawList.filter(notSkipped)

    const rainUntil = typeof d.rainDelayExpirationDate === 'number' ? d.rainDelayExpirationDate : 0
    const rainDelay = rainUntil > Date.now()

    const wateringZone: string | undefined = current?.zoneId
    let minutesLeft: number | null = null
    if (wateringZone && typeof current.zoneStartDate === 'number' && typeof current.zoneDuration === 'number') {
      const endMs = current.zoneStartDate + current.zoneDuration * 1000
      minutesLeft = Math.max(1, Math.ceil((endMs - Date.now()) / 60_000))
    }

    // Next run per zone: from the run itself, or from the schedule it belongs to
    const nextFor = (zoneId: string) => upcoming.find((u) =>
      u.zoneIds.includes(zoneId) || (u.scheduleId && deviceSchedules.find((s) => s.id === u.scheduleId)?.zoneIds.includes(zoneId)))?.at ?? null

    const list = [...d.zones]
      .filter((z: any) => z.enabled !== false)
      .sort((a: any, b: any) => (a.zoneNumber ?? 0) - (b.zoneNumber ?? 0))

    for (const z of list) {
      zoneDevice[z.id] = d.id
      const isPaused = paused?.zoneId === z.id
      const isWatering = z.id === wateringZone && !isPaused
      zones.push({
        id: z.id,
        name: z.name ?? `Zone ${z.zoneNumber}`,
        isWatering,
        isPaused,
        resumesAt: isPaused ? new Date(paused!.until).toISOString() : null,
        minutesLeft: isWatering ? minutesLeft : null,
        rainDelay,
        nextRunAt: rainDelay ? null : nextFor(z.id),
        lastRunAt: iso(z.lastWateredDate),
      })
    }
  }

  if (!zones.length) throw new Error('No Rachio zones found on this account')

  // Next scheduled run for the whole system, with the schedule's name if we can find it
  upcomingAll.sort((a, b) => a.at.localeCompare(b.at))
  const first = upcomingAll.filter(notSkipped)[0]
  let nextRun: IrrigationSummary['nextRun'] = null
  if (first) {
    const name = (first.scheduleId && schedules.find((s) => s.id === first.scheduleId)?.name) || first.name
      || (first.zoneIds.length === 1 ? zones.find((z) => z.id === first.zoneIds[0])?.name : undefined) || 'Scheduled run'
    nextRun = { name, at: first.at }
  } else {
    const soonest = zones.map((z) => z.nextRunAt).filter((t): t is string => !!t).sort()[0]
    if (soonest) nextRun = { name: 'Scheduled run', at: soonest }
  }

  // Match the quick-run buttons to real zones and schedules by name
  const quick: RachioState['quick'] = {}
  const quickRuns: QuickRun[] = QUICK_RUNS.map((q) => {
    if (q.schedule) {
      const m = matchByName(q.schedule, schedules)
      if (m.item) quick[q.id] = { scheduleId: m.item.id }
      return { id: q.id, label: q.label, detail: '', available: !!m.item, reason: m.reason, zoneIds: m.item?.zoneIds ?? [] }
    }
    const m = matchByName(q.zone ?? '', zones)
    const minutes = Math.min(180, Math.max(1, q.minutes ?? 5))
    if (m.item) quick[q.id] = { zoneId: m.item.id, seconds: minutes * 60 }
    return { id: q.id, label: q.label, detail: `${minutes} min`, available: !!m.item, reason: m.reason, zoneIds: m.item ? [m.item.id] : [] }
  })

  // "Skip tomorrow": Rachio can only skip a schedule's *next* run, so a schedule
  // qualifies only if its next run is tomorrow (not later today).
  const tomorrowRuns = upcomingAll.filter((u) => localDate(Date.parse(u.at), tz) === tomorrow)
  // Never skip twice: a second skip would cancel the run *after* tomorrow.
  const skipTargets = skipped.length ? [] : [...new Set(tomorrowRuns.map((u) => u.scheduleId).filter((id): id is string => !!id))]
    .filter((id) => upcomingAll.find((u) => u.scheduleId === id)?.at === tomorrowRuns.find((u) => u.scheduleId === id)?.at)
  let skipTomorrow: IrrigationSummary['skipTomorrow']
  if (skipped.length) skipTomorrow = { available: false, skipped: true, label: "Tomorrow's runs skipped" }
  else if (!tomorrowRuns.length) skipTomorrow = { available: false, skipped: false, label: 'Nothing scheduled tomorrow' }
  else if (!skipTargets.length) skipTomorrow = { available: false, skipped: false, label: "Can't skip tomorrow from here" }
  else skipTomorrow = { available: true, skipped: false, label: "Skip tomorrow's runs" }

  return { zones, zoneDevice, quick, tomorrow, skipTargets, summary: { nextRun, quickRuns, skipTomorrow } }
}

function stateKey() { return `${STATE_KEY}-${keyTag()}` }

export async function getRachio(): Promise<{ zones: IrrigationZone[]; summary: IrrigationSummary }> {
  const s = await cached(stateKey(), STATE_MAX_AGE, loadState)
  return { zones: s.zones, summary: s.summary }
}

const MAX_SECONDS = 3 * 3600

export async function rachioCommand(action: string, zoneId: string, durationSeconds = 600, quickId?: string): Promise<void> {
  if (action === 'quick') {
    const state = await cached(stateKey(), STATE_MAX_AGE, loadState)
    const q = quickId ? state.quick[quickId] : undefined
    if (!q) throw new Error('That quick run is not matched to a zone or schedule')
    if (q.scheduleId) await api('/schedulerule/start', { method: 'PUT', body: { id: q.scheduleId } })
    else await api('/zone/start', { method: 'PUT', body: { id: q.zoneId, duration: q.seconds } })
    await cacheDelete(stateKey())
    return
  }
  if (action === 'skip-tomorrow') {
    const state = await cached(stateKey(), STATE_MAX_AGE, loadState)
    if (state.summary.skipTomorrow.skipped) return // already done — skipping again would hit a later run
    if (!state.skipTargets.length) throw new Error('Nothing to skip tomorrow')
    for (const id of state.skipTargets) await api('/schedulerule/skip', { method: 'PUT', body: { id } })
    await cacheSet(skipKey(), { date: state.tomorrow, scheduleIds: state.skipTargets } satisfies SkipFlag)
    for (const deviceId of new Set(Object.values(state.zoneDevice))) await cacheDelete(`rachio-upcoming-${deviceId}`)
    await cacheDelete(stateKey())
    return
  }
  if (typeof zoneId !== 'string' || !zoneId) throw new Error('zoneId is required')
  if (action === 'pause' || action === 'resume') {
    const state = await cached(stateKey(), STATE_MAX_AGE, loadState)
    const deviceId = state.zoneDevice[zoneId]
    if (!deviceId) throw new Error('Unknown zone')
    if (action === 'pause') {
      const seconds = Math.min(60, Math.max(1, PAUSE_MINUTES)) * 60
      await api('/device/pause_zone_run', { method: 'PUT', body: { id: deviceId, duration: seconds } })
      await cacheSet(pauseKey(), { zoneId, deviceId, until: Date.now() + seconds * 1000 } satisfies PauseFlag)
    } else {
      await api('/device/resume_zone_run', { method: 'PUT', body: { id: deviceId } })
      await cacheDelete(pauseKey())
    }
    await cacheDelete(stateKey())
    return
  }
  if (action === 'start') {
    const duration = Math.min(MAX_SECONDS, Math.max(60, Math.round(Number(durationSeconds) || 600)))
    await api('/zone/start', { method: 'PUT', body: { id: zoneId, duration } })
  } else if (action === 'stop') {
    const state = await cached(stateKey(), STATE_MAX_AGE, loadState)
    const deviceId = state.zoneDevice[zoneId]
    if (!deviceId) throw new Error('Unknown zone')
    await api('/device/stop_water', { method: 'PUT', body: { id: deviceId } })
    await cacheDelete(pauseKey())
  } else {
    throw new Error(`Unknown action: ${action}`)
  }
  // Next dashboard refresh fetches the new status instead of the cached one.
  await cacheDelete(stateKey())
}

/** For troubleshooting: what Rachio returns, with nothing cached. */
export async function rachioDebug() {
  const pid = await personId()
  const person = await api<{ devices?: any[] }>(`/person/${pid}`)
  const d = person.devices?.[0]
  return {
    devices: (person.devices ?? []).map((x) => ({ id: x.id, name: x.name, status: x.status, on: x.on, zones: x.zones?.length, rainDelayExpirationDate: x.rainDelayExpirationDate ?? null })),
    currentSchedule: d ? await api(`/device/${d.id}/current_schedule`) : null,
    upcomingRuns: d ? await api(`/device/${d.id}/upcoming_runs`).catch((e) => String(e)) : null,
    schedules: (person.devices ?? []).flatMap(schedulesOf).map((x) => x.name),
    parsed: await loadState().then((s) => ({ zones: s.zones.map((z) => z.name), nextRun: s.summary.nextRun, quickRuns: s.summary.quickRuns, tomorrow: s.tomorrow, skipTomorrow: s.summary.skipTomorrow, skipTargets: s.skipTargets })).catch((e) => String(e)),
  }
}
