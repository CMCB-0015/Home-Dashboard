// Scheduled quick runs ("Start at…"), kept by Panel on the Lenovo — not in Rachio.
//
// A quick run can be set to start later (up to 14 days ahead). Panel saves it in
// /data, so it survives restarts and updates, and checks every 15 seconds whether
// one is due. When it is:
//   • If anything is watering (a Rachio schedule, another quick run), it waits
//     and starts as soon as that ends ("Quick run waiting"), for up to 3 hours.
//   • Otherwise it starts it through the same path as the Start button
//     (start-zones), so the card shows it like any quick run. It runs even if
//     Rachio has rain/weather skips on (a manual run is a manual choice).
//   • If Rachio can't be reached, it tries again every minute for 15 minutes.
//   • If Panel was off at the time (more than 3 minutes late), it's marked
//     missed and a chip offers Run now — it doesn't start on its own late.
// Nothing is sent to Rachio until a run starts, so a pending run costs no
// Rachio requests. Not a repeating schedule — that's what Rachio schedules are for.

import { randomUUID } from 'node:crypto'
import { cacheGet, cacheSet } from './cache.ts'
import { latestRachio, rachioCommand, scheduleRunPlan } from './rachio.ts'
import type { ScheduledQuickRun } from '../src/types.ts'

interface Saved {
  id: string
  /** Zones and minutes (for a schedule run: Rachio's estimate when it was set up, shown only) */
  zones: { zoneId: string; minutes: number }[]
  /** A whole Rachio schedule (a schedule quick-run button, e.g. "Lawns"): starts the schedule itself */
  quickId?: string
  schedule?: string
  at: number
  createdAt: number
  state: 'pending' | 'waiting' | 'missed'
  reason?: string
  /** First failed try to start (Rachio unreachable) */
  failingSince?: number
}

const KEY = 'rachio-scheduled'
const TICK_MS = 15_000
/** Later than this past its time and it counts as missed (Panel was off or restarting) */
const LATE_MS = 3 * 60_000
const WAIT_MAX_MS = 3 * 3_600_000
const RETRY_MAX_MS = 15 * 60_000
const MAX_AHEAD_MS = 14 * 86_400_000
const MAX_PENDING = 10
const MAX_MINUTES = 60

let runs: Saved[] = []
let loaded = false
let busy = false
let onChange: (() => void) | null = null

const save = async () => { await cacheSet(KEY, runs); onChange?.() }
const clock = (t: number) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: process.env.TIMEZONE || 'America/Los_Angeles' })

/** Load saved runs and start checking. Runs whose time passed while Panel was off become missed. */
export async function startQuickRunScheduler(update: () => void) {
  onChange = update
  runs = (await cacheGet<Saved[]>(KEY)) ?? []
  loaded = true
  const now = Date.now()
  let changed = false
  for (const r of runs) {
    if (r.state === 'pending' && now - r.at > LATE_MS) {
      r.state = 'missed'; r.reason = `Panel was off at ${clock(r.at)}`; changed = true
      console.warn(`[rachio] scheduled quick run ${r.id} missed: Panel was off at ${clock(r.at)}`)
    }
  }
  if (changed) await save()
  setInterval(() => { void tick() }, TICK_MS)
  void tick()
}

/** Start a run: a schedule button starts the Rachio schedule (its times that day); otherwise the zones */
const startRun = (r: Saved) => r.quickId
  ? rachioCommand('quick', '', undefined, r.quickId)
  : rachioCommand('start-zones', '', undefined, undefined, { zones: r.zones })

async function tick() {
  if (!loaded || busy) return
  busy = true
  try {
    const now = Date.now()
    for (const r of [...runs].sort((a, b) => a.at - b.at)) {
      if (r.state === 'missed' || r.at > now) continue
      if (r.state === 'pending' && now - r.at > LATE_MS) {
        r.state = 'missed'; r.reason = `Panel was off at ${clock(r.at)}`
        await save(); continue
      }
      const rachio = latestRachio()
      const running = rachio?.zones.find((z) => z.isWatering || z.isPaused)
      if (!rachio || running) {
        if (now - r.at > WAIT_MAX_MS) {
          r.state = 'missed'
          r.reason = running ? `${rachio?.summary.watering?.schedule ?? running.name} was still watering` : 'Couldn’t reach Rachio'
          await save(); continue
        }
        const reason = running ? `${rachio?.summary.watering?.schedule ?? running.name} is watering` : 'Waiting for Rachio'
        if (r.state !== 'waiting' || r.reason !== reason) { r.state = 'waiting'; r.reason = reason; await save() }
        break // one at a time; the next waits its turn
      }
      try {
        await startRun(r)
        runs = runs.filter((x) => x.id !== r.id)
        console.log(`[rachio] scheduled quick run started (${r.schedule ? `${r.schedule} schedule` : `${r.zones.length} zone${r.zones.length > 1 ? 's' : ''}`})`)
        await save()
        break // the next one (if due) waits until this one has finished
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        r.failingSince ??= now
        if (now - r.failingSince > RETRY_MAX_MS) { r.state = 'missed'; r.reason = `Couldn’t start: ${msg}` }
        else { r.state = 'waiting'; r.reason = 'Retrying — Rachio didn’t answer' }
        console.warn('[rachio] scheduled quick run failed to start:', msg)
        await save()
        break
      }
    }
  } finally {
    busy = false
  }
}

