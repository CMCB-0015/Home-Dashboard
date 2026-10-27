import { useEffect, useMemo, useState } from 'react'
import { Radar, X } from 'lucide-react'
import { useHome } from '../../lib/useHome'
import { relativeTime } from '../../lib/format'
import { Card } from '../Card'
import { WeatherIcon } from '../WeatherIcon'
import { SkyChart, SunArc } from '../weather/SkyChart'
import { RadarView } from '../weather/RadarView'
import type { Weather, WeatherHour } from '../../types'

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

/** The card's tint follows the sky: warm by day, indigo at night, blue in rain, grey when it's gloomy */
export function skyTone(icon: string, isDay: boolean) {
  if (icon === 'rain' || icon === 'storm' || icon === 'snow') return { color: '#6fb0ff', wash: 'linear-gradient(180deg, rgba(111,176,255,.20), rgba(111,176,255,.05) 55%, rgba(111,176,255,0))' }
  if (!isDay || icon === 'moon' || icon === 'pcloudy-night') return { color: '#8e9cf5', wash: 'linear-gradient(180deg, rgba(124,140,240,.22), rgba(124,140,240,.06) 55%, rgba(124,140,240,0))' }
  if (icon === 'cloudy' || icon === 'fog') return { color: '#a7b4c2', wash: 'linear-gradient(180deg, rgba(167,180,194,.17), rgba(167,180,194,.04) 55%, rgba(167,180,194,0))' }
  return { color: '#f2c14e', wash: 'linear-gradient(180deg, rgba(242,193,78,.20), rgba(91,143,199,.10) 55%, rgba(91,143,199,0))' }
}

const chip = 'flex h-7 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.05] px-3 text-xs text-[#c5ced6]'
const val = 'font-mono font-medium text-ink'
const dayName = (date: string, full = false) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', full ? { weekday: 'long', month: 'short', day: 'numeric' } : { weekday: 'short' })
const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

/** Hours on a day (local), midnight to midnight */
const hoursOn = (hours: WeatherHour[], date: string) => hours.filter((h) => {
  const d = new Date(h.time)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === date
})

/** Each day's low-to-high as a bar on one shared scale (red high above, blue low below) */
function RangeBars({ days, onPick }: { days: Weather['daily']; onPick: (i: number) => void }) {
  const lo = Math.min(...days.map((d) => d.lowF)), hi = Math.max(...days.map((d) => d.highF))
  const y = (t: number) => 18 + (1 - (t - lo) / Math.max(hi - lo, 1)) * 44
  return (
    <div className="grid grid-cols-6 gap-1">
      {days.map((d, i) => (
        <button key={d.date} onClick={() => onPick(i)} aria-label={`${dayName(d.date, true)}: high ${d.highF}°, low ${d.lowF}°${d.rainChancePct >= 20 ? `, ${d.rainChancePct}% rain` : ''}. Tap for details`}
          className="flex flex-col items-center gap-[3px] rounded-xl pb-1 pt-1.5 transition-colors hover:bg-white/[0.04] active:bg-white/[0.06]">
          <span className="text-xs font-semibold text-ink-dim">{dayName(d.date)}</span>
          <WeatherIcon kind={d.icon} size={24} />
          <span className="relative h-[82px] w-full">
            <span className="absolute inset-x-0 text-center font-display text-[13px] font-bold text-temp-high" style={{ top: y(d.highF) - 17 }}>{d.highF}°</span>
            <span className="absolute left-1/2 w-1.5 -translate-x-1/2 rounded-full" style={{ top: y(d.highF), height: Math.max(y(d.lowF) - y(d.highF), 6), background: 'linear-gradient(180deg,#ff6b5e,#f2c14e 50%,#5aa2ff)' }} />
            <span className="absolute inset-x-0 text-center font-display text-[13px] font-bold text-temp-low" style={{ top: y(d.lowF) + 1 }}>{d.lowF}°</span>
          </span>
          <span className="h-[13px] font-mono text-[10.5px] text-[#7db6ff]">{d.rainChancePct >= 20 ? `${d.rainChancePct}%` : ''}</span>
        </button>
      ))}
    </div>
  )
}

