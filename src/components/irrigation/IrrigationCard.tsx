import type React from 'react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, SkipForward, X } from 'lucide-react'
import { useHome } from '../../lib/useHome'
import { categories } from '../../lib/categories'
import { clockTime } from '../../lib/format'
import { useLongPress } from '../../lib/useLongPress'
import { PAUSE_MINUTES, RAIN_EFFECT } from '../../config/irrigation'
import { QuickRunPicker, QuickRunSheet, DEFAULT_MINUTES, type PickZone, type RunRow } from './QuickRunPicker'
import { Card } from '../Card'
import { RainLayer } from './RainLayer'
import { useIrrigationActions } from '../tiles/SmallTiles'
import type { HomeState, IrrigationRun, IrrigationZone, QuickRun, RunZone } from '../../types'

const CYAN = '#35c2d6'
const AMBER = '#f2c14e'
const RED = '#ff6b5e'
const cfg = categories.irrigation
const cyan = (a: number) => `rgba(53,194,214,${a})`

/** "2026-10-28" → local noon that day */
const dayOf = (date: string) => new Date(`${date}T12:00:00`)
const dayLetters = (date: string) => dayOf(date).toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)

/** "Sun 5:00 AM" (or "Today 5:00 AM" / "Tomorrow …") */
function whenText(at: string) {
  const d = new Date(at), now = new Date()
  const days = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86_400_000)
  const day = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' })
  return `${day} ${clockTime(at)}`
}

/** "in 6 h 41 m" */
function inText(at: string) {
  const m = Math.max(0, Math.round((Date.parse(at) - Date.now()) / 60_000))
  if (m < 60) return `in ${m} m`
  const h = Math.floor(m / 60)
  return h >= 24 ? `in ${Math.round(h / 24)} d` : `in ${h} h ${m % 60} m`
}

const lastRanText = (iso?: string | null) => {
  if (!iso) return null
  const d = new Date(iso)
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000)
  return `Last ran ${days === 0 ? 'today' : days === 1 ? 'yesterday' : d.toLocaleDateString('en-US', { weekday: 'short' })}`
}

