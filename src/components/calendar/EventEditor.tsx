import { useEffect, useMemo, useRef, useState } from 'react'
import { AlignLeft, ChevronLeft, ChevronRight, Clock, MapPin, Repeat, X, AlertTriangle } from 'lucide-react'
import { Switch } from '../Sheet'
import { sameDay } from '../../lib/format'
import { addDays, dayStart, endOf } from './calendarData'
import type { CalendarEvent, CalendarInfo } from '../../types'

/** What the editor holds (times as minutes after midnight, dates as YYYY-MM-DD) */
export interface Draft {
  title: string
  calendarId: string
  allDay: boolean
  date: string
  /** All-day: the last day (inclusive) */
  endDate: string
  startMin: number
  durationMin: number
  location: string
  description: string
}

const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fromYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const dateLabel = (s: string) => fromYmd(s).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
export function minLabel(min: number, withAmPm = true) {
  const m = ((min % 1440) + 1440) % 1440
  const h = Math.floor(m / 60), mm = m % 60
  const t = `${h % 12 === 0 ? 12 : h % 12}:${pad(mm)}`
  return withAmPm ? `${t} ${h < 12 ? 'AM' : 'PM'}` : t
}
const lengthLabel = (min: number) => min < 60 ? `${min} min` : min % 60 === 0 ? `${min / 60} h` : min % 30 === 0 ? `${min / 60} h` : `${Math.floor(min / 60)} h ${min % 60} m`

/** Defaults for a new event on a day: the next whole hour today, otherwise 9 AM, for an hour, on Family */
export function newDraft(day: Date, calendars: CalendarInfo[]): Draft {
  const now = new Date()
  const start = sameDay(day, now) ? Math.min(23 * 60, (now.getHours() + 1) * 60) : 9 * 60
  const cal = calendars.find((c) => /family/i.test(c.name)) ?? calendars[0]
  return { title: '', calendarId: cal?.id ?? '', allDay: false, date: ymd(day), endDate: ymd(day), startMin: start, durationMin: 60, location: '', description: '' }
}

/** An existing event, ready to edit */
export function draftFrom(e: CalendarEvent): Draft {
  const s = new Date(e.start)
  const end = new Date(endOf(e))
  if (e.allDay) {
    const last = addDays(dayStart(end), -1)
    return { title: e.title, calendarId: e.calendarId ?? '', allDay: true, date: ymd(s), endDate: ymd(last < s ? s : last), startMin: 9 * 60, durationMin: 60, location: e.location ?? '', description: e.description ?? '' }
  }
  return {
    title: e.title, calendarId: e.calendarId ?? '', allDay: false, date: ymd(s), endDate: ymd(s),
    startMin: s.getHours() * 60 + s.getMinutes(), durationMin: Math.max(5, Math.round((end.getTime() - s.getTime()) / 60_000)),
    location: e.location ?? '', description: e.description ?? '',
  }
}

/** What the server needs */
export function toRequest(d: Draft) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (d.allDay) return { title: d.title, allDay: true, start: d.date, end: d.endDate < d.date ? d.date : d.endDate, location: d.location || null, description: d.description || null, timeZone }
  const start = fromYmd(d.date); start.setMinutes(d.startMin)
  const end = new Date(start.getTime() + d.durationMin * 60_000)
  return { title: d.title, allDay: false, start: start.toISOString(), end: end.toISOString(), location: d.location || null, description: d.description || null, timeZone }
}

/** How the event will look in the list while it saves */
export function previewEvent(d: Draft, cal: CalendarInfo | undefined, id: string, base?: CalendarEvent): CalendarEvent {
  const r = toRequest(d)
  return {
    ...(base ?? {}),
    id, title: d.title.trim() || '(No title)', location: d.location.trim() || null, description: d.description.trim() || null,
    start: d.allDay ? `${r.start}T00:00:00` : r.start,
    end: d.allDay ? `${ymd(addDays(fromYmd(r.end), 1))}T00:00:00` : r.end,
    allDay: d.allDay, color: cal?.color ?? '#6fa8ff', calendar: cal?.name, calendarId: cal?.id, saving: true,
  }
}

const START_TIMES = Array.from({ length: 48 }, (_, i) => i * 30)
const LENGTHS = [30, 60, 90, 120, 180, 240]

