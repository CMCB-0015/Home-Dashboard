// Shared by the vacuum card, the Map & rooms page and the server.
import { HOME } from '../config/home'
import type { VacuumEstimates, VacuumPreset, VacuumRoom, VacuumState } from '../types'

export const VAC_GREY = '#8b9baa'

export const whatText = (vacuum: boolean, mop: boolean) =>
  vacuum && mop ? 'Vacuum + mop' : vacuum ? 'Vacuum only' : mop ? 'Mop only' : ''

/** Rooms from the config, before Roborock room numbers are known */
export function configRooms(): VacuumRoom[] {
  return HOME.vacuum.rooms.map((r) => ({ id: r.id, name: r.name, color: r.color, main: r.main, rects: r.rects.map((q) => [...q]), segment: null }))
}

export function configPresets(): VacuumPreset[] {
  return HOME.vacuum.presets.map((p) => ({ id: p.id, name: p.name, sub: whatText(p.vacuum, p.mop), color: p.color, rooms: [...p.rooms], vacuum: p.vacuum, mop: p.mop, available: true }))
}

/** Every room in full-clean order (rooms missing from fullOrder go last) */
export function fullOrder(rooms: readonly { id: string }[]): string[] {
  const order: string[] = HOME.vacuum.fullOrder.filter((id) => rooms.some((r) => r.id === id))
  return [...order, ...rooms.map((r) => r.id).filter((id) => !order.includes(id))]
}

/** Where the dot goes: middle of the room's labelled box */
export function roomCenter(r: VacuumRoom): [number, number] {
  const m = r.rects[r.main] ?? r.rects[0]
  return [m[0] + m[2] / 2, m[1] + m[3] / 2]
}

/** The run's progress: which room it's on (index) and how many are done */
export function runProgress(v: VacuumState) {
  const run = v.run
  if (!run) return null
  const idx = v.currentRoom ? run.rooms.indexOf(v.currentRoom) : -1
  const done = v.state === 'returning' || v.state === 'docked' ? run.rooms.length : Math.max(0, idx)
  return { idx, done, total: run.rooms.length }
}

/** The key for a kind of run: its rooms (any order) and passes. Shared with the server. */
export const runKey = (rooms: readonly string[], reps: number) => [...rooms].sort().join('+') + (reps > 1 ? `×${reps}` : '')

export interface Estimate {
  /** ok = a time; partial = a time for the rooms that have one (some don't yet); none = nothing to go on */
  state: 'ok' | 'partial' | 'none'
  minutes: number
  /** Each room's own time, for the chips (null = not timed yet) */
  parts: { id: string; name: string; color: string; minutes: number | null }[]
}

/**
 * How long a run would take if started now, from the last 5 runs:
 * the same run done before → its own average; otherwise add up each room's
 * average (× passes), leaving out rooms with no time yet (state 'partial').
 * No rooms = the whole home. Worked out in the browser, so it follows taps at once.
 */
export function estimateRun(v: VacuumState, pick: { rooms: readonly string[]; vacuum: boolean; mop: boolean; passes?: number }): Estimate {
  const none: Estimate = { state: 'none', minutes: 0, parts: [] }
  const mode = pick.vacuum && pick.mop ? 'vacmop' : pick.vacuum ? 'vac' : pick.mop ? 'mop' : null
  const est: VacuumEstimates | undefined = v.estimates
  if (!mode || !est) return none
  const reps = Math.max(1, pick.passes ?? 1)
  const ids = pick.rooms.length ? [...pick.rooms] : fullOrder(v.rooms)
  const order = v.rooms.map((r) => r.id)
  ids.sort((a, b) => order.indexOf(a) - order.indexOf(b))
  const roomAvg = est.rooms[mode] ?? {}
  const parts = ids.map((id) => {
    const r = v.rooms.find((x) => x.id === id)
    const s = roomAvg[id]
    return { id, name: r?.name ?? id, color: r?.color ?? VAC_GREY, minutes: s ? Math.round((s * reps) / 60) : null }
  })
  const whole = est.runs[mode]?.[runKey(ids, reps)]
  if (whole) return { state: 'ok', minutes: Math.max(1, Math.round(whole / 60)), parts }
  const known = ids.filter((id) => roomAvg[id])
  if (!known.length) return none
  const secs = known.reduce((n, id) => n + roomAvg[id] * reps, 0)
  return { state: known.length < ids.length ? 'partial' : 'ok', minutes: Math.max(1, Math.round(secs / 60)), parts }
}

/** "11:16 PM" for now + minutes */
export const doneBy = (minutes: number, now = Date.now()) =>
  new Date(now + minutes * 60_000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export function demoVacuum(lastCleanAt: string): VacuumState {
  return {
    name: HOME.vacuum.model, state: 'docked', batteryPct: 100, error: null,
    dock: { cleanWater: 'ok', dirtyWater: 'ok', mopDrying: false, dryingMinutes: null, problem: null },
    currentRoom: null, run: null, cleanMinutes: 39, cleanAreaFt2: 334,
    suction: 'balanced', suctionOptions: ['off', 'quiet', 'balanced', 'turbo', 'max', 'max_plus'],
    mopIntensity: 'moderate', mopIntensityOptions: ['off', 'mild', 'moderate', 'intense'],
    mopRoute: 'standard', mopRouteOptions: ['standard', 'deep', 'deep_plus', 'fast'],
    rooms: configRooms().map((r, i) => ({ ...r, segment: 16 + i })),
    presets: configPresets(), areas: false, lastCleanAt, finishAt: null,
    // Demo: one clean set for tomorrow 10 AM, so the chip, card row and details show
    scheduled: [((t) => ({ id: 'demo-1', at: t, createdAt: new Date().toISOString(), state: 'pending' as const, reason: null, name: 'Bedrooms', cmd: { action: 'preset' as const, preset: 'bedrooms' }, rooms: ['master', 'margaux', 'guest'] }))(((d) => { d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); return d.toISOString() })(new Date()))],
    estimates: { runs: { vacmop: { kitchen: 25 * 60 } }, rooms: { vacmop: { kitchen: 26 * 60, hall: 300, guest: 600, margaux: 540, master: 900, hallbath: 240, masterbath: 360 }, vac: { margaux: 420 } } },
    dust: { autoEmpty: null, emptyMode: 'smart', emptyModeOptions: ['smart', 'light', 'balanced', 'max'] },
  }
}
