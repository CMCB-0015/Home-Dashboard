// Backup weather from the US National Weather Service (api.weather.gov), free, no key.
// Used when Open-Meteo doesn't answer. NWS's gridded forecast is turned into the same
// shape as an Open-Meteo reply, so the rest of weather.ts reads it the same way.
// Not available from NWS: UV index (left out) and air quality (left out).
import { env } from './env.ts'

const UA = 'Panel home dashboard (github.com/CMCB-0015/Home-Dashboard)'
const HOUR = 3_600_000

type GridValue = { validTime: string; value: unknown }
type GridProp = { uom?: string; values: GridValue[] }

let point: { key: string; grid: string; timeZone: string } | null = null

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/geo+json' }, signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`National Weather Service returned ${res.status}`)
  return res.json()
}

/** "PT6H", "P1D", "P1DT6H" → hours */
function hoursOf(iso: string): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(iso)
  if (!m) return 1
  return Math.max(1, Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0) + Math.round(Number(m[3] ?? 0) / 60))
}

/** One value per hour start from a gridded property; precipitation-like amounts are split evenly over their hours */
function perHour(prop: GridProp | undefined, starts: number[], split = false): (number | null)[] {
  const spans = (prop?.values ?? []).map((v) => {
    const [at, dur] = v.validTime.split('/')
    const a = Date.parse(at), h = hoursOf(dur ?? 'PT1H')
    return { a, b: a + h * HOUR, h, v: v.value }
  }).filter((s) => Number.isFinite(s.a))
  return starts.map((t) => {
    const s = spans.find((x) => t >= x.a && t < x.b) ?? (spans.length && t < spans[0].a ? spans[0] : undefined)
    if (!s || typeof s.v !== 'number') return null
    return split ? s.v / s.h : s.v
  })
}

const toF = (c: number | null) => (c === null ? null : c * 9 / 5 + 32)
const kmhToMph = (k: number | null) => (k === null ? null : k / 1.609344)
const isKmh = (p?: GridProp) => !p?.uom || p.uom.includes('km_h')

/** Sunrise and sunset for a date (sunrise equation, ±1 min) */
export function sunTimes(y: number, m: number, d: number, lat: number, lon: number): { rise: number; set: number } {
  const rad = Math.PI / 180
  const jd = Date.UTC(y, m - 1, d, 12) / 86_400_000 + 2440587.5
  const n = Math.round(jd - 2451545.0 + 0.0008)
  const J = n - lon / 360
  const M = (357.5291 + 0.98560028 * J) % 360
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad)
  const L = (M + C + 180 + 102.9372) % 360
  const transit = 2451545.0 + J + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad)
  const dec = Math.asin(Math.sin(L * rad) * Math.sin(23.4397 * rad))
  const cosW = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(dec)) / (Math.cos(lat * rad) * Math.cos(dec))
  const w = Math.acos(Math.max(-1, Math.min(1, cosW))) / rad
  const ms = (j: number) => (j - 2440587.5) * 86_400_000
  return { rise: ms(transit - w / 360), set: ms(transit + w / 360) }
}

/** An Open-Meteo-style weather code from NWS weather words, rain chance and sky cover */
function codeOf(wx: unknown, pop: number | null, sky: number | null): number {
  const list = Array.isArray(wx) ? wx as { weather?: string | null; intensity?: string | null }[] : []
  const words = list.map((w) => w.weather ?? '').filter(Boolean)
  const heavy = list.some((w) => w.intensity === 'heavy'), light = list.some((w) => w.intensity === 'light' || w.intensity === 'very_light')
  const likely = (pop ?? 0) >= 40
  if (words.includes('thunderstorms') && likely) return 95
  if (words.some((w) => w.includes('snow')) && likely) return 73
  if (words.some((w) => w.startsWith('freezing') || w === 'sleet') && likely) return 66
  if (words.includes('rain_showers') && likely) return heavy ? 82 : 80
  if (words.includes('rain') && likely) return heavy ? 65 : light ? 61 : 63
  if (words.includes('drizzle') && likely) return 51
  if (words.some((w) => w === 'fog' || w === 'freezing_fog')) return 45
  const s = sky ?? 0
  return s <= 12 ? 0 : s <= 37 ? 1 : s <= 62 ? 2 : 3
}

