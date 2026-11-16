import { useMemo } from 'react'
import type { Tides, Weather } from '../../types'
import { useWidth } from './SkyChart'
import { dayStart, nextTide, tideAt, tideText, signed, toTides, type Tide } from '../../lib/tides'

const TEAL = '#4fd6c8'
const LINE = '#7fe9de'
const ORANGE = '#f29a4e'
const HOUR = 3_600_000

const clock = (t: number) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const hourMark = (t: number) => { const h = new Date(t).getHours(); return `${h % 12 || 12}${h < 12 ? 'a' : 'p'}` }
const span = (ms: number) => { const m = Math.max(0, Math.round(ms / 60_000)); return `${m >= 60 ? `${Math.floor(m / 60)} h ` : ''}${m % 60} m` }
const f = (x: number) => x.toFixed(1)

// Chart box: ft marks in a left gutter, room above for high labels and below for low labels
const G = 34, TOP = 38, PH = 150, BOTTOM = TOP + PH, CH = 230
// Label box; PAD keeps it clear of the line and of the high/low dot (radius 3.5 + its outline)
const LW = 64, LH = 28, PAD = 8

/**
 * The weather card's Tides tab (Option A, Nov 15, 2026): one day at a time,
 * midnight to midnight, with the 0 ft baseline (mean lower low water), each high
 * and low labeled clear of the line, nights shaded and a line at now. Seven day
 * tiles underneath pick the day.
 */
/** Enough predictions to draw today (the card shows a short note otherwise) */
export const tidesReady = (tides: Tides | null | undefined, now: number) => {
  if (!tides) return false
  const all = toTides(tides.events)
  return all.length >= 4 && tideAt(all, now) !== null
}

