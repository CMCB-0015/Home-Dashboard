// Eufy cameras, through Home Assistant's eufy-sdk integration (+ the eufy-sdk bridge app).
//
// For each camera device the integration makes (all names come from the camera):
//   camera.<name>                 live video (Home Assistant's own WebRTC, see cameraLive.ts)
//   image.<name>_last_event       the latest motion picture
//   event.<name>_detection        what the AI saw last (person, pet, vehicle, motion…) and when
//   sensor.<name>_battery         battery %
//   sensor.<name>_solar_intensity how much sun the panel gets
//   switch.<name>_spotlight_enabled  the light that turns on with motion at night
// and on the HomeBase:
//   alarm_control_panel.<name>    Security mode (Home / Away / …)
//
// Entities are matched by pattern on the camera's own device, so renaming a
// camera in the Eufy app needs no change here. /api/setup-check → cameras
// shows what was found.

import type { AlertItem, Camera, GuardMode } from '../src/types.ts'
import { ha, type HAState } from './ha.ts'
import { cacheGet, cacheSet } from './cache.ts'
import { env } from './env.ts'

const PLATFORM = 'eufy_sdk'
const TZ = env('TIMEZONE') ?? 'America/Los_Angeles'
/** Motion counts as "just now" for this long (status chip, card outline) */
const MOTION_NOW_MS = 3 * 60_000
/** Stargazing length; tapping again restarts it */
const STARGAZE_MS = 60 * 60_000

const FIND = {
  image: ['image', /_last_event$|last_event/],
  detection: ['event', /_detection$/],
  battery: ['sensor', /_battery$/],
  solar: ['sensor', /solar_intensity$|_solar$/],
  spotlight: ['switch', /spotlight_enabled$|_spotlight$|spotlight/],
} as const satisfies Record<string, readonly [string, RegExp]>
type Key = keyof typeof FIND

const usable = (s?: HAState) => !!s && s.state !== 'unavailable' && s.state !== 'unknown'
const num = (s?: HAState) => (usable(s) && Number.isFinite(Number(s!.state)) ? Number(s!.state) : null)

interface Found { camera: HAState; device: string | null; parts: Partial<Record<Key, HAState>> }

/** Every eufy-sdk camera with its entities, in a steady order (by name) */
function resolve(): Found[] {
  const all = ha.entitiesOf(PLATFORM)
  return all
    .filter((s) => s.entity_id.startsWith('camera.') && !/_view_\d+$/.test(s.entity_id))
    .map((camera) => {
      const device = ha.deviceOf(camera.entity_id)
      const mine = device ? ha.entitiesOf(PLATFORM, device) : []
      const parts: Partial<Record<Key, HAState>> = {}
      for (const [key, [domain, re]] of Object.entries(FIND) as [Key, readonly [string, RegExp]][]) {
        const hits = mine.filter((s) => s.entity_id.startsWith(domain + '.') && re.test(s.entity_id))
          .sort((a, b) => a.entity_id.length - b.entity_id.length)
        // The battery sensor can also be found by its device class
        const hit = hits[0] ?? (key === 'battery' ? mine.find((s) => s.entity_id.startsWith('sensor.') && s.attributes.device_class === 'battery') : undefined)
        if (hit) parts[key] = hit
      }
      return { camera, device, parts }
    })
    .sort((a, b) => ha.name(a.camera).localeCompare(ha.name(b.camera)))
}

function homeBase(): HAState | null {
  return ha.entitiesOf(PLATFORM).find((s) => s.entity_id.startsWith('alarm_control_panel.')) ?? null
}

// ── What the AI saw ───────────────────────────────────────────────────────
const EVENT_LABEL: Record<string, Camera['lastEvent']> = {
  person: 'Person', stranger: 'Person', pet: 'Pet', dog: 'Pet', vehicle: 'Vehicle', motion: 'Motion',
  package_delivered: 'Package', package_taken: 'Package', package_stranded: 'Package', sound: 'Sound', crying: 'Sound',
}

function lastDetection(f: Found): { at: string; label: NonNullable<Camera['lastEvent']> } | null {
  const ev = f.parts.detection
  if (ev && usable(ev) && !Number.isNaN(Date.parse(ev.state))) {
    return { at: new Date(ev.state).toISOString(), label: EVENT_LABEL[String(ev.attributes.event_type)] ?? 'Motion' }
  }
  // No detection entity: the picture changing is the next best sign of motion
  const img = f.parts.image
  if (img && usable(img)) return { at: img.last_updated, label: 'Motion' }
  return null
}

