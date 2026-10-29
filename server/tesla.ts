// The Tesla (WillaWilla), through Teslemetry in Home Assistant.
//
// Teslemetry streams the car's data into Home Assistant, which keeps it in
// entities like sensor.willawilla_battery_level. This file finds those
// entities by what they are (not by exact name), builds the card's data and
// runs the card's commands. Anything it can't find shows up in
// /api/setup-check, and the matching button says so instead of pretending.
//
// The car is never woken just to refresh — only a button press wakes it.

import type { Tesla } from '../src/types.ts'
import { HOME } from '../src/config/home.ts'
import { ha, type HAState } from './ha.ts'
import { currentTrail, recordTrail, routeHome, routeNotes, trailHeading } from './teslaMap.ts'

const PLATFORMS = ['teslemetry', 'tesla_fleet', 'tessie']

// What each control is called in Home Assistant (object id, after the car's name)
const FIND = {
  climate: ['climate', /_climate$|^climate\.[^.]+$/],
  battery: ['sensor', /_battery_level$/],
  range: ['sensor', /_battery_range$|_estimate_battery_range$|_range$/],
  charging: ['sensor', /_charging$|_charging_state$/],
  chargeLimit: ['number', /_charge_limit$/],
  chargeAmps: ['number', /_charge_current$/],
  chargerAmps: ['sensor', /_charger_current$/],
  chargeRate: ['sensor', /_charge_rate$/],
  doneAt: ['sensor', /_time_to_full_charge$/],
  chargeSwitch: ['switch', /_charge$/],
  port: ['cover', /_charge_port_door$|_charge_port$/],
  cable: ['binary_sensor', /_charge_cable$/],
  lock: ['lock', /_lock$/],
  inside: ['sensor', /_inside_temperature$/],
  outside: ['sensor', /_outside_temperature$/],
  heatDriver: ['select', /_seat_heater_front_left$/],
  heatPassenger: ['select', /_seat_heater_front_right$/],
  heatRearLeft: ['select', /_seat_heater_rear_left$/],
  heatRearCenter: ['select', /_seat_heater_rear_center$/],
  heatRearRight: ['select', /_seat_heater_rear_right$/],
  coolDriver: ['select', /_seat_cooler_front_left$|_seat_ventilation_front_left$/],
  coolPassenger: ['select', /_seat_cooler_front_right$|_seat_ventilation_front_right$/],
  wheelSelect: ['select', /_steering_wheel_heater$/],
  wheelSwitch: ['switch', /_steering_wheel_heater$/],
  frontDefrost: ['switch', /_defrost$|_front_defrost(er)?$|_max_defrost$/],
  rearDefrost: ['switch', /_rear_defrost(er)?$|_rear_window_heater$/],
  frunk: ['cover', /_frunk$/],
  trunk: ['cover', /_trunk$/],
  location: ['device_tracker', /_location$/],
  route: ['device_tracker', /_route$|_destination$/],
  destination: ['sensor', /_destination$/],
  minutesToArrival: ['sensor', /_minutes_to_arrival$|_time_to_arrival$/],
  milesToArrival: ['sensor', /_distance_to_arrival$|_miles_to_arrival$/],
  trafficDelay: ['sensor', /_traffic_delay$|_traffic_minutes_delay$/],
  heading: ['sensor', /_gps_heading$|_heading$/],
  shift: ['sensor', /_shift_state$/],
  speed: ['sensor', /_speed$/],
  status: ['binary_sensor', /_status$|_online$/],
  scheduleTime: ['sensor', /_scheduled_charging_start_time$/],
  schedulePending: ['binary_sensor', /_scheduled_charging_pending$/],
} as const satisfies Record<string, readonly [string, RegExp]>

type Key = keyof typeof FIND

