// The vacuum (Roborock S8 Pro Ultra), through the Roborock integration in
// Home Assistant.
//
// Finds the vacuum.* entity and its sensors by what they are, learns each
// room's Roborock number with roborock.get_maps (matched by name to the rooms
// in src/config/home.ts), and runs the card's commands:
//   whole home  → vacuum.start (or every room, when 2 passes are asked for)
//   rooms       → vacuum.send_command app_segment_clean [{segments, repeat}]
//   areas       → vacuum.send_command app_zoned_clean [[x1, y1, x2, y2, repeat]]
//                 (only once the floor plan is calibrated)
// Suction, water flow and mop route are set first, through the vacuum's fan
// speed and the mop selects.

import type { VacuumPreset, VacuumRoom, VacuumState } from '../src/types.ts'
import { HOME } from '../src/config/home.ts'
import { configPresets, configRooms, fullOrder, whatText } from '../src/lib/vacuum.ts'
import { ha, type HAState } from './ha.ts'
import { cacheGet, cacheSet } from './cache.ts'
import { estimateTables, finishAt, markRunCut, observe, timingNotes, type CleanMode } from './vacuumTiming.ts'

const FIND = {
  battery: ['sensor', /_battery$/],
  status: ['sensor', /_status$/],
  error: ['sensor', /_vacuum_error$|_error$/],
  dockError: ['sensor', /_dock_error$/],
  waterShortage: ['binary_sensor', /_water_shortage$/],
  mopDrying: ['binary_sensor', /_mop_drying$/],
  dryingLeft: ['sensor', /_mop_drying_remaining_time$|_drying_remaining_time$/],
  cleanArea: ['sensor', /_cleaning_area$/],
  cleanTime: ['sensor', /_cleaning_time$/],
  lastCleanEnd: ['sensor', /_last_clean_end$/],
  currentRoom: ['sensor', /_current_room$/],
  mopIntensity: ['select', /_mop_intensity$/],
  mopMode: ['select', /_mop_mode$/],
  /** On for the whole job, mop-wash trips to the dock included (Roborock's in_cleaning) */
  inCleaning: ['binary_sensor', /_cleaning$/],
} as const satisfies Record<string, readonly [string, RegExp]>
type Key = keyof typeof FIND

const ok = (s?: HAState) => !!s && s.state !== 'unavailable' && s.state !== 'unknown'
const num = (s?: HAState) => (ok(s) && Number.isFinite(Number(s!.state)) ? Number(s!.state) : null)
const opts = (s?: HAState): string[] => (Array.isArray(s?.attributes.options) ? s!.attributes.options.map(String) : [])

function resolve(): ({ vac: HAState } & Partial<Record<Key, HAState>>) | null {
  const all = ha.entitiesOf('roborock')
  const vac = all.find((s) => s.entity_id.startsWith('vacuum.'))
  if (!vac) return null
  const device = ha.deviceOf(vac.entity_id)
  const mine = device ? ha.entitiesOf('roborock', device) : all
  const out: { vac: HAState } & Partial<Record<Key, HAState>> = { vac }
  for (const [key, [domain, re]] of Object.entries(FIND) as [Key, readonly [string, RegExp]][]) {
    // The dock can be its own device, so dock sensors are looked for everywhere
    const pool = /dock|water|drying/i.test(key) ? all : mine
    const hits = pool.filter((s) => s.entity_id.startsWith(domain + '.') && re.test(s.entity_id) && !(key === 'error' && /dock/.test(s.entity_id)))
      .sort((a, b) => a.entity_id.length - b.entity_id.length)
    if (hits[0]) out[key] = hits[0]
  }
  return out
}

