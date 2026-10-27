import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, MapPin, Plus, Trash2, Undo2 } from 'lucide-react'
import { useHome } from '../../lib/useHome'
import { categories } from '../../lib/categories'
import { clockTime, sameDay } from '../../lib/format'
import { Card } from '../Card'
import { Segmented } from '../Buttons'
import { EventSheet } from '../calendar/EventSheet'
import { addDays, dayStart, endOf, onDay, splitLocation, useEventsBetween, useHiddenCalendars } from '../calendar/calendarData'
import { EventEditor, RepeatChoice, draftFrom, newDraft, previewEvent, toRequest, type Draft } from '../calendar/EventEditor'
import { LinkGoogleSheet } from '../calendar/LinkGoogleSheet'
import { addSaving, applyEdits, dropSaving, editsNow, forgetLater, hide, setPendingDelete, unhide, useCalendarEdits, type PendingDelete } from '../calendar/calendarEdits'
import { useLongPress } from '../../lib/useLongPress'
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
      {e.saving && (
        <span className="flex items-center gap-1.5 self-center rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: cfg.dim, color: cfg.color }}>
          <span className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />Saving
        </span>
      )}
      {!e.saving && (happening || soon) && (
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

/**
 * A day you can tap (pick it) or press and hold (add an event on it). While
 * held, a ring fills around the day; when it completes the add panel opens.
 */
function HoldDay({ onTap, onHold, className, style, label, pressed, children }: {
  onTap: () => void; onHold: () => void; className: string; style?: CSSProperties; label?: string; pressed: boolean; children: ReactNode
}) {
  const [holding, setHolding] = useState(false)
  const lp = useLongPress(onTap, () => { setHolding(false); onHold() }, 450)
  const stop = () => setHolding(false)
  return (
    <button {...lp} aria-pressed={pressed} aria-label={label} className={`relative ${className}`} style={{ ...style, touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none' }}
      onPointerDown={() => { setHolding(true); lp.onPointerDown() }}
      onPointerUp={() => { stop(); lp.onPointerUp() }} onPointerLeave={() => { stop(); lp.onPointerLeave() }} onPointerCancel={() => { stop(); lp.onPointerCancel() }}>
      {children}
      {holding && <span className="hold-ring" aria-hidden />}
    </button>
  )
}

type ViewProps = { now: Date; show: (e: CalendarEvent) => boolean; open: (e: CalendarEvent) => void; holdDay: (d: Date) => void; onPick: (d: Date) => void }

function WeekView({ now, show, open, holdDay, onPick }: ViewProps) {
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(dayStart(new Date()), i)), [])
  const [selected, setSelected] = useState(0)
  const { events } = useEventsBetween(days[0], addDays(days[0], DAYS))
  const edits = useCalendarEdits()
  const visible = applyEdits(events, edits).filter(show)
  useEffect(() => { onPick(days[selected]) }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps
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
            <HoldDay key={i} onTap={() => setSelected(i)} onHold={() => { setSelected(i); holdDay(d) }} pressed={active}
              label={`${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} — hold to add an event`}
              className="flex flex-col items-center rounded-xl py-2 transition-colors"
              style={active ? { background: cfg.dim } : undefined}>
              <span className="text-[10px] font-semibold uppercase" style={{ color: active ? cfg.color : 'var(--color-ink-faint)' }}>
                {d.toLocaleDateString('en-US', { weekday: 'short' })}
              </span>
              <span className={`font-mono text-lg ${active ? 'text-ink' : 'text-ink-dim'}`}>{d.getDate()}</span>
              <span className="flex h-1.5 gap-1">
                {list.slice(0, 3).map((e) => <span key={e.id} className="h-1 w-1 rounded-full" style={{ background: e.color }} />)}
              </span>
            </HoldDay>
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

function MonthView({ now, show, open, holdDay, onPick }: ViewProps) {
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const [selected, setSelected] = useState<Date>(() => dayStart(now))
  // Six weeks from the Sunday on or before the 1st
  const gridStart = addDays(month, -month.getDay())
  const weeks = Math.ceil((month.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7)
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i))
  const gridEnd = addDays(gridStart, weeks * 7)
  const { events, loading, error } = useEventsBetween(gridStart, gridEnd)
  const edits = useCalendarEdits()
  const visible = applyEdits(events, edits).filter(show)
  useEffect(() => { onPick(selected) }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps
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
            <HoldDay key={d.toDateString()} onTap={() => setSelected(d)} onHold={() => { setSelected(d); holdDay(d) }} pressed={active}
              label={`${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}, ${list.length} event${list.length === 1 ? '' : 's'} — hold to add an event`}
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
            </HoldDay>
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

type EditorState = { mode: 'add' | 'edit'; draft: Draft; event?: CalendarEvent; error?: string | null }
type Choice = { action: 'delete' | 'save'; event: CalendarEvent; draft?: Draft }

async function post(path: string, body: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) return { ok: true }
    const j = await res.json().catch(() => ({}))
    return { ok: false, error: res.status === 401 ? 'Signed out — unlock the dashboard and try again' : j.error ?? 'That didn’t go through' }
  } catch {
    return { ok: false, error: 'Couldn’t reach the dashboard server — not saved yet' }
  }
}

const keyOf = (e: CalendarEvent) => ({ calendarId: e.calendarId, uid: e.uid ?? null, recurrenceId: e.recurrenceId ?? null })

/** The 5-second Undo bar after a delete; the delete only goes to Google when it runs out */
function UndoBar({ p, onUndo }: { p: PendingDelete; onUndo: () => void }) {
  return (
    <div role="status" className="absolute inset-x-3 bottom-3 z-[3] flex min-h-[56px] items-center gap-2.5 overflow-hidden rounded-xl border border-[#33404c] bg-[#222c36] pl-4 pr-1.5 text-[13px] shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
      <Trash2 size={16} className="shrink-0 text-ink-dim" />
      <span className="min-w-0 flex-1 truncate">Deleted “{p.event.title}”{p.event.repeating ? (p.scope === 'following' ? ' · this and following' : ' · this event') : ''}</span>
      <button onClick={onUndo} className="flex h-11 items-center gap-1.5 rounded-[10px] px-3.5 text-sm font-semibold text-calendar hover:bg-[#2a3540]"><Undo2 size={16} />Undo</button>
      <span key={p.sendAt} className="undo-progress absolute bottom-0 left-0 h-[3px] w-full bg-calendar" />
    </div>
  )
}

/**
 * Calendar on page 2: a week strip with the agenda, or a month grid with the
 * picked day's events under it. Colors show which calendar each event is on
 * (chips at the top hide or show a calendar); tapping an event shows its
 * details, with the place on a Google map.
 *
 * Adding (the + button, or press and hold a day), editing and deleting go to
 * Google through Panel's own link (one-time setup the first time).
 */
export function CalendarCard() {
  const { data, send } = useHome()
  const [view, setView] = useState<View>(() => { try { return localStorage.getItem('panel-calendar-view') === 'month' ? 'month' : 'week' } catch { return 'week' } })
  const [openEvent, setOpenEvent] = useState<CalendarEvent | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [choice, setChoice] = useState<Choice | null>(null)
  const [link, setLink] = useState<{ then: () => void } | null>(null)
  const pickedDay = useRef<Date>(dayStart(new Date()))
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const edits = useCalendarEdits()
  const { hidden, toggle } = useHiddenCalendars()

  const calendars = data?.calendars ?? []
  const cw = data?.calendarWrite
  // Calendars Panel can add to and change (until linked, everything but holidays and birthdays)
  const writableCals = cw?.linked ? calendars.filter((c) => c.writable) : calendars.filter((c) => !/holiday|birthday/i.test(c.name))
  const canChange = (e: CalendarEvent) => !!e.calendarId && !e.saving && writableCals.some((c) => c.id === e.calendarId)

  /** Link Google first if it isn't yet, then carry on */
  const linked = (then: () => void) => { if (cw && !cw.linked) setLink({ then }); else then() }

  // ── Delete with Undo ──
  const commit = useCallback(async (p: PendingDelete) => {
    if (deleteTimer.current) { clearTimeout(deleteTimer.current); deleteTimer.current = null }
    setPendingDelete(null)
    const ok = await send('calendar/delete', { key: keyOf(p.event), scope: p.scope })
    if (ok) forgetLater(p.event); else unhide(p.event)
  }, [send])
  const beginDelete = (e: CalendarEvent, scope: 'one' | 'following') => {
    const before = editsNow().pendingDelete
    if (before) void commit(before)
    hide(e, scope)
    const p: PendingDelete = { event: e, scope, sendAt: Date.now() + 5000 }
    setPendingDelete(p)
    deleteTimer.current = setTimeout(() => void commit(p), 5000)
  }
  const undo = () => {
    const p = editsNow().pendingDelete
    if (!p) return
    if (deleteTimer.current) { clearTimeout(deleteTimer.current); deleteTimer.current = null }
    setPendingDelete(null)
    unhide(p.event)
  }
  // Leaving the page sends a waiting delete right away
  useEffect(() => () => { const p = editsNow().pendingDelete; if (p) void commit(p) }, [commit])

  // ── Save ──
  async function doSave(state: EditorState, d: Draft, scope: 'one' | 'all') {
    setEditor(null)
    const cal = calendars.find((c) => c.id === d.calendarId)
    const temp = `saving-${Date.now()}`
    const ev = state.event
    addSaving(previewEvent(d, cal, temp, ev), ev?.id)
    const r = state.mode === 'add'
      ? await post('calendar/create', { calendarId: d.calendarId, ...toRequest(d) })
      : await post('calendar/update', { key: keyOf(ev!), scope, moveTo: d.calendarId !== ev!.calendarId ? d.calendarId : undefined, ...toRequest(d) })
    if (r.ok) {
      // The server's list has it now; give the live update a moment to arrive
      setTimeout(() => dropSaving(temp, ev?.id), 1500)
    } else {
      dropSaving(temp, ev?.id)
      setEditor({ ...state, draft: d, error: r.error })
    }
  }
  const save = (d: Draft) => {
    if (!editor) return
    if (editor.mode === 'edit' && editor.event?.repeating) setChoice({ action: 'save', event: editor.event, draft: d })
    else void doSave(editor, d, 'one')
  }

  const startAdd = (day: Date) => linked(() => setEditor({ mode: 'add', draft: newDraft(day, writableCals) }))
  const startEdit = (e: CalendarEvent) => linked(() => { setOpenEvent(null); setEditor({ mode: 'edit', draft: draftFrom(e), event: e }) })
  const startDelete = (e: CalendarEvent) => linked(() => {
    setOpenEvent(null)
    if (e.repeating) setChoice({ action: 'delete', event: e })
    else beginDelete(e, 'one')
  })

  if (!data) return null
  const now = new Date()
  const show = (e: CalendarEvent) => !e.calendar || !hidden.includes(e.calendar)
  const pick = (v: View) => { setView(v); try { localStorage.setItem('panel-calendar-view', v) } catch { /* private mode */ } }
  const onPick = (d: Date) => { pickedDay.current = d }
  const viewProps = { now, show, open: setOpenEvent, holdDay: startAdd, onPick }

  return (
    <>
      <Card accent={cfg.color} title="Calendar" category="calendar" subtitle="Google Calendar" className="h-full" bodyClassName="flex min-h-0 flex-col"
        overlay={edits.pendingDelete ? <UndoBar p={edits.pendingDelete} onUndo={undo} /> : undefined}
        headerRight={
          <div className="flex items-center gap-2">
            <Segmented label="Calendar view" value={view} onChange={pick} color={cfg.color} dim={cfg.dim}
              options={[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
            <button onClick={() => startAdd(pickedDay.current)} aria-label="Add event"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-calendar text-bg transition-opacity hover:opacity-90">
              <Plus size={19} strokeWidth={2.6} />
            </button>
          </div>
        }>
        <CalendarChips calendars={calendars} hidden={hidden} toggle={toggle} />
        {view === 'week' ? <WeekView {...viewProps} /> : <MonthView {...viewProps} />}
      </Card>
      {openEvent && (
        <EventSheet e={openEvent} onClose={() => setOpenEvent(null)}
          onEdit={canChange(openEvent) ? () => startEdit(openEvent) : undefined}
          onDelete={canChange(openEvent) ? () => startDelete(openEvent) : undefined} />
      )}
      {editor && (
        <EventEditor key={`${editor.mode}-${editor.event?.id ?? 'new'}-${editor.error ?? ''}`} mode={editor.mode} initial={editor.draft} error={editor.error}
          // A repeating event stays on its own calendar (Google can't move one occurrence)
          calendars={editor.event?.repeating ? writableCals.filter((c) => c.id === editor.event!.calendarId) : writableCals}
          repeating={editor.event?.repeating} onSave={save} onClose={() => setEditor(null)} />
      )}
      {choice && (
        <RepeatChoice action={choice.action} event={choice.event} onCancel={() => setChoice(null)}
          onPick={(scope) => {
            const c = choice
            setChoice(null)
            if (c.action === 'delete') beginDelete(c.event, scope === 'following' ? 'following' : 'one')
            else if (editor && c.draft) void doSave(editor, c.draft, scope === 'all' ? 'all' : 'one')
          }} />
      )}
      {link && cw && <LinkGoogleSheet status={cw} onClose={() => setLink(null)} onLinked={() => { const t = link.then; setLink(null); t() }} />}
    </>
  )
}
