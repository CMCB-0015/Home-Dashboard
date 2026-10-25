import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react'
import { useHome } from '../../lib/useHome'
import { categories } from '../../lib/categories'
import { clockTime, sameDay } from '../../lib/format'
import { Card } from '../Card'
import { Segmented } from '../Buttons'
import { EventSheet } from '../calendar/EventSheet'
import { addDays, dayStart, endOf, onDay, splitLocation, useEventsBetween, useHiddenCalendars } from '../calendar/calendarData'
import type { CalendarEvent, CalendarInfo } from '../../types'

const cfg = categories.calendar
const DAYS = 7
type View = 'week' | 'month'

function dayHeading(d: Date, today: Date) {
  const diff = Math.round((dayStart(d).getTime() - dayStart(today).getTime()) / 86_400_000)
  const name = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  if (diff === 0) return `Today · ${name}`
  if (diff === 1) return `Tomorrow · ${name}`
  return name
}

const byTime = (a: CalendarEvent, b: CalendarEvent) => (a.allDay === b.allDay ? Date.parse(a.start) - Date.parse(b.start) : a.allDay ? -1 : 1)

function EventRow({ e, now, onOpen }: { e: CalendarEvent; now: Date; onOpen: () => void }) {
  const start = new Date(e.start)
  const end = new Date(endOf(e))
  const happening = !e.allDay && start <= now && end > now
  const soon = !e.allDay && start > now && start.getTime() - now.getTime() < 3 * 3_600_000
  const minsAway = Math.round((start.getTime() - now.getTime()) / 60_000)
  const place = e.location ? splitLocation(e.location) : null
  return (
    <button onClick={onOpen} className="-mx-2 flex w-[calc(100%+1rem)] items-stretch gap-4 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-surface-raised active:bg-surface-raised">
      <div className="w-16 shrink-0 pt-0.5">
        <div className="font-mono text-[13px] text-ink-dim">{e.allDay ? 'All day' : clockTime(e.start, true)}</div>
        {e.end && !e.allDay && <div className="font-mono text-[11px] text-ink-faint">{clockTime(end.toISOString(), true)}</div>}
      </div>
      <span className="w-1 shrink-0 rounded-full" style={{ background: e.color }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{e.title}</p>
        <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-ink-dim">
          {e.calendar && <span className="shrink-0" style={{ color: e.color }}>{e.calendar}</span>}
          {e.calendar && place && <span className="shrink-0 text-ink-faint">·</span>}
          {place && <span className="truncate"><MapPin size={11} className="mr-0.5 inline -translate-y-px" />{place.place ?? place.address}</span>}
        </p>
      </div>
      {(happening || soon) && (
        <span className="self-center rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: cfg.dim, color: cfg.color }}>
          {happening ? 'Now' : minsAway < 60 ? `In ${minsAway}m` : `In ${Math.round(minsAway / 60)}h`}
        </span>
      )}
    </button>
  )
}

/** One chip per calendar: its color and name. Tap to hide or show it on this screen. */
function CalendarChips({ calendars, hidden, toggle }: { calendars: CalendarInfo[]; hidden: string[]; toggle: (n: string) => void }) {
  if (calendars.length < 2) return null
  return (
    <div className="status-bar -mx-5 mb-3 flex gap-2 overflow-x-auto px-5" role="group" aria-label="Calendars">
      {calendars.map((c) => {
        const off = hidden.includes(c.name)
        return (
          <button key={c.id} onClick={() => toggle(c.name)} aria-pressed={!off}
            className="flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors"
            style={{ borderColor: off ? 'var(--color-edge)' : c.color, background: off ? 'transparent' : `color-mix(in srgb, ${c.color} 14%, transparent)`, color: off ? 'var(--color-ink-faint)' : 'var(--color-ink)' }}>
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: off ? 'var(--color-edge)' : c.color }} />
            {c.name}
          </button>
        )
      })}
    </div>
  )
}

