// Scheduled cleans ("Start at…"), kept by Panel on the Lenovo — not in the Roborock app.
//
// A clean (a preset, or rooms / whole home with its settings) can be set to start
// later, up to 14 days ahead, one time only. Panel saves it in /data, so it
// survives restarts and updates, and checks every 15 seconds whether one is due.
// Home Assistant can't see schedules made in the Roborock app, so instead of
// reading them Panel checks the robot itself at the time (Connor, Nov 17 2026):
//   1. Already cleaning (e.g. a Roborock schedule started it) → skipped.
//   2. Cleaned the same rooms in the last 2 hours → skipped. Cleans started from
//      Panel are matched room by room; one Panel didn't see (Roborock app, Panel
//      off) counts as every room — HA only says when it ended, not where.
//   3. Dock can't mop (clean water empty / dirty water full, mopping runs only)
//      or battery under 20% → skipped, with Run now.
//   Otherwise it starts through the same path as the Start button.
// If Panel was off at the time (more than 3 minutes late) it's marked missed and
// a chip offers Run now — it never starts late on its own. Home Assistant not
// answering → tries again every minute for 15 minutes. Skipped / missed entries
// stay until dismissed (or 24 hours).

import { randomUUID } from 'node:crypto'
import { cacheGet, cacheSet } from './cache.ts'
import { HOME } from '../src/config/home.ts'
import { fullOrder } from '../src/lib/vacuum.ts'
import { recentCleans, vacuumCommand, vacuumState, type VacuumCommand } from './vacuum.ts'
import type { ScheduledClean } from '../src/types.ts'

interface Saved {
  id: string
  /** What to run: the same command the Start button sends ('preset' or 'clean') */
  cmd: VacuumCommand
  name: string
  at: number
  createdAt: number
  state: 'pending' | 'skipped' | 'missed'
  reason?: string
  failingSince?: number
  /** When it was skipped / missed (for the 24 h tidy-up) */
  endedAt?: number
}

const KEY = 'vacuum-scheduled'
const TICK_MS = 15_000
const LATE_MS = 3 * 60_000
const RETRY_MAX_MS = 15 * 60_000
const RECENT_MS = 2 * 3_600_000
const KEEP_DONE_MS = 24 * 3_600_000
const MAX_AHEAD_MS = 14 * 86_400_000
const MAX_PENDING = 10
const LOW_BATTERY = 20

let list: Saved[] = []
let loaded = false
let busy = false
let onChange: (() => void) | null = null

const save = async () => { await cacheSet(KEY, list); onChange?.() }
const clock = (t: number) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: process.env.TIMEZONE || 'America/Los_Angeles' })

/** The rooms a command would clean (empty = whole home) */
function roomsOf(cmd: VacuumCommand): string[] {
  if (cmd.action === 'preset') return [...(HOME.vacuum.presets.find((p) => p.id === cmd.preset)?.rooms ?? [])]
  return cmd.rooms?.length ? [...cmd.rooms] : fullOrder(HOME.vacuum.rooms)
}
function mopsOf(cmd: VacuumCommand): boolean {
  if (cmd.action === 'preset') return !!HOME.vacuum.presets.find((p) => p.id === cmd.preset)?.mop
  return cmd.mop !== false
}

/** Load saved cleans and start checking. Ones whose time passed while Panel was off become missed. */
export async function startVacuumScheduler(update: () => void) {
  onChange = update
  list = (await cacheGet<Saved[]>(KEY)) ?? []
  loaded = true
  const now = Date.now()
  let changed = false
  for (const r of list) {
    if (r.state === 'pending' && now - r.at > LATE_MS) {
      Object.assign(r, { state: 'missed', reason: `Panel was off at ${clock(r.at)}`, endedAt: now }); changed = true
      console.warn(`[vacuum] scheduled clean ${r.name} missed: Panel was off at ${clock(r.at)}`)
    }
  }
  if (changed) await save()
  setInterval(() => { void tick() }, TICK_MS)
  void tick()
}

/** Why it shouldn't start now, or null to go ahead (rules 1–3 above) */
export function skipReason(cmd: VacuumCommand, now = Date.now()): string | null {
  const v = vacuumState()
  if (!v) return null // handled by the caller (retry)
  if (v.state === 'cleaning' || v.state === 'returning' || v.state === 'paused' || v.run) return `already cleaning at ${clock(now)}`
  const want = roomsOf(cmd)
  const recent = recentCleans(now - RECENT_MS)
  const covered = new Set(recent.flatMap((c) => c.rooms ?? fullOrder(HOME.vacuum.rooms)))
  if (want.length && want.every((r) => covered.has(r))) {
    const last = recent.reduce((a, b) => (b.endedAt > a.endedAt ? b : a))
    return `cleaned ${want.length === 1 ? 'this room' : 'these rooms'} at ${clock(last.endedAt)}`
  }
  if (mopsOf(cmd)) {
    if (v.dock.cleanWater === 'empty') return 'clean water empty'
    if (v.dock.dirtyWater === 'full') return 'dirty water tank full'
  }
  if (v.batteryPct !== null && v.batteryPct < LOW_BATTERY) return `battery at ${v.batteryPct}%`
  if (v.state === 'error') return v.error ? `robot problem: ${v.error}` : 'the robot reports a problem'
  return null
}

