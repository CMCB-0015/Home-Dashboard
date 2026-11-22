// Lights: everything the Lights card, light panel and Lights page need, read
// live from Home Assistant, plus the commands they send.

import type { BedtimeLamp, Light, Lighting, LightScene, QuickLight } from '../src/types.ts'
import { HOME, matchName } from '../src/config/home.ts'
import { ha, type HAState } from './ha.ts'
import { cacheGet, cacheSet } from './cache.ts'

const COLOR_MODES = ['hs', 'xy', 'rgb', 'rgbw', 'rgbww']
/** Shown for lights that are on but don't report a color (plain dimmable bulbs) */
const WARM_WHITE = '#ffd6a0'

const hex = (rgb: unknown): string | null => {
  if (!Array.isArray(rgb) || rgb.length < 3) return null
  return '#' + rgb.slice(0, 3).map((n) => Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, '0')).join('')
}

const isGroup = (s: HAState) => !!s.attributes.is_hue_group || Array.isArray(s.attributes.entity_id)

function toLight(s: HAState, timerIds: Set<string>): Light {
  const a = s.attributes
  const modes: string[] = Array.isArray(a.supported_color_modes) ? a.supported_color_modes : []
  const on = s.state === 'on'
  const name = ha.name(s)
  const room = ha.area(s.entity_id) ?? 'Other'
  const where = `${name} ${room}`.toLowerCase()
  return {
    id: s.entity_id,
    name,
    room,
    on,
    brightnessPct: on && typeof a.brightness === 'number' ? Math.max(1, Math.round((a.brightness / 255) * 100)) : on ? 100 : 0,
    color: on ? hex(a.rgb_color) ?? WARM_WHITE : null,
    kelvin: on && a.color_mode === 'color_temp' && typeof a.color_temp_kelvin === 'number' ? a.color_temp_kelvin : null,
    supports: {
      color: modes.some((m) => COLOR_MODES.includes(m)),
      white: modes.includes('color_temp'),
      dim: modes.length > 0 && !(modes.length === 1 && modes[0] === 'onoff'),
    },
    minKelvin: typeof a.min_color_temp_kelvin === 'number' ? a.min_color_temp_kelvin : 2200,
    maxKelvin: typeof a.max_color_temp_kelvin === 'number' ? a.max_color_temp_kelvin : 6500,
    outdoor: HOME.lights.outdoorWords.some((w) => where.includes(w)),
    timer: timerIds.has(s.entity_id),
    isGroup: isGroup(s),
    available: s.state !== 'unavailable',
  }
}

// ── Outlets that run lights (VeSync landscape lights, 1.29.0) ─────────────
// Only the exact ids in HOME.lights.outlets: never found by name, so nothing
// here can reach the Front Yard camera's switch.

const OUTLET_IDS = new Set<string>(HOME.lights.outlets.map((o) => o.id))
export const isOutlet = (id: string) => OUTLET_IDS.has(id)

/** The outlet's power sensor (Current power) on the same device */
function outletWatts(id: string): number | null {
  const dev = ha.deviceOf(id)
  if (!dev) return null
  const p = ha.entitiesOnDevice(dev).find((e) => e.entity_id.startsWith('sensor.')
    && (e.attributes.device_class === 'power' || e.attributes.unit_of_measurement === 'W'))
  const w = p ? Number(p.state) : NaN
  return Number.isFinite(w) ? Math.round(w * 10) / 10 : null
}

function toOutlet(o: { id: string; name: string }, s: HAState): Light {
  const on = s.state === 'on'
  return {
    id: o.id, name: o.name, room: ha.area(o.id) ?? 'Outside', on,
    brightnessPct: on ? 100 : 0, color: on ? WARM_WHITE : null, kelvin: null,
    supports: { color: false, white: false, dim: false },
    outdoor: true, timer: false, isGroup: false, available: s.state !== 'unavailable',
    outlet: true, watts: on ? outletWatts(o.id) : null,
  }
}

