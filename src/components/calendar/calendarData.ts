import { useEffect, useMemo, useState } from 'react'
import { useHome } from '../../lib/useHome'
import type { CalendarEvent } from '../../types'

const DAY = 86_400_000
export const dayStart = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

/** When the event ends (all-day events without an end last the whole day; timed ones an hour) */
export function endOf(e: CalendarEvent): number {
  const s = Date.parse(e.start)
  const end = e.end ? Date.parse(e.end) : NaN
  if (!Number.isNaN(end) && end > s) return end
  return e.allDay ? dayStart(new Date(s)).getTime() + DAY : s + 3_600_000
}

/** Is the event on this day (multi-day events show on every day they cover) */
export function onDay(e: CalendarEvent, d: Date): boolean {
  const a = dayStart(d).getTime(), b = a + DAY
  const s = Date.parse(e.start)
  return s < b && endOf(e) > a
}

// Months fetched from the server, kept while the dashboard is open
const cache = new Map<string, CalendarEvent[]>()

/**
 * Events between two dates. The live state already covers this month and next;
 * other months are asked for once and kept, so paging back is instant.
 */
export function useEventsBetween(from: Date, to: Date): { events: CalendarEvent[]; loading: boolean; error: string | null } {
  const { data, live } = useHome()
  const range = data?.calendarRange
  const inLive = !!range && from.getTime() >= Date.parse(range.start) && to.getTime() <= Date.parse(range.end)
  const key = `${from.toISOString()}|${to.toISOString()}`
  const [fetched, setFetched] = useState<{ key: string; events: CalendarEvent[] } | null>(() => (cache.has(key) ? { key, events: cache.get(key)! } : null))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (inLive || !live) return
    if (cache.has(key)) { setFetched({ key, events: cache.get(key)! }); return }
    let cancelled = false
    setError(null)
    fetch(`/api/calendar/range?start=${encodeURIComponent(from.toISOString())}&end=${encodeURIComponent(to.toISOString())}`)
      .then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Couldn’t load that month'); return r.json() as Promise<CalendarEvent[]> })
      .then((ev) => { cache.set(key, ev); if (!cancelled) setFetched({ key, events: ev }) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Couldn’t load that month') })
    return () => { cancelled = true }
  }, [key, inLive, live]) // eslint-disable-line react-hooks/exhaustive-deps

  const events = useMemo(() => {
    const src = inLive || !live ? data?.calendar ?? [] : fetched?.key === key ? fetched.events : []
    return src.filter((e) => Date.parse(e.start) < to.getTime() && endOf(e) > from.getTime())
  }, [inLive, live, data?.calendar, fetched, key, from, to])

  return { events, loading: !inLive && live && fetched?.key !== key && !error, error }
}

/** Calendars hidden on this screen (remembered on this device only) */
const HIDDEN_KEY = 'panel-calendars-hidden'
export function useHiddenCalendars() {
  const [hidden, setHidden] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') } catch { return [] }
  })
  const toggle = (name: string) => setHidden((h) => {
    const next = h.includes(name) ? h.filter((x) => x !== name) : [...h, name]
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)) } catch { /* private mode */ }
    return next
  })
  return { hidden, toggle }
}

/** "Pedro's Tacos, 2801 S El Camino Real, San Clemente, CA 92672, USA" → place + address */
export function splitLocation(loc: string): { place: string | null; address: string } {
  const parts = loc.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts[parts.length - 1] && /^(USA|United States)$/i.test(parts[parts.length - 1])) parts.pop()
  if (parts.length > 1 && !/^\d/.test(parts[0])) return { place: parts[0], address: parts.slice(1).join(', ') }
  return { place: null, address: parts.join(', ') }
}

export const googleMapsSearch = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
export const googleMapsDirections = (q: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`
export const googleMapsEmbed = (q: string) => `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`
