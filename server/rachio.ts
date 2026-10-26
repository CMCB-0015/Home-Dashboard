// Rachio sprinkler controller — official public API (https://rachio.readme.io).
//
// Rachio allows 1,700 requests a day. A watcher on the Lenovo checks Rachio
// around the clock and adjusts how often it looks (see startRachioWatcher):
//   • idle: every 5 minutes
//   • around a scheduled start: a minute before, then every 20 seconds until it starts
//   • while watering: every minute, plus right at each expected zone change
//   • right after you press a button on the dashboard, then every 10 seconds
//     until Rachio confirms the change (Rachio takes a little while to report
//     a run it just started or stopped; until then the dashboard shows what
//     you asked for, so the card doesn't flash back)
// Each check is one request ("what's watering now?"). The account details
// (zones, schedules, rain delay) are kept for 30 minutes and upcoming runs
// for 30 minutes, so a normal day uses a few hundred requests.

import type { IrrigationZone, IrrigationSummary, IrrigationRun, IrrigationWatering, QuickRun, RunZone } from '../src/types.ts'
import { QUICK_RUNS, PAUSE_MINUTES, matchByName } from '../src/config/irrigation.ts'
import { env } from './env.ts'
import { cached, cacheDelete, cacheGet, cacheSet } from './cache.ts'

// RACHIO_BASE_URL is only for testing against a simulated Rachio
const BASE = () => env('RACHIO_BASE_URL') ?? 'https://api.rach.io/1/public'
const STATE_KEY = 'rachio-state'
const STATE_MAX_AGE = 10 * 60_000
const PERSON_MAX_AGE = 30 * 60_000
const UPCOMING_MAX_AGE = 30 * 60_000

export function rachioConfigured(): boolean {
  return !!env('RACHIO_API_KEY')
}