/** Every light in Home Assistant, as the dashboard sees it. */
function allLights(): { lights: Light[]; singles: { id: string; name: string }[]; everything: { id: string; name: string }[]; notes: string[] } {
  const states = ha.all('light')
  const notes: string[] = []
  const singles = states.filter((s) => !isGroup(s)).map((s) => ({ id: s.entity_id, name: ha.name(s) }))
  const everything = states.map((s) => ({ id: s.entity_id, name: ha.name(s) }))
  const timerIds = new Set<string>()
  for (const t of HOME.lights.timer) {
    const m = matchName(t, singles)
    if (m.item) timerIds.add(m.item.id)
    else notes.push(`Timer light: ${m.reason}`)
  }
  const outlets: Light[] = []
  for (const o of HOME.lights.outlets) {
    const s = ha.states.get(o.id)
    if (s) outlets.push(toOutlet(o, s))
    else notes.push(`Outlet "${o.name}": ${o.id} isn't in Home Assistant (check the id in src/config/home.ts)`)
  }
  const lights = [...states.map((s) => toLight(s, timerIds)), ...outlets].sort((a, b) => a.room.localeCompare(b.room) || a.name.localeCompare(b.name))
  return { lights, singles, everything, notes }
}

function hhmm(s: HAState | undefined, fallback: string): string {
  const v = s?.state
  return v && /^\d\d:\d\d/.test(v) ? v.slice(0, 5) : fallback
}

const START_ID = 'input_datetime.panel_bedtime_start'
const END_ID = 'input_datetime.panel_bedtime_end'
const AUTOMATION_ID = 'panel_bedtime_lamp'

function bedtimeAutomation(): HAState | undefined {
  return ha.all('automation').find((a) => a.attributes.id === AUTOMATION_ID)
}

function findTv(): { id: string; name: string } | null {
  const players = ha.all('media_player')
  const lg = players.filter((p) => ha.platform(p.entity_id) === 'webostv')
  if (lg.length === 1) return { id: lg[0].entity_id, name: ha.name(lg[0]) }
  const m = matchName(HOME.bedtime.tv, (lg.length ? lg : players).map((p) => ({ id: p.entity_id, name: ha.name(p) })))
  return m.item ?? null
}

function findLamp(singles: { id: string; name: string }[]) {
  return matchName(HOME.bedtime.lamp, singles).item ?? null
}

function bedtimeState(singles: { id: string; name: string }[]): BedtimeLamp {
  const start = hhmm(ha.states.get(START_ID), HOME.bedtime.defaultStart)
  const end = hhmm(ha.states.get(END_ID), HOME.bedtime.defaultEnd)
  const auto = bedtimeAutomation()
  const base = { enabled: auto?.state === 'on', start, end, lastRun: (auto?.attributes.last_triggered as string | null) ?? null }
  if (ha.status !== 'connected') return { ...base, status: 'offline', message: "Can't reach Home Assistant" }
  if (auto) return { ...base, status: 'ready' }
  if (!findLamp(singles)) return { ...base, status: 'no-lamp', message: `No light named "${HOME.bedtime.lamp}" — check src/config/home.ts` }
  if (!findTv()) return { ...base, status: 'no-tv', message: 'Add the living room LG TV in Home Assistant first' }
  return { ...base, status: 'not-set-up' }
}

/** The lights section of the dashboard data. */
export function lightingState(): { lights: Light[]; lighting: Lighting } {
  const { lights, singles, everything, notes } = allLights()

  const quick: QuickLight[] = HOME.lights.quick.map((q) => {
    const m = matchName(q.light, everything)
    if (!m.item) notes.push(`Card button "${q.label}": ${m.reason}`)
    return { label: q.label, lightId: m.item?.id ?? null, reason: m.reason }
  })

  const c = HOME.lights.bedroomCans
  const group = matchName(c.group, everything).item
  const win = matchName(c.window, singles).item
  const dresser = matchName(c.dresser, singles).item
  const cans = group && win && dresser ? { groupId: group.id, windowId: win.id, dresserId: dresser.id } : null
  if (!cans) notes.push(`Bedroom cans: couldn't find all three of "${c.group}", "${c.window}" and "${c.dresser}"`)

  const scenes: LightScene[] = ha.all('scene')
    .filter((s) => ha.platform(s.entity_id) === 'hue')
    .map((s) => ({ id: s.entity_id, name: String(s.attributes.name ?? ha.name(s)), room: String(s.attributes.group_name ?? '') }))
    .sort((a, b) => a.room.localeCompare(b.room) || a.name.localeCompare(b.name))

  if (notes.length) notes.push(`Lights Home Assistant has: ${singles.map((l) => l.name).join(', ')}`)
  return { lights, lighting: { quick, scenes, cans, bedtime: bedtimeState(singles), notes } }
}