// ── Rooms: Roborock numbers from roborock.get_maps ─────────────────────
const squash = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[’'`]/g, '').replace(/[^a-z0-9]/g, '')
let segments: Record<string, number> = {}
let roborockRooms: { id: number; name: string }[] = []
let roomsError: string | null = null
let roomsLoadedFor: string | null = null

async function loadRooms(vacId: string) {
  try {
    const res = await ha.callServiceForResponse<any>('roborock', 'get_maps', {}, [vacId])
    const maps: any[] = res?.[vacId]?.maps ?? (Object.values(res ?? {})[0] as any)?.maps ?? []
    const map = maps.find((m) => m?.rooms && Object.keys(m.rooms).length) ?? maps[0]
    roborockRooms = Object.entries(map?.rooms ?? {}).map(([id, name]) => ({ id: Number(id), name: String(name) })).filter((r) => Number.isFinite(r.id))
    const next: Record<string, number> = {}
    for (const room of HOME.vacuum.rooms) {
      const hit = room.match.map(squash).map((m) => roborockRooms.find((r) => squash(r.name) === m)).find(Boolean)
      if (hit) next[room.id] = hit.id
    }
    segments = next
    void cacheSet('vacuum-segments', segments)
    roomsError = roborockRooms.length ? null : 'roborock.get_maps returned no rooms — name the rooms in the Roborock app'
    roomsLoadedFor = vacId
    ha.notify()
  } catch (e) {
    roomsError = `Couldn’t read the Roborock rooms: ${e instanceof Error ? e.message : e}`
  }
}

// ── Lining the floor plan up with the robot's own map (for drawn areas) ──
// Two readings of the robot's position (roborock.get_vacuum_current_position,
// millimetres): one on the dock (we know where the dock is on the picture),
// one somewhere far away that Connor taps on the map. That gives scale and
// offset for each direction: robot = a + b·plan. Saved on the Lenovo.
type Cal = { x: [number, number]; y: [number, number] }
let savedCal: Cal | null = null
let calDock: { robot: [number, number]; at: string } | null = null
void cacheGet<Cal>('vacuum-calibration').then((c) => { if (c) { savedCal = c; ha.notify() } })
void cacheGet<typeof calDock>('vacuum-cal-dock').then((c) => { if (c) calDock = c })
/** The line-up in use: a value in src/config/home.ts wins, else the one set from the page */
export const calibration = (): Cal | null => HOME.vacuum.calibration ?? savedCal

async function robotPosition(id: string): Promise<[number, number]> {
  let res: any
  try { res = await ha.callServiceForResponse<any>('roborock', 'get_vacuum_current_position', {}, [id]) }
  catch (e) { throw new Error(`Couldn’t read the robot’s position: ${e instanceof Error ? e.message : e}`) }
  const p = res?.[id] ?? (Object.values(res ?? {})[0] as any) ?? res
  const x = Number(p?.x), y = Number(p?.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('The robot didn’t report its position — try again in a moment')
  return [x, y]
}

/** Work out the line-up from the dock reading and a second reading at `plan` (floor-plan units). Throws with a reason if it doesn't add up. */
export function solveCalibration(dockPlan: [number, number], dockRobot: [number, number], plan: [number, number], robot: [number, number]): Cal {
  const [W, H] = HOME.vacuum.size
  const dpx = plan[0] - dockPlan[0], dpy = plan[1] - dockPlan[1]
  if (Math.abs(dpx) < W * 0.2 || Math.abs(dpy) < H * 0.2) throw new Error('Pick a spot further from the dock, both across and up the map (the far side of the Master bedroom works well)')
  const drx = robot[0] - dockRobot[0], dry = robot[1] - dockRobot[1]
  if (Math.abs(drx) < 500 || Math.abs(dry) < 500) throw new Error('The robot hasn’t moved far enough from the dock — pause it further away, then tap where it is')
  const bx = drx / dpx, by = dry / dpy
  const ratio = Math.abs(bx) / Math.abs(by)
  if (ratio < 0.7 || ratio > 1.43) throw new Error('That tap doesn’t match where the robot is — check the spot and try again')
  return { x: [dockRobot[0] - bx * dockPlan[0], bx], y: [dockRobot[1] - by * dockPlan[1], by] }
}

// ── Recent cleans (for scheduled cleans: "cleaned these rooms in the last 2 h") ──
type Clean = { rooms?: string[]; endedAt: number }
let cleanLog: Clean[] = []
let lastCleanEndSeen: number | null = null
void cacheGet<Clean[]>('vacuum-clean-log').then((l) => { if (l) cleanLog = [...l, ...cleanLog] })
function logClean(c: Clean) {
  cleanLog = [...cleanLog, c].filter((x) => Date.now() - x.endedAt < 24 * 3_600_000)
  void cacheSet('vacuum-clean-log', cleanLog)
}
/**
 * Cleans that ended since `since`: Panel's own (with their rooms), plus the
 * robot's "last clean end" if Panel didn't follow that clean (Roborock app,
 * Panel off) — rooms unknown, so it counts as the whole home.
 */
export function recentCleans(since: number): Clean[] {
  const out = cleanLog.filter((c) => c.endedAt >= since)
  const t = lastCleanEndSeen
  if (t && Number.isFinite(t) && t >= since && !cleanLog.some((c) => Math.abs(c.endedAt - t) < 15 * 60_000)) out.push({ endedAt: t })
  return out
}

// ── The run started from the dashboard ──────────────────────────────────
type Run = NonNullable<VacuumState['run']>
let run: Run | null = null
const setRun = (r: Run | null) => { run = r; void cacheSet('vacuum-run', r); ha.notify() }

// Pick up the room numbers and the current run after a restart
void cacheGet<Record<string, number>>('vacuum-segments').then((s) => { if (s && !Object.keys(segments).length) segments = s })
void cacheGet<Run>('vacuum-run').then((r) => { if (r && !run) run = r })
let quietDockSince: number | null = null

const MODE: Record<string, VacuumState['state']> = {
  docked: 'docked', cleaning: 'cleaning', paused: 'paused', returning: 'returning', idle: 'idle', error: 'error',
}

/** "water_empty" → "Water empty" */
const words = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

export function vacuumState(): VacuumState | null {
  const e = resolve()
  if (!e) return null
  if (roomsLoadedFor !== e.vac.entity_id && ha.status === 'connected') { roomsLoadedFor = e.vac.entity_id; void loadRooms(e.vac.entity_id) }

  const state = MODE[e.vac.state] ?? (e.vac.state === 'unavailable' ? 'error' : 'idle')
  const battery = num(e.battery) ?? (Number.isFinite(Number(e.vac.attributes.battery_level)) ? Number(e.vac.attributes.battery_level) : null)

  // Mid-run trip to the dock to wash the mop: the run isn't over yet. The robot's own
  // "Cleaning" sensor stays on for the whole job, washes included; without it, any
  // washing status counts. (Until 1.23.1 this also needed a room "still to go", so a
  // one-room run — Kitchen, which starts at the dock — ended at its first mop wash.)
  const status = ok(e.status) ? e.status!.state : ''
  const washing = /wash|mop|empty|dust/i.test(status) && !/dry/i.test(status)
  const jobOn = ok(e.inCleaning) ? e.inCleaning!.state === 'on' : false
  const atDock = state === 'docked' || state === 'idle'
  // Safety: "Cleaning" stuck on while sitting quietly at the dock for 15 min ends the run anyway
  if (run && atDock && jobOn && !washing) { quietDockSince ??= Date.now() } else quietDockSince = null
  const stuck = quietDockSince !== null && Date.now() - quietDockSince > 15 * 60_000
  const midRunWash = !!run && (washing || (jobOn && !stuck))
  // A run ends once the robot is back on the dock
  if (run && (state === 'docked' || state === 'idle') && !midRunWash && Date.now() - Date.parse(run.startedAt) > 120_000) {
    logClean({ rooms: [...run.rooms], endedAt: Date.now() })
    run = null; void cacheSet('vacuum-run', null)
  }
  lastCleanEndSeen = ok(e.lastCleanEnd) ? Date.parse(e.lastCleanEnd!.state) : null
  // A clean started in the Roborock app (or on the robot): follow it as a full clean
  if (!run && (state === 'cleaning' || state === 'paused')) {
    const mode: CleanMode = String(e.vac.attributes.fan_speed) === 'off' ? 'mop' : ok(e.mopIntensity) && e.mopIntensity!.state === 'off' ? 'vac' : 'vacmop'
    run = { name: 'Full clean', rooms: fullOrder(HOME.vacuum.rooms), startedAt: new Date().toISOString(), mode, reps: 1 }
    void cacheSet('vacuum-run', run)
  }

  const dockErr = ok(e.dockError) ? e.dockError!.state : 'ok'
  const cleanEmpty = (ok(e.waterShortage) && e.waterShortage!.state === 'on') || /water_empty|clean.*(empty|short)/.test(dockErr)
  const dirtyFull = /waste_water_tank_full|dirty.*full|cleaning_tank_full/.test(dockErr)
  const otherDock = dockErr !== 'ok' && dockErr !== 'none' && !cleanEmpty && !dirtyFull ? words(dockErr) : null

  const rooms: VacuumRoom[] = configRooms().map((r) => ({ ...r, segment: segments[r.id] ?? null }))
  const presets: VacuumPreset[] = configPresets().map((p) => {
    const missing = p.rooms.filter((id) => segments[id] === undefined)
    return missing.length ? { ...p, available: false, reason: `No Roborock room matches ${missing.map((id) => rooms.find((r) => r.id === id)?.name ?? id).join(', ')}` } : p
  })

  // Current room: a Home Assistant sensor, matched to our rooms by name
  let currentRoom: string | null = null
  if (ok(e.currentRoom)) {
    const name = squash(e.currentRoom!.state)
    currentRoom = HOME.vacuum.rooms.find((r) => r.match.some((m) => squash(m) === name) || squash(r.name) === name)?.id ?? null
  }
  const shownRun = run

  // Time the rooms, and work out when it'll be done
  const now = Date.now()
  observe({
    now,
    run: run ? { startedAt: run.startedAt, rooms: run.rooms, mode: run.mode ?? 'vacmop', reps: run.reps ?? 1 } : null,
    active: state === 'cleaning' || state === 'returning' || (state === 'docked' && midRunWash),
    room: currentRoom,
    stateChangedAt: Date.parse(e.vac.last_changed),
    roomChangedAt: e.currentRoom ? Date.parse(e.currentRoom.last_changed) : undefined,
  })
  const showFinish = state === 'cleaning' || state === 'paused' || (state === 'returning' && midRunWash) || (state === 'docked' && midRunWash)

  const areaM2 = num(e.cleanArea)
  const areaUnit = String(e.cleanArea?.attributes.unit_of_measurement ?? 'm²')
  const timeV = num(e.cleanTime)
  const timeUnit = String(e.cleanTime?.attributes.unit_of_measurement ?? 'min')

  return {
    name: HOME.vacuum.model,
    state,
    batteryPct: battery === null ? null : Math.round(battery),
    error: state === 'error' ? (ok(e.error) && e.error!.state !== 'none' ? words(e.error!.state) : e.vac.state === 'unavailable' ? 'Not responding' : 'Needs attention') : null,
    dock: {
      cleanWater: e.waterShortage || e.dockError ? (cleanEmpty ? 'empty' : 'ok') : null,
      dirtyWater: e.dockError ? (dirtyFull ? 'full' : 'ok') : null,
      mopDrying: ok(e.mopDrying) ? e.mopDrying!.state === 'on' : null,
      dryingMinutes: num(e.dryingLeft) !== null ? Math.round(num(e.dryingLeft)! / (/s$/.test(String(e.dryingLeft!.attributes.unit_of_measurement ?? 'min')) ? 60 : 1)) : null,
      problem: otherDock,
    },
    currentRoom,
    run: shownRun,
    cleanMinutes: timeV === null ? null : Math.round(/^s$/.test(timeUnit) ? timeV / 60 : /^h$/.test(timeUnit) ? timeV * 60 : timeV),
    cleanAreaFt2: areaM2 === null ? null : Math.round(/ft/.test(areaUnit) ? areaM2 : areaM2 * 10.7639),
    suction: (e.vac.attributes.fan_speed as string) ?? null,
    suctionOptions: Array.isArray(e.vac.attributes.fan_speed_list) ? e.vac.attributes.fan_speed_list.map(String) : [],
    mopIntensity: ok(e.mopIntensity) ? e.mopIntensity!.state : null,
    mopIntensityOptions: opts(e.mopIntensity),
    mopRoute: ok(e.mopMode) ? e.mopMode!.state : null,
    mopRouteOptions: opts(e.mopMode),
    rooms,
    presets,
    areas: !!calibration(),
    lineUp: { dockRead: !!calDock, done: !!calibration(), fromConfig: !!HOME.vacuum.calibration },
    lastCleanAt: ok(e.lastCleanEnd) ? e.lastCleanEnd!.state : null,
    ...(() => { const f = showFinish ? finishAt(run, now) : null; return { finishAt: f?.at ?? null, finishingUp: !!f?.finishingUp } })(),
    estimates: estimateTables(),
  }
}

/** Alerts for the status bar */
export function vacuumAlerts(v: VacuumState): { severity: 'warning' | 'critical'; message: string }[] {
  const out: { severity: 'warning' | 'critical'; message: string }[] = []
  if (v.state === 'error') out.push({ severity: 'critical', message: v.error ?? 'Needs attention' })
  if (v.dock.cleanWater === 'empty') out.push({ severity: 'warning', message: 'Clean water tank is empty' })
  if (v.dock.dirtyWater === 'full') out.push({ severity: 'warning', message: 'Dirty water tank is full' })
  if (v.dock.problem) out.push({ severity: 'warning', message: `Dock: ${v.dock.problem}` })
  return out
}

export function vacuumNotes() {
  const e = resolve()
  if (!e) return { found: null, notes: ['No Roborock vacuum in Home Assistant'] }
  const notes: string[] = []
  if (roomsError) notes.push(roomsError)
  for (const r of HOME.vacuum.rooms) if (segments[r.id] === undefined) notes.push(`${r.name}: no Roborock room named ${r.match.map((m) => `"${m}"`).join(' or ')}`)
  if (!calibration()) notes.push('Drawn areas are off until the map is lined up (Map & rooms → Areas → Line up the map)')
  const found: Record<string, string> = { vacuum: e.vac.entity_id }
  for (const k of Object.keys(FIND) as Key[]) if (e[k]) found[k] = e[k]!.entity_id
  return { found, notes, roborockRooms, matched: segments, roomTimes: timingNotes() }
}

// ── Commands ─────────────────────────────────────────────────────────────
export interface VacuumCommand {
  action?: string
  /** clean: rooms (our ids), or areas in floor-plan units [x, y, w, h] */
  rooms?: string[]
  areas?: number[][]
  vacuum?: boolean; mop?: boolean
  suction?: string; passes?: number
  water?: string; route?: string
  preset?: string
  name?: string
  /** lineup-point: where the robot is, in floor-plan units */
  at?: number[]
}

const clampPasses = (n: unknown, max: number) => Math.min(max, Math.max(1, Math.round(Number(n) || 1)))

/** Pick the Roborock option that means "low"/"medium"/"high" (names differ by model) */
function waterOption(options: string[], want: string): string | null {
  const w = want.toLowerCase()
  const groups: Record<string, RegExp> = { off: /^off$/, low: /low|mild|light/, medium: /medium|moderate|standard|middle/, high: /high|intense|heavy|max/ }
  const re = groups[w]
  return options.find((o) => o.toLowerCase() === w) ?? (re ? options.find((o) => re.test(o.toLowerCase())) : null) ?? null
}
function routeOption(options: string[], want: string): string | null {
  const w = want.toLowerCase().replace(/\+$/, '_plus').replace(/\s+/g, '_')
  return options.find((o) => o.toLowerCase() === w) ?? options.find((o) => o.toLowerCase().replace(/[^a-z]/g, '') === w.replace(/[^a-z]/g, '')) ?? null
}
function suctionOption(options: string[], want: string): string | null {
  const w = want.toLowerCase().replace(/\+$/, '_plus').replace(/\s+/g, '_')
  return options.find((o) => o.toLowerCase() === w) ?? null
}

export async function vacuumCommand(b: VacuumCommand) {
  const e = resolve()
  if (!e) throw new Error('The vacuum isn’t in Home Assistant yet')
  if (e.vac.state === 'unavailable') throw new Error('The vacuum isn’t responding — check it’s on Wi-Fi')
  const id = e.vac.entity_id
  const vac = (service: string, data: Record<string, unknown> = {}) => ha.callService('vacuum', service, data, [id])

  switch (b.action) {
    case 'pause': return vac('pause')
    case 'resume': return vac('start')
    case 'dock': markRunCut(); return vac('return_to_base')
    case 'stop': markRunCut(); return vac('stop')
    case 'preset': {
      const p = HOME.vacuum.presets.find((x) => x.id === b.preset)
      if (!p) throw new Error('That preset isn’t set up')
      return clean(e, { rooms: [...p.rooms], vacuum: p.vacuum, mop: p.mop, name: p.name })
    }
    case 'clean': return clean(e, b)
    case 'lineup-dock': {
      const st = MODE[e.vac.state] ?? 'idle'
      if (st !== 'docked') throw new Error('Put the robot on the dock first (Send to dock), then read its position')
      calDock = { robot: await robotPosition(id), at: new Date().toISOString() }
      void cacheSet('vacuum-cal-dock', calDock); ha.notify()
      return
    }
    case 'lineup-point': {
      if (!calDock) throw new Error('Do step 1 first: read the position with the robot on the dock')
      const at = b.at
      if (!Array.isArray(at) || at.length !== 2 || !at.every((n) => Number.isFinite(n))) throw new Error('Tap the spot on the map where the robot is')
      const robot = await robotPosition(id)
      const cal = solveCalibration(HOME.vacuum.dock as [number, number], calDock.robot, [at[0], at[1]], robot)
      savedCal = cal; void cacheSet('vacuum-calibration', cal); ha.notify()
      console.log('[vacuum] map lined up', JSON.stringify(cal))
      return
    }
    case 'lineup-reset': {
      savedCal = null; calDock = null
      void cacheSet('vacuum-calibration', null); void cacheSet('vacuum-cal-dock', null); ha.notify()
      return
    }
    default: throw new Error('Unknown vacuum command')
  }
}

async function clean(e: NonNullable<ReturnType<typeof resolve>>, b: VacuumCommand) {
  const id = e.vac.entity_id
  const doVac = b.vacuum !== false, doMop = b.mop !== false
  if (!doVac && !doMop) throw new Error('Turn on Vacuum or Mop first')
  if (e.vac.state === 'cleaning') throw new Error('It’s already cleaning — pause or send it to the dock first')

  // Check the rooms before changing any settings
  const picked = (b.rooms ?? []).filter((r, i, a) => a.indexOf(r) === i)
  const reps = clampPasses(b.passes, b.areas?.length ? 3 : 2)
  const allRooms = fullOrder(HOME.vacuum.rooms)
  const ids = picked.length ? allRooms.filter((r) => picked.includes(r)).concat(picked.filter((r) => !allRooms.includes(r))) : allRooms
  const needSegments = !b.areas?.length && (picked.length > 0 || reps > 1)
  if (needSegments && ids.some((r) => segments[r] === undefined)) await loadRooms(id)
  const missing = needSegments ? ids.filter((r) => segments[r] === undefined) : []
  if (missing.length) {
    const names = missing.map((r) => HOME.vacuum.rooms.find((x) => x.id === r)?.name ?? r)
    throw new Error(`No Roborock room matches ${names.join(', ')} — check the room names in the Roborock app`)
  }
  if (b.areas?.length && !calibration()) throw new Error('Drawn areas need the map lined up first (Areas → Line up the map) — pick rooms instead')

  // 1. Settings: suction (off = mop only), water flow (off = vacuum only), mop route
  const fanList: string[] = Array.isArray(e.vac.attributes.fan_speed_list) ? e.vac.attributes.fan_speed_list.map(String) : []
  if (!doVac) {
    const off = suctionOption(fanList, 'off')
    if (!off) throw new Error('This vacuum can’t turn suction off, so it can’t mop only')
    await ha.callService('vacuum', 'set_fan_speed', { fan_speed: off }, [id])
  } else if (b.suction) {
    const s = suctionOption(fanList, b.suction)
    if (!s) throw new Error(`Suction "${b.suction}" isn’t one of: ${fanList.join(', ')}`)
    await ha.callService('vacuum', 'set_fan_speed', { fan_speed: s }, [id])
  } else if (String(e.vac.attributes.fan_speed) === 'off') {
    // Last run was mop only — bring suction back
    const s = suctionOption(fanList, 'balanced')
    if (s) await ha.callService('vacuum', 'set_fan_speed', { fan_speed: s }, [id])
  }
  if (e.mopIntensity) {
    const options = opts(e.mopIntensity)
    // Mopping: the water flow picked for this run, otherwise the default (Medium)
    const want = !doMop ? waterOption(options, 'off') : waterOption(options, b.water ?? HOME.vacuum.waterDefault)
    if (!doMop && !want) throw new Error('This vacuum can’t turn the mop off from here')
    if (want && want !== e.mopIntensity.state) await ha.callService('select', 'select_option', { option: want }, [e.mopIntensity.entity_id])
  } else if (!doMop) {
    throw new Error('The mop setting isn’t in Home Assistant, so it can’t vacuum only')
  }
  if (doMop && b.route && e.mopMode) {
    const r = routeOption(opts(e.mopMode), b.route)
    if (r && r !== e.mopMode.state) await ha.callService('select', 'select_option', { option: r }, [e.mopMode.entity_id])
  }

  const what = whatText(doVac, doMop)
  const mode: CleanMode = doVac && doMop ? 'vacmop' : doVac ? 'vac' : 'mop'

  // 2. Areas (needs calibration)
  if (b.areas?.length) {
    const cal = calibration()!
    const zones = b.areas.slice(0, 5).map(([x, y, w, h]) => {
      const xs = [cal.x[0] + cal.x[1] * x, cal.x[0] + cal.x[1] * (x + w)].sort((a, c) => a - c)
      const ys = [cal.y[0] + cal.y[1] * y, cal.y[0] + cal.y[1] * (y + h)].sort((a, c) => a - c)
      return [Math.round(xs[0]), Math.round(ys[0]), Math.round(xs[1]), Math.round(ys[1]), reps]
    })
    await ha.callService('vacuum', 'send_command', { command: 'app_zoned_clean', params: zones }, [id])
    setRun({ name: b.name ?? `${what} · ${zones.length} area${zones.length > 1 ? 's' : ''}`, rooms: [], startedAt: new Date().toISOString(), mode, reps })
    return
  }

  // 3. Rooms, or the whole home
  if (!picked.length && reps === 1) {
    await ha.callService('vacuum', 'start', {}, [id])
    setRun({ name: b.name ?? 'Full clean', rooms: allRooms, startedAt: new Date().toISOString(), mode, reps: 1 })
    return
  }
  await ha.callService('vacuum', 'send_command', { command: 'app_segment_clean', params: [{ segments: ids.map((r) => segments[r]), repeat: reps }] }, [id])
  setRun({ name: b.name ?? (picked.length ? `${what} · ${picked.length} room${picked.length > 1 ? 's' : ''}` : 'Full clean'), rooms: ids, startedAt: new Date().toISOString(), mode, reps })
}
