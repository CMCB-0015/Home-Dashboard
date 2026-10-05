import type { HomeState } from '../types.ts'

// Demo data, shaped exactly like the live data will be. Both the frontend
// (plain `npm run dev`) and the backend (before a service is connected) use
// this, so there is one copy to keep up to date.

const at = (minutesFromNow: number) => new Date(Date.now() + minutesFromNow * 60_000).toISOString()
const ago = (m: number) => at(-m)

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

export function buildMockState(): HomeState {
  return {
    thermostats: [
      { id: 'nest-1', name: 'Main Floor', room: 'Living Room', currentTempF: 71, targetTempF: 70, humidityPct: 42, mode: 'heat' },
      { id: 'nest-2', name: 'Upstairs', room: 'Bedroom', currentTempF: 68, targetTempF: 68, humidityPct: 38, mode: 'eco' },
    ],
    lights: [
      { id: 'hue-1', name: 'Ceiling', room: 'Living Room', on: true, brightnessPct: 80 },
      { id: 'hue-2', name: 'Lamp', room: 'Living Room', on: true, brightnessPct: 45 },
      { id: 'hue-3', name: 'Pendant', room: 'Kitchen', on: true, brightnessPct: 100 },
      { id: 'hue-4', name: 'Under Cabinet', room: 'Kitchen', on: false, brightnessPct: 0 },
      { id: 'hue-5', name: 'Ceiling', room: 'Office', on: true, brightnessPct: 65 },
      { id: 'hue-6', name: 'Desk Lamp', room: 'Office', on: false, brightnessPct: 0 },
      { id: 'hue-7', name: 'Ceiling', room: 'Bedroom', on: false, brightnessPct: 0 },
      { id: 'hue-8', name: 'Nightstand', room: 'Bedroom', on: false, brightnessPct: 0 },
      { id: 'hue-9', name: 'Hallway', room: 'Hallway', on: true, brightnessPct: 30 },
      { id: 'hue-10', name: 'Porch', room: 'Front Door', on: true, brightnessPct: 100 },
      { id: 'hue-11', name: 'Garage', room: 'Garage', on: false, brightnessPct: 0 },
    ],
    cameras: [
      { id: 'eufy-1', name: 'Front Door', status: 'online', lastMotionAt: ago(14), snapshotUrl: '/demo/front-door.svg', liveUrl: null },
      { id: 'eufy-2', name: 'Driveway', status: 'online', lastMotionAt: ago(52), snapshotUrl: '/demo/driveway.svg', liveUrl: null },
    ],
    guardMode: 'home',
    vacuums: [
      { id: 'roborock-1', name: 'Roborock', state: 'docked', batteryPct: 92, lastCleanAt: ago(20 * 60) },
    ],
    vacuumRunProfiles: [
      { id: 'whole-home', name: 'Whole Home', rooms: 'All rooms', suction: 'balanced' },
      { id: 'quick', name: 'Quick Clean', rooms: 'All rooms, single pass', suction: 'quiet' },
      { id: 'pet-hair', name: 'Pet Hair Focus', rooms: 'Living Room, Bedroom', suction: 'max' },
      { id: 'kitchen', name: 'Kitchen Only', rooms: 'Kitchen', suction: 'max' },
    ],
    irrigationZones: [
      { id: 'rachio-1', name: 'Front Lawn', isWatering: false, minutesLeft: null, rainDelay: false, nextRunAt: at(14 * 60), lastRunAt: ago(28 * 60) },
      { id: 'rachio-2', name: 'Back Lawn', isWatering: false, minutesLeft: null, rainDelay: false, nextRunAt: at(14 * 60 + 12), lastRunAt: ago(26 * 60) },
      { id: 'rachio-3', name: 'Back Slope', isWatering: false, minutesLeft: null, rainDelay: false, nextRunAt: at(38 * 60), lastRunAt: ago(52 * 60) },
    ],
    irrigation: {
      nextRun: { name: 'Lawns', at: at(14 * 60) },
      quickRuns: [
        { id: 'back-slope-2', label: 'Back slope', detail: '2 min', available: true, zoneIds: ['rachio-3'] },
        { id: 'lawns', label: 'Quick Run Lawns', detail: '', available: true, zoneIds: [] },
        { id: 'back-lawn-5', label: 'Back lawn', detail: '5 min', available: true, zoneIds: ['rachio-2'] },
      ],
      skipTomorrow: { available: true, skipped: false, label: "Skip tomorrow's runs" },
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
      room: 'Living Room', groupSize: 2, playing: true,
      title: 'Sunday Morning', subtitle: 'Acoustic Mix', artUrl: '/demo/album.svg',
      positionSec: 98, durationSec: 232, volumePct: 35,
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
      { id: 'e1', title: 'Drop-off at school', location: null, start: todayAt(8, 30), end: todayAt(9), allDay: false, color: '#7fd1b9' },
      { id: 'e2', title: 'Lunch with Mike', location: "Pedro's Tacos", start: todayAt(12), end: todayAt(13), allDay: false, color: '#6fa8ff' },
      { id: 'e3', title: 'Date night', location: 'Reservation for 2', start: todayAt(20, 30), end: todayAt(22), allDay: false, color: '#d6a0e0' },
      { id: 'e4', title: 'Soccer practice', location: 'Field 3', start: todayAt(9, 0, 1), end: todayAt(10, 0, 1), allDay: false, color: '#7fd1b9' },
      { id: 'e5', title: 'Birthday party', location: 'Backyard BBQ', start: todayAt(14, 0, 1), end: todayAt(17, 0, 1), allDay: false, color: '#d6b46a' },
      { id: 'e6', title: 'Trash & recycling pickup', location: null, start: todayAt(0, 0, 3), end: null, allDay: true, color: '#56636f' },
      { id: 'e7', title: 'Dentist', location: 'Dr. Patel', start: todayAt(15, 30, 4), end: todayAt(16, 30, 4), allDay: false, color: '#6fa8ff' },
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
      { id: 'a3', category: 'vehicles', severity: 'info', message: 'Finished charging', deviceName: 'Model 3', timestamp: ago(60) },
      { id: 'a4', category: 'cameras', severity: 'warning', message: 'Motion detected', deviceName: 'Driveway', timestamp: ago(52) },
      { id: 'a5', category: 'irrigation', severity: 'info', message: 'Rain delay applied, schedule skipped', deviceName: 'Back Slope', timestamp: ago(120) },
      { id: 'a6', category: 'climate', severity: 'info', message: 'Switched to Eco mode', deviceName: 'Upstairs', timestamp: ago(9 * 60) },
      { id: 'a7', category: 'vacuum', severity: 'info', message: 'Finished cleaning, returned to dock', deviceName: 'Roborock', timestamp: ago(20 * 60) },
    ],
  }
}
