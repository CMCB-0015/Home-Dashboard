import { useEffect, useId, useRef, useState } from 'react'
import type { WeatherHour } from '../../types'

/** The width of a box, kept up to date as the screen resizes */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

const hourShort = (iso: string) => { const h = new Date(iso).getHours(); return `${h % 12 || 12}${h < 12 ? 'a' : 'p'}` }

/**
 * Hourly temperature as a smooth curve over rain-chance bars. Under the bars:
 * the chance every few hours, the rain in inches for those hours (only when it
 * rains), and the time.
 */
export function SkyChart({ hours, color, tempHeight = 64, barHeight = 20, every = 2, firstLabel, dimBefore }: {
  hours: WeatherHour[]
  /** Curve color (the sky tint) */
  color: string
  tempHeight?: number
  barHeight?: number
  /** Label every n hours */
  every?: number
  /** Replace the first time label ("Now") */
  firstLabel?: string
  /** Fade hours before this time (earlier today) */
  dimBefore?: number
}) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const gid = useId().replace(/:/g, '')
  const n = hours.length
  const rains = hours.some((h) => h.rainIn >= 0.01)
  const by0 = tempHeight + 4
  const H = by0 + barHeight + (rains ? 42 : 30)
  if (!n) return null

  const cw = W / n
  const temps = hours.map((h) => h.tempF)
  const mn = Math.min(...temps), mx = Math.max(...temps), rg = Math.max(mx - mn, 4)
  const top = 22, bot = 8
  const pts = hours.map((h, i) => [cw * (i + 0.5), top + (1 - (h.tempF - mn) / rg) * (tempHeight - top - bot)] as const)
  const f = (v: number) => v.toFixed(1)
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2
    d += ` C${[p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]].map(f).join(' ')}`
  }
  const area = `${d} L${f(pts[n - 1][0])} ${tempHeight} L${f(pts[0][0])} ${tempHeight} Z`
  const label = 'absolute left-1/2 -translate-x-1/2 whitespace-nowrap'

  return (
    <div ref={ref} className="relative w-full" style={{ height: H }}
      role="img" aria-label={`Hourly: ${hours.filter((_, i) => i % every === 0).map((h) => `${hourShort(h.time)} ${h.tempF}°, ${h.rainChancePct}% rain`).join('; ')}`}>
      {W > 0 && (
        <>
          <svg width={W} height={tempHeight} className="absolute left-0 top-0" aria-hidden>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={color} stopOpacity={0.28} />
                <stop offset="1" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gid})`} />
            <path d={d} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
          </svg>
          {hours.map((h, i) => {
            const bh = h.rainChancePct ? Math.max((h.rainChancePct / 100) * barHeight, 2) : 0
            const show = i % every === 0
            const block = hours.slice(i, i + every).reduce((a, x) => a + x.rainIn, 0)
            const dim = dimBefore !== undefined && Date.parse(h.time) + 3_600_000 <= dimBefore
            return (
              <div key={h.time} className="absolute top-0" style={{ left: cw * i, width: cw, height: H, opacity: dim ? 0.4 : 1 }} aria-hidden>
                {show && <span className={`${label} font-display text-xs font-semibold text-ink`} style={{ top: pts[i][1] - 20 }}>{h.tempF}°</span>}
                <span className="absolute left-1/2 -translate-x-1/2 rounded-t-[3px] bg-temp-low" style={{ top: by0 + barHeight - bh, height: bh, width: Math.max(cw - 7, 3), opacity: h.rainIn >= 0.01 ? 0.95 : 0.5 }} />
                {show && <span className={`${label} font-mono text-[10.5px] text-[#7db6ff]`} style={{ top: by0 + barHeight + 3 }}>{h.rainChancePct}%</span>}
                {show && rains && block >= 0.01 && <span className={`${label} font-mono text-[10px] text-[#a9cdfa]`} style={{ top: by0 + barHeight + 16 }}>{block.toFixed(2)}</span>}
                {show && <span className={`${label} text-[10.5px] text-ink-dim`} style={{ top: by0 + barHeight + (rains ? 29 : 16) }}>{i === 0 && firstLabel ? firstLabel : hourShort(h.time)}</span>}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

/** Sunrise → sunset as an arc, with the sun where it is now (empty at night, counting down to sunrise) */
export function SunArc({ sunrise, sunset, nextSunrise, now }: { sunrise: string; sunset: string; nextSunrise?: string; now: number }) {
  const rise = Date.parse(sunrise), set = Date.parse(sunset)
  const day = now >= rise && now <= set
  const p = day ? (now - rise) / (set - rise) : 0
  const x = 90 - 76 * Math.cos(Math.PI * p), y = 80 - 76 * Math.sin(Math.PI * p)
  const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const target = now < rise ? rise : nextSunrise ? Date.parse(nextSunrise) : null
  const until = target ? Math.max(0, target - now) : null
  const label = 'absolute bottom-0 flex items-center gap-1 font-mono text-[11px] text-[#c5ced6]'
  return (
    <div className="relative h-[100px] w-[180px] shrink-0" role="img"
      aria-label={`Sunrise ${clock(sunrise)}, sunset ${clock(sunset)}${until !== null && !day ? `, sunrise in ${Math.floor(until / 3_600_000)} hours` : ''}`}>
      <svg width="180" height="86" viewBox="0 0 180 86" className="absolute left-0 top-0" aria-hidden>
        <path d="M14 80 A76 76 0 0 1 166 80" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth={1.5} strokeDasharray="3 4" />
        <line x1="4" y1="80" x2="176" y2="80" stroke="rgba(255,255,255,.18)" />
        {day && (
          <>
            <path d={`M14 80 A76 76 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`} fill="none" stroke="var(--color-weather)" strokeWidth={2.5} strokeLinecap="round" />
            <circle cx={x} cy={y} r={9} fill="rgba(242,193,78,.25)" />
            <circle cx={x} cy={y} r={5} fill="var(--color-weather)" />
          </>
        )}
      </svg>
      {!day && until !== null && (
        <span className="absolute inset-x-0 top-[42px] text-center text-xs text-[#c5ced6]">
          Sunrise in <span className="font-mono">{Math.floor(until / 3_600_000)} h {Math.floor((until % 3_600_000) / 60_000)} m</span>
        </span>
      )}
      <span className={`${label} left-0`}><SunGlyph up />{clock(sunrise)}</span>
      <span className={`${label} right-0`}>{clock(sunset)}<SunGlyph /></span>
    </div>
  )
}

function SunGlyph({ up }: { up?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={up ? '#f2c14e' : '#f09a5a'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={up ? 'M12 2v8M4.93 10.93l1.41 1.41M2 18h2M20 18h2M19.07 10.93l-1.41 1.41M22 22H2M8 6l4-4 4 4M16 18a4 4 0 0 0-8 0' : 'M12 10V2M4.93 10.93l1.41 1.41M2 18h2M20 18h2M19.07 10.93l-1.41 1.41M22 22H2M16 6l-4 4-4-4M16 18a4 4 0 0 0-8 0'} />
    </svg>
  )
}