/** The car's entities, found by what they are */
function resolve(): Partial<Record<Key, HAState>> | null {
  const all = ha.entitiesOf(PLATFORMS)
  const climate = all.find((s) => s.entity_id.startsWith('climate.') && !/overheat/.test(s.entity_id))
  if (!climate) return null
  const device = ha.deviceOf(climate.entity_id)
  const mine = device ? ha.entitiesOf(PLATFORMS, device) : all
  const out: Partial<Record<Key, HAState>> = { climate }
  for (const [key, [domain, re]] of Object.entries(FIND) as [Key, readonly [string, RegExp]][]) {
    if (key === 'climate') continue
    // Pick the shortest match, so "_charge" doesn't grab "_charge_cable" and the like
    const hits = mine.filter((s) => s.entity_id.startsWith(domain + '.') && re.test(s.entity_id))
      .sort((a, b) => a.entity_id.length - b.entity_id.length)
    if (hits[0]) out[key] = hits[0]
  }
  return out
}

const ok = (s?: HAState) => !!s && s.state !== 'unavailable' && s.state !== 'unknown'
const num = (s?: HAState) => (ok(s) && Number.isFinite(Number(s!.state)) ? Number(s!.state) : null)
const on = (s?: HAState) => (ok(s) ? s!.state === 'on' : null)

/** °F from a temperature sensor that may report °C */
function tempF(s?: HAState): number | null {
  const v = num(s)
  if (v === null) return null
  return /C$/.test(String(s!.attributes.unit_of_measurement ?? '')) ? Math.round(v * 9 / 5 + 32) : Math.round(v)
}

/** Miles from a distance sensor that may report km */
function miles(s?: HAState): number | null {
  const v = num(s)
  if (v === null) return null
  return /^km$/i.test(String(s!.attributes.unit_of_measurement ?? '')) ? Math.round(v * 0.621371) : Math.round(v)
}

/** Seat select option → level 0–3 */
function level(s?: HAState): number {
  if (!ok(s)) return 0
  const v = s!.state.toLowerCase()
  if (/high|3/.test(v)) return 3
  if (/med|2/.test(v)) return 2
  if (/low|1/.test(v)) return 1
  return 0
}

function distanceMi(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 3958.8, rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function coords(s?: HAState) {
  const lat = Number(s?.attributes.latitude), lon = Number(s?.attributes.longitude)
  return Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0) ? { lat, lon } : null
}

function home() { return coords(ha.states.get('zone.home')) }

/** "Home" when the navigation destination is within a quarter mile of home */
function headingHome(e: Partial<Record<Key, HAState>>): boolean {
  const h = home()
  const dest = coords(e.route) ?? coords(e.destination)
  if (h && dest) return distanceMi(h, dest) < 0.25
  // No coordinates: only trust a destination literally named Home
  const name = String(e.destination?.state ?? e.route?.state ?? '').trim().toLowerCase()
  return name === 'home'
}