function WeekView({ now, show, open }: { now: Date; show: (e: CalendarEvent) => boolean; open: (e: CalendarEvent) => void }) {
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(dayStart(new Date()), i)), [])
  const [selected, setSelected] = useState(0)
  const { events } = useEventsBetween(days[0], addDays(days[0], DAYS))
  const visible = events.filter(show)
  const eventsOn = (d: Date) => visible.filter((e) => onDay(e, d)).sort(byTime)
  // Agenda: from the selected day forward, skipping events that already ended today
  const agenda = days.slice(selected).map((d) => ({
    day: d,
    items: eventsOn(d).filter((e) => !(sameDay(d, now) && !e.allDay && endOf(e) < now.getTime())),
  })).filter((g) => g.items.length)

  return (
    <>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const list = eventsOn(d)
          const active = i === selected
          return (
            <button key={i} onClick={() => setSelected(i)} aria-pressed={active}
              className="flex flex-col items-center rounded-xl py-2 transition-colors"
              style={active ? { background: cfg.dim } : undefined}>
              <span className="text-[10px] font-semibold uppercase" style={{ color: active ? cfg.color : 'var(--color-ink-faint)' }}>
                {d.toLocaleDateString('en-US', { weekday: 'short' })}
              </span>
              <span className={`font-mono text-lg ${active ? 'text-ink' : 'text-ink-dim'}`}>{d.getDate()}</span>
              <span className="flex h-1.5 gap-1">
                {list.slice(0, 3).map((e) => <span key={e.id} className="h-1 w-1 rounded-full" style={{ background: e.color }} />)}
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
        {agenda.length === 0 && <p className="py-8 text-center text-sm text-ink-faint">Nothing else on the calendar this week.</p>}
        {agenda.map((g) => (
          <div key={g.day.toDateString()} className="mt-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">{dayHeading(g.day, now)}</h3>
            <div>{g.items.map((e) => <EventRow key={e.id} e={e} now={now} onOpen={() => open(e)} />)}</div>
          </div>
        ))}
      </div>
    </>
  )
}

