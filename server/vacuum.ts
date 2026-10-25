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

// ── The run started from the dashboard ──────────────────────────────────
type Run = NonNullable<VacuumState['run']>
let run: Run | null = null
const setRun = (r: Run | null) => { run = r; void cacheSet('vacuum-run', r); ha.notify() }

// Pick up the room numbers and the current run after a restart
void cacheGet<Record<string, number>>('vacuum-segments').then((s) => { if (s && !Object.keys(segments).length) segments = s })
void cacheGet<Run>('vacuum-run').then((r) => { if (r && !run) run = r })

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

  // A run ends once the robot is back on the dock
  if (run && (state === 'docked' || state === 'idle') && Date.now() - Date.parse(run.startedAt) > 120_000) { run = null; void cacheSet('vacuum-run', null) }

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
  // A full clean started in the Roborock app: show it with every room
  const shownRun = run ?? (state === 'cleaning' || state === 'paused' || state === 'returning'
    ? { name: 'Full clean', rooms: fullOrder(rooms), startedAt: e.vac.last_changed } : null)

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
    areas: !!HOME.vacuum.calibration,
    lastCleanAt: ok(e.lastCleanEnd) ? e.lastCleanEnd!.state : null,
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
  if (!HOME.vacuum.calibration) notes.push('Drawn areas are off until the floor plan is calibrated (vacuum.calibration in src/config/home.ts)')
  const found: Record<string, string> = { vacuum: e.vac.entity_id }
  for (const k of Object.keys(FIND) as Key[]) if (e[k]) found[k] = e[k]!.entity_id
  return { found, notes, roborockRooms, matched: segments }
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
    case 'dock': return vac('return_to_base')
    case 'stop': return vac('stop')
    case 'preset': {
      const p = HOME.vacuum.presets.find((x) => x.id === b.preset)
      if (!p) throw new Error('That preset isn’t set up')
      return clean(e, { rooms: [...p.rooms], vacuum: p.vacuum, mop: p.mop, name: p.name })
    }
    case 'clean': return clean(e, b)
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
  if (b.areas?.length && !HOME.vacuum.calibration) throw new Error('Drawn areas need the floor plan calibrated first — pick rooms instead')

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
    const want = !doMop ? waterOption(options, 'off') : b.water ? waterOption(options, b.water) : e.mopIntensity.state === 'off' ? waterOption(options, 'medium') : null
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

  // 2. Areas (needs calibration)
  if (b.areas?.length) {
    const cal = HOME.vacuum.calibration!
    const zones = b.areas.slice(0, 5).map(([x, y, w, h]) => {
      const xs = [cal.x[0] + cal.x[1] * x, cal.x[0] + cal.x[1] * (x + w)].sort((a, c) => a - c)
      const ys = [cal.y[0] + cal.y[1] * y, cal.y[0] + cal.y[1] * (y + h)].sort((a, c) => a - c)
      return [Math.round(xs[0]), Math.round(ys[0]), Math.round(xs[1]), Math.round(ys[1]), reps]
    })
    await ha.callService('vacuum', 'send_command', { command: 'app_zoned_clean', params: zones }, [id])
    setRun({ name: b.name ?? `${what} · ${zones.length} area${zones.length > 1 ? 's' : ''}`, rooms: [], startedAt: new Date().toISOString() })
    return
  }

  // 3. Rooms, or the whole home
  if (!picked.length && reps === 1) {
    await ha.callService('vacuum', 'start', {}, [id])
    setRun({ name: b.name ?? 'Full clean', rooms: allRooms, startedAt: new Date().toISOString() })
    return
  }
  await ha.callService('vacuum', 'send_command', { command: 'app_segment_clean', params: [{ segments: ids.map((r) => segments[r]), repeat: reps }] }, [id])
  setRun({ name: b.name ?? (picked.length ? `${what} · ${picked.length} room${picked.length > 1 ? 's' : ''}` : 'Full clean'), rooms: ids, startedAt: new Date().toISOString() })
}
