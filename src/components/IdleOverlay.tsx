import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useHome } from '../lib/useHome'
import { statusItems } from '../lib/statusItems'
import { WeatherIcon } from './WeatherIcon'
import { skyNow } from '../lib/sky'
import { activeHoliday, holidaySettings, HOLIDAY_THEMES } from '../lib/holidays'

// Idle dim + tap to wake (EXPERIMENTAL, 1.18.0, Nov 8, 2026).
// After `idle_minutes` with no touch, a near-black screensaver covers Panel:
// a faint clock, the date, the current weather and the alert / launch chips.
// The first tap only wakes Panel; it never reaches the button underneath.
// The tablet's backlight stays on (a web page can't change it).
//
// 1.27.0: on/off, wait, clock & text and chip brightness come from the Settings
// menu (saved on the Lenovo). "Preview now" there shows it right away; a tap
// goes back to the menu.
//
// 1.30.0: holiday themes. During a theme's dates (Settings → Holiday themes,
// Auto) an animated scene replaces the near-black background and the text moves
// to the top-left, brighter so it reads over the scene. No theme = exactly as before.
//
// Off switch: `idle_dim` in Panel's Configuration tab. Off = this component
// renders nothing and listens to nothing, so Panel behaves like 1.17.0.
// Baseline before this feature: 1.17.0 (commit f7d09da, branch baseline-pre-idle-dim), project doc
// claude/baseline-pre-idle-dim.md. Everything for this feature lives in this
// file plus the three `idle_*` settings and one line in App.tsx and
// CameraSheet.tsx, so it can be removed cleanly.

/** Fired when the screensaver starts, so a camera live view can stop (battery cameras) */
export const IDLE_EVENT = 'panel-idle'
/** Settings menu → "Preview now": show the screensaver now, even if it's switched off.
 *  detail.theme (a holiday theme id) previews that theme's scene, in season or not. */
export const SCREENSAVER_PREVIEW_EVENT = 'panel-screensaver-preview'

const ACTIVITY = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
const FADE_MS = 900

function useClock(active: boolean) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!active) return
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(t)
  }, [active])
  return now
}