/** Ticks every second while something waters (for the countdown) */
function useSecondTick(on: boolean) {
  const [, set] = useState(0)
  useEffect(() => {
    if (!on) return
    const t = setInterval(() => set((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [on])
}

// ── Week strip ───────────────────────────────────────────────────────────
function WeekStrip({ data, selected, onPick, faded }: { data: HomeState; selected: number | null; onPick?: (i: number) => void; faded?: boolean }) {
  const week = data.irrigation.week ?? []
  const nextAt = data.irrigation.nextRun?.at
  return (
    <div className={`grid grid-cols-7 gap-1.5 transition-opacity ${faded ? 'opacity-50' : ''}`}>
      {week.map((d, i) => {
        const live = d.runs.filter((r) => !r.skipped)
        const allSkipped = d.runs.length > 0 && live.length === 0
        const isNext = !!nextAt && live.some((r) => r.at === nextAt)
        const today = i === 0
        const picked = selected === i
        const slot: React.CSSProperties = allSkipped
          ? { background: 'transparent', border: `1.5px dashed ${AMBER}` }
          : { background: live.length ? (isNext ? CYAN : cyan(0.55)) : 'var(--color-surface-raised)' }
        return (
          <button key={d.date} onClick={() => onPick?.(i)} disabled={!onPick} aria-pressed={picked}
            aria-label={`${dayOf(d.date).toLocaleDateString('en-US', { weekday: 'long' })}: ${d.runs.length ? d.runs.map((r) => `${r.name} ${clockTime(r.at)}${r.skipped ? ' (skipped)' : ''}`).join(', ') : 'nothing scheduled'}`}
            className="flex min-w-0 flex-col items-center gap-1.5 rounded-lg py-1.5 transition-colors"
            style={{ background: picked ? 'var(--color-surface-raised)' : undefined, outline: picked ? `2px solid ${CYAN}` : today ? `1px solid ${CYAN}` : undefined }}>
            <span className="text-[11px] font-semibold" style={{ color: picked ? 'var(--color-ink)' : today ? CYAN : 'var(--color-ink-dim)' }}>{dayLetters(d.date)}</span>
            <span className="box-border h-[22px] w-full rounded-[5px]" style={slot} />
          </button>
        )
      })}
    </div>
  )
}

// ── Countdown ring ───────────────────────────────────────────────────────
function Ring({ remaining, total, paused, label, size = 124 }: { remaining: number | null; total: number | null; paused: boolean; label: string; size?: number }) {
  const sw = size >= 110 ? 9 : 7
  const c = size / 2, R = c - sw / 2 - 1, C = 2 * Math.PI * R
  const frac = remaining !== null && total ? Math.max(0, Math.min(1, remaining / total)) : 1
  const text = remaining === null ? '—' : `${Math.floor(remaining / 60)}:${String(Math.floor(remaining % 60)).padStart(2, '0')}`
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        {/* Center filled with the card color so the rain never passes behind the numbers */}
        <circle cx={c} cy={c} r={R} fill="var(--color-surface)" stroke="var(--color-surface-raised)" strokeWidth={sw} />
        <circle cx={c} cy={c} r={R} fill="none" stroke={CYAN} strokeOpacity={paused ? 0.5 : 1} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform={`rotate(-90 ${c} ${c})`} className="transition-[stroke-dashoffset] duration-1000 ease-linear" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono leading-none" style={{ fontSize: size >= 110 ? 26 : 20 }}>{text}</span>
        <span className="mt-1 text-[11px] text-ink-dim">{paused ? 'paused' : 'left'}</span>
      </div>
    </div>
  )
}

/** "Skipped", or why Rachio skipped it (weather etc.) */
function skipText(cause?: string | null) {
  const c = (cause ?? '').toUpperCase()
  if (!c || c === 'MANUAL') return 'Skipped'
  if (c.includes('RAIN') || c.includes('PRECIP')) return 'Skipped · rain'
  if (c.includes('FREEZE')) return 'Skipped · freeze'
  if (c.includes('WIND')) return 'Skipped · wind'
  if (c.includes('SATURAT') || c.includes('MOIST')) return 'Skipped · soil is wet'
  return `Skipped · ${c.toLowerCase().replace(/_/g, ' ')}`
}

// ── Every zone in the running schedule ────────────────────────────────────
const mins = (sec: number | null) => (sec ? `${Math.max(1, Math.round(sec / 60))}m` : '')
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

function ZoneList({ zones, remaining }: { zones: RunZone[]; remaining: number | null }) {
  const ref = useRef<HTMLUListElement>(null)
  const nowIndex = zones.findIndex((z) => z.state === 'now')
  // Keep the zone watering now in view as the run moves down the list
  useEffect(() => {
    const el = ref.current, row = el?.children[nowIndex] as HTMLElement | undefined
    if (!el || !row) return
    if (row.offsetTop < el.scrollTop || row.offsetTop + row.offsetHeight > el.scrollTop + el.clientHeight)
      el.scrollTo({ top: Math.max(0, row.offsetTop - 4), behavior: 'smooth' })
  }, [nowIndex])
  return (
    <ul ref={ref} aria-label="Zones in this run"
      className="no-scrollbar relative flex max-h-[208px] min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain fit:max-h-full"
      style={{ maskImage: 'linear-gradient(180deg, #000 calc(100% - 22px), transparent)', WebkitMaskImage: 'linear-gradient(180deg, #000 calc(100% - 22px), transparent)' }}>
      {zones.map((z, k) => {
        const now = z.state === 'now'
        return (
          <li key={`${z.zoneId}-${k}`}
            className={`grid min-h-9 shrink-0 grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-x-2 rounded-lg px-1.5 py-1 text-[12.5px] leading-tight ${now ? 'font-semibold text-ink' : z.state === 'next' ? 'text-ink-dim' : 'text-ink-faint'}`}
            style={now ? { background: cyan(0.12) } : undefined}>
            {z.state === 'done' ? <Check size={11} strokeWidth={3} aria-label="done" />
              : z.state === 'skipped' ? <SkipForward size={11} aria-label="skipped" />
              : now ? <span aria-label="watering now" className="h-2 w-2 justify-self-center rounded-full" style={{ background: CYAN, boxShadow: `0 0 0 3px ${cyan(0.25)}` }} />
              : <span aria-label="up next" className="h-2 w-2 justify-self-center rounded-full border-[1.5px] border-ink-faint" />}
            <span className={`line-clamp-2 break-words ${z.state === 'skipped' ? 'line-through' : ''}`}>{z.name.trim()}</span>
            <span className="text-right font-mono text-[11.5px]" style={now ? { color: CYAN } : undefined}
              aria-label={now && remaining !== null ? `${clock(remaining)} left of ${mins(z.seconds)}` : undefined}>
              {z.state === 'skipped' ? 'skip' : mins(z.seconds)}
            </span>
          </li>
        )
      })}
      <li aria-hidden className="h-3 shrink-0" />
    </ul>
  )
}

// ── Slide-up panels inside the card ───────────────────────────────────────
export function Panel({ title, right, onClose, children }: { title: ReactNode; right?: ReactNode; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-up absolute inset-x-0 bottom-0 z-[3] flex max-h-[92%] flex-col gap-2.5 overflow-y-auto rounded-t-2xl border-t border-edge bg-surface-raised px-4 pb-4 pt-3 shadow-[0_-12px_24px_rgba(0,0,0,0.35)]"
      role="dialog" aria-label={typeof title === 'string' ? title : undefined}>
      <div className="h-1 w-9 shrink-0 self-center rounded-full bg-edge" />
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate font-display text-base font-semibold">{title}</p>
        {right}
        <button onClick={onClose} aria-label="Close" className="-mr-2 flex h-8 w-11 shrink-0 items-center justify-center text-ink-dim hover:text-ink"><X size={18} /></button>
      </div>
      {children}
    </div>
  )
}

const sbtn = 'flex min-h-11 items-center justify-center rounded-[10px] border border-edge bg-surface text-[13px] font-medium transition-colors active:scale-[0.97]'

/**
 * Hold a quick-run chip. A zone opens the Quick run pop-up (minute wheel starting
 * on the chip's time, Add another zone) — the same one as the Irrigation page; it
 * needs more room than the card has. A schedule shows its zones and Start in the card.
 */
function HoldPanel({ q, zones, onStartSchedule, onStartZones, onClose }: {
  q: QuickRun; zones: PickZone[]; onStartSchedule: () => void; onStartZones: (rows: RunRow[]) => void; onClose: () => void
}) {
  if (q.kind !== 'schedule' && q.zoneIds?.[0]) {
    return (
      <QuickRunSheet title={q.label} subtitle={lastRanText(q.lastRunAt) ?? undefined} onClose={onClose}>
        <QuickRunPicker zones={zones} first={{ zoneId: q.zoneIds[0], minutes: q.minutes ?? DEFAULT_MINUTES }} onStart={onStartZones} />
      </QuickRunSheet>
    )
  }
  return (
    <Panel title={q.label} onClose={onClose}>
      {lastRanText(q.lastRunAt) && <p className="-mt-2 text-xs text-ink-dim">{lastRanText(q.lastRunAt)}</p>}
      <p className="text-[13px] text-ink-dim">{q.zoneNames?.length ? q.zoneNames.join(', ') : 'The whole schedule'}{q.minutes ? ` · ~${q.minutes} min` : ''}</p>
      <button onClick={onStartSchedule} className="min-h-12 rounded-xl text-sm font-semibold text-bg active:scale-[0.98]" style={{ background: CYAN }}>Start</button>
    </Panel>
  )
}

function DayPanel({ date, runs, onSkip, onClose }: { date: string; runs: IrrigationRun[]; onSkip: (r: IrrigationRun) => void; onClose: () => void }) {
  return (
    <Panel title={dayOf(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} onClose={onClose}>
      {!runs.length && <p className="py-2 text-sm text-ink-dim">Nothing scheduled</p>}
      {runs.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-2.5 rounded-xl border bg-surface px-3 py-2.5" style={{ borderColor: 'var(--color-edge)', borderStyle: r.skipped ? 'dashed' : 'solid' }}>
          <div className="min-w-0">
            <p className={`text-sm font-medium leading-snug ${r.skipped ? 'text-ink-dim line-through' : ''}`}>
              {r.name} <span className="font-mono" style={{ color: r.skipped ? undefined : CYAN }}>{clockTime(r.at)}</span>
            </p>
            {r.skipped
              ? <p className="mt-0.5 text-xs" style={{ color: AMBER }}>{skipText(r.skipCause)} <span className="text-ink-faint">· undo in the Rachio app</span></p>
              : <p className="mt-0.5 text-xs text-ink-dim">{[r.minutes ? `~${r.minutes} min` : null, r.zoneNames.join(', ') || null].filter(Boolean).join(' · ')}</p>}
            {!r.skipped && !r.canSkip && r.reason && <p className="mt-0.5 text-[11px] text-ink-faint">{r.reason}</p>}
          </div>
          {!r.skipped && (
            <button onClick={() => onSkip(r)} disabled={!r.canSkip} className={`${sbtn} shrink-0 px-3.5 disabled:opacity-35`}>Skip</button>
          )}
        </div>
      ))}
    </Panel>
  )
}

// ── Quick-run chip: tap = start now, hold = set the time ──────────────────
function Chip({ q, onTap, onHold }: { q: QuickRun; onTap: () => void; onHold: () => void }) {
  const [flash, setFlash] = useState(false)
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(false), 600); return () => clearTimeout(t) }, [flash])
  const press = useLongPress(() => { setFlash(true); onTap() }, onHold)
  return (
    <button {...press} disabled={!q.available} title={q.available ? 'Tap to start · hold to set the time' : q.reason}
      className="flex min-h-11 select-none items-center gap-1.5 rounded-[10px] border px-3 text-[13px] font-medium transition-colors duration-150 active:scale-[0.97] disabled:opacity-40"
      style={flash ? { background: CYAN, borderColor: CYAN, color: 'var(--color-bg)' } : { background: 'var(--color-surface-raised)', borderColor: 'var(--color-edge)' }}>
      {q.label}
      {q.kind !== 'schedule' && q.minutes ? <span className={`font-mono ${flash ? '' : 'text-ink-dim'}`}>{q.minutes}m</span> : null}
    </button>
  )
}