export function teslaState(): Tesla | null {
  const e = resolve()
  if (!e?.climate) return null
  const c = e.climate
  const chargingRaw = String(e.charging?.state ?? '').toLowerCase()
  const charging: Tesla['charging'] =
    chargingRaw === 'charging' ? 'charging'
    : chargingRaw === 'starting' ? 'starting'
    : chargingRaw === 'complete' ? 'complete'
    : chargingRaw === 'no_power' || chargingRaw === 'nopower' ? 'no_power'
    : chargingRaw === 'disconnected' || chargingRaw === '' || chargingRaw === 'unknown' ? 'unplugged'
    : 'stopped'
  const plugged = on(e.cable) ?? charging !== 'unplugged'

  const loc = coords(e.location)
  const h = home()
  const atHome = e.location?.state === 'home' || (!!loc && !!h && distanceMi(loc, h) < 0.15)
  const shift = String(e.shift?.state ?? '').toUpperCase()
  const driving = ['D', 'R', 'N'].includes(shift) || (num(e.speed) ?? 0) > 0

  let enRouteHome: Tesla['enRouteHome'] = null
  if (!atHome && headingHome(e)) {
    const m = e.minutesToArrival
    let minutes: number | null = null, arriveAt: string | null = null
    if (ok(m) && m!.attributes.device_class === 'timestamp') {
      arriveAt = m!.state
      minutes = Math.max(0, Math.round((Date.parse(m!.state) - Date.now()) / 60_000))
    } else {
      minutes = num(m)
      if (minutes !== null) arriveAt = new Date(Date.now() + minutes * 60_000).toISOString()
    }
    const zone = e.location?.state
    const delay = num(e.trafficDelay)
    enRouteHome = {
      minutes, arriveAt, miles: miles(e.milesToArrival),
      trafficDelayMin: delay !== null && delay >= 1 ? Math.round(delay) : null,
      near: zone && !['not_home', 'home', 'unknown', 'unavailable'].includes(zone) ? zone : null,
    }
  }

  // Live map: this drive's trail, heading, and Google's route home while navigating home
  recordTrail(loc, driving)
  const reported = num(e.heading)
  const heading = reported !== null ? reported : driving ? trailHeading(loc) : null
  const dest = coords(e.route) ?? coords(e.destination)
  const routeAhead = enRouteHome ? routeHome(loc, dest ?? home()) : routeHome(null, null)

  const steering = e.wheelSelect ? (ok(e.wheelSelect) ? e.wheelSelect.state !== 'off' : null) : on(e.wheelSwitch)
  const sched = e.scheduleTime || e.schedulePending
    ? {
        enabled: on(e.schedulePending) ?? ok(e.scheduleTime),
        time: ok(e.scheduleTime) && !Number.isNaN(Date.parse(e.scheduleTime!.state))
          ? new Date(e.scheduleTime!.state).toTimeString().slice(0, 5) : null,
      }
    : null
  const coolingSeats = !!(e.coolDriver || e.coolPassenger)
  const seat = (heat?: HAState, cool?: HAState) => { const hl = level(heat); return hl ? hl : -level(cool) }
  // Teslemetry's "Time to full charge" is a timestamp: when charging reaches the limit.
  // (Some setups report a duration instead — hours or minutes — so take that too.)
  let doneAt: string | null = null
  if (ok(e.doneAt)) {
    const raw = e.doneAt!.state
    if (e.doneAt!.attributes.device_class === 'timestamp' || /T\d\d:/.test(raw)) doneAt = Number.isNaN(Date.parse(raw)) ? null : raw
    else if (Number.isFinite(Number(raw)) && Number(raw) > 0) {
      const unit = String(e.doneAt!.attributes.unit_of_measurement ?? 'h').toLowerCase()
      const ms = Number(raw) * (unit.startsWith('min') ? 60_000 : unit === 's' ? 1000 : 3_600_000)
      doneAt = new Date(Date.now() + ms).toISOString()
    }
  }

  const limit = num(e.chargeLimit)
  const updated = [c, e.battery, e.charging, e.lock].filter(Boolean).map((s) => Date.parse(s!.last_updated)).filter(Number.isFinite)
  return {
    name: HOME.tesla.name,
    online: on(e.status) ?? c.state !== 'unavailable',
    batteryPct: num(e.battery) === null ? null : Math.round(num(e.battery)!),
    rangeMi: miles(e.range),
    charging,
    plugged,
    chargeLimitPct: limit === null ? null : Math.round(limit),
    chargeLimitMin: Number(e.chargeLimit?.attributes.min ?? 50),
    chargeLimitMax: Number(e.chargeLimit?.attributes.max ?? 100),
    chargeAmps: num(e.chargeAmps),
    chargeAmpsMax: Number(e.chargeAmps?.attributes.max ?? 48),
    chargerAmps: num(e.chargerAmps),
    chargeRateMph: num(e.chargeRate) === null ? null : Math.round(num(e.chargeRate)!),
    doneAt,
    portOpen: e.port ? (ok(e.port) ? e.port.state === 'open' : null) : null,
    schedule: sched,
    locked: e.lock ? (ok(e.lock) ? e.lock.state === 'locked' : null) : null,
    insideF: tempF(e.inside) ?? (Number.isFinite(Number(c.attributes.current_temperature)) ? Math.round(Number(c.attributes.current_temperature)) : null),
    outsideF: tempF(e.outside),
    climateOn: ok(c) && c.state !== 'off',
    targetF: Number.isFinite(Number(c.attributes.temperature)) ? Math.round(Number(c.attributes.temperature)) : null,
    minF: Math.round(Number(c.attributes.min_temp ?? 59)),
    maxF: Math.round(Number(c.attributes.max_temp ?? 82)),
    driver: seat(e.heatDriver, e.coolDriver),
    passenger: seat(e.heatPassenger, e.coolPassenger),
    rear: Math.max(level(e.heatRearLeft), level(e.heatRearCenter), level(e.heatRearRight)),
    coolingSeats,
    wheel: steering,
    frontDefrost: e.frontDefrost ? on(e.frontDefrost) : null,
    rearDefrost: e.rearDefrost ? on(e.rearDefrost) : null,
    frunkOpen: e.frunk ? (ok(e.frunk) ? e.frunk.state === 'open' : null) : null,
    trunkOpen: e.trunk ? (ok(e.trunk) ? e.trunk.state === 'open' : null) : null,
    atHome,
    driving,
    speedMph: num(e.speed) === null ? null : Math.round(num(e.speed)!),
    enRouteHome,
    location: loc,
    heading: heading === null ? null : Math.round(heading),
    trail: driving ? currentTrail(loc) : null,
    routeAhead,
    home: home(),
    updatedAt: new Date(updated.length ? Math.max(...updated) : Date.now()).toISOString(),
  }
}

