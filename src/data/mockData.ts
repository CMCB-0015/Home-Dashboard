import { demoVacuum } from '../lib/vacuum'
import type { HomeState, Light } from '../types.ts'

// Demo data, shaped exactly like the live data will be. Both the frontend
// (plain `npm run dev`) and the backend (before a service is connected) use
// this, so there is one copy to keep up to date.

const at = (minutesFromNow: number) => new Date(Date.now() + minutesFromNow * 60_000).toISOString()
const ago = (m: number) => at(-m)

function L(id: string, name: string, room: string, on: boolean, brightnessPct: number, color: string | null, kelvin: number | null,
  extra: Partial<Light> = {}): Light {
  return {
    id, name, room, on, brightnessPct, color: on ? color : null, kelvin, outdoor: false, timer: false, isGroup: false, available: true,
    supports: { color: true, white: true, dim: true }, minKelvin: 2000, maxKelvin: 6500, ...extra,
  }
}

function todayAt(hour: number, minute = 0, dayOffset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

function dayISO(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Demo calendar colors (Family is pinned blue in src/config/home.ts)
const F = '#6fa8ff', C = '#7fd1b9', H = '#f2c14e'

export function buildMockState(): HomeState {
  const now = new Date()
  return {
    thermostats: [
      { id: 'climate.thermostat', name: 'Thermostat', room: 'Hallway', currentTempF: 71, targetTempF: 70, humidityPct: 48, mode: 'cool',
        modes: ['heat', 'cool', 'heat_cool', 'eco', 'off'], action: 'idle' },
    ],
    lights: [
      L('light.patio_string_lights', 'Patio string lights', 'Patio', true, 70, '#ffb347', null, { outdoor: true }),
      L('light.patio_sconces', 'Patio sconces', 'Patio', true, 55, '#ffc98a', 2700, { outdoor: true }),
      L('light.bedroom_overhead', 'Bedroom overhead', 'Bedroom', false, 0, null, null, { isGroup: true }),
      L('light.window', 'Window', 'Bedroom', false, 0, null, null),
      L('light.dresser', 'Dresser', 'Bedroom', false, 0, null, null),
      L('light.bedside_lamp', 'Bedside lamp', 'Bedroom', true, 40, '#ff9f5a', 2200),
      L('light.living_room_lamp', 'Floor lamp', 'Living Room', true, 80, '#7f8cff', null),
      L('light.kitchen_pendants', 'Pendants', 'Kitchen', false, 0, null, null),
      L('light.hallway', 'Hallway', 'Hallway', false, 0, null, null),
      L('light.front_door', 'Front door', 'Front Yard', true, 100, '#ffd6a0', 2900, { outdoor: true, timer: true }),
      L('light.garage', 'Garage', 'Front Yard', true, 100, '#ffd6a0', 2900, { outdoor: true, timer: true }),
      L('light.side_yard', 'Side yard', 'Front Yard', false, 0, null, null, { outdoor: true, timer: true }),
    ],
    lighting: {
      quick: [
        { label: 'Patio string lights', lightId: 'light.patio_string_lights' },
        { label: 'Patio sconces', lightId: 'light.patio_sconces' },
        { label: 'Bedroom overhead', lightId: 'light.bedroom_overhead' },
        { label: 'Bedside lamp', lightId: 'light.bedside_lamp' },
      ],
      scenes: ['Bright', 'Relax', 'Read', 'Concentrate', 'Nightlight'].flatMap((n) => [
        { id: `scene.bedroom_${n.toLowerCase()}`, name: n, room: 'Bedroom' },
        { id: `scene.patio_${n.toLowerCase()}`, name: n, room: 'Patio' },
      ]),
      cans: { groupId: 'light.bedroom_overhead', windowId: 'light.window', dresserId: 'light.dresser' },
      bedtime: { status: 'ready', enabled: true, start: '20:00', end: '22:00', lastRun: ago(23 * 60) },
      notes: [],
    },
    cameras: [
      { id: 'eufy-1', name: 'Front Door', status: 'online', lastMotionAt: ago(14), snapshotUrl: '/demo/front-door.svg', liveUrl: null },
      { id: 'eufy-2', name: 'Driveway', status: 'online', lastMotionAt: ago(52), snapshotUrl: '/demo/driveway.svg', liveUrl: null },
    ],
    guardMode: 'home',
    vacuum: demoVacuum(ago(20 * 60)),
    irrigationZones: [
      { id: 'rachio-1', name: 'Front Lawn', isWatering: false, minutesLeft: null, rainDelay: false, nextRunAt: at(14 * 60), lastRunAt: ago(28 * 60) },
      { id: 'rachio-2', name: 'Back Lawn', isWatering: false, minutesLeft: null, rainDelay: false, nextRunAt: at(14 * 60 + 12), lastRunAt: ago(26 * 60) },
      { id: 'rachio-3', name: 'Back Slope', isWatering: false, minutesLeft: null, rainDelay: false, nextRunAt: at(38 * 60), lastRunAt: ago(52 * 60) },
    ],
    irrigation: {
      nextRun: { name: 'Lawns', at: todayAt(5, 0, 1), minutes: 19 },
      week: Array.from({ length: 7 }, (_, k) => ({
        date: dayISO(k),
        runs: k === 1 || k === 4 || k === 6 ? [{
          id: `lawns-${k}`, scheduleId: 'lawns', name: 'Lawns', at: todayAt(5, 0, k), minutes: 19,
          zoneNames: ['Front Lawn', 'Back Lawn'], skipped: false, canSkip: k === 1,
          reason: k === 1 ? undefined : 'Rachio can only skip this schedule’s next run',
        }] : [],
      })),
      watering: null,
      quickRuns: [
        { id: 'back-slope-2', label: 'Back slope', detail: '2 min', kind: 'zone', minutes: 2, available: true, zoneIds: ['rachio-3'], zoneNames: ['Back Slope'], lastRunAt: ago(52 * 60) },
        { id: 'lawns', label: 'Lawns', detail: '', kind: 'schedule', minutes: 19, available: true, zoneIds: ['rachio-1', 'rachio-2'], zoneNames: ['Front Lawn', 'Back Lawn'] },
        { id: 'back-lawn-5', label: 'Back lawn', detail: '5 min', kind: 'zone', minutes: 5, available: true, zoneIds: ['rachio-2'], zoneNames: ['Back Lawn'], lastRunAt: ago(26 * 60) },
      ],
      skipTomorrow: { available: true, skipped: false, label: "Skip tomorrow's runs" },
    },
    tesla: {
      name: 'WillaWilla', online: true, batteryPct: 70, rangeMi: 216,
      charging: 'complete', plugged: true, chargeLimitPct: 80, chargeLimitMin: 50, chargeLimitMax: 100,
      chargeAmps: 32, chargeAmpsMax: 48, chargerAmps: null, chargeRateMph: null, doneAt: null,
      portOpen: false, schedule: { enabled: true, time: '23:00' }, locked: true,
      insideF: 58, outsideF: 54, climateOn: false, targetF: 70, minF: 59, maxF: 82,
      driver: 0, passenger: 0, rear: 0, coolingSeats: true, wheel: false, frontDefrost: false, rearDefrost: null,
      frunkOpen: false, trunkOpen: false, atHome: true, driving: false, speedMph: null,
      enRouteHome: null, location: { lat: 33.427, lon: -117.612 }, updatedAt: ago(5),
    },
    vehicles: [
      {
        id: 'tesla-1', name: 'Model 3', detail: '2024 · Grey', kind: 'ev', color: '#5f666d',
        batteryPct: 78, rangeMi: 241, charging: 'complete', locked: true, insideTempF: 68,
        updatedAt: ago(5), canCommand: true,
      },
      // BMW X5 45e goes here once BMW CarData access is confirmed:
      // { id: 'bmw-1', name: 'X5 45e', detail: '2022 · Blue-grey', kind: 'phev', color: '#3f5466',
      //   batteryPct: 62, rangeMi: 19, fuelPct: 71, fuelRangeMi: 305, charging: 'unplugged',
      //   locked: true, insideTempF: null, updatedAt: ago(22), canCommand: false },
    ],
    sonos: {
      id: 'media_player.patio_1',
      room: 'Patio 1 + Patio 2', groupSize: 2, playing: true,
      title: 'Harvest Moon', subtitle: 'Neil Young', artUrl: '/demo/album.svg',
      positionSec: 98, durationSec: 303, volumePct: 30, shuffle: false, from: 'Chill',
      speakers: [
        { id: 'media_player.patio_1', name: 'Patio 1', room: 'Patio', available: true, volumePct: 30, state: 'playing', group: ['media_player.patio_1', 'media_player.patio_2'] },
        { id: 'media_player.patio_2', name: 'Patio 2', room: 'Patio', available: true, volumePct: 30, state: 'playing', group: ['media_player.patio_1', 'media_player.patio_2'] },
        { id: 'media_player.roam_2', name: 'Roam 2', room: 'Garage', available: true, volumePct: 35, state: 'paused', group: ['media_player.roam_2'] },
        { id: 'media_player.living_room', name: 'Living Room', room: 'Living Room', available: true, volumePct: 25, state: 'idle', group: ['media_player.living_room'] },
        { id: 'media_player.kitchen', name: 'Kitchen', room: 'Kitchen', available: true, volumePct: 25, state: 'idle', group: ['media_player.kitchen'] },
      ],
      favorites: [
        { id: 'FV:2/1', name: 'All my tracks', kind: 'Playlist', art: null },
        { id: 'FV:2/2', name: 'Chill', kind: 'Playlist', art: null },
        { id: 'FV:2/3', name: 'Dinner Jazz', kind: 'Playlist', art: null },
        { id: 'FV:2/4', name: 'Rock', kind: 'Playlist', art: null },
        { id: 'FV:2/5', name: 'Sunday Morning', kind: 'Album', art: null },
      ],
      presets: [
        { id: 'chill', name: 'Chill', where: 'Patio 1 + Patio 2', volume: 'Vol 30', shuffle: false, available: true },
        { id: 'rock', name: 'Rock', where: 'Roam 2', volume: 'Vol 35', shuffle: false, available: true },
        { id: 'all-tracks', name: 'All my tracks', where: 'Roam 2 · Shuffle', volume: 'Vol 35', shuffle: true, available: true },
      ],
      groupChips: [
        { label: 'Patio 1 + 2', speakerIds: ['media_player.patio_1', 'media_player.patio_2'] },
        { label: 'Garage', speakerIds: ['media_player.roam_2'] },
        { label: 'Everywhere', speakerIds: ['media_player.patio_1', 'media_player.patio_2', 'media_player.roam_2', 'media_player.living_room', 'media_player.kitchen'] },
      ],
    },
    weather: {
      location: 'San Clemente',
      updatedAt: ago(5),
      current: {
        tempF: 68, feelsLikeF: 67, condition: 'Partly cloudy', icon: 'pcloudy-night',
        humidityPct: 72, dewPointF: 59, windMph: 7, windDir: 'WSW',
        rainChancePct: 10, uvIndex: 0, aqi: 38,
      },
      today: { highF: 75, lowF: 61, sunrise: todayAt(6, 47), sunset: todayAt(18, 33) },
      hourly: [67, 65, 63, 62, 61, 61, 64, 70, 74, 75].map((t, i) => ({
        time: at(i * 120), tempF: t, rainChancePct: i < 6 ? 5 : 0,
      })),
      daily: [
        { date: dayISO(0), icon: 'pcloudy', highF: 75, lowF: 61, rainChancePct: 10 },
        { date: dayISO(1), icon: 'sun', highF: 77, lowF: 62, rainChancePct: 0 },
        { date: dayISO(2), icon: 'sun', highF: 79, lowF: 63, rainChancePct: 0 },
        { date: dayISO(3), icon: 'pcloudy', highF: 74, lowF: 61, rainChancePct: 5 },
        { date: dayISO(4), icon: 'cloudy', highF: 70, lowF: 60, rainChancePct: 20 },
        { date: dayISO(5), icon: 'rain', highF: 67, lowF: 59, rainChancePct: 45 },
      ],
    },
    calendar: [
      { id: 'e1', title: 'Drop-off at school', location: null, start: todayAt(8, 30), end: todayAt(9), allDay: false, color: F, calendar: 'Family' },
      { id: 'e2', title: 'Lunch with Mike', location: "Pedro's Tacos, 2801 S El Camino Real, San Clemente, CA 92672, USA", start: todayAt(12), end: todayAt(13), allDay: false, color: C, calendar: 'Connor',
        description: 'Catch up before the trip. Mike is bringing the drone parts.' },
      { id: 'e3', title: 'Margaux swim class', location: 'San Clemente Aquatics Center, 987 Avenida Vista Hermosa, San Clemente, CA 92673, USA', start: todayAt(16, 45), end: todayAt(17), allDay: false, color: F, calendar: 'Family',
        description: 'Bring goggles and a towel.\nCoach Sara: lane 3.' },
      { id: 'e4', title: 'Date night', location: 'Nick\'s San Clemente, 213 Avenida Del Mar, San Clemente, CA 92672, USA', start: todayAt(19, 30), end: todayAt(21), allDay: false, color: F, calendar: 'Family',
        description: 'Reservation for 2 under Halberg.' },
      { id: 'e5', title: 'Soccer game', location: 'Vista Hermosa Sports Park, 987 Avenida Vista Hermosa, San Clemente, CA 92673, USA', start: todayAt(10, 30, 1), end: todayAt(11, 30, 1), allDay: false, color: F, calendar: 'Family' },
      { id: 'e6', title: 'Pool service', location: null, start: todayAt(0, 0, 1), end: todayAt(0, 0, 2), allDay: true, color: F, calendar: 'Family' },
      { id: 'e7', title: 'Dentist', location: 'Coastal Dental, 1031 Avenida Pico, San Clemente, CA 92673, USA', start: todayAt(15, 30, 4), end: todayAt(16, 30, 4), allDay: false, color: C, calendar: 'Connor' },
      { id: 'e8', title: 'Halloween', location: null, start: todayAt(0, 0, 7), end: todayAt(0, 0, 8), allDay: true, color: H, calendar: 'Holidays in United States' },
      { id: 'e9', title: 'Design review · Blitz', location: null, start: todayAt(9, 0, 3), end: todayAt(10, 30, 3), allDay: false, color: C, calendar: 'Connor' },
      { id: 'e10', title: 'Trash & recycling pickup', location: null, start: todayAt(0, 0, 5), end: todayAt(0, 0, 6), allDay: true, color: F, calendar: 'Family' },
      { id: 'e11', title: 'Veterans Day', location: null, start: todayAt(0, 0, 18), end: todayAt(0, 0, 19), allDay: true, color: H, calendar: 'Holidays in United States' },
      { id: 'e12', title: 'Margaux swim class', location: 'San Clemente Aquatics Center, 987 Avenida Vista Hermosa, San Clemente, CA 92673, USA', start: todayAt(16, 45, 7), end: todayAt(17, 0, 7), allDay: false, color: F, calendar: 'Family' },
      { id: 'e13', title: 'Car service', location: 'Tesla Service Center, 3 Hughes, Irvine, CA 92618, USA', start: todayAt(8, 0, 10), end: todayAt(9, 0, 10), allDay: false, color: C, calendar: 'Connor' },
      { id: 'e14', title: 'Thanksgiving at Mom\'s', location: null, start: todayAt(0, 0, 33), end: todayAt(0, 0, 34), allDay: true, color: F, calendar: 'Family' },
    ],
    calendars: [
      { id: 'calendar.family', name: 'Family', color: F },
      { id: 'calendar.connor', name: 'Connor', color: C },
      { id: 'calendar.holidays', name: 'Holidays in United States', color: H },
    ],
    calendarRange: { start: new Date(now.getFullYear(), now.getMonth(), -6).toISOString(), end: new Date(now.getFullYear(), now.getMonth() + 2, 8).toISOString() },
    sports: [
      { id: 'g1', kind: 'suns', title: 'Suns vs. Portland', start: todayAt(19), end: todayAt(21, 30), channel: 'ESPN' },
      { id: 'g2', kind: 'f1', title: 'F1 · Mexico City GP', start: todayAt(13, 0, 2), end: todayAt(15, 0, 2), big: true },
    ],
    shoppingList: [
      { id: 's1', text: 'Milk', section: 'Grocery', done: false },
      { id: 's2', text: 'Bananas', section: 'Grocery', done: false },
      { id: 's3', text: 'Chicken thighs', section: 'Grocery', done: false },
      { id: 's4', text: 'Sourdough', section: 'Grocery', done: false },
      { id: 's5', text: 'Coffee beans', section: 'Grocery', done: false },
      { id: 's6', text: 'Dishwasher pods', section: 'Household', done: false },
      { id: 's7', text: 'Paper towels', section: 'Household', done: false },
      { id: 's8', text: 'Eggs', section: 'Grocery', done: true },
    ],
    alerts: [
      { id: 'a2', category: 'cameras', severity: 'warning', message: 'Motion detected', deviceName: 'Front Door', timestamp: ago(14) },
      { id: 'a3', category: 'vehicles', severity: 'info', message: 'Finished charging', deviceName: 'WillaWilla', timestamp: ago(60) },
      { id: 'a4', category: 'cameras', severity: 'warning', message: 'Motion detected', deviceName: 'Driveway', timestamp: ago(52) },
      { id: 'a5', category: 'irrigation', severity: 'info', message: 'Rain delay applied, schedule skipped', deviceName: 'Back Slope', timestamp: ago(120) },
      { id: 'a6', category: 'climate', severity: 'info', message: 'Switched to Eco mode', deviceName: 'Thermostat', timestamp: ago(9 * 60) },
      { id: 'a7', category: 'vacuum', severity: 'info', message: 'Finished cleaning, returned to dock', deviceName: 'S8 Pro Ultra', timestamp: ago(20 * 60) },
    ],
  }
}