// ── Commands ─────────────────────────────────────────────────────────────

export interface LightChange {
  ids: string[]
  on?: boolean
  brightnessPct?: number
  kelvin?: number
  rgb?: [number, number, number]
  /** Changing both bedroom cans together: remember these as their shared settings */
  linked?: boolean
}

type Linked = Pick<LightChange, 'brightnessPct' | 'kelvin' | 'rgb'>
const LINKED_KEY = 'bedroom-cans-linked'

export async function setLights(c: LightChange) {
  const ids = (c.ids ?? []).filter((id) => typeof id === 'string' && id.startsWith('light.') && ha.states.has(id))
  // Outlets: on/off only, and only the exact configured ids
  const plugs = (c.ids ?? []).filter((id) => typeof id === 'string' && isOutlet(id) && ha.states.has(id))
  if (!ids.length && !plugs.length) throw new Error("That light isn't in Home Assistant")
  if (plugs.length) await ha.callService('switch', c.on === false ? 'turn_off' : 'turn_on', {}, plugs)
  if (!ids.length) return
  if (c.on === false) { await ha.callService('light', 'turn_off', {}, ids); return }

  const data: Record<string, unknown> = {}
  if (typeof c.brightnessPct === 'number') data.brightness_pct = Math.max(1, Math.min(100, Math.round(c.brightnessPct)))
  if (typeof c.kelvin === 'number') data.color_temp_kelvin = Math.round(c.kelvin)
  else if (Array.isArray(c.rgb) && c.rgb.length === 3) data.rgb_color = c.rgb.map((n) => Math.max(0, Math.min(255, Math.round(n))))

  const { lighting } = lightingState()
  const groupId = lighting.cans?.groupId
  if (groupId && ids.includes(groupId)) {
    const saved = (await cacheGet<Linked>(LINKED_KEY)) ?? {}
    if (c.linked && Object.keys(data).length) {
      // Remember the shared settings. A new color replaces a white tone and vice versa.
      const next: Linked = { ...saved }
      if (data.brightness_pct) next.brightnessPct = data.brightness_pct as number
      if (data.color_temp_kelvin) { next.kelvin = data.color_temp_kelvin as number; delete next.rgb }
      if (data.rgb_color) { next.rgb = data.rgb_color as [number, number, number]; delete next.kelvin }
      await cacheSet(LINKED_KEY, next)
    } else if (!Object.keys(data).length) {
      // Plain "turn on": come back linked, with the last shared settings
      if (saved.brightnessPct) data.brightness_pct = saved.brightnessPct
      if (saved.kelvin) data.color_temp_kelvin = saved.kelvin
      else if (saved.rgb) data.rgb_color = saved.rgb
    }
  }
  await ha.callService('light', 'turn_on', data, ids)
}

/** indoor: everything except the timer lights · all: every light. Never the outlets (landscape lights stay on). */
export async function allOff(scope: 'indoor' | 'all') {
  const { lights } = allLights()
  const ids = lights.filter((l) => !l.isGroup && !l.outlet && l.available && (scope === 'all' || !l.timer)).map((l) => l.id)
  if (ids.length) await ha.callService('light', 'turn_off', {}, ids)
}

export async function activateScene(id: string) {
  if (typeof id !== 'string' || !id.startsWith('scene.') || !ha.states.has(id)) throw new Error("That scene isn't in Home Assistant")
  await ha.callService('scene', 'turn_on', {}, [id])
}

// ── Bedside lamp after TV ─────────────────────────────────────────────────

const valid = (t: unknown): t is string => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t)

async function waitFor(entityId: string) {
  for (let i = 0; i < 30 && !ha.states.has(entityId); i++) await new Promise((r) => setTimeout(r, 200))
  if (!ha.states.has(entityId)) throw new Error(`Home Assistant didn't create ${entityId}`)
}

async function ensureTimeHelper(entityId: string, name: string, value: string) {
  if (!ha.states.has(entityId)) {
    await ha.command({ type: 'input_datetime/create', name, has_date: false, has_time: true, icon: 'mdi:clock-outline' })
    await waitFor(entityId)
  }
  await ha.callService('input_datetime', 'set_datetime', { time: `${value}:00` }, [entityId])
}

