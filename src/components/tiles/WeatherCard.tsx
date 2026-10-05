import { useHome } from '../../lib/useHome'
import { categories } from '../../lib/categories'
import { clockTime, dayLabel, hourLabel, relativeTime } from '../../lib/format'
import { Card } from '../Card'
import { WeatherIcon } from '../WeatherIcon'
import type { Weather } from '../../types'

const cfg = categories.weather

function aqiLabel(aqi: number) {
  if (aqi <= 50) return 'Good'
  if (aqi <= 100) return 'Moderate'
  if (aqi <= 150) return 'Sensitive'
  return 'Unhealthy'
}
function uvLabel(uv: number) {
  if (uv < 3) return 'Low'
  if (uv < 6) return 'Moderate'
  if (uv < 8) return 'High'
  return 'Very high'
}

function HourlyChart({ hourly }: { hourly: Weather['hourly'] }) {
  const W = 560, H = 72, padX = 16, top = 18, bottom = 46
  const temps = hourly.map((h) => h.tempF)
  const min = Math.min(...temps), max = Math.max(...temps)
  const span = Math.max(1, max - min)
  const step = (W - padX * 2) / Math.max(1, hourly.length - 1)
  const pts = hourly.map((h, i) => [padX + i * step, bottom - ((h.tempF - min) / span) * (bottom - top)] as const)
  const line = pts.map((p) => p.join(',')).join(' ')
  const area = `${padX},${bottom + 6} ${line} ${padX + (hourly.length - 1) * step},${bottom + 6}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Hourly temperature">
      <polygon points={area} fill="var(--color-weather)" opacity={0.1} />
      <polyline points={line} fill="none" stroke="var(--color-weather)" strokeWidth={2} strokeLinejoin="round" />
      {hourly.map((h, i) => (
        <g key={h.time}>
          <text x={pts[i][0]} y={pts[i][1] - 8} textAnchor="middle" fontSize="11" fontWeight="500" fill="var(--color-ink)">{h.tempF}°</text>
          <text x={pts[i][0]} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--color-ink-faint)">{i === 0 ? 'Now' : hourLabel(h.time)}</text>
        </g>
      ))}
    </svg>
  )
}

export function WeatherCard() {
  const { data } = useHome()
  const w = data?.weather
  if (!w) {
    return <Card accent={cfg.color} title="Weather"><p className="py-6 text-sm text-ink-faint">Weather unavailable right now.</p></Card>
  }
  const c = w.current
  const details: [string, string][] = [
    ['Humidity', `${c.humidityPct}%`],
    ['Dew point', `${c.dewPointF}°`],
    ['Wind', `${c.windMph} mph ${c.windDir}`],
    ['Chance of rain', `${c.rainChancePct}%`],
    ['Sunrise', clockTime(w.today.sunrise)],
    ['Sunset', clockTime(w.today.sunset)],
    ['UV index', `${c.uvIndex} · ${uvLabel(c.uvIndex)}`],
    ['Air quality', c.aqi === null ? '—' : `${c.aqi} · ${aqiLabel(c.aqi)}`],
  ]
  return (
    <Card accent={cfg.color} title={w.location} subtitle={`Updated ${relativeTime(w.updatedAt)}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-3">
            <WeatherIcon kind={c.icon} size={52} />
            <div className="flex items-start">
              <span className="text-5xl font-light leading-none">{c.tempF}</span>
              <span className="ml-1 mt-1 text-base text-ink-dim">°F</span>
            </div>
          </div>
          <p className="mt-1.5 flex gap-3 text-xs font-bold" aria-label={`High ${w.today.highF} degrees, low ${w.today.lowF} degrees`}>
            <span className="text-temp-high">H {w.today.highF}°</span>
            <span className="text-temp-low">L {w.today.lowF}°</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-medium">{c.condition}</p>
          <p className="mt-0.5 text-xs text-ink-dim">Feels like {c.feelsLikeF}°</p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-edge-soft pt-3 sm:grid-cols-4">
        {details.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] text-ink-faint">{k}</dt>
            <dd className="text-sm font-medium">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 border-t border-edge-soft pt-2">
        <HourlyChart hourly={w.hourly} />
      </div>

      <div className="mt-1 grid grid-cols-6 border-t border-edge-soft pt-2 text-center">
        {w.daily.map((d, i) => (
          <div key={d.date} className="flex flex-col items-center">
            <span className={`text-xs ${i === 0 ? 'font-semibold text-ink' : 'font-medium text-ink-dim'}`}>{dayLabel(d.date, i)}</span>
            <WeatherIcon kind={d.icon} size={30} />
            <span className="text-sm font-semibold">{d.highF}°</span>
            <span className="text-xs text-ink-faint">{d.lowF}°</span>
            <span className="h-4 text-[10px] font-medium text-rain">{d.rainChancePct >= 10 ? `${d.rainChancePct}%` : ''}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
