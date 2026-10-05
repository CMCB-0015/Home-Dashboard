// The shape of everything the dashboard shows. The backend returns exactly
// this, whether it's demo data or live data from each service.

export type Category =
  | 'climate' | 'lights' | 'cameras' | 'vacuum' | 'irrigation'
  | 'vehicles' | 'sonos' | 'weather' | 'calendar' | 'list'

export interface Thermostat {
  id: string; name: string; room: string
  currentTempF: number; targetTempF: number; humidityPct: number
  mode: 'heat' | 'cool' | 'eco' | 'off'
}

export interface Light {
  id: string; name: string; room: string; on: boolean; brightnessPct: number
}

export interface Camera {
  id: string; name: string; status: 'online' | 'offline'
  lastMotionAt: string | null
  snapshotUrl: string | null      // latest motion thumbnail
  liveUrl: string | null          // link that opens the live feed
}

export type GuardMode = 'home' | 'away'

export interface Vacuum {
  id: string; name: string
  state: 'docked' | 'cleaning' | 'returning' | 'paused' | 'stuck'
  batteryPct: number; lastCleanAt: string
}

export interface RunProfile {
  id: string; name: string; rooms: string; suction: 'quiet' | 'balanced' | 'max'
}

export interface IrrigationZone {
  id: string; name: string; isWatering: boolean; minutesLeft: number | null
  rainDelay: boolean; nextRunAt: string | null; lastRunAt: string | null
  /** Paused mid-run from the dashboard; resumes on its own at resumesAt */
  isPaused?: boolean; resumesAt?: string | null
}

export interface QuickRun {
  id: string
  label: string
  /** e.g. "2 min" or "Schedule" */
  detail: string
  available: boolean
  /** Why it's unavailable (name didn't match), shown on the detail page */
  reason?: string
  /** Zones it waters, so the screen can update right away */
  zoneIds?: string[]
}

export interface IrrigationSummary {
  nextRun: { name: string; at: string } | null
  quickRuns: QuickRun[]
  /** "Skip tomorrow's runs" button state */
  skipTomorrow: { available: boolean; skipped: boolean; label: string }
}

export interface Vehicle {
  id: string; name: string; detail: string; kind: 'ev' | 'phev'
  color: string
  batteryPct: number; rangeMi: number
  fuelPct?: number; fuelRangeMi?: number
  charging: 'charging' | 'complete' | 'plugged' | 'unplugged'
  locked: boolean; insideTempF: number | null
  updatedAt: string
  canCommand: boolean
}

export interface SonosState {
  room: string; groupSize: number
  playing: boolean; title: string; subtitle: string
  artUrl: string | null
  positionSec: number; durationSec: number; volumePct: number
}

export type WeatherIcon = 'sun' | 'moon' | 'pcloudy' | 'pcloudy-night' | 'cloudy' | 'fog' | 'rain' | 'storm' | 'snow'

export interface Weather {
  location: string
  updatedAt: string
  current: {
    tempF: number; feelsLikeF: number; condition: string; icon: WeatherIcon
    humidityPct: number; dewPointF: number
    windMph: number; windDir: string
    rainChancePct: number; uvIndex: number; aqi: number | null
  }
  today: { highF: number; lowF: number; sunrise: string; sunset: string }
  hourly: { time: string; tempF: number; rainChancePct: number }[]
  daily: { date: string; icon: WeatherIcon; highF: number; lowF: number; rainChancePct: number }[]
}

export interface CalendarEvent {
  id: string; title: string; location: string | null
  start: string; end: string | null; allDay: boolean; color: string
}

export interface ShoppingItem {
  id: string; text: string; section: string; done: boolean
}

export type Severity = 'info' | 'warning' | 'critical'

export interface AlertItem {
  id: string; category: Category; severity: Severity
  message: string; deviceName: string; timestamp: string
}

export interface HomeState {
  thermostats: Thermostat[]
  lights: Light[]
  cameras: Camera[]
  guardMode: GuardMode
  vacuums: Vacuum[]
  vacuumRunProfiles: RunProfile[]
  irrigationZones: IrrigationZone[]
  irrigation: IrrigationSummary
  vehicles: Vehicle[]
  sonos: SonosState | null
  weather: Weather | null
  calendar: CalendarEvent[]
  shoppingList: ShoppingItem[]
  alerts: AlertItem[]
  /** Which sections are real data vs. placeholders */
  sources?: Partial<Record<Category, 'live' | 'demo'>>
}