/** The NWS forecast for lat/lon, shaped like an Open-Meteo forecast reply */
export async function nwsForecast(lat: number, lon: number) {
  const base = env('NWS_URL') ?? 'https://api.weather.gov'
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`
  if (!point || point.key !== key) {
    const p = await getJson(`${base}/points/${key}`)
    const grid = p?.properties?.forecastGridData
    if (!grid) throw new Error('National Weather Service has no forecast grid for this location')
    point = { key, grid: env('NWS_URL') ? grid.replace(/^https:\/\/api\.weather\.gov/, base) : grid, timeZone: p.properties.timeZone ?? 'America/Los_Angeles' }
  }
  const g = (await getJson(point.grid))?.properties
  if (!g?.temperature?.values?.length) throw new Error('National Weather Service sent an empty forecast')
  const tz = point.timeZone

  // Local clock parts in the station's time zone
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
  const parts = (t: number) => Object.fromEntries(fmt.formatToParts(new Date(t)).map((p) => [p.type, p.value])) as Record<string, string>
  const local = (t: number) => { const p = parts(t); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}` }
  const now = Date.now()
  const pn = parts(now)
  const offset = Math.round((Date.UTC(+pn.year, +pn.month - 1, +pn.day, +pn.hour, +pn.minute, +pn.second) - now) / 60_000) * 60
  const midnight = Date.UTC(+pn.year, +pn.month - 1, +pn.day) - offset * 1000
  const starts = Array.from({ length: 7 * 24 }, (_, i) => midnight + i * HOUR)

  const T = perHour(g.temperature, starts).map(toF)
  const Td = perHour(g.dewpoint, starts).map(toF)
  const AT = perHour(g.apparentTemperature, starts).map(toF)
  const RH = perHour(g.relativeHumidity, starts)
  const POP = perHour(g.probabilityOfPrecipitation, starts)
  const QPF = perHour(g.quantitativePrecipitation, starts, true).map((mm) => (mm === null ? 0 : mm / 25.4))
  const SKY = perHour(g.skyCover, starts)
  const WS = perHour(g.windSpeed, starts).map((v) => (isKmh(g.windSpeed) ? kmhToMph(v) : v))
  const WG = perHour(g.windGust, starts).map((v) => (isKmh(g.windGust) ? kmhToMph(v) : v))
  const WD = perHour(g.windDirection, starts)
  // Weather words per hour (kept as the raw lists)
  const wxSpans = (g.weather?.values ?? []).map((v: GridValue) => { const [at, dur] = v.validTime.split('/'); const a = Date.parse(at); return { a, b: a + hoursOf(dur ?? 'PT1H') * HOUR, v: v.value } })
  const wxAt = (t: number) => wxSpans.find((s: { a: number; b: number }) => t >= s.a && t < s.b)?.v ?? null

  // Days, with sunrise / sunset worked out here (NWS doesn't send them)
  const dates = Array.from({ length: 7 }, (_, d) => local(midnight + d * 24 * HOUR + 12 * HOUR).slice(0, 10))
  const sun = dates.map((ds) => { const [y, m, d] = ds.split('-').map(Number); return sunTimes(y, m, d, lat, lon) })
  const isDay = starts.map((t, i) => { const s = sun[Math.min(6, Math.floor(i / 24))]; return t + HOUR / 2 >= s.rise && t + HOUR / 2 < s.set ? 1 : 0 })
  const code = starts.map((t, i) => codeOf(wxAt(t), POP[i], SKY[i]))

  const hourly = {
    time: starts.map(local),
    temperature_2m: T, apparent_temperature: AT,
    precipitation_probability: POP.map((v) => (v === null ? 0 : Math.round(v))),
    precipitation: QPF, weather_code: code, is_day: isDay,
    relative_humidity_2m: RH, dew_point_2m: Td, uv_index: starts.map(() => null),
  }
  const day = (d: number) => Array.from({ length: 24 }, (_, h) => d * 24 + h)
  const num = (a: (number | null)[]) => a.filter((v): v is number => typeof v === 'number')
  const severity = (c: number) => (c >= 95 ? 8 : c >= 71 && c <= 77 ? 7 : (c >= 61 && c <= 67) || (c >= 80 && c <= 82) ? 6 : c >= 51 && c <= 57 ? 5 : c === 45 ? 4 : Math.min(c, 3))
  const dayCode = (d: number) => {
    const daytime = day(d).filter((i) => isDay[i]).map((i) => code[i])
    const list = daytime.length ? daytime : day(d).map((i) => code[i])
    const count = new Map<number, number>(); for (const c of list) count.set(c, (count.get(c) ?? 0) + 1)
    const worst = [...count.keys()].filter((c) => count.get(c)! >= Math.max(1, list.length / 4)).sort((a, b) => severity(b) - severity(a))[0] ?? 0
    if (worst > 3) return worst // rain, fog, snow, storms
    // Just clouds: go by the average sky cover over daylight hours (a grey morning, then sun = partly cloudy)
    const sky = num(day(d).filter((i) => isDay[i]).map((i) => SKY[i]))
    const avg = sky.length ? sky.reduce((a, b) => a + b, 0) / sky.length : 0
    return avg <= 12 ? 0 : avg <= 37 ? 1 : avg <= 62 ? 2 : 3
  }
  const daily = {
    time: dates,
    weather_code: dates.map((_, d) => dayCode(d)),
    temperature_2m_max: dates.map((_, d) => Math.max(...num(day(d).map((i) => T[i])))),
    temperature_2m_min: dates.map((_, d) => Math.min(...num(day(d).map((i) => T[i])))),
    precipitation_probability_max: dates.map((_, d) => Math.round(Math.max(0, ...num(day(d).map((i) => POP[i]))))),
    precipitation_sum: dates.map((_, d) => day(d).reduce((a, i) => a + (QPF[i] ?? 0), 0)),
    sunrise: sun.map((s) => local(s.rise)), sunset: sun.map((s) => local(s.set)),
    wind_speed_10m_max: dates.map((_, d) => Math.max(0, ...num(day(d).map((i) => WS[i])))),
    wind_gusts_10m_max: dates.map((_, d) => Math.max(0, ...num(day(d).map((i) => WG[i])))),
    wind_direction_10m_dominant: dates.map((_, d) => { const idx = day(d).reduce((a, i) => ((WS[i] ?? -1) > (WS[a] ?? -1) ? i : a), d * 24); return WD[idx] ?? 0 }),
    uv_index_max: dates.map(() => null),
  }
  const ci = Math.min(starts.length - 1, Math.max(0, Math.floor((now - midnight) / HOUR)))
  const current = {
    temperature_2m: T[ci], apparent_temperature: AT[ci] ?? T[ci], relative_humidity_2m: RH[ci], dew_point_2m: Td[ci],
    weather_code: code[ci], is_day: isDay[ci], wind_speed_10m: WS[ci] ?? 0, wind_direction_10m: WD[ci] ?? 0,
  }
  if (current.temperature_2m === null) throw new Error('National Weather Service forecast has no temperature for now')
  return { utc_offset_seconds: offset, current, hourly, daily }
}