/** One day in detail: slides up over the card in that day's tint */
function DayPanel({ day, hours, onClose }: { day: Weather['daily'][number]; hours: WeatherHour[]; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
  const tone = skyTone(day.icon, true)
  const wettest = hours.reduce<WeatherHour | null>((a, h) => (h.rainIn > (a?.rainIn ?? 0) ? h : a), null)
  const summary = (day.rainIn ?? 0) >= 0.01
    ? `${day.condition ?? 'Rain'}${wettest ? `, heaviest around ${new Date(wettest.time).toLocaleTimeString('en-US', { hour: 'numeric' })}` : ''} · ${day.rainIn!.toFixed(2)} in`
    : day.condition ?? ''
  return (
    <div className="absolute inset-x-0 bottom-0 top-12 z-[3] flex flex-col overflow-hidden rounded-t-2xl border-t border-[#33404c] bg-surface-raised shadow-[0_-16px_40px_rgba(0,0,0,0.45)] sheet-up"
      role="dialog" aria-label={dayName(day.date, true)}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56" style={{ background: tone.wash }} />
      <div className="relative mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[#3a4754]" />
      <div className="relative flex items-center gap-2.5 py-1 pl-1.5 pr-5">
        <button onClick={onClose} aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#c5ced6] hover:bg-white/5"><X size={20} /></button>
        <WeatherIcon kind={day.icon} size={34} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[17px] font-semibold">{dayName(day.date, true)}</p>
          <p className="truncate text-xs text-[#a3b0bc]">{summary}</p>
        </div>
        <p className="flex gap-2 font-display text-xl"><span className="font-bold text-temp-high">{day.highF}°</span><span className="text-ink-faint">/</span><span className="font-bold text-temp-low">{day.lowF}°</span></p>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-4 pt-1">
        <div className="flex flex-wrap gap-1.5">
          <span className={chip}>Rain <b className={val}>{(day.rainIn ?? 0).toFixed(2)} in</b></span>
          <span className={chip}>Peak chance <b className={val}>{day.rainChancePct}%</b></span>
          {day.windMph !== undefined && <span className={chip}>Wind <b className={val}>{day.windDir} {day.windMph}</b> · gusts <b className={val}>{day.gustMph}</b></span>}
          {day.uvIndex !== undefined && <span className={chip}>UV <b className={val}>{day.uvIndex}</b> {uvLabel(day.uvIndex)}</span>}
          {day.humidityMax !== undefined && <span className={chip}>Humidity <b className={val}>{day.humidityMin === day.humidityMax ? `${day.humidityMax}%` : `${day.humidityMin}–${day.humidityMax}%`}</b></span>}
          {day.dewPointF !== undefined && <span className={chip}>Dew point <b className={val}>{day.dewPointF}°</b></span>}
          {day.sunrise && <span className={chip}>Sunrise <b className={val}>{clock(day.sunrise)}</b></span>}
          {day.sunset && <span className={chip}>Sunset <b className={val}>{clock(day.sunset)}</b></span>}
        </div>
        {hours.length > 0 && (
          <>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-dim">Hourly · temperature, rain chance and inches per 3 h</p>
            <SkyChart hours={hours} color={tone.color === '#f2c14e' ? '#f2c14e' : '#e8edf2'} tempHeight={96} barHeight={48} every={3} dimBefore={Date.now()} />
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Weather on page 2 ("Sky", chosen October 26, 2026): the card tints with the
 * sky, sunrise → sunset as an arc, a temperature curve over rain-chance bars,
 * and the next 6 days as low-to-high bars. Tap a day (or today's temperature)
 * for that day in detail; Radar shows the last hour of rain on a Google map.
 */
export function WeatherCard() {
  const { data } = useHome()
  const w = data?.weather
  const [dayIdx, setDayIdx] = useState<number | null>(null)
  const [radar, setRadar] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t) }, [])

  const hours = useMemo(() => w?.hours ?? w?.hourly.map((h) => ({ time: h.time, tempF: h.tempF, rainChancePct: h.rainChancePct, rainIn: 0, icon: w.current.icon })) ?? [], [w])

  if (!w) {
    return <Card accent="var(--color-weather)" title="Weather"><p className="py-6 text-sm text-ink-faint">Weather unavailable right now.</p></Card>
  }
  const c = w.current
  const isDay = c.isDay ?? (now >= Date.parse(w.today.sunrise) && now <= Date.parse(w.today.sunset))
  const tone = skyTone(c.icon, isDay)
  const startIdx = Math.max(0, hours.findIndex((h) => Date.parse(h.time) + 3_600_000 > now))
  const next12 = hours.slice(startIdx, startIdx + 12)
  const days = w.daily.slice(1, 7)
  const openDay = dayIdx === null ? null : w.daily[dayIdx]
  const radarBtn = (
    <button onClick={() => setRadar(true)} aria-label="Show radar"
      className="flex h-9 items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.06] px-3 text-[12.5px] font-semibold text-ink transition-colors hover:bg-white/10">
      <Radar size={16} /> Radar
    </button>
  )

  return (
    <Card accent={tone.color} title="Weather" category="weather" subtitle={`${w.location} · updated ${relativeTime(w.updatedAt)}`} headerRight={radarBtn}
      overlay={
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[280px] transition-[background] duration-700" style={{ background: tone.wash }} aria-hidden />
          {openDay && <DayPanel day={openDay} hours={hoursOn(hours, openDay.date)} onClose={() => setDayIdx(null)} />}
          {radar && <RadarView lat={w.lat ?? 33.427} lon={w.lon ?? -117.612} mapsKey={data?.mapsKey ?? null} place={w.location} onClose={() => setRadar(false)} />}
        </>
      }>
      <div className="flex flex-col gap-2.5">
        <div className="flex min-h-[100px] flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <button onClick={() => setDayIdx(0)} aria-label={`Today: ${c.tempF}°, high ${w.today.highF}°, low ${w.today.lowF}°. Tap for today in detail`}
            className="flex w-[150px] flex-col items-center gap-1.5 rounded-xl py-1 hover:bg-white/[0.03]">
            <span className="font-display text-[72px] font-light leading-[0.95] tracking-tight">{c.tempF}°</span>
            <span className="flex gap-2.5 font-display text-[17px]"><span className="font-bold text-temp-high">{w.today.highF}°</span><span className="text-ink-faint">/</span><span className="font-bold text-temp-low">{w.today.lowF}°</span></span>
          </button>
          <div className="flex min-w-[130px] flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-2"><WeatherIcon kind={c.icon} size={32} /><span className="text-base font-medium">{c.condition}</span></span>
            <span className="text-[13px] text-[#a3b0bc]">Feels like {c.feelsLikeF}°</span>
          </div>
          <SunArc sunrise={w.today.sunrise} sunset={w.today.sunset} nextSunrise={w.daily[1]?.sunrise} now={now} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className={chip}>Humidity <b className={val}>{c.humidityPct}%</b></span>
          <span className={chip}>Dew point <b className={val}>{c.dewPointF}°</b></span>
          <span className={chip}>Wind <b className={val}>{c.windDir} {c.windMph}</b></span>
          <span className={chip}>UV <b className={val}>{c.uvIndex}</b> {uvLabel(c.uvIndex)}</span>
          {c.aqi !== null && <span className={chip}>Air <b className={val}>{c.aqi}</b> {aqiLabel(c.aqi)}</span>}
        </div>
        <SkyChart hours={next12} color={tone.color} firstLabel="Now" />
        {days.length > 0 && <RangeBars days={days} onPick={(i) => setDayIdx(i + 1)} />}
      </div>
    </Card>
  )
}