/** For /api/setup-check: what was found, and what's missing */
export function teslaNotes(): { found: Record<string, string>; missing: string[]; map?: Record<string, string> } {
  const e = resolve()
  if (!e) return { found: {}, missing: ['No Teslemetry climate entity found in Home Assistant'] }
  const found: Record<string, string> = {}
  for (const [k, s] of Object.entries(e)) if (s) found[k] = s.entity_id
  const wanted: Key[] = ['battery', 'range', 'charging', 'chargeLimit', 'chargeAmps', 'chargeSwitch', 'port', 'lock', 'inside', 'outside', 'heatDriver', 'heatPassenger', 'frunk', 'trunk', 'location', 'route']
  const missing: string[] = wanted.filter((k) => !e[k])
  if (!e.route && !e.destination) missing.push('The Destination entity is off — enable it in Home Assistant for "en route home"')
  if (!e.heading) missing.push('The GPS heading entity is off — enable it in Home Assistant so the map arrow points the way the car faces (until then it follows the drive)')
  if (!e.trafficDelay) missing.push('The Traffic delay entity is off — enable it in Home Assistant for "+4 min traffic" on the map')
  return { found, missing, map: routeNotes() }
}

// ── Commands ─────────────────────────────────────────────────────────────

export interface TeslaCommand { action?: string; value?: unknown; seat?: string; level?: number; enabled?: boolean; time?: string }

const need = (s: HAState | undefined, what: string): HAState => {
  if (!s) throw new Error(`${what} isn't in Home Assistant — check the Teslemetry entities`)
  if (s.state === 'unavailable') throw new Error(`${what} is unavailable right now — the car may be out of reach`)
  return s
}

const LEVELS = ['off', 'low', 'medium', 'high']

/** Pick the select option for a level (Teslemetry uses off/low/medium/high) */
function optionFor(s: HAState, lvl: number): string {
  const options: string[] = Array.isArray(s.attributes.options) ? s.attributes.options : LEVELS
  const want = LEVELS[Math.min(3, Math.max(0, lvl))]
  return options.find((o) => o.toLowerCase() === want)
    ?? options.find((o) => o.toLowerCase().startsWith(want.slice(0, 3)))
    ?? (lvl === 0 ? options[0] : options[Math.min(options.length - 1, lvl)])
}

async function selectLevel(s: HAState | undefined, lvl: number) {
  if (!s) return
  await ha.callService('select', 'select_option', { option: optionFor(s, lvl) }, [s.entity_id])
}

async function setSeat(heat: HAState | undefined, cool: HAState | undefined, lvl: number, what: string) {
  need(heat, what)
  if (lvl < 0 && !cool) throw new Error(`${what} cooling isn't in Home Assistant`)
  // Heat and cooling can't both be on: turn the other one off first
  if (lvl > 0) { if (cool && level(cool)) await selectLevel(cool, 0); await selectLevel(heat, lvl) }
  else if (lvl < 0) { if (level(heat)) await selectLevel(heat, 0); await selectLevel(cool, -lvl) }
  else { await selectLevel(heat, 0); if (cool && level(cool)) await selectLevel(cool, 0) }
}

const clamp = (v: unknown, lo: number, hi: number, what: string) => {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n) || n < lo || n > hi) throw new Error(`${what} must be between ${lo} and ${hi}`)
  return n
}