async function tick() {
  if (!loaded || busy) return
  busy = true
  try {
    const now = Date.now()
    const before = list.length
    list = list.filter((r) => r.state === 'pending' || !r.endedAt || now - r.endedAt < KEEP_DONE_MS)
    if (list.length !== before) await save()
    for (const r of [...list].sort((a, b) => a.at - b.at)) {
      if (r.state !== 'pending' || r.at > now) continue
      if (now - r.at > LATE_MS && !r.failingSince) {
        Object.assign(r, { state: 'missed', reason: `Panel was off at ${clock(r.at)}`, endedAt: now }); await save(); continue
      }
      if (!vacuumState()) {
        r.failingSince ??= now
        if (now - r.failingSince > RETRY_MAX_MS) Object.assign(r, { state: 'missed', reason: 'Couldn’t reach the robot', endedAt: now })
        await save(); break
      }
      const why = skipReason(r.cmd, now)
      if (why) {
        Object.assign(r, { state: 'skipped', reason: why, endedAt: now })
        console.log(`[vacuum] scheduled clean ${r.name} skipped: ${why}`)
        await save(); continue
      }
      try {
        await vacuumCommand(r.cmd)
        list = list.filter((x) => x.id !== r.id)
        console.log(`[vacuum] scheduled clean ${r.name} started`)
        await save()
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        r.failingSince ??= now
        if (now - r.failingSince > RETRY_MAX_MS) Object.assign(r, { state: 'missed', reason: `Couldn’t start: ${msg}`, endedAt: now })
        console.warn('[vacuum] scheduled clean failed to start:', msg)
        await save()
      }
      break // one start per tick
    }
  } finally {
    busy = false
  }
}

/** For the dashboard: every scheduled clean, soonest first */
export function scheduledCleans(): ScheduledClean[] {
  return [...list].sort((a, b) => a.at - b.at).map((r) => ({
    id: r.id,
    at: new Date(r.at).toISOString(),
    createdAt: new Date(r.createdAt).toISOString(),
    state: r.state,
    reason: r.reason ?? null,
    name: r.name,
    cmd: r.cmd as ScheduledClean['cmd'],
    rooms: roomsOf(r.cmd),
  }))
}

function checkCmd(c: any): { cmd: VacuumCommand; name: string } {
  if (!c || typeof c !== 'object') throw new Error('Nothing to schedule')
  if (c.action === 'preset') {
    const p = HOME.vacuum.presets.find((x) => x.id === c.preset)
    if (!p) throw new Error('That preset isn’t set up')
    return { cmd: { action: 'preset', preset: p.id }, name: p.name }
  }
  if (c.action !== 'clean') throw new Error('Nothing to schedule')
  if (c.areas?.length) throw new Error('Drawn areas can’t be scheduled — pick rooms instead')
  const known = new Set<string>(HOME.vacuum.rooms.map((r) => r.id))
  const rooms: string[] = Array.isArray(c.rooms) ? c.rooms.map(String) : []
  if (rooms.some((r) => !known.has(r))) throw new Error('Unknown room')
  if (c.vacuum === false && c.mop === false) throw new Error('Turn on Vacuum or Mop first')
  const cmd: VacuumCommand = { action: 'clean', rooms, vacuum: c.vacuum !== false, mop: c.mop !== false }
  for (const k of ['suction', 'water', 'route'] as const) if (typeof c[k] === 'string') cmd[k] = c[k]
  if (c.passes) cmd.passes = Math.min(2, Math.max(1, Math.round(Number(c.passes) || 1)))
  const names = rooms.map((id) => HOME.vacuum.rooms.find((r) => r.id === id)!.name)
  const name = typeof c.name === 'string' && c.name.trim() ? c.name.trim().slice(0, 40)
    : !rooms.length ? 'Full clean' : names.length === 1 ? names[0] : `${names.length} rooms`
  cmd.name = name
  return { cmd, name }
}

function checkTime(at: unknown): number {
  const t = typeof at === 'string' ? Date.parse(at) : Number(at)
  if (!Number.isFinite(t)) throw new Error('Pick a start time')
  if (t < Date.now() + 30_000) throw new Error('That time has passed — pick a later one, or Now')
  if (t > Date.now() + MAX_AHEAD_MS) throw new Error('Cleans can be set up to 14 days ahead')
  return t
}

/** Actions from the dashboard: add, update, cancel, dismiss, run-now */
export async function vacuumScheduledCommand(action: string, b: { id?: string; cmd?: unknown; at?: unknown }): Promise<void> {
  if (!loaded) throw new Error('Panel is still starting — try again in a moment')
  const find = () => { const r = list.find((x) => x.id === b.id); if (!r) throw new Error('That scheduled clean is gone (it may have just started)'); return r }

  if (action === 'add') {
    if (list.filter((r) => r.state === 'pending').length >= MAX_PENDING) throw new Error(`Up to ${MAX_PENDING} scheduled cleans at a time`)
    const { cmd, name } = checkCmd(b.cmd)
    list.push({ id: randomUUID(), cmd, name, at: checkTime(b.at), createdAt: Date.now(), state: 'pending' })
    await save(); return
  }
  if (action === 'update') {
    const r = find()
    const { cmd, name } = b.cmd !== undefined ? checkCmd(b.cmd) : { cmd: r.cmd, name: r.name }
    Object.assign(r, { cmd, name, at: checkTime(b.at), state: 'pending', reason: undefined, failingSince: undefined, endedAt: undefined })
    await save(); return
  }
  if (action === 'cancel' || action === 'dismiss') {
    find()
    list = list.filter((x) => x.id !== b.id)
    await save(); return
  }
  if (action === 'run-now') {
    const r = find()
    await vacuumCommand(r.cmd) // the normal start: its own checks (already cleaning…) still apply
    list = list.filter((x) => x.id !== r.id)
    await save(); return
  }
  throw new Error('Unknown action')
}

/** Tests only: run one check now */
export const _tickForTests = () => tick()
