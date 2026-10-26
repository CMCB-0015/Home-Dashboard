// How long each room takes, learned from the robot's own runs, and the
// "Done ~5:42 PM" estimate built from it.
//
// Home Assistant tells us which room the robot is in, but not how long is
// left. So while a run goes, the time from entering a room until entering the
// next one is timed (trips back to the dock to wash the mop land in the room
// it left from, so they're included). Paused time doesn't count. Times are
// kept separately for vacuum + mop, vacuum only and mop only, the last five of
// each, and saved so they survive restarts and updates.
//
// A room is only timed when the robot was seen walking into it, so a room it
// was already in when the dashboard started isn't timed short. No estimate is
// shown until every room still to go has been timed at least once.

import { cacheGet, cacheSet } from './cache.ts'

export type CleanMode = 'vacmop' | 'vac' | 'mop'
type Learned = Partial<Record<CleanMode, Record<string, number[]>>>

const KEEP = 5
const MIN_SAMPLE_S = 30      // shorter than this = it just passed through
const MAX_SAMPLE_S = 3 * 3600

let learned: Learned = {}
void cacheGet<Learned>('vacuum-room-times').then((l) => { if (l) learned = { ...l, ...learned } })

interface Track {
  startedAt: string           // which run this is
  mode: CleanMode
  reps: number
  room: string | null         // room being timed
  fresh: boolean              // we saw it walk into `room`
  activeMs: number            // time spent in `room` so far, not counting pauses
  lastT: number
  active: boolean
  visited: string[]
}
let track: Track | null = null

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

/** Typical seconds for one pass of a room, or null if never timed */
export function typicalSeconds(mode: CleanMode, room: string): number | null {
  const xs = learned[mode]?.[room]
  return xs?.length ? median(xs) : null
}

function record(t: Track) {
  if (!t.room || !t.fresh || t.reps !== 1) return
  const s = Math.round(t.activeMs / 1000)
  if (s < MIN_SAMPLE_S || s > MAX_SAMPLE_S) return
  const byRoom = (learned[t.mode] ??= {})
  byRoom[t.room] = [...(byRoom[t.room] ?? []), s].slice(-KEEP)
  void cacheSet('vacuum-room-times', learned)
  console.log(`[vacuum] ${t.room} took ${Math.round(s / 60)} min (${t.mode})`)
}

export interface Seen {
  now: number
  /** The run in progress, or null when there isn't one */
  run: { startedAt: string; rooms: string[]; mode: CleanMode; reps: number } | null
  /** Robot is working (cleaning, or away from the room washing the mop) — not paused */
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
    if (track) { accrue(track, Math.min(s.now, Math.max(track.lastT, s.stateChangedAt ?? s.now))); record(track); track = null }
    return
  }
  if (!track || track.startedAt !== s.run.startedAt) {
    if (track) { accrue(track, s.now); record(track) }
    track = { startedAt: s.run.startedAt, mode: s.run.mode, reps: s.run.reps, room: s.room, fresh: false, activeMs: 0, lastT: s.now, active: s.active, visited: [] }
    return
  }
  const t = track
  const at = (x: number | undefined) => (x && Number.isFinite(x) ? Math.min(s.now, Math.max(t.lastT, x)) : s.now)
  // Walked into another room (null = between rooms or at the dock: still the same room)
  const moved = !!s.room && s.room !== t.room
  const activeChanged = s.active !== t.active
  // Apply the two changes in the order they happened
  const steps: { when: number; kind: 'room' | 'active' }[] = []
  if (moved) steps.push({ when: at(s.roomChangedAt), kind: 'room' })
  if (activeChanged) steps.push({ when: at(s.stateChangedAt), kind: 'active' })
  steps.sort((a, b) => a.when - b.when)
  for (const st of steps) {
    accrue(t, st.when)
    if (st.kind === 'active') t.active = s.active
    else {
      // Only a room we saw it walk into counts as done (at the start, Home Assistant still shows the last run's room)
      if (t.room && t.fresh) { record(t); if (!t.visited.includes(t.room)) t.visited.push(t.room) }
      t.room = s.room
      t.fresh = true
      t.activeMs = 0
    }
  }
  accrue(t, s.now)
  t.active = s.active
}

function accrue(t: Track, now: number) {
  if (t.active) t.activeMs += Math.max(0, now - t.lastT)
  t.lastT = now
}

/** Rooms of this run still to go (not finished, not the one it's in) */
export function roomsLeft(run: { startedAt: string; rooms: string[] }): string[] | null {
  if (!track || track.startedAt !== run.startedAt) return null
  return run.rooms.filter((r) => !track!.visited.includes(r) && !(track!.fresh && r === track!.room))
}

/** When the run should be done, or null when it can't be worked out without guessing */
export function finishAt(run: { startedAt: string; rooms: string[] } | null, now: number): string | null {
  if (!run || !run.rooms.length || !track || track.startedAt !== run.startedAt) return null
  const t = track
  const mode = t.mode
  let ms = 0
  if (t.room && t.fresh && run.rooms.includes(t.room)) {
    const typ = typicalSeconds(mode, t.room)
    if (typ === null) return null
    const spent = t.activeMs + (t.active ? Math.max(0, now - t.lastT) : 0)
    // Running long: allow a minute more rather than showing a time in the past
    ms += Math.max(60_000, typ * 1000 * t.reps - spent)
  }
  for (const r of roomsLeft(run) ?? []) {
    const typ = typicalSeconds(mode, r)
    if (typ === null) return null
    ms += typ * 1000 * t.reps
  }
  if (!ms) return null
  return new Date(now + ms).toISOString()
}

/** Rooms the robot has finished in this run */
export function roomsVisited(startedAt: string): string[] {
  return track && track.startedAt === startedAt ? [...track.visited] : []
}

/** For /api/setup-check */
export function timingNotes() {
  const out: Record<string, Record<string, string>> = {}
  for (const [mode, rooms] of Object.entries(learned)) {
    out[mode] = Object.fromEntries(Object.entries(rooms ?? {}).map(([r, xs]) => [r, `${Math.round(median(xs) / 60)} min (${xs.length} run${xs.length > 1 ? 's' : ''})`]))
  }
  return out
}

/** Tests only */
export function _resetTiming(l: Learned = {}) { learned = l; track = null }