export function TidesView({ tides, daily, now, day, onDay }: {
  tides: Tides | null | undefined
  daily: Weather['daily']
  now: number
  day: number
  onDay: (d: number) => void
}) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const all = useMemo(() => (tides ? toTides(tides.events) : []), [tides])
  const starts = useMemo(() => Array.from({ length: 8 }, (_, d) => dayStart(now, d)), [now])

  if (!tides) return null

  const inDay = (d: number) => all.filter((e) => e.t >= starts[d] && e.t < starts[d + 1])
  const days = Array.from({ length: 7 }, (_, d) => d).filter((d) => tideAt(all, starts[d] + 12 * HOUR) !== null)
  const picked = days.includes(day) ? day : 0
  const t0 = starts[picked], t1 = starts[picked + 1]

  // One scale for the whole week, so days compare at a glance
  const week = all.filter((e) => e.t >= starts[0] && e.t < starts[7])
  const yMin = Math.min(-1.2, Math.floor(Math.min(...week.map((e) => e.ft)) - 0.8))
  const yMax = Math.max(6.6, Math.max(...week.map((e) => e.ft)) + 0.6)

  // ── Header ──
  const pe = inDay(picked)
  const lowest = pe.filter((e) => !e.high).sort((a, b) => a.ft - b.ft)[0]
  const highest = pe.filter((e) => e.high).sort((a, b) => b.ft - a.ft)[0]
  const rowColor = (e: Tide) => (!e.high && e.ft < 0 ? ORANGE : '#e8edf2')
  let kicker: string, big: string, bigColor = '#e8edf2', arrow = ''
  const rows: { k: string; e: Tide; when: string }[] = []
  if (picked === 0) {
    const h = tideAt(all, now)!
    const next = nextTide(all, now), after = next ? nextTide(all, next.t) : null
    kicker = 'Tide now'; big = `${f(h)} ft`; arrow = next?.high ? '↑ rising' : '↓ falling'
    if (next) rows.push({ k: next.high ? 'Next high' : 'Next low', e: next, when: `at ${clock(next.t)} · in ${span(next.t - now)}` })
    if (after) rows.push({ k: after.high ? 'Then high' : 'Then low', e: after, when: `at ${clock(after.t)}` })
  } else {
    kicker = new Date(t0).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    big = lowest ? `Low ${tideText(lowest)}` : '—'
    if (lowest && lowest.ft < 0) bigColor = ORANGE
    if (lowest) rows.push({ k: 'Lowest low', e: lowest, when: `at ${clock(lowest.t)}` })
    if (highest) rows.push({ k: 'Highest high', e: highest, when: `at ${clock(highest.t)}` })
  }

  // ── Chart ──
  const chart = W > 120 ? (() => {
    const X = (t: number) => G + ((t - t0) / (t1 - t0)) * (W - G)
    const Y = (h: number) => TOP + (1 - (h - yMin) / (yMax - yMin)) * PH
    const pts: [number, number, number][] = []
    for (let t = t0; t <= t1; t += 10 * 60_000) { const h = tideAt(all, t); if (h !== null) pts.push([X(t), Y(h), h]) }
    if (pts.length < 2) return null
    const line = 'M' + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join(' L')
    const first = pts[0][0], last = pts[pts.length - 1][0], z = Y(0)
    const area = `${line} L${f(last)} ${BOTTOM} L${f(first)} ${BOTTOM} Z`
    const minus = `M${f(first)} ${f(z)} L` + pts.map((p) => `${f(p[0])} ${f(p[2] < 0 ? p[1] : z)}`).join(' L') + ` L${f(last)} ${f(z)} Z`
    const grid = [2, 4, 6].filter((h) => h < yMax).map((h) => `M${G} ${Math.round(Y(h)) + 0.5} H${W}`).join(' ')
    const marks = [0, 2, 4, 6].filter((h) => h < yMax)
    const dd = daily[picked]
    let nights = ''
    if (dd?.sunrise && dd?.sunset) {
      const rise = Date.parse(dd.sunrise), set = Date.parse(dd.sunset)
      if (rise > t0) nights += `M${f(X(t0))} ${TOP} H${f(X(rise))} V${BOTTOM} H${f(X(t0))} Z `
      if (set < t1) nights += `M${f(X(set))} ${TOP} H${f(X(t1))} V${BOTTOM} H${f(X(set))} Z`
    }
    // Each label sits clear of the line across its whole width: above a high, below a low
    const labels = pe.filter((e) => e.t > t0 + 0.3 * HOUR && e.t < t1 - 0.3 * HOUR).map((e) => {
      const x = X(e.t), y = Y(e.ft), lx = Math.min(W - LW / 2, Math.max(G + LW / 2, x))
      const under = pts.filter((p) => p[0] >= lx - LW / 2 - 2 && p[0] <= lx + LW / 2 + 2).map((p) => p[1])
      const ly = e.high ? Math.min(...under, y) - PAD - LH : Math.max(...under, y) + PAD
      return { e, x, y, lx, ly }
    })
    const hasNow = now > t0 && now < t1
    const nowX = X(now)
    const ticks = [3, 6, 9, 12, 15, 18, 21].map((h) => t0 + h * HOUR)
      .filter((t) => !hasNow || Math.abs(X(t) - nowX) > 30)
      .map((t) => ({ x: X(t), t: hourMark(t), now: false }))
    if (hasNow) ticks.push({ x: nowX, t: 'Now', now: true })
    return { line, area, minus, grid, marks, nights, labels, hasNow, nowX, nowY: Y(tideAt(all, now) ?? 0), zeroY: Math.round(z) + 0.5, Y, ticks }
  })() : null

  const aria = `${picked === 0 ? 'Today' : kicker} tides: ` + pe.map((e) => `${e.high ? 'high' : 'low'} ${tideText(e)} at ${clock(e.t)}`).join(', ')
  const station = tides.stationName ? `NOAA ${tides.stationName}` : `NOAA station ${tides.station}`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <div className="flex flex-col gap-[3px]">
          <span className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-[#8493a1]">{kicker}</span>
          <span className="font-display text-[26px] font-medium leading-none" style={{ color: bigColor }}>
            {big} {arrow && <span className="text-sm" style={{ color: TEAL }}>{arrow}</span>}
          </span>
        </div>
        <div className="grid grid-cols-[auto_auto_auto] items-baseline gap-x-2.5 gap-y-[3px] text-[12.5px]">
          {rows.map((r) => (
            <span key={r.k} className="contents">
              <span className="text-[#8493a1]">{r.k}</span>
              <span className="text-right font-mono font-semibold" style={{ color: rowColor(r.e) }}>{tideText(r.e)}</span>
              <span className="text-[#c5ced6]">{r.when}</span>
            </span>
          ))}
        </div>
      </div>

      <div ref={ref} className="relative w-full" style={{ height: CH }}>
        {chart && (
          <>
            <svg width={W} height={CH} viewBox={`0 0 ${W} ${CH}`} role="img" aria-label={aria} className="absolute left-0 top-0">
              <defs>
                <linearGradient id="tide-water" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={TEAL} stopOpacity=".5" />
                  <stop offset="1" stopColor={TEAL} stopOpacity=".03" />
                </linearGradient>
              </defs>
              <path d={chart.nights} fill="rgba(124,140,240,.08)" />
              <path d={chart.grid} stroke="rgba(255,255,255,.07)" shapeRendering="crispEdges" />
              <path d={chart.area} fill="url(#tide-water)" />
              <path d={chart.minus} fill="rgba(242,154,78,.42)" />
              <line x1={G} y1={chart.zeroY} x2={W} y2={chart.zeroY} stroke="rgba(232,237,242,.55)" shapeRendering="crispEdges" />
              <path d={chart.line} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" />
              {chart.hasNow && (
                <>
                  <line x1={chart.nowX} y1={TOP} x2={chart.nowX} y2={BOTTOM} stroke="#f2c14e" strokeWidth={1.5} />
                  <circle cx={chart.nowX} cy={chart.nowY} r={5} fill="#161d24" stroke="#f2c14e" strokeWidth={2} />
                </>
              )}
              {chart.labels.map(({ e, x, y }) => (
                <circle key={e.t} cx={x} cy={y} r={3.5} fill={e.high ? LINE : e.ft < 0 ? ORANGE : '#e8edf2'} stroke="#161d24" strokeWidth={1.5} />
              ))}
            </svg>
            {chart.marks.map((h) => (
              <span key={h} className="absolute left-0 font-mono text-[9.5px]" style={{ top: chart.Y(h) - 6, color: h === 0 ? '#c5ced6' : '#56636f', fontWeight: h === 0 ? 600 : 400 }}>{h} ft</span>
            ))}
            {chart.labels.map(({ e, lx, ly }) => (
              <span key={e.t} data-tide-label className="absolute flex w-16 flex-col items-center justify-center overflow-hidden rounded-[5px] text-center" style={{ left: lx - LW / 2, top: ly, height: LH, background: 'rgba(22,29,36,.85)' }}>
                <b className="block font-display text-[12.5px] font-semibold leading-[14px]" style={{ color: e.high ? '#e8edf2' : e.ft < 0 ? ORANGE : '#c5ced6' }}>{tideText(e)}</b>
                <span className="block font-mono text-[10px] leading-[12px] text-[#a3b0bc]">{clock(e.t)}</span>
              </span>
            ))}
            {chart.ticks.map((k) => (
              <span key={k.t + k.x} className="absolute w-10 text-center text-[10px]" style={{ left: k.x - 20, top: CH - 16, color: k.now ? '#f2c14e' : '#8493a1', fontWeight: k.now ? 600 : 400 }}>{k.t}</span>
            ))}
          </>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const e = inDay(d), hi = e.filter((x) => x.high).sort((a, b) => b.ft - a.ft)[0], lo = e.filter((x) => !x.high).sort((a, b) => a.ft - b.ft)[0]
          const on = d === picked
          const name = d === 0 ? 'Today' : new Date(starts[d]).toLocaleDateString('en-US', { weekday: 'short' })
          return (
            <button key={d} type="button" onClick={() => onDay(d)} aria-pressed={on}
              aria-label={`${d === 0 ? 'Today' : new Date(starts[d]).toLocaleDateString('en-US', { weekday: 'long' })}: highest ${hi ? hi.ft.toFixed(1) : '–'} ft, lowest ${lo ? signed(lo.ft) : '–'} ft`}
              className="flex min-w-0 flex-col items-center gap-1 rounded-[10px] border px-0.5 pb-1.5 pt-[7px] transition-colors"
              style={{ borderColor: on ? 'rgba(79,214,200,.55)' : 'rgba(255,255,255,.06)', background: on ? 'rgba(79,214,200,.09)' : 'rgba(255,255,255,.02)' }}>
              <span className="text-[11.5px] font-semibold" style={{ color: on ? '#e8edf2' : '#8493a1' }}>{name}</span>
              <MiniTide all={all} t0={starts[d]} t1={starts[d + 1]} yMin={yMin} yMax={yMax} />
              <span className="text-center font-mono text-[10px] leading-[1.3] text-[#a3b0bc]">
                H {hi ? hi.ft.toFixed(1) : '–'}<br />
                <span style={{ color: lo && lo.ft < 0 ? ORANGE : undefined }}>L {lo ? signed(lo.ft) : '–'}</span>
              </span>
            </button>
          )
        })}
      </div>
      <p className="m-0 text-[10.5px] text-[#8493a1]">
        Feet above the 0 ft baseline (mean lower low water) · <span style={{ color: ORANGE }}>orange</span> = below 0 ft · {station}
      </p>
    </div>
  )
}