/** For the dashboard: every scheduled run with zone names, soonest first */
export function scheduledQuickRuns(zoneNames: Map<string, string>): ScheduledQuickRun[] {
  return [...runs].sort((a, b) => a.at - b.at).map((r) => ({
    id: r.id,
    at: new Date(r.at).toISOString(),
    createdAt: new Date(r.createdAt).toISOString(),
    state: r.state,
    reason: r.reason ?? null,
    schedule: r.schedule ?? null,
    zones: r.zones.map((z) => ({ zoneId: z.zoneId, name: zoneNames.get(z.zoneId) ?? 'Zone', minutes: z.minutes })),
  }))
}

function checkZones(list: unknown): Saved['zones'] {
  const rachio = latestRachio()
  if (!rachio) throw new Error('Rachio isn’t connected yet — try again in a moment')
  const known = new Set(rachio.zones.map((z) => z.id))
  const zones = (Array.isArray(list) ? list : []).map((z: any) => ({ zoneId: String(z?.zoneId ?? ''), minutes: Math.round(Number(z?.minutes)) }))
  if (!zones.length) throw new Error('Pick a zone to run')
  if (zones.length > 16) throw new Error('Too many zones')
  for (const z of zones) {
    if (!known.has(z.zoneId)) throw new Error('Unknown zone')
    if (!(z.minutes >= 1 && z.minutes <= MAX_MINUTES)) throw new Error(`Run time must be 1–${MAX_MINUTES} minutes`)
  }
  if (new Set(zones.map((z) => z.zoneId)).size !== zones.length) throw new Error('Each zone can only be in the run once')
  return zones
}

function checkTime(at: unknown): number {
  const t = typeof at === 'string' ? Date.parse(at) : Number(at)
  if (!Number.isFinite(t)) throw new Error('Pick a start time')
  if (t < Date.now() + 30_000) throw new Error('That time has passed — pick a later one, or Now')
  if (t > Date.now() + MAX_AHEAD_MS) throw new Error('Quick runs can be set up to 14 days ahead')
  return t
}

/** Actions from the dashboard: add, update, cancel, run-now, dismiss */
/** A schedule button's run: name + zones (Rachio's estimate) */
async function checkSchedule(quickId: unknown) {
  const plan = typeof quickId === 'string' ? await scheduleRunPlan(quickId) : null
  if (!plan) throw new Error('That schedule isn’t matched in Rachio')
  if (!plan.zones.length) throw new Error('That schedule has no zones')
  return { quickId: quickId as string, schedule: plan.name, zones: plan.zones }
}

export async function scheduledCommand(action: string, b: { id?: string; zones?: unknown; quickId?: unknown; at?: unknown }): Promise<void> {
  if (!loaded) throw new Error('Panel is still starting — try again in a moment')
  const find = () => { const r = runs.find((x) => x.id === b.id); if (!r) throw new Error('That scheduled run is gone (it may have just started)'); return r }

  if (action === 'add') {
    if (runs.filter((r) => r.state !== 'missed').length >= MAX_PENDING) throw new Error(`Up to ${MAX_PENDING} scheduled quick runs at a time`)
    const what = b.quickId !== undefined ? await checkSchedule(b.quickId) : { zones: checkZones(b.zones) }
    runs.push({ id: randomUUID(), ...what, at: checkTime(b.at), createdAt: Date.now(), state: 'pending' })
    await save(); return
  }
  if (action === 'update') {
    const r = find()
    if (r.state === 'waiting') throw new Error('It’s already due and waiting to start — cancel it or start it now')
    // A schedule run only changes its time (Rachio's schedule decides the zones)
    const what = r.quickId ? await checkSchedule(r.quickId) : { zones: checkZones(b.zones) }
    const at = checkTime(b.at)
    Object.assign(r, { ...what, at, state: 'pending', reason: undefined, failingSince: undefined })
    await save(); return
  }
  if (action === 'cancel' || action === 'dismiss') {
    find()
    runs = runs.filter((x) => x.id !== b.id)
    await save(); return
  }
  if (action === 'run-now') {
    const r = find()
    if (r.quickId || b.zones === undefined) await startRun(r)
    else await rachioCommand('start-zones', '', undefined, undefined, { zones: checkZones(b.zones) })
    runs = runs.filter((x) => x.id !== r.id)
    await save(); return
  }
  throw new Error('Unknown action')
}
