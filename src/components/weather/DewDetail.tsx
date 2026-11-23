import type { WeatherDay, WeatherHour } from '../../types'
import { useWidth } from './SkyChart'
import { dewFeel } from '../../lib/dew'

const GREEN = '#8fd6b0'
const GOLD = 'rgba(242,193,78,.7)'

// How a dew point feels (°F) — names shared with the Climate card (src/lib/dew.ts)
const BANDS = [
  { name: 'dry', lo: -100, hi: 40, color: 'rgba(214,180,120,.55)' },
  { name: 'comfortable', lo: 40, hi: 55, color: 'rgba(143,214,176,.6)' },
  { name: 'sticky', lo: 55, hi: 65, color: 'rgba(242,193,78,.6)' },
  { name: 'muggy', lo: 65, hi: 200, color: 'rgba(242,154,78,.65)' },
]
const feel = dewFeel
const clock = (t: number) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const f = (x: number) => x.toFixed(1)

// Plot box: ° marks in the left gutter, the band scale and names in the right gutter,
// the dew/fog note in a strip above and the hours below. Nothing is written inside the plot.
// On a narrow card (phone) the band names move to a key under the plot and only the band bars stay on the right.
const G = 30, STRIP = 20, TOP = STRIP + 4, PH = 126, BOTTOM = TOP + PH, CH = BOTTOM + 22
const NARROW = 420

/**
 * Humidity / dew point through one day (opened from either chip in a day's details).
 * Ranges and averages on top, then dew point under temperature with the gap shaded,
 * then the lowest and highest dew point and a one-line read of the day.
 */