/** A day's tide as a small line, on the week's scale */
function MiniTide({ all, t0, t1, yMin, yMax }: { all: Tide[]; t0: number; t1: number; yMin: number; yMax: number }) {
  const W = 66, H = 24
  const X = (t: number) => ((t - t0) / (t1 - t0)) * W, Y = (h: number) => 1 + (1 - (h - yMin) / (yMax - yMin)) * H
  const p: [number, number, number][] = []
  for (let t = t0; t <= t1; t += 30 * 60_000) { const h = tideAt(all, t); if (h !== null) p.push([X(t), Y(h), h]) }
  if (p.length < 2) return <svg width="100%" height="26" aria-hidden />
  const line = 'M' + p.map((q) => `${f(q[0])} ${f(q[1])}`).join(' L'), z = Y(0)
  return (
    <svg width="100%" height="26" viewBox="0 0 66 26" preserveAspectRatio="none" aria-hidden className="max-w-[66px]">
      <line x1="0" y1={z} x2="66" y2={z} stroke="rgba(232,237,242,.3)" vectorEffect="non-scaling-stroke" />
      <path d={`${line} L${f(p[p.length - 1][0])} 26 L${f(p[0][0])} 26 Z`} fill="rgba(79,214,200,.18)" />
      <path d={`M${f(p[0][0])} ${f(z)} L` + p.map((q) => `${f(q[0])} ${f(q[2] < 0 ? q[1] : z)}`).join(' L') + ` L${f(p[p.length - 1][0])} ${f(z)} Z`} fill="rgba(242,154,78,.55)" />
      <path d={line} fill="none" stroke={LINE} strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