// ── Local time (overnight motion) ─────────────────────────────────────────
function localParts(ms: number) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour), mi: Number(p.minute) }
}
/** A local wall-clock time in TZ → epoch ms */
function zoned(y: number, m: number, d: number, h: number, mi: number): number {
  const guess = Date.UTC(y, m - 1, d, h, mi)
  const p = localParts(guess)
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi)
  return guess - (asUtc - guess)
}
const clock = (ms: number) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(ms))

/** Overnight = 10 PM–6 AM. Returns when its chip goes away (9 AM that morning), or null if not overnight. */
function overnightUntil(atMs: number): number | null {
  const p = localParts(atMs)
  if (p.h >= 6 && p.h < 22) return null
  // After 10 PM → 9 AM the next day; after midnight → 9 AM the same day
  const day = p.h >= 22 ? new Date(Date.UTC(p.y, p.m - 1, p.d + 1)) : new Date(Date.UTC(p.y, p.m - 1, p.d))
  return zoned(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), 9, 0)
}

/** "Pet detected at 2:43 AM", plus " last night" once it's morning (6–9 AM) */
export function nightText(n: { at: string; label: string }, now = Date.now()): string {
  const h = localParts(now).h
  return `${n.label} detected at ${clock(Date.parse(n.at))}${h >= 6 && h < 22 ? ' last night' : ''}`
}
export { overnightUntil }

/** Latest overnight event per camera, kept until 9 AM even if newer daytime motion replaces it in Home Assistant */
type Night = { at: string; label: string; until: number }
let night: Record<string, Night> = {}
let nightLoaded = false
void cacheGet<Record<string, Night>>('camera-night').then((v) => { if (v) night = { ...v, ...night }; nightLoaded = true })

function rememberNight(name: string, d: { at: string; label: string }) {
  const at = Date.parse(d.at)
  const until = overnightUntil(at)
  if (!until || Date.now() >= until) return
  const prev = night[name]
  if (prev && Date.parse(prev.at) >= at) return
  night[name] = { at: d.at, label: d.label, until }
  if (nightLoaded) void cacheSet('camera-night', night)
}

// ── State for the dashboard ───────────────────────────────────────────────
export function camerasState(): Camera[] | null {
  const found = resolve()
  if (!found.length) return null
  return found.map((f) => {
    const name = ha.name(f.camera)
    const det = lastDetection(f)
    if (det) rememberNight(name, det)
    const img = f.parts.image
    const pic = img && usable(img) && typeof img.attributes.entity_picture === 'string' ? img.attributes.entity_picture as string : null
    return {
      id: f.camera.entity_id,
      name,
      status: f.camera.state === 'unavailable' ? 'offline' : 'online',
      lastMotionAt: det?.at ?? null,
      lastEvent: det?.label ?? null,
      // Through Panel's /api/ha-image (Home Assistant needs a login); ?v= changes with each new picture
      snapshotUrl: pic ? `/api/ha-image?p=${encodeURIComponent(pic)}&v=${encodeURIComponent(img!.last_updated)}` : null,
      liveUrl: null,
      battery: num(f.parts.battery),
      solar: num(f.parts.solar),
      spotlight: f.parts.spotlight ? f.parts.spotlight.state !== 'off' : true,
    } satisfies Camera
  })
}

export function guardMode(): GuardMode {
  const s = homeBase()?.state
  return s === 'armed_home' ? 'home' : s === 'armed_away' ? 'away' : 'other'
}

/** Status-bar chips: motion in the last 3 minutes, and overnight motion until 9 AM */
export function cameraAlerts(cams: Camera[]): AlertItem[] {
  const out: AlertItem[] = []
  const now = Date.now()
  for (const c of cams) {
    const at = c.lastMotionAt ? Date.parse(c.lastMotionAt) : NaN
    if (now - at < MOTION_NOW_MS) {
      out.push({ id: `cam-now-${c.id}`, category: 'cameras', severity: 'info', message: c.lastEvent ?? 'Motion', deviceName: c.name, timestamp: c.lastMotionAt! })
      continue
    }
    const n = night[c.name]
    if (n && now < n.until) out.push({ id: `cam-night-${c.id}`, category: 'cameras', severity: 'info', message: nightText(n, now), deviceName: c.name, timestamp: n.at })
    if (c.status === 'offline') out.push({ id: `cam-off-${c.id}`, category: 'cameras', severity: 'warning', message: 'Camera is offline', deviceName: c.name, timestamp: new Date().toISOString() })
    else if (c.battery !== null && c.battery <= 20) out.push({ id: `cam-batt-${c.id}`, category: 'cameras', severity: 'warning', message: `Battery ${c.battery}%`, deviceName: c.name, timestamp: new Date().toISOString() })
  }
  // Clean up expired overnight events
  let dropped = false
  for (const [k, v] of Object.entries(night)) if (now >= v.until) { delete night[k]; dropped = true }
  if (dropped) void cacheSet('camera-night', night)
  return out
}