export async function teslaCommand(b: TeslaCommand) {
  const e = resolve()
  if (!e?.climate) throw new Error('The Tesla isn’t in Home Assistant yet')
  const svc = (domain: string, service: string, s: HAState, data: Record<string, unknown> = {}) => ha.callService(domain, service, data, [s.entity_id])
  switch (b.action) {
    case 'lock': return svc('lock', 'lock', need(e.lock, 'The lock'))
    case 'unlock': return svc('lock', 'unlock', need(e.lock, 'The lock'))
    case 'climate_on': return svc('climate', 'turn_on', e.climate)
    case 'climate_off': return svc('climate', 'turn_off', e.climate)
    case 'climate_target': {
      const min = Math.round(Number(e.climate.attributes.min_temp ?? 59)), max = Math.round(Number(e.climate.attributes.max_temp ?? 82))
      return svc('climate', 'set_temperature', e.climate, { temperature: clamp(b.value, min, max, 'The temperature') })
    }
    case 'seat': {
      const lvl = clamp(b.level, -3, 3, 'The seat level')
      if (b.seat === 'driver') return setSeat(e.heatDriver, e.coolDriver, lvl, 'The driver seat heater')
      if (b.seat === 'passenger') return setSeat(e.heatPassenger, e.coolPassenger, lvl, 'The passenger seat heater')
      if (b.seat === 'rear') {
        if (lvl < 0) throw new Error('Rear seats only heat')
        const rear = [e.heatRearLeft, e.heatRearCenter, e.heatRearRight].filter(Boolean) as HAState[]
        if (!rear.length) throw new Error('The rear seat heaters aren’t in Home Assistant')
        for (const s of rear) await selectLevel(s, lvl)
        return
      }
      throw new Error('Unknown seat')
    }
    case 'wheel': {
      if (e.wheelSelect) return selectLevel(e.wheelSelect, b.value ? 3 : 0)
      return svc('switch', b.value ? 'turn_on' : 'turn_off', need(e.wheelSwitch, 'Steering wheel heat'))
    }
    case 'front_defrost': return svc('switch', b.value ? 'turn_on' : 'turn_off', need(e.frontDefrost, 'Front defrost'))
    case 'rear_defrost': return svc('switch', b.value ? 'turn_on' : 'turn_off', need(e.rearDefrost, 'Rear defrost'))
    case 'frunk': return svc('cover', 'open_cover', need(e.frunk, 'The frunk'))
    case 'trunk': return svc('cover', 'open_cover', need(e.trunk, 'The trunk'))
    case 'charge_start': return svc('switch', 'turn_on', need(e.chargeSwitch, 'Charging'))
    case 'charge_stop': return svc('switch', 'turn_off', need(e.chargeSwitch, 'Charging'))
    case 'charge_limit': {
      const s = need(e.chargeLimit, 'The charge limit')
      return svc('number', 'set_value', s, { value: clamp(b.value, Number(s.attributes.min ?? 50), Number(s.attributes.max ?? 100), 'The charge limit') })
    }
    case 'charge_amps': {
      const s = need(e.chargeAmps, 'Charging amps')
      return svc('number', 'set_value', s, { value: clamp(b.value, Number(s.attributes.min ?? 1), Number(s.attributes.max ?? 48), 'Charging amps') })
    }
    // The charge port "opens" to release a plugged-in cable, like the app
    case 'port_open': return svc('cover', 'open_cover', need(e.port, 'The charge port'))
    case 'port_close': return svc('cover', 'close_cover', need(e.port, 'The charge port'))
    case 'schedule': {
      const device = ha.deviceOf(e.climate.entity_id)
      if (!device) throw new Error('Scheduled charging needs the car’s device in Home Assistant')
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(b.time ?? ''))
      const minutes = m ? Number(m[1]) * 60 + Number(m[2]) : null
      if (b.enabled && (minutes === null || minutes >= 1440)) throw new Error('Pick a start time')
      return ha.callService('teslemetry', 'set_scheduled_charging', { device_id: device, enable: !!b.enabled, ...(minutes !== null ? { time: minutes } : {}) })
    }
    default: throw new Error('Unknown Tesla command')
  }
}
