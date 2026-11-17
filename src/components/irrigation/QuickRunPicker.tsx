import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Clock, Plus, TriangleAlert, X } from 'lucide-react'
import { MiniMonth, minLabel, parseTime } from '../calendar/EventEditor'
import type { IrrigationSummary } from '../../types'
import { clearTimes, dayKey, inLabel, overlaps, timeOf, whenLabel, MINUTE } from './scheduled'

const CYAN = 'var(--color-irrigation)'
const cyan = (a: number) => `rgba(53, 194, 214, ${a})`

/** Longest quick run per zone, in minutes (Connor: never more than an hour) */
export const MAX_MINUTES = 60
/** Where the wheel starts for a zone with no time of its own */
export const DEFAULT_MINUTES = 10
const SHORTCUTS = [2, 5, 10, 15, 30]
const ROW = 36

// ── Minute wheel ──────────────────────────────────────────────────────────
/**
 * A flick-to-pick column of minutes (1–60). Snaps to a row; tap a number to
 * pick it; arrow keys step. The middle row is the value.
 */
export function MinuteWheel({ value, onChange, rows = 3 }: { value: number; onChange: (m: number) => void; rows?: 3 | 5 }) {
  const ref = useRef<HTMLDivElement>(null)
  const pad = ((rows - 1) / 2) * ROW
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fromScroll = useRef(false)

  // Put the wheel on the value (first show, row switch, shortcut tap)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (fromScroll.current) { fromScroll.current = false; return }
    const top = (value - 1) * ROW
    if (Math.abs(el.scrollTop - top) < 2) return
    if (el.dataset.ready) el.scrollTo({ top, behavior: 'smooth' })
    else { el.scrollTop = top; el.dataset.ready = '1' }
  }, [value])
  useEffect(() => () => { if (settle.current) clearTimeout(settle.current) }, [])

  const onScroll = () => {
    if (settle.current) clearTimeout(settle.current)
    settle.current = setTimeout(() => {
      const el = ref.current
      if (!el) return
      const m = Math.min(MAX_MINUTES, Math.max(1, Math.round(el.scrollTop / ROW) + 1))
      if (m !== value) { fromScroll.current = true; onChange(m) }
    }, 90)
  }

  return (
    <div className="relative select-none" style={{ height: rows * ROW }}>
      {/* Selection band */}
      <div className="pointer-events-none absolute inset-x-3 rounded-[10px] border" style={{ top: pad, height: ROW, background: cyan(0.12), borderColor: cyan(0.35) }} />
      <div ref={ref} onScroll={onScroll} tabIndex={0} role="spinbutton" aria-label="Run time in minutes"
        aria-valuemin={1} aria-valuemax={MAX_MINUTES} aria-valuenow={value} aria-valuetext={`${value} minutes`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); onChange(Math.max(1, value - 1)) }
          if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); onChange(Math.min(MAX_MINUTES, value + 1)) }
        }}
        className="no-scrollbar relative h-full snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-irrigation)]"
        style={{ paddingTop: pad, paddingBottom: pad, maskImage: 'linear-gradient(180deg, transparent, #000 30%, #000 70%, transparent)', WebkitMaskImage: 'linear-gradient(180deg, transparent, #000 30%, #000 70%, transparent)' }}>
        {Array.from({ length: MAX_MINUTES }, (_, k) => k + 1).map((m) => (
          <button key={m} type="button" tabIndex={-1} onClick={() => onChange(m)} aria-hidden
            className="flex w-full snap-center items-center justify-center gap-2 font-mono"
            style={{ height: ROW, fontSize: m === value ? 22 : 18, color: m === value ? 'var(--color-ink)' : 'var(--color-ink-faint)' }}>
            {m}{m === value && <span className="font-sans text-xs text-ink-dim">min</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Quick run: zones + times ──────────────────────────────────────────────
export interface PickZone { id: string; name: string }
export interface RunRow { zoneId: string; minutes: number }

/**
 * Pick how long to run one zone, optionally add more zones (each with its own
 * time, run one after another), then Start. Used in the Irrigation page's
 * pop-up and the card's hold panel.
 */
export function QuickRunPicker({ zones, first, firstRows, onStart, onSchedule, summary, initialAt, editId, compact = false }: {
  zones: PickZone[]
  first: RunRow
  /** Editing a scheduled run: its zones */
  firstRows?: RunRow[]
  onStart: (rows: RunRow[]) => void
  /** Start later (“Start at…”); without it the picker only starts now */
  onSchedule?: (rows: RunRow[], at: number) => void
  /** Rachio's runs and other scheduled quick runs, for the overlap check */
  summary?: IrrigationSummary
  /** Editing a scheduled run: its start time (opens on Start at…) */
  initialAt?: number
  editId?: string
  compact?: boolean
}) {
  const [rows, setRows] = useState<RunRow[]>(firstRows?.length ? firstRows : [first])
  const [later, setLater] = useState(initialAt !== undefined)
  const [at, setAt] = useState<number>(() => initialAt ?? defaultStart())
  const [sel, setSel] = useState(0)
  const [adding, setAdding] = useState(false)
  const name = (id: string) => zones.find((z) => z.id === id)?.name ?? 'Zone'
  const left = zones.filter((z) => !rows.some((r) => r.zoneId === z.id))
  const setMin = (m: number) => setRows((rs) => rs.map((r, k) => (k === sel ? { ...r, minutes: m } : r)))
  const total = rows.reduce((n, r) => n + r.minutes, 0)
  const cur = rows[sel] ?? rows[0]
  const multi = rows.length > 1

  return (
    <div className="flex flex-col gap-2.5">
      {/* The run: one row per zone; tap a row to set its time on the wheel */}
      {multi && (
        <ol className="flex flex-col gap-1" aria-label="Zones in this quick run">
          {rows.map((r, k) => (
            <li key={r.zoneId} className="flex items-center gap-1.5">
              <button type="button" onClick={() => setSel(k)} aria-pressed={k === sel}
                className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-[10px] border px-3 text-left text-[13px]"
                style={k === sel ? { background: cyan(0.12), borderColor: CYAN } : { background: 'var(--color-surface)', borderColor: 'var(--color-edge)' }}>
                <span className="font-mono text-[11px] text-ink-faint">{k + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{name(r.zoneId)}</span>
                <span className="font-mono text-xs" style={{ color: k === sel ? CYAN : 'var(--color-ink-dim)' }}>{r.minutes}m</span>
              </button>
              <button type="button" aria-label={`Remove ${name(r.zoneId)}`}
                onClick={() => { setRows((rs) => rs.filter((_, j) => j !== k)); setSel((s) => (s >= k ? Math.max(0, s - 1) : s)) }}
                className="flex h-10 w-9 shrink-0 items-center justify-center text-ink-faint hover:text-ink"><X size={16} /></button>
            </li>
          ))}
        </ol>
      )}

      {multi && <p className="-mb-1 text-xs text-ink-dim">Time for <span className="text-ink">{name(cur.zoneId)}</span></p>}
      <MinuteWheel value={cur.minutes} onChange={setMin} rows={compact ? 3 : 5} />
      <div className="grid grid-cols-5 gap-1.5">
        {SHORTCUTS.map((m) => (
          <button key={m} type="button" onClick={() => setMin(m)} aria-pressed={m === cur.minutes}
            className="flex min-h-9 items-center justify-center rounded-[10px] border font-mono text-[12.5px]"
            style={m === cur.minutes ? { background: cyan(0.18), borderColor: CYAN, color: CYAN } : { background: 'var(--color-surface)', borderColor: 'var(--color-edge)', color: 'var(--color-ink-dim)' }}>{m}</button>
        ))}
      </div>

      {/* Add another zone */}
      {adding ? (
        <div className="flex flex-col gap-1.5 rounded-xl border border-edge bg-surface p-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-medium text-ink-dim">Then run…</p>
            <button type="button" onClick={() => setAdding(false)} aria-label="Cancel adding a zone" className="flex h-8 w-9 items-center justify-center text-ink-faint hover:text-ink"><X size={15} /></button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {left.map((z) => (
              <button key={z.id} type="button"
                onClick={() => { setRows((rs) => [...rs, { zoneId: z.id, minutes: DEFAULT_MINUTES }]); setSel(rows.length); setAdding(false) }}
                className="flex min-h-10 items-center rounded-[10px] border border-edge bg-surface-raised px-3 text-[13px] font-medium active:scale-[0.97]">{z.name}</button>
            ))}
          </div>
        </div>
      ) : left.length > 0 && (
        <button type="button" onClick={() => setAdding(true)}
          className="flex min-h-10 items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-edge text-[13px] font-medium text-ink-dim hover:text-ink">
          <Plus size={15} />Add another zone
        </button>
      )}

      {onSchedule && (
        <>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Starts</p>
          <div role="radiogroup" aria-label="When to start" className="grid grid-cols-2 rounded-xl border border-edge bg-surface p-[3px]">
            {([false, true] as const).map((v) => (
              <button key={String(v)} type="button" role="radio" aria-checked={later === v} onClick={() => setLater(v)}
                className="flex min-h-10 items-center justify-center gap-1.5 rounded-[9px] text-[13.5px] font-medium transition-colors"
                style={later === v ? { background: 'var(--color-edge)', color: 'var(--color-ink)' } : { color: 'var(--color-ink-dim)' }}>
                {v ? <><Clock size={14} />Start at…</> : 'Now'}
              </button>
            ))}
          </div>
          {later && <StartAt value={at} onChange={setAt} summary={summary} minutes={total} editId={editId} />}
        </>
      )}

      {later && onSchedule ? (
        <button type="button" disabled={!startOk(at)} onClick={() => onSchedule(rows, at)}
          className="min-h-12 rounded-xl text-sm font-semibold text-bg active:scale-[0.98] disabled:opacity-40" style={{ background: CYAN }}>
          {editId ? 'Save' : 'Schedule'}{multi ? ` ${rows.length} zones` : ''} · {whenLabel(at)}
        </button>
      ) : (
        <button type="button" onClick={() => onStart(rows)} className="min-h-12 rounded-xl text-sm font-semibold text-bg active:scale-[0.98]" style={{ background: CYAN }}>
          {editId ? `Start now · ${total} min` : multi ? `Start ${rows.length} zones · ${total} min` : `Start ${compact ? '' : `${name(cur.zoneId)} `}· ${cur.minutes} min`}
        </button>
      )}
    </div>
  )
}

// ── Start at…: day + time ─────────────────────────────────────────────────
const AHEAD_DAYS = 14
const startOk = (t: number) => t >= Date.now() + MINUTE && t <= Date.now() + AHEAD_DAYS * 86_400_000

/** The next whole hour (at least 15 min away) */
function defaultStart() {
  const d = new Date(Date.now() + 15 * MINUTE)
  d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1)
  return d.getTime()
}
const minOfDay = (t: number) => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes() }
const withDay = (t: number, ymd: string) => { const [y, m, dd] = ymd.split('-').map(Number); const d = new Date(t); d.setFullYear(y, m - 1, dd); return d.getTime() }
const withMin = (t: number, min: number) => { const d = new Date(t); d.setHours(Math.floor(min / 60), min % 60, 0, 0); return d.getTime() }

/**
 * Day buttons (today + the next 4, a calendar for further out) and a time you can
 * type ("6a", "545p") or pick (hour, minute, AM / PM) — the calendar editor's
 * picker in the irrigation color. Warns when the run would overlap a Rachio run
 * or another scheduled quick run, with the nearest clear times one tap away.
 */
function StartAt({ value, onChange, summary, minutes, editId }: { value: number; onChange: (t: number) => void; summary?: IrrigationSummary; minutes: number; editId?: string }) {
  const [month, setMonth] = useState(false)
  const [typed, setTyped] = useState<string | null>(null)
  const today = dayKey(Date.now())
  const days = Array.from({ length: 5 }, (_, k) => { const d = new Date(); d.setDate(d.getDate() + k); return d })
  const picked = dayKey(value)
  const v = minOfDay(value), h24 = Math.floor(v / 60), mi = v % 60, pm = h24 >= 12
  const parsed = typed !== null && typed.trim() !== '' ? parseTime(typed) : null
  const bad = typed !== null && typed.trim() !== '' && parsed === null
  const past = value < Date.now() + MINUTE
  const tooFar = value > Date.now() + AHEAD_DAYS * 86_400_000
  const clash = summary && !past ? overlaps(summary, value, minutes, editId) : []
  const fix = summary && clash.length ? clearTimes(summary, value, minutes, editId) : null
  const chip = (on: boolean) => on
    ? { background: cyan(0.16), borderColor: CYAN, color: CYAN, fontWeight: 600 }
    : { background: 'var(--color-surface)', borderColor: 'var(--color-edge)', color: 'var(--color-ink)' }
  const cell = 'min-h-9 rounded-[9px] border font-mono text-[13px] transition-colors'
  const nearestHour = (h: number) => { const am = (h % 12) * 60 + mi, p = am + 720; return Math.abs(am - v) <= Math.abs(p - v) ? am : p }
  const range = (o: { start: number; end: number }) => `${timeOf(o.start).replace(/ [AP]M$/, (new Date(o.start).getHours() >= 12) === (new Date(o.end).getHours() >= 12) ? '' : '$&')}–${timeOf(o.end)}`

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Day">
        {days.map((d, k) => {
          const key = dayKey(d), on = key === picked
          return (
            <button key={key} type="button" aria-pressed={on} onClick={() => { setMonth(false); onChange(withDay(value, key)) }}
              className="flex min-h-11 flex-col items-center justify-center rounded-[10px] border px-2.5 text-[12.5px] leading-tight" style={chip(on)}>
              {k === 0 ? 'Today' : k === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' })}
              <span className="text-[11px] font-normal" style={{ color: on ? CYAN : 'var(--color-ink-faint)' }}>{k < 2 ? d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }) : d.getDate()}</span>
            </button>
          )
        })}
        {!days.some((d) => dayKey(d) === picked) && (
          <button type="button" aria-pressed onClick={() => setMonth((m) => !m)} className="flex min-h-11 flex-col items-center justify-center rounded-[10px] border px-2.5 text-[12.5px] leading-tight" style={chip(true)}>
            {new Date(value).toLocaleDateString('en-US', { weekday: 'short' })}<span className="text-[11px] font-normal">{new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </button>
        )}
        <button type="button" aria-label="Pick another date" aria-expanded={month} onClick={() => setMonth((m) => !m)}
          className="flex min-h-11 w-11 items-center justify-center rounded-[10px] border" style={chip(month)}><CalendarDays size={17} /></button>
      </div>
      {month && <MiniMonth value={picked} min={today} color={CYAN} onPick={(d) => { onChange(withDay(value, d)); setMonth(false) }} />}

      <div className="flex items-center gap-2.5">
        <input value={typed ?? minLabel(v)} aria-label={`Start time: ${minLabel(v)}. Type a time or pick one`} inputMode="text" autoComplete="off" spellCheck={false}
          onFocus={(e) => { const el = e.target; setTimeout(() => el.select(), 0) }}
          onChange={(e) => { setTyped(e.target.value); const m = parseTime(e.target.value); if (m !== null) onChange(withMin(value, m)) }}
          onBlur={() => setTyped(null)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() } }}
          className="h-11 w-[112px] rounded-[10px] border px-2 text-center font-mono text-[15px] text-ink outline-none"
          style={{ borderColor: bad ? AMBER_C : CYAN, background: 'var(--color-surface)' }} />
        <span className="min-w-0 flex-1 text-xs font-semibold" aria-live="polite"
          style={{ color: bad || past || tooFar ? AMBER_C : '#4fd18b' }}>
          {bad ? 'Not a time yet' : past ? 'That time has passed' : tooFar ? 'Up to 14 days ahead' : `${whenLabel(value)} · ${inLabel(value)}`}
        </span>
      </div>
      <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="Hour">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => {
          const on = (h24 % 12 || 12) === h
          return <button type="button" key={h} aria-pressed={on} onClick={() => { setTyped(null); onChange(withMin(value, nearestHour(h))) }} className={cell} style={chip(on)}>{h}</button>
        })}
      </div>
      <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="Minute">
        {[0, 10, 15, 20, 30, 45].map((m) => {
          const on = mi === m
          return <button type="button" key={m} aria-pressed={on} onClick={() => { setTyped(null); onChange(withMin(value, h24 * 60 + m)) }} className={cell} style={chip(on)}>:{String(m).padStart(2, '0')}</button>
        })}
      </div>
      <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="AM or PM">
        {(['AM', 'PM'] as const).map((x) => {
          const on = (x === 'PM') === pm
          return <button type="button" key={x} role="radio" aria-checked={on} onClick={() => { setTyped(null); if (!on) onChange(withMin(value, v + (x === 'PM' ? 720 : -720))) }} className={`${cell} font-sans font-semibold`} style={chip(on)}>{x}</button>
        })}
      </div>

      {clash.length > 0 && (
        <div role="status" className="flex flex-col gap-2 rounded-xl border px-3 py-2.5 text-[12.5px]" style={{ borderColor: AMBER_C, background: 'rgba(242,193,78,0.08)' }}>
          <p className="flex items-start gap-2"><TriangleAlert size={15} className="mt-px shrink-0" style={{ color: AMBER_C }} />
            <span>Runs into {clash.map((o) => <span key={o.start} className="font-semibold">{o.name} <span className="font-mono font-normal">{range(o)}</span></span>).reduce<ReactNode[]>((acc, el, k) => (k ? [...acc, ', ', el] : [el]), [])}. It would wait for it to finish.</span></p>
          {fix && (fix.after || fix.before) && (
            <div className="flex flex-wrap gap-1.5">
              {fix.before && <button type="button" onClick={() => { setTyped(null); onChange(fix.before!) }} className="min-h-9 rounded-[9px] border border-edge bg-surface px-3 font-medium">Start {whenLabel(fix.before)} <span className="text-ink-dim">(ends before)</span></button>}
              {fix.after && <button type="button" onClick={() => { setTyped(null); onChange(fix.after!) }} className="min-h-9 rounded-[9px] border border-edge bg-surface px-3 font-medium">Start {whenLabel(fix.after)} <span className="text-ink-dim">(after it)</span></button>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const AMBER_C = '#f2c14e'

/** Pop-up from the bottom of the screen, over a dimmed page (tap outside, X or Escape closes) */
export function QuickRunSheet({ title, subtitle, eyebrow = 'Quick run', onClose, children }: { title: string; subtitle?: string; eyebrow?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
  // On top of everything (the card has its own stacking), so render at the page root
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/55" />
      <div role="dialog" aria-label={`Quick run · ${title}`}
        className="sheet-up relative flex max-h-[92vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-2xl border-t border-edge bg-surface-raised px-5 pb-5 pt-3 shadow-[0_-12px_24px_rgba(0,0,0,0.35)]">
        <div className="h-1 w-9 shrink-0 self-center rounded-full bg-edge" />
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{eyebrow}</p>
            <p className="truncate font-display text-lg font-semibold">{title}</p>
            {subtitle && <p className="text-xs text-ink-dim">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-2 flex h-10 w-11 shrink-0 items-center justify-center text-ink-dim hover:text-ink"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  , document.body)
}
