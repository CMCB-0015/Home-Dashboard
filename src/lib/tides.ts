import type { TideEvent } from '../types'

/** Fired by the pager with the page now showing (0 = Home, 1 = calendar / weather / list) */
export const PAGE_EVENT = 'panel-page'

export interface Tide { t: number; ft: number; high: boolean }

export const toTides = (events: TideEvent[]): Tide[] =>
  events.map((e) => ({ t: Date.parse(e.time), ft: e.ft, high: e.high })).sort((a, b) => a.t - b.t)

/**
 * Height at a moment, between the high and low around it. A half cosine from
 * one to the next, the way NOAA draws its own tide charts between highs and lows.
 */
export function tideAt(tides: Tide[], t: number): number | null {
  for (let i = 0; i < tides.length - 1; i++) {
    const a = tides[i], b = tides[i + 1]
    if (t >= a.t && t <= b.t) {
      const p = (t - a.t) / (b.t - a.t)
      return (a.ft + b.ft) / 2 + ((a.ft - b.ft) / 2) * Math.cos(Math.PI * p)
    }
  }
  return null
}

/** Rising = the next turn is a high */
export const nextTide = (tides: Tide[], t: number) => tides.find((e) => e.t > t) ?? null

/** Local midnight, `d` days from today (handles daylight-saving days) */
export function dayStart(now: number, d: number): number {
  const x = new Date(now)
  return new Date(x.getFullYear(), x.getMonth(), x.getDate() + d).getTime()
}

/** "+0.6" / "−0.3" / "0.0" for lows; plain for highs */
export const signed = (ft: number) => (Math.abs(ft) < 0.05 ? '' : ft < 0 ? '−' : '+') + Math.abs(ft).toFixed(1)
export const tideText = (e: { ft: number; high: boolean }) => `${e.high ? e.ft.toFixed(1) : signed(e.ft)} ft`
