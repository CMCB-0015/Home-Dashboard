// Builds everything the dashboard shows (one HomeState), from Home Assistant,
// Rachio and the weather — and keeps the weather and calendar fresh.
//
// Where each section comes from (shown on the cards):
//   live — real data
//   demo — sample data, only when Home Assistant isn't configured (testing in the Codespace)
//   off  — not connected yet: the card keeps its place but shows as a placeholder

import type { AlertItem, Category, HomeState, Weather } from '../src/types.ts'
import { buildMockState } from '../src/data/mockData.ts'
import { ha } from './ha.ts'
import { getWeather } from './weather.ts'
import { latestRachio, rachioConfigured, rachioError, rachioNotice } from './rachio.ts'
import { lightingState } from './lights.ts'
import { thermostats } from './climate.ts'
import { refreshFavorites, sonosState } from './sonos.ts'
import { calendarEvents, calendarError, calendarList, calendarRange, refreshCalendar } from './calendar.ts'
import { refreshSports, sportsEvents } from './sports.ts'
import { teslaState } from './tesla.ts'
import { vacuumState, vacuumAlerts } from './vacuum.ts'

let weather: Weather | null = null

export function startBackgroundRefresh(changed: () => void) {
  const loadWeather = async () => {
    try { weather = await getWeather(); changed() } catch (e) { console.warn('[weather]', e instanceof Error ? e.message : e) }
  }
  void loadWeather()
  setInterval(loadWeather, 10 * 60_000)

  const loadSports = async () => { if (await refreshSports()) changed() }
  void loadSports()
  setInterval(loadSports, 15 * 60_000)

  const loadCalendar = async () => { if (await refreshCalendar()) changed() }
  setInterval(loadCalendar, 5 * 60_000)
  // Sonos Favorites rarely change; read them on connect and every 10 minutes
  const loadFavorites = async () => { await refreshFavorites(); changed() }
  setInterval(loadFavorites, 10 * 60_000)
  // Load the calendar as soon as Home Assistant connects
  let wasConnected = false
  ha.onChange(() => {
    const now = ha.status === 'connected'
    if (now && !wasConnected) { void loadCalendar(); void loadFavorites() }
    wasConnected = now
  })
}

export function buildState(): HomeState {
  const demo = buildMockState()
  const sources: NonNullable<HomeState['sources']> = {}
  const haConfigured = ha.configured()
  const haUp = ha.status === 'connected'
  const alerts: AlertItem[] = []
  const alert = (category: Category, severity: AlertItem['severity'], deviceName: string, message: string, timestamp = new Date().toISOString()) =>
    alerts.push({ id: `${category}-${deviceName}-${message}`, category, severity, deviceName, message, timestamp })

  // A Home Assistant section: live when connected and found, demo when Home
  // Assistant isn't configured at all, otherwise a placeholder.
  function fromHa<T>(cat: Category, live: () => T | null, fallback: T): T {
    if (!haConfigured) { sources[cat] = 'demo'; return fallback }
    const value = haUp ? live() : null
    sources[cat] = value === null ? 'off' : 'live'
    return value ?? fallback
  }

  const lightsLive = fromHa('lights', () => {
    const l = lightingState()
    return l.lights.length ? l : null
  }, { lights: demo.lights, lighting: demo.lighting! })
  // Keep the setup notes even when no lights matched
  const lighting = sources.lights === 'live' ? lightsLive.lighting : haUp ? lightingState().lighting : demo.lighting

  const climate = fromHa('climate', () => { const t = thermostats(); return t.length ? t : null }, demo.thermostats)
  for (const t of sources.climate === 'live' ? climate : []) {
    if (ha.states.get(t.id)?.state === 'unavailable') alert('climate', 'warning', t.name, 'Thermostat is offline')
  }
  const sonos = fromHa('sonos', sonosState, demo.sonos)
  const calendar = fromHa('calendar', calendarEvents, demo.calendar)
  if (haUp && calendarError()) alert('calendar', 'warning', 'Calendar', calendarError()!)

  // Rachio runs on its own, outside Home Assistant
  let irrigationZones = demo.irrigationZones
  let irrigation = demo.irrigation
  const r = latestRachio()
  if (rachioConfigured() && r) {
    sources.irrigation = 'live'
    irrigationZones = r.zones
    irrigation = r.summary
    if (r.summary.lastSkipped) alert('irrigation', 'info', r.summary.lastSkipped.name, "Scheduled run didn't start (skipped)", r.summary.lastSkipped.at)
    if (r.zones.some((z) => z.rainDelay)) alert('irrigation', 'info', 'Rachio', 'Rain delay is on')
  } else {
    sources.irrigation = rachioConfigured() ? 'off' : 'demo'
  }
  if (rachioError()) alert('irrigation', 'warning', 'Rachio', rachioError()!)
  if (rachioNotice()) alert('irrigation', 'warning', 'Rachio', rachioNotice()!)

  sources.weather = weather ? 'live' : 'demo'

  const tesla = fromHa('vehicles', teslaState, demo.tesla ?? null)

  const vacuum = fromHa('vacuum', vacuumState, demo.vacuum ?? null)
  if (sources.vacuum === 'live' && vacuum) for (const a of vacuumAlerts(vacuum)) alert('vacuum', a.severity, vacuum.name, a.message)

  // Not connected to the dashboard yet. Placeholders on the real system, demo while testing.
  for (const cat of ['cameras', 'list'] as Category[]) sources[cat] = haConfigured ? 'off' : 'demo'

  if (haConfigured && !haUp) alert('climate', 'critical', 'Home Assistant', "Can't reach Home Assistant — reconnecting")

  return {
    ...demo,
    thermostats: climate,
    lights: lightsLive.lights,
    lighting,
    sonos,
    tesla,
    vacuum,
    calendar,
    calendars: sources.calendar === 'live' ? calendarList() : demo.calendars,
    calendarRange: sources.calendar === 'live' ? calendarRange() ?? undefined : demo.calendarRange,
    sports: haConfigured ? sportsEvents() : demo.sports,
    irrigationZones,
    irrigation,
    weather: weather ?? demo.weather,
    alerts: haConfigured ? alerts : demo.alerts,
    sources,
    homeAssistant: haConfigured ? (haUp ? 'connected' : 'connecting') : 'not-configured',
  }
}