function MonthView({ now, show, open }: { now: Date; show: (e: CalendarEvent) => boolean; open: (e: CalendarEvent) => void }) {
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const [selected, setSelected] = useState<Date>(() => dayStart(now))
  // Six weeks from the Sunday on or before the 1st
  const gridStart = addDays(month, -month.getDay())
  const weeks = Math.ceil((month.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7)
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i))
  const gridEnd = addDays(gridStart, weeks * 7)
  const { events, loading, error } = useEventsBetween(gridStart, gridEnd)
  const visible = events.filter(show)
  const eventsOn = (d: Date) => visible.filter((e) => onDay(e, d)).sort(byTime)
  const go = (n: number) => {
    const m = new Date(month.getFullYear(), month.getMonth() + n, 1)
    setMonth(m)
    setSelected(m.getMonth() === now.getMonth() && m.getFullYear() === now.getFullYear() ? dayStart(now) : m)
  }
  const isThisMonth = month.getMonth() === now.getMonth() && month.getFullYear() === now.getFullYear()
  const dayList = eventsOn(selected)
  const navBtn = 'flex h-9 w-9 items-center justify-center rounded-full text-ink-dim hover:bg-surface-raised hover:text-ink'

  return (
    <>
      <div className="mb-2 flex items-center gap-1">
        <h3 className="font-display text-lg font-semibold">{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
        {loading && <span className="ml-2 text-xs text-ink-faint">Loading…</span>}
        {error && <span className="ml-2 truncate text-xs text-critical">{error}</span>}
        <span className="ml-auto" />
        {!isThisMonth && <button onClick={() => { setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelected(dayStart(now)) }} className="h-8 rounded-full border border-edge px-3 text-xs font-medium text-ink-dim hover:text-ink">Today</button>}
        <button onClick={() => go(-1)} aria-label="Previous month" className={navBtn}><ChevronLeft size={18} /></button>
        <button onClick={() => go(1)} aria-label="Next month" className={navBtn}><ChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-7 gap-px">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="pb-1 text-center text-[10px] font-semibold uppercase text-ink-faint">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const list = eventsOn(d)
          const inMonth = d.getMonth() === month.getMonth()
          const today = sameDay(d, now)
          const active = sameDay(d, selected)
          return (
            <button key={d.toDateString()} onClick={() => setSelected(d)} aria-pressed={active}
              aria-label={`${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}, ${list.length} event${list.length === 1 ? '' : 's'}`}
              className="flex min-h-[52px] min-w-0 flex-col sm:min-h-[64px] gap-[3px] rounded-lg p-1 text-left transition-colors hover:bg-surface-raised"
              style={{ background: active ? cfg.dim : undefined, opacity: inMonth ? 1 : 0.4 }}>
              <span className={`flex h-5 w-5 items-center justify-center self-start rounded-full font-mono text-[11px] ${today ? 'bg-calendar font-semibold text-bg' : active ? 'text-ink' : 'text-ink-dim'}`}>{d.getDate()}</span>
              {/* Phones: colored bars; wider screens: titles */}
              <span className="flex flex-wrap gap-[3px] px-0.5 sm:hidden">
                {list.slice(0, 4).map((e) => <span key={e.id} className={`h-1.5 rounded-full ${e.allDay ? 'w-full' : 'w-1.5'}`} style={{ background: e.color }} />)}
              </span>
              {list.slice(0, 2).map((e) => (
                <span key={e.id} className="hidden min-w-0 items-center gap-1 rounded-[4px] px-1 text-[10px] leading-[15px] sm:flex"
                  style={{ background: e.allDay ? `color-mix(in srgb, ${e.color} 22%, transparent)` : undefined }}>
                  {!e.allDay && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: e.color }} />}
                  <span className="truncate text-ink">{e.title}</span>
                </span>
              ))}
              {list.length > 2 && <span className="hidden px-1 text-[10px] text-ink-faint sm:inline">+{list.length - 2} more</span>}
            </button>
          )
        })}
      </div>
      <div className="mt-3 min-h-[120px] flex-1 overflow-y-auto border-t border-edge-soft pr-1 pt-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">{dayHeading(selected, now)}</h3>
        {dayList.length === 0
          ? <p className="py-4 text-sm text-ink-faint">Nothing on the calendar.</p>
          : dayList.map((e) => <EventRow key={e.id} e={e} now={now} onOpen={() => open(e)} />)}
      </div>
    </>
  )
}

/**
 * Calendar on page 2: a week strip with the agenda, or a month grid with the
 * picked day's events under it. Colors show which calendar each event is on
 * (chips at the top hide or show a calendar); tapping an event shows its
 * details, with the place on a Google map.
 */
export function CalendarCard() {
  const { data } = useHome()
  const [view, setView] = useState<View>(() => { try { return localStorage.getItem('panel-calendar-view') === 'month' ? 'month' : 'week' } catch { return 'week' } })
  const [openEvent, setOpenEvent] = useState<CalendarEvent | null>(null)
  const { hidden, toggle } = useHiddenCalendars()
  if (!data) return null
  const now = new Date()
  const calendars = data.calendars ?? []
  const show = (e: CalendarEvent) => !e.calendar || !hidden.includes(e.calendar)
  const pick = (v: View) => { setView(v); try { localStorage.setItem('panel-calendar-view', v) } catch { /* private mode */ } }

  return (
    <>
      <Card accent={cfg.color} title="Calendar" category="calendar" subtitle="Google Calendar" className="h-full" bodyClassName="flex min-h-0 flex-col"
        headerRight={<Segmented label="Calendar view" value={view} onChange={pick} color={cfg.color} dim={cfg.dim}
          options={[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />}>
        <CalendarChips calendars={calendars} hidden={hidden} toggle={toggle} />
        {view === 'week'
          ? <WeekView now={now} show={show} open={setOpenEvent} />
          : <MonthView now={now} show={show} open={setOpenEvent} />}
      </Card>
      {openEvent && <EventSheet e={openEvent} onClose={() => setOpenEvent(null)} />}
    </>
  )
}
