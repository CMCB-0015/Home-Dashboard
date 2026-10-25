// Shared by the vacuum card, the Map & rooms page and the server.
import { HOME } from '../config/home'
import type { VacuumPreset, VacuumRoom, VacuumState } from '../types'

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

export function demoVacuum(lastCleanAt: string): VacuumState {
  return {
    name: HOME.vacuum.model, state: 'docked', batteryPct: 100, error: null,
    dock: { cleanWater: 'ok', dirtyWater: 'ok', mopDrying: false, dryingMinutes: null, problem: null },
    currentRoom: null, run: null, cleanMinutes: 39, cleanAreaFt2: 334,
    suction: 'balanced', suctionOptions: ['off', 'quiet', 'balanced', 'turbo', 'max', 'max_plus'],
    mopIntensity: 'moderate', mopIntensityOptions: ['off', 'mild', 'moderate', 'intense'],
    mopRoute: 'standard', mopRouteOptions: ['standard', 'deep', 'deep_plus', 'fast'],
    rooms: configRooms().map((r, i) => ({ ...r, segment: 16 + i })),
    presets: configPresets(), areas: false, lastCleanAt,
  }
}