/** Create the two time settings and the automation in Home Assistant. Safe to run again. */
export async function setUpBedtime(start: string = HOME.bedtime.defaultStart, end: string = HOME.bedtime.defaultEnd) {
  const { singles } = allLights()
  const lamp = findLamp(singles)
  if (!lamp) throw new Error(`No light named "${HOME.bedtime.lamp}"`)
  const tv = findTv()
  if (!tv) throw new Error('Add the living room LG TV in Home Assistant first')
  if (!valid(start) || !valid(end)) throw new Error('Times look wrong')

  await ensureTimeHelper(START_ID, 'Panel bedtime start', start)
  await ensureTimeHelper(END_ID, 'Panel bedtime end', end)

  const lampState = ha.states.get(lamp.id)
  const lampModes: string[] = lampState?.attributes.supported_color_modes ?? []
  const config = {
    id: AUTOMATION_ID,
    alias: 'Bedside lamp after TV',
    description: `When the living room TV (${tv.name}) turns off between the Panel bedtime start and end times, turn on the bedside lamp. Set up from the Panel dashboard.`,
    mode: 'single',
    triggers: [{ trigger: 'state', entity_id: tv.id, to: 'off', not_from: ['unavailable', 'unknown'], for: { seconds: 10 } }],
    conditions: [{ condition: 'time', after: START_ID, before: END_ID }],
    actions: [{
      action: 'light.turn_on',
      target: { entity_id: lamp.id },
      data: { brightness_pct: HOME.bedtime.brightnessPct, ...(lampModes.includes('color_temp') ? { color_temp_kelvin: HOME.bedtime.kelvin } : {}) },
    }],
  }
  const res = await ha.rest(`/api/config/automation/config/${AUTOMATION_ID}`, { method: 'POST', body: JSON.stringify(config) })
  if (!res.ok) throw new Error(`Home Assistant didn't accept the automation (${res.status}): ${(await res.text()).slice(0, 200)}`)
}

export async function bedtimeCommand(body: { action?: string; start?: string; end?: string }) {
  const auto = bedtimeAutomation()
  switch (body.action) {
    case 'setup': return setUpBedtime(body.start, body.end)
    case 'enable':
    case 'disable':
      if (!auto) throw new Error('Set up the bedtime lamp first')
      return ha.callService('automation', body.action === 'enable' ? 'turn_on' : 'turn_off', {}, [auto.entity_id])
    case 'window': {
      if (body.start !== undefined) { if (!valid(body.start)) throw new Error('Start time looks wrong'); await ha.callService('input_datetime', 'set_datetime', { time: `${body.start}:00` }, [START_ID]) }
      if (body.end !== undefined) { if (!valid(body.end)) throw new Error('End time looks wrong'); await ha.callService('input_datetime', 'set_datetime', { time: `${body.end}:00` }, [END_ID]) }
      return
    }
    default: throw new Error('Unknown bedtime action')
  }
}

/** For the setup check page */
export function lightNames() {
  return [
    ...ha.all('light').map((s) => ({ id: s.entity_id, name: ha.name(s), room: ha.area(s.entity_id), hueGroup: isGroup(s), state: s.state })),
    ...HOME.lights.outlets.map((o) => {
      const s = ha.states.get(o.id)
      return { id: o.id, name: `${o.name} (outlet)`, room: ha.area(o.id), hueGroup: false, state: s ? `${s.state}${s.state === 'on' ? ` · ${outletWatts(o.id) ?? '?'} W` : ''}` : 'missing' }
    }),
  ]
}

// ── Stargazing: front lights for the hour (1.29.0) ───────────────────────
// Front Door off, Garage down to 60%, Front Yard Landscape outlet off (only
// what's on; nothing is ever turned on). At the end each one goes back the way
// it was, but only if it's still how Stargazing left it: a Hue timer, scene or
// VeSync schedule that changed it in the meantime wins.

export interface StargazeLight {
  id: string
  kind: 'light' | 'switch'
  /** What Stargazing set */
  set: { on: boolean; brightness?: number }
  /** How it was before (lights): brightness 0–255 and color */
  was: { brightness?: number; mode?: string; kelvin?: number; xy?: number[]; hs?: number[] }
}

