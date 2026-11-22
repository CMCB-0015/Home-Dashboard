import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { HolidaySettings } from '../types'

// Holiday screensaver themes (1.30.0).
//
// Each theme has yearly dates (month/day, may run over New Year) and a scene.
// With its mode on Auto it switches itself on during those dates every year and
// off after; the choices for each theme are saved on the Lenovo by theme id
// (server/settings.ts), so nothing is lost once the season ends.
//
// To add a theme (e.g. Halloween):
//   1. add its id to HOLIDAY_IDS in server/settings.ts
//   2. add an entry below with its dates and scene
//   3. write the scene in src/components/idle/ (a full-screen canvas, see ChristmasScene)
// Scenes are loaded only when one is about to show, so a theme costs nothing
// the rest of the year.

export interface SceneProps {
  settings: HolidaySettings
  /** Show Santa (or the theme's special moment) soon, used by Preview */
  preview?: boolean
}

export interface HolidayTheme {
  id: string
  name: string
  /** First and last day, [month 1–12, day] */
  start: [number, number]
  end: [number, number]
  Scene: LazyExoticComponent<ComponentType<SceneProps>>
}

export const HOLIDAY_THEMES: HolidayTheme[] = [
  {
    id: 'christmas',
    name: 'Christmas',
    start: [12, 1],
    end: [1, 6],
    Scene: lazy(() => import('../components/idle/ChristmasScene')),
  },
]

export const HOLIDAY_DEFAULTS: HolidaySettings = { mode: 'auto', scene: 100, snow: 'normal', lights: 'normal', glow: 60 }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const fmtDay = ([m, d]: [number, number]) => `${MONTHS[m - 1]} ${d}`
export const dateRange = (t: HolidayTheme) => `${fmtDay(t.start)} – ${fmtDay(t.end)}`

export function holidaySettings(all: Record<string, HolidaySettings> | undefined, id: string): HolidaySettings {
  return { ...HOLIDAY_DEFAULTS, ...(all?.[id] ?? {}) }
}

/** Is this date inside the theme's yearly dates? */
export function inSeason(t: HolidayTheme, now: Date): boolean {
  const md = (now.getMonth() + 1) * 100 + now.getDate()
  const s = t.start[0] * 100 + t.start[1], e = t.end[0] * 100 + t.end[1]
  return s <= e ? md >= s && md <= e : md >= s || md <= e
}

/** Days until the theme's next start (0 if in season) */
export function daysUntil(t: HolidayTheme, now: Date): number {
  if (inSeason(t, now)) return 0
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let start = new Date(now.getFullYear(), t.start[0] - 1, t.start[1])
  if (start < today) start = new Date(now.getFullYear() + 1, t.start[0] - 1, t.start[1])
  return Math.round((start.getTime() - today.getTime()) / 86_400_000)
}

/** The theme the screensaver should show right now, if any. On beats Auto; first in the list wins. */
export function activeHoliday(all: Record<string, HolidaySettings> | undefined, now: Date): HolidayTheme | null {
  const on = HOLIDAY_THEMES.find((t) => holidaySettings(all, t.id).mode === 'on')
  if (on) return on
  return HOLIDAY_THEMES.find((t) => holidaySettings(all, t.id).mode === 'auto' && inSeason(t, now)) ?? null
}
