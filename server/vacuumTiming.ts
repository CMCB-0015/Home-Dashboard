// How long runs and rooms take, learned from the robot's own runs, and the
// "Done ~5:42 PM" estimate built from it.
//
// Home Assistant tells us which room the robot is in, but not how long is
// left. So the dashboard learns it two ways, both kept per mode (vacuum + mop,
// vacuum only, mop only) as the AVERAGE OF THE LAST FIVE runs — one run is
// enough for a first estimate, and it settles as more come in:
//
//  1. Whole runs: the total working time of each kind of run (the same set of
//     rooms and passes — Kitchen, Bedrooms, Full clean…), not counting pauses.
//     Mop-wash trips to the dock and the drive home are included. When that
//     run has been done before, Done ~ = now + (typical total − time worked so
//     far). That's a fixed time: it doesn't move while the robot works, and
//     moves out only while paused.
//  2. Rooms: the time from starting a room to walking into the next one. Used
//     only for a set of rooms that hasn't been run before (sum of the rooms).
//
// The dock is in Kitchen/Living Room, so the robot never "walks into" that
// room on a run that starts there: the room it starts in counts from the
// start when it's part of the run. Only rooms that are part of the run are
// timed, once per run: a room's time runs until the robot reaches the next
// room of the run (or the run ends), so detours through other rooms — to
// wash the mop, or on the way — stay with the room it's working on and are
// never learned as a time for the room it drove through.
//
// A run that was cut short (Send to dock / Stop) isn't learned. Past the
// typical time the card says "Finishing up" instead of a time.

import { cacheDelete, cacheGet, cacheSet } from './cache.ts'
import { runKey } from '../src/lib/vacuum.ts'
import { HOME } from '../src/config/home.ts'
import type { VacuumEstimates } from '../src/types.ts'

export type CleanMode = 'vacmop' | 'vac' | 'mop'
type Samples = Partial<Record<CleanMode, Record<string, number[]>>>

const KEEP = 5
const MIN_ROOM_S = 30          // shorter than this = it just passed through
const MIN_RUN_S = 60
const MAX_S = 4 * 3600

// Seed (Connor, Nov 14 2026): a Kitchen-only vacuum + mop run took 24 min.
// It counts as the first of five, not a fixed time.
const SEED_RUNS: Samples = { vacmop: { kitchen: [24 * 60] } }

let roomTimes: Samples = {}
let runTimes: Samples = {}
// v2: the old per-room times (v1) included drive-throughs, so they're dropped once
void cacheDelete('vacuum-room-times')
void cacheGet<Samples>('vacuum-room-times-v2').then((l) => { if (l) roomTimes = merge(l, roomTimes) })
void cacheGet<Samples>('vacuum-run-times').then((l) => { runTimes = merge(l ?? SEED_RUNS, runTimes) })
// One-time clean-up (1.23.1, Connor's call): Kitchen/Living Room runs cut short at their first mop
// wash were learned as 5 and 1 min. Drop Kitchen samples under 10 min from run and room times.
void (async () => {
  if (await cacheGet<boolean>('vacuum-kitchen-fix-1.23.1')) return
  await new Promise((r) => setTimeout(r, 1500)) // after the loads above
  for (const [s, key] of [[runTimes, 'vacuum-run-times'], [roomTimes, 'vacuum-room-times-v2']] as const) {
    let changed = false
    for (const byKey of Object.values(s)) {
      const xs = byKey?.kitchen
      if (xs?.some((x) => x < 600)) { byKey!.kitchen = xs.filter((x) => x >= 600); changed = true }
    }
    if (changed) { void cacheSet(key, s); console.log(`[vacuum] dropped short Kitchen samples from ${key}`) }
  }
  void cacheSet('vacuum-kitchen-fix-1.23.1', true)
})()
// One-time reset (1.23.2, Connor's call): clear the learned whole-run times of the three presets
// (Kitchen, Margaux's room, Bedrooms) — runs since 1.20.4 could be cut short at a mop wash. Each
// relearns from its next run. Full clean and room times are left alone.
void (async () => {
  if (await cacheGet<boolean>('vacuum-presets-reset-1.23.2')) return
  await new Promise((r) => setTimeout(r, 2500)) // after the loads and the 1.23.1 clean-up above
  for (const p of HOME.vacuum.presets) {
    const mode: CleanMode = p.vacuum && p.mop ? 'vacmop' : p.vacuum ? 'vac' : 'mop'
    const key = runKey(p.rooms, 1)
    if (runTimes[mode]?.[key]) { delete runTimes[mode]![key]; console.log(`[vacuum] cleared learned times for preset ${p.name}`) }
  }
  void cacheSet('vacuum-run-times', runTimes)
  void cacheSet('vacuum-presets-reset-1.23.2', true)
})()