// ── Stargazing: motion lights off for an hour ─────────────────────────────
interface Stargaze { until: number; switches: string[] }
let stargaze: Stargaze | null = null
let stargazeTimer: NodeJS.Timeout | null = null

export function stargazingUntil(): string | null {
  return stargaze && stargaze.until > Date.now() ? new Date(stargaze.until).toISOString() : null
}

function schedule() {
  if (stargazeTimer) clearTimeout(stargazeTimer)
  stargazeTimer = null
  if (!stargaze) return
  stargazeTimer = setTimeout(() => { void endStargazing() }, Math.max(1000, stargaze.until - Date.now()))
}

async function endStargazing(): Promise<void> {
  const s = stargaze
  if (!s) return
  if (ha.status !== 'connected') {
    // Try again in a minute; the lights must come back on
    stargazeTimer = setTimeout(() => { void endStargazing() }, 60_000)
    return
  }
  try {
    if (s.switches.length) await ha.callService('switch', 'turn_on', {}, s.switches)
    stargaze = null
    await cacheSet('camera-stargazing', null)
    ha.notify()
  } catch (e) {
    console.warn('[cameras] could not turn the motion lights back on, retrying in a minute:', e instanceof Error ? e.message : e)
    stargazeTimer = setTimeout(() => { void endStargazing() }, 60_000)
  }
}

/** Pick up a Stargazing hour that was running when the app restarted */
export function startCameras() {
  void cacheGet<Stargaze>('camera-stargazing').then((s) => {
    if (s && !stargaze) { stargaze = s; schedule() }
  })
}

export async function camerasCommand(b: { action?: string; mode?: string; minutes?: number }) {
  if (b.action === 'guard-mode') {
    const panel = homeBase()
    if (!panel) throw new Error('No HomeBase found in Home Assistant')
    const service = b.mode === 'away' ? 'alarm_arm_away' : b.mode === 'home' ? 'alarm_arm_home' : null
    if (!service) throw new Error('Unknown mode')
    await ha.callService('alarm_control_panel', service, {}, [panel.entity_id])
    return
  }
  if (b.action === 'stargazing') {
    const minutes = Number(b.minutes)
    if (!minutes) { await endStargazing(); return }
    // Lights that are on now get turned off; restarting keeps the original list
    const lights = resolve().map((f) => f.parts.spotlight).filter((s): s is HAState => !!s && usable(s))
    if (!lights.length) throw new Error('No “Spotlight Enabled” switch found on the cameras')
    const switches = stargaze ? stargaze.switches : lights.filter((s) => s.state === 'on').map((s) => s.entity_id)
    const toOff = lights.filter((s) => s.state === 'on').map((s) => s.entity_id)
    if (toOff.length) await ha.callService('switch', 'turn_off', {}, toOff)
    stargaze = { until: Date.now() + Math.min(minutes * 60_000, STARGAZE_MS), switches: [...new Set([...switches, ...toOff])] }
    await cacheSet('camera-stargazing', stargaze)
    schedule()
    ha.notify()
    return
  }
  throw new Error('Unknown camera command')
}

/** For /api/setup-check */
export function cameraNotes() {
  const found = resolve()
  const notes: string[] = []
  if (!found.length) notes.push('No eufy-sdk cameras found. Check the eufy-sdk integration in Settings → Devices & services.')
  for (const f of found) {
    for (const key of Object.keys(FIND) as Key[]) if (!f.parts[key]) notes.push(`${ha.name(f.camera)}: no ${key} entity found (it may be disabled in Home Assistant)`)
  }
  if (!homeBase()) notes.push('No HomeBase Security mode found (Home / Away)')
  return {
    cameras: found.map((f) => ({
      camera: f.camera.entity_id, name: ha.name(f.camera), state: f.camera.state,
      ...Object.fromEntries((Object.keys(FIND) as Key[]).map((k) => [k, f.parts[k] ? `${f.parts[k]!.entity_id} = ${f.parts[k]!.state}` : null])),
    })),
    homeBase: homeBase() ? `${homeBase()!.entity_id} = ${homeBase()!.state}` : null,
    stargazingUntil: stargazingUntil(),
    overnight: night,
    notes,
  }
}
