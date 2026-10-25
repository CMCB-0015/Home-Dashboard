// The shape of everything the dashboard shows. The backend returns exactly
// this, whether it's demo data or live data from each service.

export type Category =
  | 'climate' | 'lights' | 'cameras' | 'vacuum' | 'irrigation'
  | 'vehicles' | 'sonos' | 'weather' | 'calendar' | 'list'

export type ThermostatMode = 'heat' | 'cool' | 'heat_cool' | 'eco' | 'off'

export interface Thermostat {
  id: string; name: string; room: string
  currentTempF: number; targetTempF: number; humidityPct: number
  mode: ThermostatMode
  /** Modes this thermostat offers */
  modes?: ThermostatMode[]
  /** Heat · Cool mode keeps the temperature between two targets */
  targetLowF?: number | null; targetHighF?: number | null
  /** Heating or cooling right now */
  action?: 'heating' | 'cooling' | 'idle' | 'off' | null
}

export interface Light {
  id: string; name: string; room: string; on: boolean; brightnessPct: number
  /** The light's current color as #rrggbb (white lights too), or null when unknown */
  color?: string | null
  /** Current white tone in kelvin when it's in white mode */
  kelvin?: number | null
  /** What the bulb can do */
  supports?: { color: boolean; white: boolean; dim: boolean }
  minKelvin?: number; maxKelvin?: number
  /** Outside light (patio, yard, garage...) */
  outdoor?: boolean
  /** On a timer all the time (front door, garage, side yard) */
  timer?: boolean
  /** A Hue room or zone that controls several lights at once */
  isGroup?: boolean
  available?: boolean
}

/** One of the four buttons on the Lights card */
export interface QuickLight {
  label: string
  lightId: string | null
  /** Why it isn't matched to a light */
  reason?: string
}

export interface LightScene { id: string; name: string; room: string }

/** "Bedside lamp after TV" — lives in Home Assistant, adjusted from the dashboard */
export interface BedtimeLamp {
  status: 'ready' | 'not-set-up' | 'no-tv' | 'no-lamp' | 'offline'
  enabled: boolean
  /** "20:00" */
  start: string
  end: string
  lastRun: string | null
  message?: string
}

export interface Lighting {
  quick: QuickLight[]
  scenes: LightScene[]
  /** The two Bedroom overhead cans, controllable together or separately */
  cans: { groupId: string; windowId: string; dresserId: string } | null
  bedtime: BedtimeLamp
  /** Names in src/config/home.ts that didn't match a light, with what's available */
  notes: string[]
}

export interface Camera {
  id: string; name: string; status: 'online' | 'offline'
  lastMotionAt: string | null
  snapshotUrl: string | null      // latest motion thumbnail
  liveUrl: string | null          // link that opens the live feed
}

export type GuardMode = 'home' | 'away'

/** One room on the dashboard's floor plan (shapes from src/config/home.ts) */
export interface VacuumRoom {
  id: string; name: string; color: string
  /** Which box gets the label */
  main: number
  rects: number[][]
  /** The Roborock room number (null = the name didn't match a Roborock room) */
  segment: number | null
}

export interface VacuumPreset {
  id: string; name: string
  /** "Vacuum + mop" */
  sub: string
  color: string
  rooms: string[]
  vacuum: boolean; mop: boolean
  available: boolean
  reason?: string
}

export interface VacuumState {
  name: string
  state: 'docked' | 'cleaning' | 'paused' | 'returning' | 'idle' | 'error'
  batteryPct: number | null
  /** What's wrong when state is "error" (stuck, brush jammed…) */
  error: string | null
  dock: {
    cleanWater: 'ok' | 'empty' | null
    dirtyWater: 'ok' | 'full' | null
    mopDrying: boolean | null
    dryingMinutes: number | null
    /** Other dock problem, in words */
    problem: string | null
  }
  /** Room the robot is in (our room id), when Home Assistant says */
  currentRoom: string | null
  /** The run started from the dashboard (or a full clean) */
  run: { name: string; rooms: string[]; startedAt: string } | null
  cleanMinutes: number | null
  cleanAreaFt2: number | null
  /** Current Roborock settings, as Roborock names them */
  suction: string | null
  suctionOptions: string[]
  mopIntensity: string | null
  mopIntensityOptions: string[]
  mopRoute: string | null
  mopRouteOptions: string[]
  rooms: VacuumRoom[]
  presets: VacuumPreset[]
  /** Drawn areas work (the floor plan is lined up with the robot's map) */
  areas: boolean
  lastCleanAt: string | null
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
  /** A scheduled run that didn't start (rain, wind or skipped in the Rachio app) */
  lastSkipped?: { name: string; at: string } | null
  quickRuns: QuickRun[]
  /** "Skip tomorrow's runs" button state */
  skipTomorrow: { available: boolean; skipped: boolean; label: string }
}