export function DewDetail({ day, hours }: { day: Pick<WeatherDay, 'date'> & Partial<WeatherDay>; hours: WeatherHour[] }) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const pts = hours
    .filter((h) => typeof h.dewF === 'number')
    .map((h) => ({ t: Date.parse(h.time), T: h.tempF, Td: h.dewF as number, rh: h.humidityPct }))
  if (pts.length < 6) return <p className="text-xs text-ink-faint">Hourly dew point isn't available for this day.</p>

  const dews = pts.map((p) => p.Td), rhs = pts.map((p) => p.rh).filter((v): v is number => typeof v === 'number')
  const lo = pts.reduce((a, p) => (p.Td < a.Td ? p : a)), hi = pts.reduce((a, p) => (p.Td > a.Td ? p : a))
  const avgDew = Math.round(dews.reduce((a, b) => a + b, 0) / dews.length)
  const avgRh = day.humidityAvg ?? (rhs.length ? Math.round(rhs.reduce((a, b) => a + b, 0) / rhs.length) : null)
  // Where the air comes closest to saturation (dew or fog), if within 3°
  const near = pts.reduce<(typeof pts)[number] | null>((a, p) => (p.T - p.Td <= 3 && (!a || p.T - p.Td < a.T - a.Td) ? p : a), null)
  const gap = near ? Math.max(1, Math.round(near.T - near.Td)) : 0
  // The stretch of hours around it that stay within 3° ("12–7 AM"), or just the hour
  let runA = near, runB = near
  if (near) {
    const i = pts.indexOf(near)
    let a = i, b = i
    while (a > 0 && pts[a - 1].T - pts[a - 1].Td <= 3) a--
    while (b < pts.length - 1 && pts[b + 1].T - pts[b + 1].Td <= 3) b++
    runA = pts[a]; runB = pts[b]
  }
  const hr = (t: number) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric' })
  const when = !near || !runA || !runB ? '' : runB.t - runA.t >= 2 * 3_600_000
    ? `${hr(runA.t).replace(/ (AM|PM)$/, (m) => (hr(runA.t).slice(-2) === hr(runB.t).slice(-2) ? '' : m))}–${hr(runB.t)}`
    : `around ${clock(near.t)}`
  const nearText = near ? `Only ${gap}° apart ${when} · dew or fog likely` : ''

  const swing = Math.round(hi.Td - lo.Td)
  const loHour = new Date(lo.t).getHours()
  const note = swing >= 15
    ? (loHour >= 8 && loHour <= 18
      ? `Big swing: dry air mixes down during the day and takes the dew point to ${Math.round(lo.Td)}° around ${clock(lo.t)}; moister air comes back after dark.`
      : `Big swing: the air changes over the day, from ${Math.round(hi.Td)}° down to ${Math.round(lo.Td)}° around ${clock(lo.t)}.`)
    : swing <= 6
      ? `A steady day: the dew point stays within ${Math.max(1, swing)}°${loHour >= 11 && loHour <= 17 ? ', dipping a little in the afternoon as the air mixes' : ''}.${near ? ' Dew or fog is likely where the temperature nearly meets it.' : ''}`
      : `The dew point moves ${swing}° over the day, lowest around ${clock(lo.t)}.${near ? ' Dew or fog is likely where the temperature nearly meets it.' : ''}`

  // Scale: 10–90 °F, widened if the day goes beyond it
  const all = pts.flatMap((p) => [p.T, p.Td])
  const yMin = Math.min(10, Math.floor((Math.min(...all) - 5) / 10) * 10)
  const yMax = Math.max(90, Math.ceil((Math.max(...all) + 5) / 10) * 10)
  const t0 = new Date(`${day.date}T00:00:00`).getTime(), t1 = t0 + 24 * 3_600_000

  const narrow = W < NARROW
  const plot = W > 200 ? (() => {
    const PR = W - (narrow ? 16 : 92)
    const X = (t: number) => G + ((t - t0) / (t1 - t0)) * (PR - G)
    const Y = (v: number) => TOP + (1 - (v - yMin) / (yMax - yMin)) * PH
    const line = (k: 'T' | 'Td') => 'M' + pts.map((p) => `${f(X(p.t))} ${f(Y(p[k]))}`).join(' L')
    const spread = line('T') + ' L' + [...pts].reverse().map((p) => `${f(X(p.t))} ${f(Y(p.Td))}`).join(' L') + ' Z'
    const step = (yMax - yMin) > 100 ? 40 : 20
    const marks: number[] = []; for (let v = Math.ceil(yMin / step) * step; v < yMax; v += step) if (v > yMin) marks.push(v)
    const bands = BANDS.map((b) => ({ ...b, a: Math.max(b.lo, yMin), b: Math.min(b.hi, yMax) })).filter((b) => b.b - b.a >= 6)
    const rise = day.sunrise ? Date.parse(day.sunrise) : NaN, set = day.sunset ? Date.parse(day.sunset) : NaN
    const night = (Number.isFinite(rise) ? `M${G} ${TOP} H${f(X(rise))} V${BOTTOM} H${G} Z ` : '') + (Number.isFinite(set) ? `M${f(X(set))} ${TOP} H${PR} V${BOTTOM} H${f(X(set))} Z` : '')
    const textW = nearText.length * 5.7
    return {
      PR, X, Y, line, spread, marks, bands, night,
      shade: bands.filter((b) => b.name === 'comfortable' || b.name === 'muggy').map((b) => `M${G} ${f(Y(b.b))} H${PR} V${f(Y(b.a))} H${G} Z`).join(' '),
      // Dotted line to the middle of the stretch, ending on the dew point line there
      nearY: near && runA && runB ? Y(pts.reduce((a, p) => (Math.abs(p.t - (runA!.t + runB!.t) / 2) < Math.abs(a.t - (runA!.t + runB!.t) / 2) ? p : a)).Td) : 0,
      nearX: near && runA && runB ? X((runA.t + runB.t) / 2) : 0,
      nearLX: near && runA && runB ? Math.max(G, Math.min(PR - textW, X((runA.t + runB.t) / 2) - 6)) : 0,
      // Every 3 hours, or every 6 when the plot is narrow (phone)
      ticks: (PR - G < 320 ? [6, 12, 18] : [3, 6, 9, 12, 15, 18, 21]).map((h) => ({ x: X(t0 + h * 3_600_000), t: `${h % 12 || 12}${h < 12 ? 'a' : 'p'}` })),
    }
  })() : null

  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] border px-3.5 py-3" style={{ borderColor: 'rgba(143,214,176,.22)', background: 'rgba(143,214,176,.05)' }}>
      <div className="flex flex-wrap items-end gap-x-7 gap-y-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-[.08em]" style={{ color: GREEN }}>Dew point</span>
          <span className="font-display text-[22px] font-medium leading-[1.05]">{Math.round(lo.Td)}–{Math.round(hi.Td)}°</span>
          <span className="text-[11px] text-[#8493a1]">average {day.dewPointF ?? avgDew}°</span>
        </div>
        {rhs.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-[#a3b0bc]">Humidity</span>
            <span className="font-display text-[22px] font-medium leading-[1.05]">{Math.min(...rhs)}–{Math.max(...rhs)}%</span>
            {avgRh !== null && <span className="text-[11px] text-[#8493a1]">average {avgRh}%</span>}
          </div>
        )}
        <span className="flex-1" />
        <span className="flex flex-col gap-1 pb-0.5 text-[11px] text-[#a3b0bc]">
          <span><span className="mr-1.5 inline-block h-[2.5px] w-3.5 align-[3px]" style={{ background: GREEN }} />Dew point</span>
          <span><span className="mr-1.5 inline-block h-[2px] w-3.5 align-[3px]" style={{ background: GOLD }} />Temperature</span>
        </span>
      </div>

      <div ref={ref} className="relative w-full" style={{ height: CH }}>
        {plot && (
          <>
            <svg width={W} height={CH} viewBox={`0 0 ${W} ${CH}`} role="img" className="absolute left-0 top-0"
              aria-label={`Dew point from ${Math.round(lo.Td)}° at ${clock(lo.t)} to ${Math.round(hi.Td)}° at ${clock(hi.t)}; humidity ${Math.min(...rhs)} to ${Math.max(...rhs)}%`}>
              <path d={plot.shade} fill="rgba(255,255,255,.03)" />
              <path d={plot.night} fill="rgba(124,140,240,.08)" />
              <path d={plot.marks.map((v) => `M${G} ${Math.round(plot.Y(v)) + 0.5} H${plot.PR}`).join(' ')} stroke="rgba(255,255,255,.07)" shapeRendering="crispEdges" />
              {/* Band scale in the right gutter: one short bar per band, its name centered beside it */}
              {plot.bands.map((b) => (
                <rect key={b.name} x={plot.PR + 6} y={plot.Y(b.b) + 1} width={3} height={Math.max(1, plot.Y(b.a) - plot.Y(b.b) - 2)} rx={1.5} fill={b.color} />
              ))}
              <path d={plot.spread} fill="rgba(255,255,255,.05)" />
              <path d={plot.line('T')} fill="none" stroke={GOLD} strokeWidth={1.6} strokeLinejoin="round" />
              <path d={plot.line('Td')} fill="none" stroke={GREEN} strokeWidth={2.4} strokeLinejoin="round" />
              <circle cx={plot.X(lo.t)} cy={plot.Y(lo.Td)} r={4} fill={GREEN} stroke="#1b232b" strokeWidth={1.5} />
              <circle cx={plot.X(hi.t)} cy={plot.Y(hi.Td)} r={4} fill={GREEN} stroke="#1b232b" strokeWidth={1.5} />
              {near && (
                <>
                  <line x1={plot.nearX} y1={STRIP} x2={plot.nearX} y2={plot.nearY} stroke="#e8edf2" strokeOpacity={0.7} strokeDasharray="2 2" />
                  <circle cx={plot.nearX} cy={plot.nearY} r={2.5} fill="#e8edf2" />
                </>
              )}
            </svg>
            {plot.marks.map((v) => (
              <span key={v} className="absolute left-0 font-mono text-[9.5px] leading-3 text-[#56636f]" style={{ top: plot.Y(v) - 6 }}>{v}°</span>
            ))}
            {!narrow && plot.bands.map((b) => (
              <span key={b.name} data-band={b.name} className="absolute flex h-3 items-center text-[10px] font-medium leading-3 text-[#6b7a87]"
                style={{ left: plot.PR + 14, top: (plot.Y(b.a) + plot.Y(b.b)) / 2 - 6 }}>{b.name}</span>
            ))}
            {near && <span data-note className="absolute top-0 h-3.5 whitespace-nowrap text-[10.5px] leading-[14px] text-ink" style={{ left: plot.nearLX }}>{nearText}</span>}
            {plot.ticks.map((k) => (
              <span key={k.t} className="absolute w-10 text-center text-[10px] leading-3 text-[#8493a1]" style={{ left: k.x - 20, top: BOTTOM + 6 }}>{k.t}</span>
            ))}
          </>
        )}
      </div>

      {plot && narrow && (
        <div className="-mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-medium text-[#6b7a87]">
          {plot.bands.map((b) => (
            <span key={b.name} className="flex items-center gap-1"><span className="inline-block h-2.5 w-[3px] rounded-sm" style={{ background: b.color }} />{b.name}</span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-[auto_auto_auto] justify-start gap-x-2.5 gap-y-[3px] text-[12.5px] [align-items:baseline]">
        <span className="text-[#8493a1]">Lowest</span><b className="font-mono font-semibold">{Math.round(lo.Td)}°</b><span className="text-[#c5ced6]">at {clock(lo.t)} · {feel(lo.Td)}</span>
        <span className="text-[#8493a1]">Highest</span><b className="font-mono font-semibold">{Math.round(hi.Td)}°</b><span className="text-[#c5ced6]">at {clock(hi.t)} · {feel(hi.Td)}</span>
      </div>
      <p className="m-0 text-xs leading-[1.45] text-[#a3b0bc]">{note}</p>
    </div>
  )
}