function merge(a: Samples, b: Samples): Samples {
  const out: Samples = {}
  for (const m of new Set([...Object.keys(a), ...Object.keys(b)]) as Set<CleanMode>) {
    out[m] = { ...(a[m] ?? {}) }
    for (const [k, xs] of Object.entries(b[m] ?? {})) out[m]![k] = [...(out[m]![k] ?? []), ...xs].slice(-KEEP)
  }
  return out
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

export { runKey }

function typical(s: Samples, mode: CleanMode, key: string): number | null {
  const xs = s[mode]?.[key]
  return xs?.length ? mean(xs) : null
}
/** Typical seconds for one pass of a room, or null if never timed */
export const typicalRoomSeconds = (mode: CleanMode, room: string) => typical(roomTimes, mode, room)
/** Typical seconds for a whole run of these rooms, or null if never done */
export const typicalRunSeconds = (mode: CleanMode, rooms: string[], reps: number) => typical(runTimes, mode, runKey(rooms, reps))

function add(s: Samples, cacheKey: string, mode: CleanMode, key: string, secs: number) {
  const byKey = (s[mode] ??= {})
  byKey[key] = [...(byKey[key] ?? []), Math.round(secs)].slice(-KEEP)
  void cacheSet(cacheKey, s)
}

interface Track {
  startedAt: string           // which run this is
  rooms: string[]
  mode: CleanMode
  reps: number
  room: string | null         // room of this run being timed
  here?: string | null        // room it's physically in
  fresh: boolean              // this room's time counts (walked in, or started in it)
  activeMs: number            // time in `room` so far, not counting pauses
  runMs: number               // time worked on the whole run so far, not counting pauses
  lastT: number
  active: boolean
  visited: string[]
  cut: boolean                // sent to the dock / stopped early: don't learn the run
}
let track: Track | null = null
void cacheGet<Track>('vacuum-track').then((t) => { if (t && !track) track = t })
let lastSaved = 0
function saveTrack(force = false) {
  const now = Date.now()
  if (!force && now - lastSaved < 30_000) return
  lastSaved = now
  void cacheSet('vacuum-track', track)
}

function recordRoom(t: Track) {
  if (!t.room || !t.fresh || t.reps !== 1 || !t.rooms.includes(t.room) || t.visited.includes(t.room)) return
  const s = t.activeMs / 1000
  if (s < MIN_ROOM_S || s > MAX_S) return
  add(roomTimes, 'vacuum-room-times-v2', t.mode, t.room, s)
  console.log(`[vacuum] room ${t.room} took ${Math.round(s / 60)} min (${t.mode})`)
}

function finishRun(t: Track) {
  if (!t.cut) recordRoom(t)
  const s = t.runMs / 1000
  if (t.cut || !t.rooms.length || s < MIN_RUN_S || s > MAX_S) return
  add(runTimes, 'vacuum-run-times', t.mode, runKey(t.rooms, t.reps), s)
  console.log(`[vacuum] run ${runKey(t.rooms, t.reps)} took ${Math.round(s / 60)} min (${t.mode})`)
}

/** The run was sent to the dock or stopped before it was done: don't learn its time */
export function markRunCut() {
  if (track) { track.cut = true; saveTrack(true) }
}

export interface Seen {
  now: number
  /** The run in progress, or null when there isn't one */
  run: { startedAt: string; rooms: string[]; mode: CleanMode; reps: number } | null
  /** Robot is working (cleaning, heading home, or at the dock washing the mop) — not paused */
  active: boolean
  room: string | null
  /** When Home Assistant says the robot's state and room last changed (so a change is timed exactly, however late we look) */
  stateChangedAt?: number
  roomChangedAt?: number
}

/** Call whenever the vacuum's state is read. Keeps the timers going. */
export function observe(s: Seen) {
  if (!s.run) {
    // The run ended when the robot docked: stop the clock then, not when we noticed
    if (track) { accrue(track, Math.min(s.now, Math.max(track.lastT, s.stateChangedAt ?? s.now))); finishRun(track); track = null; saveTrack(true) }
    return
  }
  if (!track || track.startedAt !== s.run.startedAt) {
    if (track) { accrue(track, s.now); finishRun(track) }
    // The room it starts in counts from the start when it's part of this run
    // (the dock is in Kitchen/Living Room, so it never walks into that room)
    const startRoom = s.room && s.run.rooms.includes(s.room) ? s.room : null
    track = {
      startedAt: s.run.startedAt, rooms: [...s.run.rooms], mode: s.run.mode, reps: s.run.reps,
      room: startRoom, here: s.room, fresh: !!startRoom, activeMs: 0, runMs: 0, lastT: s.now, active: s.active, visited: [], cut: false,
    }
    saveTrack(true)
    return
  }
  const t = track
  const at = (x: number | undefined) => (x && Number.isFinite(x) ? Math.min(s.now, Math.max(t.lastT, x)) : s.now)
  // Walked into another room (null = between rooms or at the dock: still the same room)
  const moved = !!s.room && s.room !== t.here
  if (moved) t.here = s.room
  const activeChanged = s.active !== t.active
  const steps: { when: number; kind: 'room' | 'active' }[] = []
  if (moved) steps.push({ when: at(s.roomChangedAt), kind: 'room' })
  if (activeChanged) steps.push({ when: at(s.stateChangedAt), kind: 'active' })
  steps.sort((a, b) => a.when - b.when)
  for (const st of steps) {
    accrue(t, st.when)
    if (st.kind === 'active') t.active = s.active
    else if (s.room && s.room !== t.room && t.rooms.includes(s.room) && !t.visited.includes(s.room)) {
      // On to the next room of this run: the last one is done
      if (t.room && t.fresh) { recordRoom(t); if (t.rooms.includes(t.room) && !t.visited.includes(t.room)) t.visited.push(t.room) }
      t.room = s.room
      t.fresh = true
      t.activeMs = 0
    }
    // Otherwise it's driving through a room that isn't part of this run (or one
    // it already did), e.g. on the way to wash the mop: that time stays with
    // the room it's working on.
  }
  accrue(t, s.now)
  t.active = s.active
  saveTrack(steps.length > 0)
}

function accrue(t: Track, now: number) {
  if (t.active) { const d = Math.max(0, now - t.lastT); t.activeMs += d; t.runMs += d }
  t.lastT = now
}

/** Rooms of this run still to go (not finished, not the one it's in) */
export function roomsLeft(run: { startedAt: string; rooms: string[] }): string[] | null {
  if (!track || track.startedAt !== run.startedAt) return null
  return run.rooms.filter((r) => !track!.visited.includes(r) && !(track!.fresh && r === track!.room))
}

export interface Finish {
  /** When the run should be done; null when there's nothing to go on yet, or it's running long */
  at: string | null
  /** Past the typical time: the card says "Finishing up" */
  finishingUp: boolean
}

/** When the run should be done */
export function finishAt(run: { startedAt: string; rooms: string[] } | null, now: number): Finish {
  const none = { at: null, finishingUp: false }
  if (!run || !run.rooms.length || !track || track.startedAt !== run.startedAt) return none
  const t = track
  const live = t.active ? Math.max(0, now - t.lastT) : 0
  const done = (ms: number) => (ms > 0 ? { at: new Date(now + ms).toISOString(), finishingUp: false } : { at: null, finishingUp: true })

  // 1. This kind of run has been done before
  const whole = typicalRunSeconds(t.mode, t.rooms, t.reps)
  if (whole !== null) return done(whole * 1000 - (t.runMs + live))

  // 2. New combination: add up the rooms (every room left needs a time)
  let ms = 0
  if (t.room && t.fresh && t.rooms.includes(t.room) && !t.visited.includes(t.room)) {
    const typ = typicalRoomSeconds(t.mode, t.room)
    if (typ === null) return none
    ms += Math.max(0, typ * 1000 * t.reps - (t.activeMs + live))
  }
  const left = roomsLeft(run) ?? []
  for (const r of left) {
    const typ = typicalRoomSeconds(t.mode, r)
    if (typ === null) return none
    ms += typ * 1000 * t.reps
  }
  return done(ms)
}

/** Rooms the robot has finished in this run */
export function roomsVisited(startedAt: string): string[] {
  return track && track.startedAt === startedAt ? [...track.visited] : []
}

/** For /api/setup-check: each average and the runs behind it, in minutes */
export function timingNotes() {
  const show = (s: Samples) => {
    const out: Record<string, Record<string, string>> = {}
    for (const [mode, keys] of Object.entries(s)) {
      out[mode] = Object.fromEntries(Object.entries(keys ?? {}).map(([k, xs]) =>
        [k, `${Math.round(mean(xs) / 60)} min avg of ${xs.length} (${xs.map((x) => Math.round(x / 60)).join(', ')})`]))
    }
    return out
  }
  return { runs: show(runTimes), rooms: show(roomTimes) }
}

/** Average seconds for every learned run and room, for estimating a run before it starts */
export function estimateTables(): VacuumEstimates {
  const avg = (s: Samples) => Object.fromEntries(Object.entries(s).map(([m, keys]) =>
    [m, Object.fromEntries(Object.entries(keys ?? {}).filter(([, xs]) => xs.length).map(([k, xs]) => [k, Math.round(mean(xs))]))]))
  return { runs: avg(runTimes), rooms: avg(roomTimes) }
}

/** Tests only */
export function _resetTiming(rooms: Samples = {}, runs: Samples = {}) { roomTimes = rooms; runTimes = runs; track = null }