async function api<T = any>(path: string, init?: { method: 'PUT'; body: unknown }): Promise<T> {
  const key = env('RACHIO_API_KEY')
  if (!key) throw new Error('RACHIO_API_KEY not set')
  const res = await fetch(`${BASE()}${path}`, {
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

interface Schedule {
  id: string; name: string; zoneIds: string[]
  /** Zones in watering order with their run time (seconds) */
  zoneRuns: { zoneId: string; seconds: number }[]
  totalSeconds: number | null
  /** Seasonal shift as a fraction (+0.33 = 33% longer), if Rachio reports it */
  seasonal: number | null
  enabled: boolean
  /** Fixed schedules: which days and when (flex schedules have none of this) */
  jobTypes: string[]; startHour: number | null; startMinute: number | null; startDate: number | null
}

interface RachioState {
  zones: IrrigationZone[]
  summary: IrrigationSummary
  zoneDevice: Record<string, string>      // zone id → controller id (needed to stop watering)
  quick: Record<string, { zoneId?: string; scheduleId?: string; seconds?: number }>
  tomorrow: string                        // local date, YYYY-MM-DD
  skipTargets: string[]                   // schedules whose next run is tomorrow
  rules: Record<string, { name: string; zoneRuns: { zoneId: string; seconds: number }[]; seasonal: number | null }>
}

// Small bits of state the dashboard remembers itself (Rachio doesn't report them clearly)
interface PauseFlag { zoneId: string; deviceId: string; until: number; remainingSec?: number | null; watering?: IrrigationWatering | null }
interface SkipFlag { date: string; scheduleIds: string[] }
/** Single runs skipped from the week strip (schedule + local date) */
interface RunSkip { scheduleId: string; date: string }
const runSkipKey = () => `rachio-run-skips-${keyTag()}`
/**
 * A run the dashboard started or rearranged (quick run, a schedule started
 * from the card, or Next zone): its zones in order. Rachio's "what's watering"
 * only names the current zone, so this is how the card knows the whole list
 * for a manual run.
 */
interface RunPlan { zones: { zoneId: string; name: string; seconds: number | null; state?: 'done' | 'skipped' }[]; schedule: string | null; label: string; startedAt: number }
const planKey = () => `rachio-plan-${keyTag()}`
const planAlive = (p: RunPlan | null | undefined): p is RunPlan =>
  !!p && Date.now() < p.startedAt + p.zones.reduce((n, z) => n + (z.seconds ?? 3600) * 1000, 0) + 30 * 60_000

/** The run's zones with done / now / next, with index of the current one */
function listFrom(zones: { zoneId: string; name: string; seconds: number | null; state?: 'done' | 'skipped' }[], currentId: string): { list: RunZone[]; i: number } | null {
  const i = zones.findIndex((z) => z.zoneId === currentId && !z.state)
  if (i < 0) return null
  return {
    i,
    list: zones.map((z, k) => ({ zoneId: z.zoneId, name: z.name, seconds: z.seconds, state: k < i ? (z.state === 'skipped' ? 'skipped' : 'done') : k === i ? 'now' : z.state === 'skipped' ? 'skipped' : 'next' })),
  }
}
const pauseKey = () => `rachio-pause-${keyTag()}`
const skipKey = () => `rachio-skipped-${keyTag()}`

// Rachio works in your local time zone; the server's clock may be on UTC.
function localDate(ms: number, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms)
}

/** Epoch ms for a local date + time in Rachio's time zone */
function zonedTime(date: string, hour: number, minute: number, tz: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, hour, minute)
  // How far the zone's clock is from UTC at that moment
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(guess).reduce<Record<string, number>>((o, p) => (p.type !== 'literal' ? { ...o, [p.type]: Number(p.value) } : o), {})
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
  return guess - (asUtc - guess)
}

/**
 * Fixed schedules' runs over the next days, from their rules (day of week,
 * every N days, odd/even days). Flex schedules decide day by day, so only
 * Rachio's upcoming-runs list knows those.
 */
function projectRuns(rules: Schedule[], dates: string[], tz: string): Upcoming[] {
  const out: Upcoming[] = []
  for (const r of rules) {
    if (!r.enabled || r.startHour === null || !r.jobTypes.length) continue
    for (const date of dates) {
      const [y, m, d] = date.split('-').map(Number)
      const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
      const runs = r.jobTypes.some((j) => {
        let k = /^DAY_OF_WEEK_(\d)$/.exec(j)
        if (k) return Number(k[1]) === weekday
        k = /^INTERVAL_(\d+)$/.exec(j)
        if (k && r.startDate) {
          const startDay = localDateUtcDays(r.startDate, tz)
          const n = Number(k[1])
          return n > 0 && (Date.UTC(y, m - 1, d) / 86_400_000 - startDay) % n === 0
        }
        if (j === 'ODD') return d % 2 === 1 && d !== 31
        if (j === 'EVEN') return d % 2 === 0
        return false
      })
      if (!runs) continue
      const at = zonedTime(date, r.startHour, r.startMinute ?? 0, tz)
      if (at > Date.now()) out.push({ at: new Date(at).toISOString(), zoneIds: r.zoneIds, scheduleId: r.id, name: r.name })
    }
  }
  return out
}

/** Whole days since 1970 for the local date of a timestamp */
function localDateUtcDays(ms: number, tz: string): number {
  const [y, m, d] = localDate(ms, tz).split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

function schedulesOf(d: any): Schedule[] {
  const rules = [...(d.scheduleRules ?? []), ...(d.flexScheduleRules ?? [])]
  return rules
    .filter((r: any) => r && typeof r.id === 'string')
    .map((r: any): Schedule => {
      const zr = (Array.isArray(r.zones) ? r.zones : [])
        .filter((z: any) => z && (z.zoneId ?? z.id))
        .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((z: any) => ({ zoneId: String(z.zoneId ?? z.id), seconds: Number(z.duration) || 0 }))
      const total = Number(r.totalDuration) || zr.reduce((n: number, z: { seconds: number }) => n + z.seconds, 0) || null
      return {
        id: r.id,
        name: r.name ?? 'Schedule',
        zoneIds: zr.map((z: { zoneId: string }) => z.zoneId),
        zoneRuns: zr,
        totalSeconds: total,
        seasonal: typeof r.seasonalAdjustment === 'number' && Number.isFinite(r.seasonalAdjustment) && Math.abs(r.seasonalAdjustment) < 5 ? r.seasonalAdjustment : null,
        enabled: r.enabled !== false,
        jobTypes: Array.isArray(r.scheduleJobTypes) ? r.scheduleJobTypes.map(String) : [],
        startHour: Number.isFinite(r.startHour) ? r.startHour : null,
        startMinute: Number.isFinite(r.startMinute) ? r.startMinute : null,
        startDate: typeof r.startDate === 'number' ? r.startDate : null,
      }
    })
}

async function loadState(): Promise<RachioState> {
  const pid = await personId()
  const person = await cached(`rachio-person-data-${keyTag()}`, PERSON_MAX_AGE, () => api<{ devices?: any[] }>(`/person/${pid}`))
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
  const today = localDate(Date.now(), tz)
  const runSkips = ((await cacheGet<RunSkip[]>(runSkipKey())) ?? []).filter((r) => r.date >= today)
  const isSkipped = (u: Upcoming) => {
    if (!u.scheduleId) return false
    const date = localDate(Date.parse(u.at), tz)
    return (date === tomorrow && skipped.includes(u.scheduleId)) || runSkips.some((r) => r.scheduleId === u.scheduleId && r.date === date)
  }
  const savedPlan = await cacheGet<RunPlan>(planKey())
  const plan = planAlive(savedPlan) ? savedPlan : null
  // Runs you've skipped no longer count as "next"
  const notSkipped = (u: Upcoming) => !isSkipped(u)
  let watering: IrrigationWatering | null = null

  for (const d of devices) {
    const [current, upcomingRaw] = await Promise.all([
      api(`/device/${d.id}/current_schedule`).catch(() => ({})),
      cached(`rachio-upcoming-${d.id}`, UPCOMING_MAX_AGE, () => api(`/device/${d.id}/upcoming_runs`).catch(() => null)),
    ])
    const deviceSchedules = schedulesOf(d)
    schedules.push(...deviceSchedules)
    const fromRachio = readUpcoming(upcomingRaw)
    // Add fixed schedules' runs Rachio's list leaves out (it may only cover the next few)
    const dates = Array.from({ length: 7 }, (_, k) => localDate(Date.now() + k * 86_400_000, tz))
    const projected = projectRuns(deviceSchedules, dates, tz).filter((p) =>
      !fromRachio.some((u) => u.scheduleId === p.scheduleId && localDate(Date.parse(u.at), tz) === localDate(Date.parse(p.at), tz)))
    const upcomingRawList = [...fromRachio, ...projected].sort((a, b) => a.at.localeCompare(b.at))
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
    if (wateringZone && !(paused?.zoneId === wateringZone)) {
      const zoneName = (id?: string) => (id ? d.zones.find((z: any) => z.id === id)?.name ?? null : null)
      const live = typeof current.zoneDuration === 'number' && current.zoneDuration > 0 ? current.zoneDuration : null
      const ruleId = current.scheduleRuleId ?? current.scheduleId ?? current.flexScheduleRuleId
      const rule = deviceSchedules.find((r) => r.id === ruleId)
      // Every zone in this run, in order, with its run time:
      //  • a run the dashboard started or rearranged → its saved plan
      //  • a schedule → the schedule's zones; Rachio's settings hold the base times,
      //    so scale them by how the live time of this zone compares to its base time
      //    (that's the seasonal shift), or by the schedule's own seasonal % if cycling
      let run: { list: RunZone[]; i: number } | null = null
      let schedule: string | null = rule?.name ?? null
      // (a schedule Rachio runs on its own later doesn't borrow an old manual plan)
      if (plan && !(rule && plan.schedule !== rule.name)) {
        run = listFrom(plan.zones, wateringZone)
        if (run) schedule = plan.schedule
      }
      if (!run && rule) {
        const base = rule.zoneRuns
        const k = base.findIndex((z) => z.zoneId === wateringZone)
        const cycling = current.cycling === true || (typeof current.totalCycleCount === 'number' && current.totalCycleCount > 1)
        let ratio = 1
        if (live && k >= 0 && base[k].seconds > 0 && !cycling) ratio = live / base[k].seconds
        else if (rule.seasonal !== null) ratio = 1 + rule.seasonal
        if (!(ratio > 0.1 && ratio < 5)) ratio = 1
        run = listFrom(base.map((z) => ({ zoneId: z.zoneId, name: zoneName(z.zoneId) ?? 'Zone', seconds: z.seconds ? Math.round(z.seconds * ratio) : null })), wateringZone)
      }
      if (run && live && !(current.cycling === true)) run.list[run.i].seconds = live
      const zoneEnd = typeof current.zoneStartDate === 'number' && live ? current.zoneStartDate + live * 1000 : null
      let doneAt: number | null = null
      if (typeof current.startDate === 'number' && typeof current.duration === 'number' && current.duration > 0) doneAt = current.startDate + current.duration * 1000
      else if (zoneEnd && run) doneAt = zoneEnd + run.list.slice(run.i + 1).filter((z) => z.state === 'next').reduce((n, z) => n + (z.seconds ?? 0) * 1000, 0)
      else if (zoneEnd) doneAt = zoneEnd
      watering = {
        zoneId: wateringZone,
        zoneName: zoneName(wateringZone) ?? 'Zone',
        zoneStartedAt: iso(current.zoneStartDate),
        zoneSeconds: live,
        nextZone: run?.list.slice(run.i + 1).find((z) => z.state === 'next')?.name ?? null,
        schedule,
        doneAt: doneAt ? new Date(doneAt).toISOString() : null,
        zones: run?.list,
        index: run?.i,
      }
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
    const rule = first.scheduleId ? schedules.find((x) => x.id === first.scheduleId) : undefined
    nextRun = { name, at: first.at, minutes: rule?.totalSeconds ? Math.round(rule.totalSeconds / 60) : null }
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
      const ids = m.item?.zoneIds ?? []
      return { id: q.id, label: q.label, detail: '', kind: 'schedule' as const, available: !!m.item, reason: m.reason, zoneIds: ids,
        zoneNames: ids.map((id) => zones.find((z) => z.id === id)?.name).filter((n): n is string => !!n),
        minutes: m.item?.totalSeconds ? Math.round(m.item.totalSeconds / 60) : undefined }
    }
    const m = matchByName(q.zone ?? '', zones)
    const minutes = Math.min(180, Math.max(1, q.minutes ?? 5))
    if (m.item) quick[q.id] = { zoneId: m.item.id, seconds: minutes * 60 }
    return { id: q.id, label: q.label, detail: `${minutes} min`, kind: 'zone' as const, minutes, available: !!m.item, reason: m.reason,
      zoneIds: m.item ? [m.item.id] : [], zoneNames: m.item ? [m.item.name] : [], lastRunAt: m.item?.lastRunAt ?? null }
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

  // The week strip: every run over the next 7 days, today first
  const nextBySchedule = new Map<string, string>()
  for (const u of upcomingAll) if (u.scheduleId && !isSkipped(u) && !nextBySchedule.has(u.scheduleId)) nextBySchedule.set(u.scheduleId, u.at)
  const week = Array.from({ length: 7 }, (_, k) => localDate(Date.now() + k * 86_400_000, tz)).map((date) => ({
    date,
    runs: upcomingAll.filter((u) => localDate(Date.parse(u.at), tz) === date).map((u): IrrigationRun => {
      const rule = u.scheduleId ? schedules.find((x) => x.id === u.scheduleId) : undefined
      const runSkipped = isSkipped(u)
      const isNext = !!u.scheduleId && nextBySchedule.get(u.scheduleId) === u.at
      const ids = rule?.zoneIds.length ? rule.zoneIds : u.zoneIds
      return {
        id: `${u.scheduleId ?? 'run'}-${u.at}`,
        scheduleId: u.scheduleId ?? null,
        name: rule?.name ?? u.name ?? 'Scheduled run',
        at: u.at,
        minutes: rule?.totalSeconds ? Math.round(rule.totalSeconds / 60) : null,
        zoneNames: ids.map((id) => zones.find((z) => z.id === id)?.name).filter((n): n is string => !!n),
        skipped: runSkipped,
        canSkip: !runSkipped && isNext,
        reason: runSkipped || isNext ? undefined : u.scheduleId ? 'Rachio can only skip this schedule’s next run' : 'Not a schedule',
      }
    }),
  }))

  if (paused) {
    const z = zones.find((x) => x.id === paused.zoneId)
    watering = { ...(paused.watering ?? { zoneId: paused.zoneId, zoneName: z?.name ?? 'Zone', zoneStartedAt: null, zoneSeconds: null, nextZone: null, schedule: null, doneAt: null }), pausedRemainingSec: paused.remainingSec ?? null }
  }

  const rules: RachioState['rules'] = Object.fromEntries(schedules.map((r) => [r.id, { name: r.name, zoneRuns: r.zoneRuns, seasonal: r.seasonal }]))
  return { zones, zoneDevice, quick, tomorrow, skipTargets, rules, summary: { nextRun, quickRuns, skipTomorrow, week, watering } }
}

function stateKey() { return `${STATE_KEY}-${keyTag()}` }

export async function getRachio(): Promise<{ zones: IrrigationZone[]; summary: IrrigationSummary }> {
  const s = await cached(stateKey(), STATE_MAX_AGE, loadState)
  return { zones: s.zones, summary: { ...s.summary, lastSkipped: skippedToShow() } }
}

/** Ask Rachio for fresh status now. */
export async function refreshRachio() {
  await cacheDelete(stateKey())
  return getRachio()
}

// ── The watcher ────────────────────────────────────────────────────────────
// Decides when to check Rachio next, based on what's happening.

// ── Waiting for Rachio to confirm a button press ──────────────────────────
// Rachio takes a few seconds (sometimes longer) to report a run it just
// started. Until it does, the dashboard shows the run as started — with its
// countdown and Stop — and checks every 10 seconds. If Rachio still hasn't
// confirmed after 90 seconds, the card goes back to what Rachio says and a
// short message explains why. Stop works the same way in reverse.

const CONFIRM_EVERY = 10_000
const CONFIRM_FOR = 90_000

type Pending =
  | { kind: 'start'; since: number; plan: RunPlan }
  | { kind: 'stop'; since: number }
let pending: Pending | null = null
let notice: { text: string; until: number } | null = null

/** Remember what a button press started (saved, so the card can list the zones the whole run) */
async function expectStart(state: RachioState, label: string, zoneRuns: { zoneId: string; seconds: number | null; state?: 'done' | 'skipped' }[], schedule: string | null, save = true) {
  const name = (id: string) => state.zones.find((z) => z.id === id)?.name ?? 'Zone'
  const zones = zoneRuns.filter((z) => z.zoneId).map((z) => ({ zoneId: z.zoneId, name: name(z.zoneId), seconds: z.seconds && z.seconds > 0 ? z.seconds : null, ...(z.state ? { state: z.state } : {}) }))
  if (!zones.some((z) => !z.state)) return
  const plan: RunPlan = { zones, schedule, label, startedAt: Date.now() }
  // A schedule's own run isn't saved: once Rachio reports it, the list comes from
  // the schedule with the live seasonal shift applied (more accurate than base times)
  if (save) await cacheSet(planKey(), plan)
  else await cacheDelete(planKey())
  pending = { kind: 'start', since: Date.now(), plan }
  notice = null
}

/** Rachio's state with any not-yet-confirmed button press laid over it */
function withPending(s: { zones: IrrigationZone[]; summary: IrrigationSummary }): { zones: IrrigationZone[]; summary: IrrigationSummary } {
  if (!pending) return s
  const p = pending
  const now = Date.now()
  const anyWatering = s.zones.some((z) => z.isWatering)
  const anyPaused = s.zones.some((z) => z.isPaused)

  if (p.kind === 'start') {
    // Confirmed only when Rachio reports one of *this run's* zones
    const ours = new Set(p.plan.zones.filter((z) => !z.state).map((z) => z.zoneId))
    if (s.zones.some((z) => (z.isWatering || z.isPaused) && ours.has(z.id))) { pending = null; return s }
    if (now - p.since > CONFIRM_FOR) {
      pending = null
      notice = { text: `Rachio didn’t confirm ${p.plan.label} started — check the Rachio app`, until: now + 10 * MIN_MS }
      console.log(`[rachio] ${p.plan.label} was started from the dashboard but Rachio never reported it running`)
      return s
    }
    // Which of the run's zones should be going by now, going by their times
    const todo = p.plan.zones.filter((z) => !z.state)
    let t = p.since, k = 0
    while (k < todo.length - 1 && todo[k].seconds && now >= t + todo[k].seconds! * 1000) { t += todo[k].seconds! * 1000; k++ }
    const cur = todo[k]
    const left = cur.seconds ? Math.max(0, t + cur.seconds * 1000 - now) : null
    const total = todo.every((z) => z.seconds) ? todo.reduce((n, z) => n + z.seconds! * 1000, 0) : null
    // Zones already passed in this estimate count as done
    const passed = new Set(todo.slice(0, k).map((z) => z.zoneId))
    const run = listFrom(p.plan.zones.map((z) => (passed.has(z.zoneId) && !z.state ? { ...z, state: 'done' as const } : z)), cur.zoneId)
    return {
      zones: s.zones.map((z) => (z.id === cur.zoneId
        ? { ...z, isWatering: true, isPaused: false, resumesAt: null, minutesLeft: left !== null ? Math.max(1, Math.ceil(left / 60_000)) : null }
        : { ...z, isWatering: false, isPaused: false, minutesLeft: null })),
      summary: {
        ...s.summary,
        watering: {
          zoneId: cur.zoneId,
          zoneName: cur.name,
          zoneStartedAt: new Date(t).toISOString(),
          zoneSeconds: cur.seconds,
          nextZone: todo[k + 1]?.name ?? null,
          schedule: p.plan.schedule,
          doneAt: total ? new Date(p.since + total).toISOString() : null,
          zones: run?.list,
          index: run?.i,
        },
      },
    }
  }

  // Stop: show it stopped until Rachio agrees
  if (!anyWatering && !anyPaused) { pending = null; return s }
  if (now - p.since > CONFIRM_FOR) {
    pending = null
    notice = { text: 'Rachio still shows watering after Stop — check the Rachio app', until: now + 10 * MIN_MS }
    return s
  }
  return {
    zones: s.zones.map((z) => ({ ...z, isWatering: false, isPaused: false, resumesAt: null, minutesLeft: null })),
    summary: { ...s.summary, watering: null },
  }
}

/** A short message about a button press Rachio didn't confirm (shown as an alert for 10 minutes) */
export function rachioNotice(): string | null {
  if (notice && notice.until < Date.now()) notice = null
  return notice?.text ?? null
}

const MIN_MS = 60_000
const SEC = 1000, MIN = 60 * SEC
const IDLE = 5 * MIN
const NEAR_START = 20 * SEC
const WATERING = MIN
/** How long after a scheduled start we keep looking before calling it skipped */
const START_GRACE = 5 * MIN

interface Watched { name: string; at: string; started: boolean }
let watched: Watched | null = null
let skipped: { name: string; at: string } | null = null
let timer: NodeJS.Timeout | null = null
let onUpdate: (() => void) | null = null
let latest: { zones: IrrigationZone[]; summary: IrrigationSummary } | null = null
let lastError: string | null = null

function skippedToShow() {
  if (!skipped) return null
  // Show it for the rest of that day
  return new Date(skipped.at).toDateString() === new Date().toDateString() ? skipped : null
}

/** The most recent Rachio status the watcher has (null until the first check). */
export function latestRachio() { return latest ? withPending(latest) : null }
export function rachioError() { return lastError }

async function tick() {
  timer = null
  let next = IDLE
  try {
    const raw = await refreshRachio()
    lastError = null
    const now = Date.now()
    const waiting = !!pending
    // What the dashboard shows, including a button press Rachio hasn't confirmed yet
    const state = withPending(raw)
    const active = state.zones.find((z) => z.isWatering || z.isPaused)

    // Is the run we were waiting for underway, or did it not happen?
    if (watched && !watched.started && raw.zones.some((z) => z.isWatering)) watched.started = true
    if (watched && !watched.started && now > Date.parse(watched.at) + START_GRACE) {
      skipped = { name: watched.name, at: watched.at }
      console.log(`[rachio] ${watched.name} was scheduled for ${watched.at} but didn't start — showing it as skipped`)
      watched = null
    }
    if (watched && (watched.started || now > Date.parse(watched.at) + START_GRACE)) watched = null

    // Start watching the next scheduled run once it's close
    const nextRun = state.summary.nextRun
    if (nextRun && !watched) {
      const until = Date.parse(nextRun.at) - now
      if (until < 2 * MIN) watched = { name: nextRun.name, at: nextRun.at, started: false }
      else next = Math.min(next, until - MIN) // check again a minute before it
    }
    if (watched && !watched.started) next = Math.min(next, NEAR_START)

    if (active?.isWatering) {
      next = Math.min(next, WATERING)
      // Check right after the zone should finish, to catch the next zone starting
      const w = state.summary.watering
      const zoneEnd = w?.zoneStartedAt && w.zoneSeconds ? Date.parse(w.zoneStartedAt) + w.zoneSeconds * 1000 : null
      if (zoneEnd && zoneEnd > now) next = Math.min(next, zoneEnd - now + 5 * SEC)
      else if (zoneEnd) next = Math.min(next, 15 * SEC) // zone should have ended: look again soon
      else if (active.minutesLeft) next = Math.min(next, active.minutesLeft * MIN + 5 * SEC)
    } else if (active?.isPaused && active.resumesAt) {
      next = Math.min(next, Math.max(10 * SEC, Date.parse(active.resumesAt) - now + 5 * SEC), WATERING)
    }
    // Waiting on Rachio to confirm a button press: look again soon
    if (waiting && pending) next = Math.min(next, CONFIRM_EVERY)
    latest = { zones: raw.zones, summary: { ...raw.summary, lastSkipped: skippedToShow() } }
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e)
    console.warn('[rachio] check failed:', lastError)
    next = lastError.includes('limit') ? 30 * MIN : IDLE
  }
  onUpdate?.()
  timer = setTimeout(tick, Math.max(10 * SEC, Math.min(next, 10 * MIN)))
}

/** Start checking Rachio around the clock. `update` is called after every check. */
export function startRachioWatcher(update: () => void) {
  onUpdate = update
  if (!rachioConfigured()) { console.log('[rachio] no API key set — irrigation shows demo data'); return }
  void tick()
}

/** Check Rachio right away (after a button press), then carry on with the normal rhythm. */
export function pokeRachio(delayMs = 2000) {
  if (!rachioConfigured()) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(tick, delayMs)
}

const MAX_SECONDS = 3 * 3600

export async function rachioCommand(action: string, zoneId: string, durationSeconds = 600, quickId?: string, extra: { minutes?: number; scheduleId?: string; date?: string } = {}): Promise<void> {
  if (action === 'quick') {
    const state = await cached(stateKey(), STATE_MAX_AGE, loadState)
    const q = quickId ? state.quick[quickId] : undefined
    if (!q) throw new Error('That quick run is not matched to a zone or schedule')
    const label = QUICK_RUNS.find((x) => x.id === quickId)?.label ?? 'the run'
    if (q.scheduleId) {
      await api('/schedulerule/start', { method: 'PUT', body: { id: q.scheduleId } })
      const rule = state.rules?.[q.scheduleId]
      // Base times with the schedule's seasonal shift, if Rachio reports it (the live times take over once it runs)
      const k = 1 + (rule?.seasonal ?? 0)
      await expectStart(state, label, (rule?.zoneRuns ?? []).map((z) => ({ zoneId: z.zoneId, seconds: z.seconds ? Math.round(z.seconds * k) : null })), rule?.name ?? label, false)
    } else {
      // The hold panel can pick another time (1–180 minutes)
      const seconds = extra.minutes ? Math.min(180, Math.max(1, Math.round(Number(extra.minutes)))) * 60 : q.seconds
      await api('/zone/start', { method: 'PUT', body: { id: q.zoneId, duration: seconds } })
      await expectStart(state, label, [{ zoneId: q.zoneId!, seconds: seconds ?? null }], null)
    }
    await cacheDelete(stateKey())
    showNow()
    return
  }
  if (action === 'next-zone') {
    // Rachio's public API has no "skip to next zone", so: stop, then start the
    // zones that were still to come, in order, with their (seasonally adjusted)
    // times. Rachio's history shows the rest as a manual run.
    const state = await cached(stateKey(), STATE_MAX_AGE, loadState)
    const view = latestRachio() ?? state
    const w = view.summary.watering
    if (!w?.zones || w.index === undefined || w.index === null) throw new Error('Not sure which zones are left in this run — skip it in the Rachio app')
    const rest = w.zones.slice(w.index + 1).filter((z) => z.state === 'next')
    if (!rest.length) throw new Error('This is the last zone')
    if (rest.some((z) => !z.seconds)) throw new Error('Rachio didn’t say how long the next zones run — skip it in the Rachio app')
    const deviceId = state.zoneDevice[w.zoneId]
    if (!deviceId) throw new Error('Unknown zone')
    await api('/device/stop_water', { method: 'PUT', body: { id: deviceId } })
    await new Promise((r) => setTimeout(r, 1500)) // let the controller settle before the new run
    await api('/zone/start_multiple', { method: 'PUT', body: { zones: rest.map((z, k) => ({ id: z.zoneId, duration: Math.min(MAX_SECONDS, Math.max(60, z.seconds!)), sortOrder: k + 1 })) } })
    await cacheDelete(pauseKey())
    // Same list as before, with the current zone marked skipped
    await expectStart(state, w.schedule ?? 'the run', w.zones.map((z, k) => ({
      zoneId: z.zoneId, seconds: z.seconds,
      ...(k < w.index! ? { state: z.state === 'skipped' ? 'skipped' as const : 'done' as const } : k === w.index ? { state: 'skipped' as const } : z.state === 'skipped' ? { state: 'skipped' as const } : {}),
    })), w.schedule)
    await cacheDelete(stateKey())
    showNow()
    return
  }
  if (action === 'skip-run') {
    // Skip one schedule's run on one day (the week strip). Rachio can only skip a schedule's next run.
    const state = await cached(stateKey(), STATE_MAX_AGE, loadState)
    const run = state.summary.week?.find((d) => d.date === extra.date)?.runs.find((r) => r.scheduleId === extra.scheduleId)
    if (!run) throw new Error('That run isn’t on the schedule anymore')
    if (run.skipped) return
    if (!run.canSkip) throw new Error(run.reason ?? 'Rachio can’t skip that run')
    await api('/schedulerule/skip', { method: 'PUT', body: { id: run.scheduleId } })
    const list = (await cacheGet<RunSkip[]>(runSkipKey())) ?? []
    await cacheSet(runSkipKey(), [...list, { scheduleId: run.scheduleId!, date: extra.date! }].slice(-50))
    for (const deviceId of new Set(Object.values(state.zoneDevice))) await cacheDelete(`rachio-upcoming-${deviceId}`)
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
      // Remember where the countdown was, so the ring holds still while paused
      const w = state.summary.watering
      const endMs = w?.zoneStartedAt && w.zoneSeconds ? Date.parse(w.zoneStartedAt) + w.zoneSeconds * 1000 : null
      const remainingSec = endMs ? Math.max(0, Math.round((endMs - Date.now()) / 1000)) : null
      await cacheSet(pauseKey(), { zoneId, deviceId, until: Date.now() + seconds * 1000, remainingSec, watering: w && w.zoneId === zoneId ? w : null } satisfies PauseFlag)
    } else {
      await api('/device/resume_zone_run', { method: 'PUT', body: { id: deviceId } })
      await cacheDelete(pauseKey())
    }
    pending = null
    await cacheDelete(stateKey())
    showNow()
    return
  }
  if (action === 'start') {
    const duration = Math.min(MAX_SECONDS, Math.max(60, Math.round(Number(durationSeconds) || 600)))
    await api('/zone/start', { method: 'PUT', body: { id: zoneId, duration } })
    const state = await cached(stateKey(), STATE_MAX_AGE, loadState)
    await expectStart(state, state.zones.find((z) => z.id === zoneId)?.name ?? 'the zone', [{ zoneId, seconds: duration }], null)
  } else if (action === 'stop') {
    const state = await cached(stateKey(), STATE_MAX_AGE, loadState)
    const deviceId = state.zoneDevice[zoneId]
    if (!deviceId) throw new Error('Unknown zone')
    await api('/device/stop_water', { method: 'PUT', body: { id: deviceId } })
    await cacheDelete(pauseKey())
    pending = { kind: 'stop', since: Date.now() }
    notice = null
    await cacheDelete(planKey())
  } else {
    throw new Error(`Unknown action: ${action}`)
  }
  // Next dashboard refresh fetches the new status instead of the cached one.
  await cacheDelete(stateKey())
  showNow()
}

/** Send the new picture to open screens right away (before Rachio has caught up) */
function showNow() { onUpdate?.() }

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
