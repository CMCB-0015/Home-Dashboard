import { useMemo, useState } from 'react'
import { useHome } from '../../lib/useHome'
import { categories } from '../../lib/categories'
import { clockTime, sameDay } from '../../lib/format'
import { Card } from '../Card'
import type { CalendarEvent } from '../../types'

const cfg = categories.calendar
const DAYS = 7

function dayHeading(d: Date, today: Date) {
  const diff = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date(today).setHours(0, 0, 0, 0)) / 86_400_000)
  const name = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  if (diff === 0) return `Today · ${name}`
  if (diff === 1) return `Tomorrow · ${name}`
  return name
}

function EventRow({ e, now }: { e: CalendarEvent; now: Date }) {
  const start = new Date(e.start)
  const end = e.end ? new Date(e.end) : null
  const happening = !e.allDay && start <= now && (!end || end > now)
  const soon = !e.allDay && start > now && start.getTime() - now.getTime() < 3 * 3_600_000
  const minsAway = Math.round((start.getTime() - now.getTime()) / 60_000)
  return (
    <div className="flex items-stretch gap-4 py-2.5">
      <div className="w-16 shrink-0 pt-0.5">
        <div className="font-mono text-[13px] text-ink-dim">{e.allDay ? 'All day' : clockTime(e.start, true)}</div>
        {end && !e.allDay && <div className="font-mono text-[11px] text-ink-faint">{clockTime(e.end!, true)}</div>}
      </div>
      <span className="w-1 shrink-0 rounded-full" style={{ background: e.color }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{e.title}</p>
        {e.location && <p className="truncate text-xs text-ink-dim">{e.location}</p>}
      </div>
      {(happening || soon) && (
        <span className="self-center rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: cfg.dim, color: cfg.color }}>
          {happening ? 'Now' : minsAway < 60 ? `In ${minsAway}m` : `In ${Math.round(minsAway / 60)}h`}
        </span>
      )}
    </div>
  )
}

export function CalendarCard() {
  const { data } = useHome()
  const now = new Date()
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d }), [])
  const [selected, setSelected] = useState(0)
  if (!data) return null

  const events = [...data.calendar].sort((a, b) => a.start.localeCompare(b.start))
  const eventsOn = (d: Date) => events.filter((e) => sameDay(new Date(e.start), d))
  // Agenda: from the selected day forward, skipping events that already ended today
  const agenda = days.slice(selected).map((d) => ({
    day: d,
    items: eventsOn(d).filter((e) => !(sameDay(d, now) && !e.allDay && new Date(e.end ?? e.start) < now)),
  })).filter((g) => g.items.length)

  return (
    <Card accent={cfg.color} title="Calendar" subtitle="Google Calendar" className="h-full" bodyClassName="flex flex-col">
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const count = eventsOn(d).length
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
                {Array.from({ length: Math.min(count, 3) }).map((_, k) => (
                  <span key={k} className="h-1 w-1 rounded-full" style={{ background: active ? cfg.color : 'var(--color-ink-faint)' }} />
                ))}
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
            <div className="divide-y divide-edge-soft">
              {g.items.map((e) => <EventRow key={e.id} e={e} now={now} />)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
