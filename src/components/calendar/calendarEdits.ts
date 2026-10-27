import { useSyncExternalStore } from 'react'
import type { CalendarEvent } from '../../types'

// Changes made on this screen that the server hasn't confirmed yet, so the
// calendar can show them the moment Save or Delete is tapped:
//  - added / changed events show at once with a small "Saving" tag
//  - a deleted event disappears at once; it's only sent to Google after the
//    5-second Undo bar runs out (tapping Undo just brings it back)

export interface PendingDelete {
  event: CalendarEvent
  scope: 'one' | 'following'
  /** When the delete goes to Google */
  sendAt: number
}

interface EditsState {
  /** Shown with "Saving" until the server's list has them */
  saving: CalendarEvent[]
  /** Events (by id) to keep hidden: being replaced by a saving copy, or deleted */
  hiddenIds: string[]
  /** "This and following": hide later occurrences of the series too */
  hiddenFrom: { calendarId: string; uid: string; from: number }[]
  pendingDelete: PendingDelete | null
}

let state: EditsState = { saving: [], hiddenIds: [], hiddenFrom: [], pendingDelete: null }
const listeners = new Set<() => void>()
function set(next: Partial<EditsState>) { state = { ...state, ...next }; for (const l of listeners) l() }
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }

export function useCalendarEdits(): EditsState {
  return useSyncExternalStore(subscribe, () => state)
}
export const editsNow = () => state

export function addSaving(e: CalendarEvent, replacesId?: string) {
  set({ saving: [...state.saving.filter((s) => s.id !== e.id), e], hiddenIds: replacesId ? [...state.hiddenIds, replacesId] : state.hiddenIds })
}
export function dropSaving(id: string, unhideId?: string) {
  set({ saving: state.saving.filter((s) => s.id !== id), hiddenIds: unhideId ? state.hiddenIds.filter((h) => h !== unhideId) : state.hiddenIds })
}
export function hide(e: CalendarEvent, scope: 'one' | 'following') {
  set({
    hiddenIds: [...state.hiddenIds, e.id],
    hiddenFrom: scope === 'following' && e.calendarId && e.uid ? [...state.hiddenFrom, { calendarId: e.calendarId, uid: e.uid, from: Date.parse(e.start) }] : state.hiddenFrom,
  })
}
export function unhide(e: CalendarEvent) {
  set({ hiddenIds: state.hiddenIds.filter((h) => h !== e.id), hiddenFrom: state.hiddenFrom.filter((h) => !(h.uid === e.uid && h.from === Date.parse(e.start))) })
}
export function setPendingDelete(p: PendingDelete | null) { set({ pendingDelete: p }) }

/** Forget hidden ids after a while (the server's own list has caught up by then) */
export function forgetLater(e: CalendarEvent, ms = 90_000) { setTimeout(() => unhide(e), ms) }

const sameStart = (a: CalendarEvent, b: CalendarEvent) => Date.parse(a.start) === Date.parse(b.start)

/** The server's events with this screen's unconfirmed changes laid over them */
export function applyEdits(events: CalendarEvent[], edits: EditsState): CalendarEvent[] {
  const hidden = new Set(edits.hiddenIds)
  let out = events.filter((e) => !hidden.has(e.id)
    && !edits.hiddenFrom.some((h) => e.calendarId === h.calendarId && e.uid === h.uid && Date.parse(e.start) >= h.from))
  for (const s of edits.saving) {
    // Already in the server's list (it answered faster than this screen): don't show it twice
    if (out.some((e) => e.calendar === s.calendar && e.title === s.title && sameStart(e, s))) continue
    out = [...out, s]
  }
  return out
}