/**
 * The Irrigation card (bottom row on Home). Idle: next run, a 7-day strip
 * (tap a day for its runs and Skip) and quick-run chips (tap to start, hold to
 * set the time). Watering: a countdown ring for the current zone, Pause and
 * Stop, and a decorative rain layer. Every button acts on one tap.
 */
export function IrrigationCard() {
  const { data, update, send } = useHome()
  const a = useIrrigationActions()
  const [day, setDay] = useState<number | null>(null)
  const [hold, setHold] = useState<QuickRun | null>(null)
  const zones = data?.irrigationZones ?? []
  const active: IrrigationZone | undefined = zones.find((z) => z.isWatering || z.isPaused)
  useSecondTick(!!active?.isWatering)
  if (!data) return null

  const s = data.irrigation
  const paused = !!active?.isPaused
  const watering = s.watering && active && s.watering.zoneId === active.id ? s.watering : null
  const k = active ? (paused ? 0.5 : 1) : 0
  const wash = k ? { backgroundImage: `linear-gradient(180deg, ${cyan(0.2 * k)} 0%, ${cyan(0.06 * k)} 45%, transparent 80%)` } : undefined
  const skippedToday = !!s.lastSkipped

  // Countdown for the current zone
  let remaining: number | null = null
  if (paused) remaining = watering?.pausedRemainingSec ?? null
  else if (watering?.zoneStartedAt && watering.zoneSeconds) remaining = Math.max(0, (Date.parse(watering.zoneStartedAt) + watering.zoneSeconds * 1000 - Date.now()) / 1000)
  else if (active?.minutesLeft) remaining = active.minutesLeft * 60

  const startQuick = (q: QuickRun, minutes?: number) => {
    setHold(null)
    if (q.zoneIds?.[0]) update((st) => ({ ...st, irrigationZones: st.irrigationZones.map((z) => (z.id === q.zoneIds![0] ? { ...z, isWatering: true, isPaused: false, minutesLeft: minutes ?? q.minutes ?? null } : z)) }))
    void send('rachio/command', { action: 'quick', quickId: q.id, minutes }, { refresh: true })
  }
  const skipRun = (date: string, r: IrrigationRun) => {
    update((st) => ({
      ...st, irrigation: {
        ...st.irrigation,
        week: st.irrigation.week?.map((d) => (d.date === date ? { ...d, runs: d.runs.map((x) => (x.id === r.id ? { ...x, skipped: true, canSkip: false } : x)) } : d)),
      },
    }))
    void send('rachio/command', { action: 'skip-run', scheduleId: r.scheduleId, date }, { refresh: true })
  }

  const status = active
    ? <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: cyan(paused ? 0.09 : 0.18), color: paused ? cyan(0.6) : CYAN }}>
        <span className="h-[7px] w-[7px] rounded-full" style={{ background: paused ? cyan(0.6) : CYAN }} />{paused ? 'Paused' : 'Watering'}
      </span>
    : skippedToday
      ? <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: 'var(--color-weather-dim)', color: AMBER }}>Skipped today</span>
      : <span className="text-xs text-ink-dim">{zones.some((z) => z.rainDelay) ? 'Rain delay' : 'Idle'}</span>

  const strip = 'flex h-9 items-center justify-center whitespace-nowrap rounded-lg px-2 text-xs font-medium transition-colors duration-150 active:scale-[0.97] disabled:opacity-40'
  const skip = s.skipTomorrow
  const runZones = watering?.zones && watering.zones.length > 1 ? watering.zones : null
  const canNext = !!runZones && watering!.index !== undefined && runZones.slice(watering!.index + 1).some((z) => z.state === 'next')
  const actions = active ? (
    <div className={`grid w-full gap-2 ${canNext ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {paused
        ? <button onClick={() => a.resume(active)} className={strip} style={{ background: cfg.dim, color: cfg.color }}>Resume</button>
        : <button onClick={() => a.pause(active)} className={strip} style={{ background: cfg.dim, color: cfg.color }}>Pause {PAUSE_MINUTES === 60 ? '1 h' : `${PAUSE_MINUTES} m`}</button>}
      {canNext && (
        <button onClick={() => a.nextZone()} className={`${strip} gap-1`} style={{ background: 'var(--color-surface-raised)', color: 'var(--color-ink)' }}>
          <SkipForward size={13} aria-hidden />Next zone
        </button>
      )}
      <button onClick={() => a.stop(active)} className={strip} style={{ background: 'var(--color-critical-dim)', color: RED }}>Stop</button>
    </div>
  ) : (
    <div className="grid w-full grid-cols-2 gap-2">
      <button onClick={a.skipTomorrow} disabled={!skip.available} title={skip.label} className={strip} style={{ background: 'var(--color-calendar-dim)', color: 'var(--color-rain)' }}>
        {skip.skipped ? 'Tomorrow skipped' : 'Skip tomorrow'}
      </button>
      <Link to={cfg.path} className={strip} style={{ background: 'var(--color-surface-raised)', color: 'var(--color-ink)' }}>Details</Link>
    </div>
  )

  const week = s.week ?? []
  const pickZones: PickZone[] = zones.map((z) => ({ id: z.id, name: z.name.trim() }))
  const overlay = (
    <>
      {RAIN_EFFECT && <RainLayer active={!!active && !paused} />}
      {hold && <HoldPanel q={hold} zones={pickZones} onStartSchedule={() => startQuick(hold)} onStartZones={(rows) => { setHold(null); a.startZones(rows) }} onClose={() => setHold(null)} />}
      {day !== null && week[day] && !active && (
        <DayPanel date={week[day].date} runs={week[day].runs} onSkip={(r) => skipRun(week[day].date, r)} onClose={() => setDay(null)} />
      )}
    </>
  )

  return (
    <Card className="h-full" accent={cfg.color} title="Irrigation" category="irrigation" style={wash} headerRight={status}
      bodyClassName="@container flex flex-col gap-3.5 fit:gap-2.5" actions={actions} overlay={overlay}>
      {active ? (runZones && watering!.index !== undefined ? (
        // A run with several zones: one line of context, then the ring on the left
        // and every zone on the right (the list fills the height and scrolls)
        <>
          <p className="truncate text-xs text-ink-dim">
            {watering!.schedule ?? 'Run'} · zone {watering!.index + 1} of {runZones.length}
            {paused && active.resumesAt ? <> · resumes <span className="font-mono text-ink">{clockTime(active.resumesAt)}</span></>
              : watering!.doneAt ? <> · done ~<span className="font-mono text-ink">{clockTime(watering!.doneAt)}</span></> : null}
          </p>
          <div className="flex min-h-0 flex-1 items-start gap-2.5">
            <Ring size={84} remaining={remaining} total={watering?.zoneSeconds ?? (active.minutesLeft ? active.minutesLeft * 60 : null)} paused={paused}
              label={`${active.name}, ${remaining !== null ? `${Math.round(remaining / 60)} minutes left` : 'watering'}`} />
            <ZoneList zones={runZones} remaining={remaining} />
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col items-center gap-3 @min-[300px]:flex-row @min-[300px]:gap-4">
            <Ring remaining={remaining} total={watering?.zoneSeconds ?? (active.minutesLeft ? active.minutesLeft * 60 : null)} paused={paused}
              label={`${active.name}, ${remaining !== null ? `${Math.round(remaining / 60)} minutes left` : 'watering'}`} />
            <div className="flex min-w-0 flex-col items-center gap-1 text-center @min-[300px]:items-start @min-[300px]:text-left">
              <p className="font-display text-xl font-semibold leading-tight">{active.name}</p>
              {watering?.nextZone && <p className="text-[13px] text-ink-dim">Then {watering.nextZone}</p>}
              {watering?.doneAt && <p className="text-[13px] text-ink-dim">Done ~<span className="font-mono text-ink">{clockTime(watering.doneAt)}</span></p>}
              {paused && active.resumesAt && <p className="text-[13px] text-ink-dim">Resumes {clockTime(active.resumesAt)}</p>}
            </div>
          </div>
          <WeekStrip data={data} selected={null} faded />
        </>
      )
      ) : (
        <>
          <div className={`transition-opacity ${day !== null ? 'opacity-35' : ''}`}>
            <p className="mb-1 text-xs text-ink-dim">Next run</p>
            <p className="font-mono text-[22px] leading-tight @min-[300px]:text-[26px]">{s.nextRun ? whenText(s.nextRun.at) : '—'}</p>
            <p className="mt-1 text-[13px] text-ink-dim">
              {s.nextRun
                ? [s.nextRun.name, inText(s.nextRun.at), s.nextRun.minutes ? `~${s.nextRun.minutes} min` : null].filter(Boolean).join(' · ')
                : zones.some((z) => z.rainDelay) ? 'Paused for rain' : 'Nothing scheduled'}
            </p>
          </div>
          {week.length > 0 && <WeekStrip data={data} selected={day} onPick={(i) => { setHold(null); setDay(day === i ? null : i) }} />}
          <div className="flex flex-wrap gap-2">
            {s.quickRuns.map((q) => <Chip key={q.id} q={q} onTap={() => startQuick(q)} onHold={() => { setDay(null); setHold(q) }} />)}
          </div>
        </>
      )}
    </Card>
  )
}
