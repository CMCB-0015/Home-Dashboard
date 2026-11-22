import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useHome } from '../../lib/useHome'
import { dateRange, daysUntil, HOLIDAY_THEMES, holidaySettings, inSeason, type HolidayTheme } from '../../lib/holidays'
import { SCREENSAVER_PREVIEW_EVENT } from '../IdleOverlay'
import { Section, Slider } from './SettingsMenu'
import type { HolidaySettings } from '../../types'

// Settings → Holiday themes (1.30.0): one block per theme (Christmas for now).
// Off / Auto (its dates, every year) / On, plus the scene's own controls.
// Saved on the Lenovo by theme id, so the choices come back every season.

const MODES: { id: HolidaySettings['mode']; label: string }[] = [
  { id: 'off', label: 'Off' }, { id: 'auto', label: 'Auto' }, { id: 'on', label: 'On' },
]
const SNOW: { id: HolidaySettings['snow']; label: string }[] = [
  { id: 'off', label: 'Off' }, { id: 'light', label: 'Light' }, { id: 'normal', label: 'Normal' }, { id: 'heavy', label: 'Heavy' },
]
const LIGHTS: { id: HolidaySettings['lights']; label: string }[] = [
  { id: 'few', label: 'Few' }, { id: 'normal', label: 'Normal' }, { id: 'lots', label: 'Lots' }, { id: 'max', label: 'Max' },
]

function status(t: HolidayTheme, h: HolidaySettings, now: Date) {
  if (h.mode === 'off') return 'Off'
  if (h.mode === 'on') return 'On (all year)'
  if (inSeason(t, now)) return `Auto · ${dateRange(t)} · on now`
  const n = daysUntil(t, now)
  return `Auto · ${dateRange(t)} · starts in ${n} day${n === 1 ? '' : 's'}`
}

export function HolidaySection({ icon }: { icon: ReactNode }) {
  const { data } = useHome()
  const [open, setOpen] = useState(false)
  const now = new Date()
  const summary = HOLIDAY_THEMES.map((t) => `${t.name} · ${status(t, holidaySettings(data?.holidays, t.id), now)}`).join(' · ')
  return (
    <Section icon={icon} title="Holiday themes" summary={summary} open={open} onToggle={() => setOpen((o) => !o)}>
      {HOLIDAY_THEMES.map((t) => <ThemeBlock key={t.id} theme={t} />)}
    </Section>
  )
}

function ThemeBlock({ theme }: { theme: HolidayTheme }) {
  const { data, update, send } = useHome()
  // What was just changed here wins over the live data until it's saved (no slider snap-back)
  const [local, setLocal] = useState<Partial<HolidaySettings>>({})
  const h = { ...holidaySettings(data?.holidays, theme.id), ...local }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<Partial<HolidaySettings>>({})
  const flush = useCallback(() => {
    const patch = pending.current
    pending.current = {}
    if (!Object.keys(patch).length) return
    void send('settings', { holidays: { [theme.id]: patch } }).then(() => {
      if (!Object.keys(pending.current).length) setTimeout(() => { if (!Object.keys(pending.current).length) setLocal({}) }, 1500)
    })
  }, [send, theme.id])
  const change = useCallback((patch: Partial<HolidaySettings>, delay = 0) => {
    setLocal((l) => ({ ...l, ...patch }))
    update((s) => ({ ...s, holidays: { ...s.holidays, [theme.id]: { ...holidaySettings(s.holidays, theme.id), ...patch } } }))
    pending.current = { ...pending.current, ...patch }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, delay)
  }, [update, flush, theme.id])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); flush() }, [flush]) // closing mid-drag still saves

  const help = h.mode === 'auto' ? `Turns on ${dateRange(theme).replace(' – ', ' and off after ')}, every year`
    : h.mode === 'on' ? 'Shows all year until you switch it back' : 'The screensaver stays as it is today'

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] font-medium">{theme.name}</span>
        <span className="text-xs text-ink-dim">{dateRange(theme)}</span>
      </div>
      <div>
        <Choices items={MODES} value={h.mode} onPick={(mode) => change({ mode })} label={`${theme.name} screensaver`} />
        <div className="mt-1.5 text-xs text-ink-dim">{help}</div>
      </div>
      <div className="flex flex-col gap-3.5" style={{ opacity: h.mode === 'off' ? 0.5 : 1 }}>
        <Slider label="Scene brightness" value={h.scene} min={30} max={100} step={5} onChange={(v) => change({ scene: v }, 350)} />
        <div>
          <div className="mb-2 text-[15px] font-medium">Snow</div>
          <Choices items={SNOW} value={h.snow} onPick={(snow) => change({ snow })} label="Snow amount" />
        </div>
        <div>
          <div className="mb-2 text-[15px] font-medium">Christmas lights</div>
          <Choices items={LIGHTS} value={h.lights} onPick={(lights) => change({ lights })} label="How many Christmas lights" />
        </div>
        <Slider label="Light brightness" value={h.glow} min={25} max={100} step={5} onChange={(v) => change({ glow: v }, 350)} />
      </div>
      <button onClick={() => window.dispatchEvent(new CustomEvent(SCREENSAVER_PREVIEW_EVENT, { detail: { theme: theme.id } }))}
        className="h-12 rounded-xl border border-edge bg-[#1b232b] text-sm font-medium text-ink hover:bg-[#232c35]">
        Preview {theme.name}
      </button>
    </div>
  )
}

function Choices<T extends string>({ items, value, onPick, label }:
  { items: { id: T; label: string }[]; value: T; onPick: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((it) => (
        <button key={it.id} onClick={() => onPick(it.id)} aria-pressed={value === it.id}
          className="h-11 rounded-[10px] border text-[13px] font-medium text-ink"
          style={{ background: value === it.id ? '#1c3438' : 'transparent', borderColor: value === it.id ? '#35c2d6' : '#29333d' }}>
          {it.label}
        </button>
      ))}
    </div>
  )
}
