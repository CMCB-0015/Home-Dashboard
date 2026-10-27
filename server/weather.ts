// Live weather from Open-Meteo (https://open-meteo.com) — free, no account or API key.
import type { Weather, WeatherDay, WeatherHour, WeatherIcon } from '../src/types.ts'
import { env } from './env.ts'

const DEFAULT = { lat: '33.4270', lon: '-117.6120', name: 'San Clemente' }

// WMO weather codes → words and icon
function describe(code: number, isDay: boolean): { condition: string; icon: WeatherIcon } {
  if (code === 0) return { condition: isDay ? 'Sunny' : 'Clear', icon: isDay ? 'sun' : 'moon' }
  if (code === 1) return { condition: isDay ? 'Mostly sunny' : 'Mostly clear', icon: isDay ? 'pcloudy' : 'pcloudy-night' }
  if (code === 2) return { condition: 'Partly cloudy', icon: isDay ? 'pcloudy' : 'pcloudy-night' }
  if (code === 3) return { condition: 'Cloudy', icon: 'cloudy' }
  if (code === 45 || code === 48) return { condition: 'Fog', icon: 'fog' }
  if (code >= 51 && code <= 57) return { condition: 'Drizzle', icon: 'rain' }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { condition: code === 61 || code === 80 ? 'Light rain' : 'Rain', icon: 'rain' }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { condition: 'Snow', icon: 'snow' }
  if (code >= 95) return { condition: 'Thunderstorms', icon: 'storm' }
  return { condition: 'Cloudy', icon: 'cloudy' }
}

function compass(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

// Open-Meteo returns local times like "2026-10-02T06:47"; attach the UTC offset.
function withOffset(local: string, offsetSec: number): string {
  const sign = offsetSec < 0 ? '-' : '+'
  const abs = Math.abs(offsetSec)
  const hh = String(Math.floor(abs / 3600)).padStart(2, '0')
  const mm = String(Math.floor((abs % 3600) / 60)).padStart(2, '0')
  return `${local.length === 16 ? local + ':00' : local}${sign}${hh}:${mm}`
}

let cache: { at: number; data: Weather } | null = null
const CACHE_MS = 10 * 60_000

export async function getWeather(): Promise<Weather> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data

  const lat = env('WEATHER_LAT') ?? DEFAULT.lat
  const lon = env('WEATHER_LON') ?? DEFAULT.lon
  const name = env('WEATHER_LOCATION_NAME') ?? DEFAULT.name

  const q = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: 'auto', forecast_days: '7',
    temperature_unit: 'fahrenheit', wind_speed_unit: 'mph', precipitation_unit: 'inch',
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m',
    hourly: 'temperature_2m,precipitation_probability,precipitation,weather_code,is_day,relative_humidity_2m,dew_point_2m,uv_index',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,uv_index_max',
  })

  const [fRes, aRes] = await Promise.all([
    fetch(`${env('OPEN_METEO_URL') ?? 'https://api.open-meteo.com/v1/forecast'}?${q}`),
    fetch(`${env('OPEN_METEO_AQ_URL') ?? 'https://air-quality-api.open-meteo.com/v1/air-quality'}?latitude=${lat}&longitude=${lon}&current=us_aqi`).catch(() => null),
  ])
  if (!fRes.ok) throw new Error(`Open-Meteo returned ${fRes.status}`)
  const f = await fRes.json()
  const aqi = aRes && aRes.ok ? ((await aRes.json())?.current?.us_aqi ?? null) : null

  const off: number = f.utc_offset_seconds
  const cur = f.current
  const hourTimes: string[] = f.hourly.time.map((t: string) => withOffset(t, off))
  const nowIdx = Math.max(0, hourTimes.findIndex((t) => new Date(t).getTime() > Date.now() - 3_600_000))
  const { condition, icon } = describe(cur.weather_code, cur.is_day === 1)

  const hourly = Array.from({ length: 10 }, (_, k) => nowIdx + k * 2)
    .filter((i) => i < hourTimes.length)
    .map((i) => ({ time: hourTimes[i], tempF: Math.round(f.hourly.temperature_2m[i]), rainChancePct: f.hourly.precipitation_probability[i] ?? 0 }))

  // Every hour from midnight today, for the hourly chart and each day's panel
  const H = f.hourly
  const hours: WeatherHour[] = hourTimes.map((time, i) => ({
    time,
    tempF: Math.round(H.temperature_2m[i]),
    rainChancePct: H.precipitation_probability[i] ?? 0,
    rainIn: Math.round((H.precipitation[i] ?? 0) * 100) / 100,
    icon: describe(H.weather_code[i] ?? 0, H.is_day?.[i] === 1).icon,
  }))

  const D = f.daily
  const daily: WeatherDay[] = (D.time as string[]).map((date, i) => {
    const mine = (H.time as string[]).map((t, k) => (t.startsWith(date) ? k : -1)).filter((k) => k >= 0)
    const hum = mine.map((k) => H.relative_humidity_2m[k]).filter((v: unknown) => typeof v === 'number') as number[]
    const dew = mine.map((k) => H.dew_point_2m[k]).filter((v: unknown) => typeof v === 'number') as number[]
    const { icon, condition } = describe(D.weather_code[i], true)
    return {
      date, icon, condition,
      highF: Math.round(D.temperature_2m_max[i]),
      lowF: Math.round(D.temperature_2m_min[i]),
      rainChancePct: D.precipitation_probability_max[i] ?? 0,
      rainIn: Math.round((D.precipitation_sum[i] ?? 0) * 100) / 100,
      sunrise: withOffset(D.sunrise[i], off),
      sunset: withOffset(D.sunset[i], off),
      windMph: Math.round(D.wind_speed_10m_max[i] ?? 0),
      windDir: compass(D.wind_direction_10m_dominant[i] ?? 0),
      gustMph: Math.round(D.wind_gusts_10m_max[i] ?? 0),
      uvIndex: Math.round(D.uv_index_max[i] ?? 0),
      humidityMin: hum.length ? Math.round(Math.min(...hum)) : 0,
      humidityMax: hum.length ? Math.round(Math.max(...hum)) : 0,
      dewPointF: dew.length ? Math.round(dew.reduce((a, b) => a + b, 0) / dew.length) : 0,
    }
  })

  const data: Weather = {
    location: name,
    updatedAt: new Date().toISOString(),
    lat: Number(lat), lon: Number(lon),
    current: {
      tempF: Math.round(cur.temperature_2m),
      feelsLikeF: Math.round(cur.apparent_temperature),
      condition, icon,
      humidityPct: Math.round(cur.relative_humidity_2m),
      dewPointF: Math.round(cur.dew_point_2m),
      windMph: Math.round(cur.wind_speed_10m),
      windDir: compass(cur.wind_direction_10m),
      rainChancePct: f.hourly.precipitation_probability[nowIdx] ?? 0,
      uvIndex: Math.round(f.hourly.uv_index[nowIdx] ?? 0),
      aqi: aqi === null ? null : Math.round(aqi),
      isDay: cur.is_day === 1,
    },
    today: {
      highF: daily[0].highF, lowF: daily[0].lowF,
      sunrise: withOffset(f.daily.sunrise[0], off),
      sunset: withOffset(f.daily.sunset[0], off),
    },
    hourly,
    hours,
    daily,
  }
  cache = { at: Date.now(), data }
  return data
}
