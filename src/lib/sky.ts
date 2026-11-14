import type { Weather, WeatherIcon } from '../types'

// Day and night wording for the same sky. Only clear and partly cloudy skies
// differ: clouds, fog, rain, snow and storms look the same either way.
const TO_NIGHT: Record<string, string> = { Sunny: 'Clear', 'Mostly sunny': 'Mostly clear' }
const TO_DAY: Record<string, string> = { Clear: 'Sunny', 'Mostly clear': 'Mostly sunny' }

export function skyFor(icon: WeatherIcon, condition: string, isDay: boolean): { icon: WeatherIcon; condition: string } {
  if (isDay) {
    return {
      icon: icon === 'moon' ? 'sun' : icon === 'pcloudy-night' ? 'pcloudy' : icon,
      condition: TO_DAY[condition] ?? condition,
    }
  }
  return {
    icon: icon === 'sun' ? 'moon' : icon === 'pcloudy' ? 'pcloudy-night' : icon,
    condition: TO_NIGHT[condition] ?? condition,
  }
}

const dayKey = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Is the sun up? From today's sunrise and sunset, so it flips right on time (not at the next weather update) */
export function sunUp(w: Weather, now = Date.now()): boolean {
  const rise = Date.parse(w.today.sunrise), set = Date.parse(w.today.sunset)
  if (Number.isFinite(rise) && Number.isFinite(set) && dayKey(rise) === dayKey(now)) return now >= rise && now < set
  return w.current.isDay ?? true
}

/** The current sky, worded for day or night */
export function skyNow(w: Weather, now = Date.now()) {
  const isDay = sunUp(w, now)
  return { ...skyFor(w.current.icon, w.current.condition, isDay), isDay }
}

/** After today's sunset (until midnight) the Today column becomes Tonight */
export function isTonight(w: Weather, now = Date.now()): boolean {
  const set = Date.parse(w.today.sunset)
  return Number.isFinite(set) && now >= set && w.daily[0]?.date === dayKey(now)
}

/** Tonight's sky for the Today column: the server's summary of the night, or today's sky worded for night */
export function tonightSky(w: Weather) {
  const d = w.daily[0]
  return w.tonight ?? skyFor(d.icon, d.condition ?? '', false)
}