/** Small month grid for picking a day */
function MiniMonth({ value, onPick }: { value: string; onPick: (d: string) => void }) {
  const picked = fromYmd(value)
  const [month, setMonth] = useState(() => new Date(picked.getFullYear(), picked.getMonth(), 1))
  const start = addDays(month, -month.getDay())
  const weeks = Math.ceil((month.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7)
  const today = new Date()
  const nav = 'flex h-10 w-10 items-center justify-center rounded-full text-ink-dim hover:bg-surface hover:text-ink'
  return (
    <div className="rounded-2xl border border-edge bg-surface p-2">
      <div className="mb-1 flex items-center">
        <button type="button" className={nav} aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
        <span className="flex-1 text-center font-display text-sm font-semibold">{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
        <button type="button" className={nav} aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="text-[10px] font-semibold text-ink-faint">{d}</span>)}
        {Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i)).map((d) => {
          const on = sameDay(d, picked), inMonth = d.getMonth() === month.getMonth(), isToday = sameDay(d, today)
          return (
            <button type="button" key={d.toDateString()} onClick={() => onPick(ymd(d))} aria-pressed={on}
              aria-label={d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              className="flex h-10 items-center justify-center rounded-lg font-mono text-[13px] transition-colors hover:bg-surface-raised"
              style={{ background: on ? 'var(--color-calendar)' : undefined, color: on ? 'var(--color-bg)' : isToday ? 'var(--color-calendar)' : inMonth ? 'var(--color-ink)' : 'var(--color-ink-faint)', fontWeight: on || isToday ? 600 : 400 }}>
              {d.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** A row of chips that slides sideways, with the chosen one scrolled into view */
function ChipRow<T extends number>({ label, items, value, onPick, text }: { label: string; items: T[]; value: T; onPick: (v: T) => void; text: (v: T) => string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (el && ref.current) ref.current.scrollLeft = Math.max(0, el.offsetLeft - 60)
  }, [])
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">{label}</span>
      <div ref={ref} role="group" aria-label={label} className="status-bar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        {items.map((v) => {
          const on = v === value
          return (
            <button type="button" key={v} onClick={() => onPick(v)} aria-pressed={on}
              className="h-10 shrink-0 rounded-[10px] border px-3 font-mono text-[13px] transition-colors"
              style={{ background: on ? 'var(--color-calendar)' : 'var(--color-surface)', borderColor: on ? 'var(--color-calendar)' : '#33404c', color: on ? 'var(--color-bg)' : 'var(--color-ink)', fontWeight: on ? 600 : 400 }}>
              {text(v)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

type Picker = 'date' | 'end-date' | 'time' | null

/**
 * The add / edit panel: title, which calendar (Family first), all day,
 * day and time (quick chips), place and notes. Save is one tap.
 */
export function EventEditor({ mode, initial, calendars, repeating, error, onSave, onClose }: {
  mode: 'add' | 'edit'
  initial: Draft
  /** Calendars Panel can write to */
  calendars: CalendarInfo[]
  /** Editing one occurrence of a repeating event */
  repeating?: boolean
  /** Why the last save didn't go through (the panel reopens with it) */
  error?: string | null
  onSave: (d: Draft) => void
  onClose: () => void
}) {
  const [d, setD] = useState<Draft>(initial)
  const [picker, setPicker] = useState<Picker>(null)
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }))
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    if (mode === 'add' && !error) setTimeout(() => titleRef.current?.focus(), 250)
    return () => window.removeEventListener('keydown', key)
  }, [onClose, mode, error])

  const lengths = useMemo(() => (LENGTHS.includes(d.durationMin) ? LENGTHS : [...LENGTHS, d.durationMin].sort((a, b) => a - b)), [d.durationMin])
  const starts = useMemo(() => (START_TIMES.includes(d.startMin) ? START_TIMES : [...START_TIMES, d.startMin].sort((a, b) => a - b)), [d.startMin])
  const endMin = d.startMin + d.durationMin
  const field = 'flex h-10 items-center rounded-[10px] border px-3 text-sm transition-colors'
  const fieldStyle = (on: boolean) => ({ borderColor: on ? 'var(--color-calendar)' : '#33404c', background: 'var(--color-surface)', boxShadow: on ? '0 0 0 3px rgba(111,168,255,.2)' : undefined })
  const toggle = (p: Picker) => setPicker((x) => (x === p ? null : p))
  const cals = calendars

  return (
    <div className="sheet-backdrop fixed inset-0 z-40 flex items-end justify-center bg-black/55" onClick={onClose}>
      <form role="dialog" aria-modal aria-label={mode === 'add' ? 'New event' : 'Edit event'}
        onSubmit={(e) => { e.preventDefault(); onSave(d) }}
        className="sheet-up flex max-h-[94vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-3xl border border-b-0 border-edge bg-surface-raised pb-6 shadow-[0_-16px_40px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}>
        <div className="mt-3 h-1 w-11 shrink-0 self-center rounded-full bg-[#3a4652]" />
        <div className="flex items-center gap-2 px-2 pr-4 pt-1">
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full text-ink-dim hover:bg-surface hover:text-ink"><X size={20} /></button>
          <h2 className="flex-1 font-display text-base font-semibold">{mode === 'add' ? 'New event' : 'Edit event'}</h2>
          <button type="submit" className="h-10 rounded-full bg-calendar px-6 text-sm font-semibold text-bg hover:opacity-90">Save</button>
        </div>

        <div className="flex flex-col gap-3.5 px-5 pt-1">
          {error && (
            <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-[#f0b24a] bg-[#2a2418] px-3.5 py-2.5 text-sm">
              <AlertTriangle size={17} className="mt-0.5 shrink-0 text-[#f0b24a]" />
              <span className="flex-1">{error}<span className="block text-[#c9b48c]">Everything you typed is still here — Save tries again.</span></span>
            </div>
          )}
          <input ref={titleRef} value={d.title} onChange={(e) => set({ title: e.target.value })} aria-label="Title" placeholder="Add title" maxLength={500}
            className="w-full border-0 border-b border-[#33404c] bg-transparent pb-2.5 pt-1.5 font-display text-[22px] font-semibold text-ink outline-none placeholder:text-ink-dim focus:border-calendar" />

          {cals.length > 0 && (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Calendar">
              {cals.map((c) => {
                const on = c.id === d.calendarId
                return (
                  <button type="button" key={c.id} role="radio" aria-checked={on} onClick={() => set({ calendarId: c.id })}
                    className="flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors"
                    style={{ borderColor: on ? c.color : '#33404c', background: on ? `color-mix(in srgb, ${c.color} 16%, transparent)` : 'transparent' }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.name}
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex flex-col border-t border-edge">
            <div className="flex min-h-[52px] items-center gap-3.5 border-b border-edge">
              <Clock size={19} className="shrink-0 text-ink-dim" />
              <span className="flex-1 text-sm">All day</span>
              <Switch on={d.allDay} onChange={(v) => { set({ allDay: v, endDate: d.date }); setPicker(null) }} label="All day" color="var(--color-calendar)" />
            </div>

            <div className="flex min-h-[56px] flex-wrap items-center gap-2 border-b border-edge py-2 pl-[33px]">
              <button type="button" className={field} style={fieldStyle(picker === 'date')} onClick={() => toggle('date')} aria-expanded={picker === 'date'}>
                {dateLabel(d.date)}
              </button>
              <span className="flex-1" />
              {d.allDay ? (
                <>
                  <span className="text-xs text-ink-dim">through</span>
                  <button type="button" className={field} style={fieldStyle(picker === 'end-date')} onClick={() => toggle('end-date')} aria-expanded={picker === 'end-date'}>
                    {dateLabel(d.endDate < d.date ? d.date : d.endDate)}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className={`${field} font-mono text-[13px]`} style={fieldStyle(picker === 'time')} onClick={() => toggle('time')} aria-expanded={picker === 'time'} aria-label={`Starts ${minLabel(d.startMin)}`}>
                    {minLabel(d.startMin)}
                  </button>
                  <span className="text-ink-dim">–</span>
                  <button type="button" className={`${field} font-mono text-[13px]`} style={fieldStyle(false)} onClick={() => toggle('time')} aria-label={`Ends ${minLabel(endMin)}`}>
                    {minLabel(endMin)}{endMin >= 1440 && <span className="ml-1 font-body text-[11px] text-ink-dim">+1 day</span>}
                  </button>
                </>
              )}
            </div>

            {picker === 'date' && <div className="border-b border-edge py-3 pl-[33px]"><MiniMonth value={d.date} onPick={(v) => { set({ date: v, endDate: d.endDate < v ? v : d.endDate }); setPicker(null) }} /></div>}
            {picker === 'end-date' && <div className="border-b border-edge py-3 pl-[33px]"><MiniMonth value={d.endDate < d.date ? d.date : d.endDate} onPick={(v) => { set({ endDate: v < d.date ? d.date : v }); setPicker(null) }} /></div>}
            {picker === 'time' && !d.allDay && (
              <div className="flex flex-col gap-3 border-b border-edge py-3 pl-[33px]">
                <ChipRow label="Start" items={starts} value={d.startMin} onPick={(v) => set({ startMin: v })} text={(v) => { const t = minLabel(v); return t.replace(' AM', 'a').replace(' PM', 'p') }} />
                <ChipRow label="Length" items={lengths} value={d.durationMin} onPick={(v) => set({ durationMin: v })} text={lengthLabel} />
              </div>
            )}

            {repeating && (
              <div className="flex min-h-[52px] items-center gap-3.5 border-b border-edge">
                <Repeat size={19} className="shrink-0 text-ink-dim" />
                <span className="flex-1 text-sm">Repeating event</span>
                <span className="text-xs text-ink-dim">change the pattern in Google Calendar</span>
              </div>
            )}

            <label className="flex min-h-[52px] items-center gap-3.5 border-b border-edge">
              <MapPin size={19} className="shrink-0 text-ink-dim" />
              <input value={d.location} onChange={(e) => set({ location: e.target.value })} placeholder="Add place or address" aria-label="Location" maxLength={1000}
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none placeholder:text-ink-dim" />
            </label>
            <label className="flex items-start gap-3.5 border-b border-edge py-3.5">
              <AlignLeft size={19} className="mt-0.5 shrink-0 text-ink-dim" />
              <textarea value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="Add notes" aria-label="Notes" rows={3} maxLength={8000}
                className="min-w-0 flex-1 resize-none border-0 bg-transparent text-sm text-ink outline-none placeholder:text-ink-dim" />
            </label>
          </div>
        </div>
      </form>
    </div>
  )
}

/** "Which ones?" for a repeating event. Picking an option does it — no second confirm. */
export function RepeatChoice({ action, event, onPick, onCancel }: {
  action: 'delete' | 'save'
  event: CalendarEvent
  onPick: (scope: 'one' | 'following' | 'all') => void
  onCancel: () => void
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onCancel])
  const opt = `h-[52px] w-full rounded-xl border border-[#33404c] bg-surface text-[15px] font-medium hover:bg-[#1f2830] ${action === 'delete' ? 'text-[#ff6b5e]' : 'text-calendar'}`
  const when = new Date(event.start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  return (
    <div className="sheet-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/55" onClick={onCancel}>
      <div role="dialog" aria-modal aria-label={action === 'delete' ? 'Delete repeating event' : 'Save repeating event'}
        className="sheet-up flex w-full max-w-lg flex-col gap-2 rounded-t-3xl border border-b-0 border-edge bg-surface-raised px-4 pb-6 pt-3 shadow-[0_-16px_40px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}>
        <div className="h-1 w-11 shrink-0 self-center rounded-full bg-[#3a4652]" />
        <div className="px-1 pb-2 pt-2">
          <h2 className="font-display text-[17px] font-semibold">{action === 'delete' ? 'Delete repeating event' : 'Save repeating event'}</h2>
          <p className="text-[13px] text-ink-dim">{event.title} · {when}</p>
        </div>
        <button type="button" className={opt} onClick={() => onPick('one')}>This event</button>
        {action === 'delete'
          ? <button type="button" className={opt} onClick={() => onPick('following')}>This and following events</button>
          : <button type="button" className={opt} onClick={() => onPick('all')}>All events</button>}
        <button type="button" className="h-[52px] w-full rounded-xl text-[15px] font-medium text-ink hover:bg-surface" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