/** The Tesla (WillaWilla), from Teslemetry through Home Assistant */
export interface Tesla {
  name: string
  /** Awake and talking to Teslemetry (asleep cars wake on the first command) */
  online: boolean
  batteryPct: number | null
  rangeMi: number | null
  charging: 'charging' | 'starting' | 'complete' | 'stopped' | 'unplugged' | 'no_power'
  plugged: boolean
  chargeLimitPct: number | null
  chargeLimitMin: number
  chargeLimitMax: number
  /** Requested charging current, and the most the charger allows */
  chargeAmps: number | null
  chargeAmpsMax: number
  /** Live while charging */
  chargerAmps: number | null
  chargeRateMph: number | null
  doneAt: string | null
  portOpen: boolean | null
  /** Scheduled charging (null when Home Assistant doesn't show it) */
  schedule: { enabled: boolean; time: string | null } | null
  locked: boolean | null
  insideF: number | null
  outsideF: number | null
  climateOn: boolean
  targetF: number | null
  minF: number
  maxF: number
  /** Seat levels: 1–3 heat, −1 to −3 cooling, 0 off */
  driver: number
  passenger: number
  rear: number
  /** Front seats can cool */
  coolingSeats: boolean
  /** null = this control isn't in Home Assistant */
  wheel: boolean | null
  frontDefrost: boolean | null
  rearDefrost: boolean | null
  frunkOpen: boolean | null
  trunkOpen: boolean | null
  atHome: boolean
  driving: boolean
  speedMph: number | null
  /** Only when the navigation destination is Home — never a guess */
  enRouteHome: { minutes: number | null; miles: number | null; arriveAt: string | null; near: string | null } | null
  location: { lat: number; lon: number } | null
  updatedAt: string
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
  /** The speaker running what's shown (the group's lead speaker) */
  id?: string
  /** Speakers playing it, e.g. "Patio 1 + Patio 2" */
  room: string
  groupSize: number
  playing: boolean; title: string; subtitle: string
  artUrl: string | null
  positionSec: number; durationSec: number; volumePct: number
  shuffle?: boolean
  /** The Favorite or preset it was started from on the dashboard, when known */
  from?: string | null
  /** Every Sonos speaker, for the Sonos page */
  speakers?: SonosSpeaker[]
  /** Sonos Favorites (Tidal playlists saved in the Sonos app) */
  favorites?: SonosFavorite[]
  /** Quick-play buttons from src/config/home.ts */
  presets?: SonosPreset[]
  /** One-tap speaker groups on the Sonos page */
  groupChips?: { label: string; speakerIds: string[] }[]
}

export interface SonosSpeaker {
  id: string; name: string; room: string | null
  available: boolean
  volumePct: number
  state: string
  /** Speakers in its group, lead speaker first (just itself when alone) */
  group: string[]
}

export interface SonosFavorite { id: string; name: string; kind: string; art: string | null }

export interface SonosPreset {
  id: string; name: string
  /** "Patio 1 + Patio 2" */
  where: string
  /** "Vol 30" */
  volume: string
  shuffle: boolean
  available: boolean
  /** Why it can't play (a name didn't match) */
  reason?: string
  /** The Sonos Favorite it plays */
  favorite?: string
  /** Saved from the Sonos page (can be renamed or deleted there) */
  saved?: boolean
}

export interface QueueItem { position: number; title: string; artist: string; current: boolean }

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

/** A game or race from The Brief's schedule feed, for the status bar */
export interface SportsEvent {
  id: string
  /** suns · dbacks · f1 · golf · major */
  kind: string
  /** "Suns vs. Portland", "Mexico City GP", "The Masters · Round 3" */
  title: string
  start: string
  end?: string | null
  /** TV channel (not shown for F1, always Apple TV) */
  channel?: string | null
  /** Big events (F1 races, golf majors) show up to 3 days ahead */
  big?: boolean
  /** This game's page in The Brief */
  link?: string | null
}

export type Severity = 'info' | 'warning' | 'critical'

export interface AlertItem {
  id: string; category: Category; severity: Severity
  message: string; deviceName: string; timestamp: string
}

export interface HomeState {
  thermostats: Thermostat[]
  lights: Light[]
  /** Lights card setup: quick buttons, scenes, bedroom cans, bedtime lamp */
  lighting?: Lighting
  cameras: Camera[]
  guardMode: GuardMode
  /** The vacuum card (null = not found in Home Assistant) */
  vacuum?: VacuumState | null
  irrigationZones: IrrigationZone[]
  irrigation: IrrigationSummary
  vehicles: Vehicle[]
  /** The Tesla card (null = not found in Home Assistant) */
  tesla?: Tesla | null
  sonos: SonosState | null
  weather: Weather | null
  calendar: CalendarEvent[]
  /** Upcoming games and races from The Brief (empty until its schedule feed exists) */
  sports?: SportsEvent[]
  shoppingList: ShoppingItem[]
  alerts: AlertItem[]
  /**
   * Where each section's data comes from:
   * live = real data · demo = made-up sample data (testing without Home Assistant)
   * off = not connected yet, so the card shows as a placeholder
   */
  sources?: Partial<Record<Category, 'live' | 'demo' | 'off'>>
  /** False when the dashboard is running but can't reach Home Assistant */
  homeAssistant?: 'connected' | 'connecting' | 'not-configured'
}
