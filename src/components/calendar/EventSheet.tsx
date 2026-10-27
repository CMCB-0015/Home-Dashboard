import { Fragment } from 'react'
import { Clock, MapPin, Navigation, ExternalLink, AlignLeft, Pencil, Trash2, Repeat } from 'lucide-react'
import { Sheet } from '../Sheet'
import { clockTime } from '../../lib/format'
import { endOf, googleMapsDirections, googleMapsEmbed, googleMapsSearch, splitLocation } from './calendarData'
import type { CalendarEvent } from '../../types'

const dateText = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

function whenText(e: CalendarEvent): string {
  const s = new Date(e.start), end = new Date(endOf(e))
  if (e.allDay) {
    const last = new Date(end.getTime() - 1)
    return last.toDateString() === s.toDateString() ? `${dateText(s)} · All day` : `${dateText(s)} – ${dateText(last)}`
  }
  const sameDay = s.toDateString() === end.toDateString()
  return sameDay ? `${dateText(s)} · ${clockTime(e.start)} – ${clockTime(end.toISOString())}`
    : `${dateText(s)} ${clockTime(e.start)} – ${dateText(end)} ${clockTime(end.toISOString())}`
}

/** Plain text with web addresses turned into links */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g)
  return <>{parts.map((p, i) => (/^https?:\/\//.test(p)
    ? <a key={i} href={p} target="_blank" rel="noreferrer" className="break-all text-calendar underline">{p}</a>
    : <Fragment key={i}>{p}</Fragment>))}</>
}

/**
 * What tapping an event shows: which calendar, when, the place with a Google
 * map (and buttons to open it or get directions in Google Maps), and the notes.
 */
export function EventSheet({ e, onClose, onEdit, onDelete }: { e: CalendarEvent; onClose: () => void; onEdit?: () => void; onDelete?: () => void }) {
  const loc = e.location ? splitLocation(e.location) : null
  const row = 'flex items-start gap-3 text-[15px]'
  const btn = 'flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#252e38] px-4 text-sm font-medium hover:bg-[#2c3640]'
  return (
    <Sheet title={e.title} wide={false} onClose={onClose}
      subtitle={e.calendar ? (
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: e.color }} />{e.calendar}</span>
      ) : undefined}>
      <div className={row}><Clock size={18} className="mt-0.5 shrink-0 text-ink-dim" /><span>{whenText(e)}</span></div>
      {e.repeating && <div className={row}><Repeat size={18} className="mt-0.5 shrink-0 text-ink-dim" /><span className="text-ink-dim">Repeating event</span></div>}

      {e.location && loc && (
        <div className="flex flex-col gap-3">
          <div className={row}>
            <MapPin size={18} className="mt-0.5 shrink-0 text-ink-dim" />
            <span className="flex min-w-0 flex-col">
              {loc.place && <span className="font-semibold">{loc.place}</span>}
              <span className={loc.place ? 'text-sm text-ink-dim' : ''}>{loc.address}</span>
            </span>
          </div>
          {/* Google's own map of the place, darkened to match the dashboard */}
          <div className="overflow-hidden rounded-2xl border border-edge bg-surface">
            <iframe title={`Map of ${loc.place ?? loc.address}`} src={googleMapsEmbed(e.location)} loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="block h-[220px] w-full border-0 [filter:invert(0.9)_hue-rotate(180deg)_saturate(0.8)]" />
          </div>
          <div className="flex gap-2.5">
            <a href={googleMapsSearch(e.location)} target="_blank" rel="noreferrer" className={btn}><ExternalLink size={16} /> Google Maps</a>
            <a href={googleMapsDirections(e.location)} target="_blank" rel="noreferrer" className={btn}><Navigation size={16} /> Directions</a>
          </div>
        </div>
      )}

      {e.description && (
        <div className={row}>
          <AlignLeft size={18} className="mt-0.5 shrink-0 text-ink-dim" />
          <p className="min-w-0 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#c9d2db]"><Linkified text={e.description} /></p>
        </div>
      )}

      {/* Edit · Delete (not on read-only calendars like Holidays) */}
      {(onEdit || onDelete) && (
        <div className="-mx-5 -mb-8 mt-1 flex border-t border-edge md:-mx-10">
          {onEdit && <button onClick={onEdit} className="flex min-h-[56px] flex-1 items-center justify-center gap-2 border-r border-edge text-[15px] font-medium hover:bg-[#222b34]"><Pencil size={17} /> Edit</button>}
          {onDelete && <button onClick={onDelete} className="flex min-h-[56px] flex-1 items-center justify-center gap-2 text-[15px] font-medium text-[#ff6b5e] hover:bg-[#222b34]"><Trash2 size={17} /> Delete</button>}
        </div>
      )}
    </Sheet>
  )
}