export function IdleOverlay() {
  const { data } = useHome()
  const cfg = data?.idle
  const enabled = cfg?.enabled ?? false
  const minutes = Math.max(0.25, cfg?.minutes ?? 2)
  const level = Math.min(0.6, Math.max(0.1, (cfg?.brightness ?? 32) / 100))
  const chipLevel = Math.min(1, Math.max(0, (cfg?.chips ?? 40) / 100))

  const [idle, setIdle] = useState(false)
  const [preview, setPreview] = useState(false)
  const [previewTheme, setPreviewTheme] = useState<string | null>(null)

  useEffect(() => {
    const show = (e: Event) => {
      setPreviewTheme((e as CustomEvent<{ theme?: string } | undefined>).detail?.theme ?? null)
      setPreview(true); setIdle(true)
    }
    window.addEventListener(SCREENSAVER_PREVIEW_EVENT, show)
    return () => window.removeEventListener(SCREENSAVER_PREVIEW_EVENT, show)
  }, [])
  const wake = () => { setIdle(false); setPreview(false) }

  // The holiday scene stays drawn through the fade-out, then stops completely
  const [sceneOn, setSceneOn] = useState(false)
  useEffect(() => {
    if (idle) { setSceneOn(true); return }
    const t = setTimeout(() => { setSceneOn(false); setPreviewTheme(null) }, FADE_MS)
    return () => clearTimeout(t)
  }, [idle])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Any touch, key or scroll while awake restarts the countdown
  useEffect(() => {
    if (!enabled) { if (!preview) setIdle(false); return }
    const arm = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setIdle(true), minutes * 60_000)
    }
    arm()
    for (const ev of ACTIVITY) window.addEventListener(ev, arm, { capture: true, passive: true })
    return () => {
      if (timer.current) clearTimeout(timer.current)
      for (const ev of ACTIVITY) window.removeEventListener(ev, arm, { capture: true })
    }
  }, [enabled, minutes, preview])

  useEffect(() => {
    if (idle) window.dispatchEvent(new Event(IDLE_EVENT))
  }, [idle])

  // Keyboard (Chromebook): any key wakes it, and that key does nothing else
  useEffect(() => {
    if (!idle) return
    const key = (e: KeyboardEvent) => { e.preventDefault(); e.stopPropagation(); wake() }
    window.addEventListener('keydown', key, { capture: true })
    return () => window.removeEventListener('keydown', key, { capture: true })
  }, [idle])

  const now = useClock(idle)
  const chips = useMemo(
    () => (data && idle && chipLevel > 0 ? statusItems(data, now).filter((i) => i.kind === 'alert' || i.kind === 'motion' || i.kind === 'launch').slice(0, 3) : []),
    [data, idle, now, chipLevel],
  )

  if ((!enabled && !preview) || !data) return null

  const theme = previewTheme ? HOLIDAY_THEMES.find((t) => t.id === previewTheme) ?? null : activeHoliday(data.holidays, now)
  const scene = !!theme && sceneOn
  const w = data.weather
  const ink = (a: number) => `rgba(232, 237, 242, ${a})`
  // Over a scene the faint screensaver text would vanish: same slider, brighter range (10% → 62%, 60% → 100%)
  const textLevel = scene ? Math.min(1, 0.55 + level * 0.75) : level
  const soft = textLevel * (scene ? 0.9 : 0.8)
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/, '')
  const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <button
      type="button"
      aria-label="Wake Panel"
      aria-hidden={!idle}
      tabIndex={idle ? 0 : -1}
      // Wake on click (after the finger lifts), so the whole tap belongs to the overlay
      onClick={wake}
      className={`fixed inset-0 z-[1000] m-0 flex cursor-pointer flex-col border-0 font-body ${scene
        ? 'items-start justify-start gap-2 overflow-hidden px-[clamp(24px,5vw,72px)] pt-[clamp(24px,6vh,64px)] text-left'
        : 'items-center justify-center gap-[18px] p-0'}`}
      style={{
        background: '#020304',
        textShadow: scene ? '0 2px 22px rgba(4, 10, 30, 0.5)' : undefined,
        opacity: idle ? 1 : 0,
        pointerEvents: idle ? 'auto' : 'none',
        transition: `opacity ${FADE_MS}ms ease`,
      }}
    >
      {scene && theme && (
        <Suspense fallback={null}>
          <theme.Scene settings={holidaySettings(data.holidays, theme.id)} preview={preview} />
        </Suspense>
      )}
      {scene && (
        // Soft shade behind the clock so it reads over trees and daytime sky
        <span aria-hidden className="pointer-events-none absolute left-0 top-0 block h-[60vh] w-[60vw]"
          style={{ background: 'radial-gradient(ellipse at 0% 0%, rgba(2, 6, 20, 0.55), rgba(2, 6, 20, 0) 70%)' }} />
      )}
      <span className="relative font-display font-medium" style={{ fontSize: 'min(132px, 18vw)', lineHeight: 1, letterSpacing: '-0.02em', color: ink(textLevel) }}>{time}</span>
      <span className="relative" style={{ fontSize: 22, color: ink(soft) }}>{date}</span>
      {w && (
        <span className="relative flex items-center gap-3" style={{ fontSize: 20, color: ink(soft) }}>
          <span style={{ opacity: Math.min(1, textLevel * 1.2), display: 'flex' }}><WeatherIcon kind={skyNow(w).icon} size={28} /></span>
          <span className="font-display" style={{ fontSize: 26, color: ink(textLevel) }}>{Math.round(w.current.tempF)}°</span>
          <span>{skyNow(w).condition}</span>
        </span>
      )}
      {preview && idle && <span className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs" style={{ color: scene ? 'rgba(232,237,242,0.7)' : '#3a444e' }}>Tap to go back to Settings</span>}
      {chips.length > 0 && (
        <span className={`relative flex max-w-[90vw] flex-wrap gap-2.5 ${scene ? 'mt-3 justify-start' : 'mt-[18px] justify-center'}`}>
          {chips.map((c) => {
            const launch = c.kind === 'launch'
            const color = launch ? '207, 218, 255' : c.kind === 'motion' ? '124, 140, 240' : '242, 193, 78'
            // Chip brightness (Settings menu): text 0.8×, border 0.6×, dot 1× of the level
            return (
              <span key={c.id} className="flex h-[34px] items-center gap-2 rounded-full px-3.5 text-xs"
                style={{ border: `1px solid rgba(${launch ? '70, 92, 160' : color}, ${chipLevel * 0.6})`, color: ink(chipLevel * 0.8),
                  background: scene ? 'rgba(4, 8, 20, 0.45)' : undefined }}>
                {launch
                  ? <span style={{ color: `rgba(${color}, ${chipLevel})` }}>✦</span>
                  : <span className="h-[7px] w-[7px] rounded-full" style={{ background: `rgba(${color}, ${chipLevel})` }} />}
                {c.label && <span className="font-semibold">{c.label}</span>}
                <span className="max-w-[40vw] truncate">{c.text}</span>
                {c.detail && <span>{c.detail}</span>}
              </span>
            )
          })}
        </span>
      )}
    </button>
  )
}