function snapshot(s: HAState): StargazeLight['was'] {
  const a = s.attributes
  return {
    brightness: typeof a.brightness === 'number' ? a.brightness : undefined,
    mode: typeof a.color_mode === 'string' ? a.color_mode : undefined,
    kelvin: typeof a.color_temp_kelvin === 'number' ? a.color_temp_kelvin : undefined,
    xy: Array.isArray(a.xy_color) ? a.xy_color : undefined,
    hs: Array.isArray(a.hs_color) ? a.hs_color : undefined,
  }
}

/** Set the Stargazing lights. `skip`: ids already handled this hour. Returns what changed (to restore later). */
export async function stargazeLights(skip: string[] = []): Promise<{ changed: StargazeLight[]; failed: string[] }> {
  const cfg = HOME.stargazing
  const { singles } = allLights()
  const changed: StargazeLight[] = []
  const failed: string[] = []
  const done = new Set(skip)
  const lightOn = (name: string) => {
    const id = matchName(name, singles).item?.id
    const s = id ? ha.states.get(id) : undefined
    return s && s.state === 'on' && !done.has(s.entity_id) ? s : null
  }
  const run = async (label: string, fn: () => Promise<unknown>, rec: StargazeLight) => {
    try { await fn(); changed.push(rec) } catch (e) { failed.push(label); console.warn(`[stargazing] ${label}:`, e instanceof Error ? e.message : e) }
  }
  for (const name of cfg.lightsOff) {
    const s = lightOn(name)
    if (s) await run(name, () => ha.callService('light', 'turn_off', {}, [s.entity_id]), { id: s.entity_id, kind: 'light', set: { on: false }, was: snapshot(s) })
  }
  for (const d of cfg.lightsDim) {
    const s = lightOn(d.light)
    const target = Math.round((d.pct / 100) * 255)
    // Only ever dims: a light already at or below the level is left alone
    if (s && (typeof s.attributes.brightness !== 'number' || s.attributes.brightness > target)) {
      await run(d.light, () => ha.callService('light', 'turn_on', { brightness: target }, [s.entity_id]), { id: s.entity_id, kind: 'light', set: { on: true, brightness: target }, was: snapshot(s) })
    }
  }
  for (const id of cfg.outletsOff) {
    const s = isOutlet(id) ? ha.states.get(id) : undefined
    if (s && s.state === 'on' && !done.has(id)) await run(HOME.lights.outlets.find((o) => o.id === id)?.name ?? id, () => ha.callService('switch', 'turn_off', {}, [id]), { id, kind: 'switch', set: { on: false }, was: {} })
  }
  return { changed, failed }
}

/** Put the Stargazing lights back, each only if it's still how Stargazing left it. Safe to run twice. */
export async function restoreStargazeLights(saved: StargazeLight[]) {
  for (const l of saved) {
    const s = ha.states.get(l.id)
    if (!s || s.state === 'unavailable' || s.state === 'unknown') continue
    if (l.kind === 'switch') {
      if (!isOutlet(l.id)) continue
      if (s.state === 'off') await ha.callService('switch', 'turn_on', {}, [l.id])
      continue
    }
    if (!l.id.startsWith('light.')) continue
    if (!l.set.on) {
      if (s.state !== 'off') continue // something turned it back on: leave it
      const data: Record<string, unknown> = {}
      if (l.was.brightness) data.brightness = l.was.brightness
      if (l.was.mode === 'color_temp' && l.was.kelvin) data.color_temp_kelvin = l.was.kelvin
      else if (l.was.mode === 'xy' && l.was.xy) data.xy_color = l.was.xy
      else if (l.was.mode === 'hs' && l.was.hs) data.hs_color = l.was.hs
      await ha.callService('light', 'turn_on', data, [l.id])
    } else if (typeof l.set.brightness === 'number') {
      const b = s.attributes.brightness
      // Still on at Stargazing's level (Hue may round by a step or two): bring the brightness back
      if (s.state === 'on' && typeof b === 'number' && Math.abs(b - l.set.brightness) <= 3 && l.was.brightness) {
        await ha.callService('light', 'turn_on', { brightness: l.was.brightness }, [l.id])
      }
    }
  }
}
