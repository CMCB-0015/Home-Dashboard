import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Lightbulb, X } from 'lucide-react'
import { useHome } from '../../lib/useHome'
import { useLightActions, useThrottle, type LightChange } from '../../lib/useLightActions'
import { blend, differ, hexToRgb, hueToRgb, kelvinToRgb, rgba, rgbToHex, rgbToHue, SWATCHES, WARM_WHITE, WHITE_TONES } from '../../lib/lightColor'
import { Segmented } from '../Buttons'
import type { Light } from '../../types'

type Target = 'both' | 'window' | 'dresser'

/**
 * Slides up from the bottom when you press and hold a light.
 * Changes apply live while dragging; Done just closes it.
 * For the bedroom overhead cans: Both / Window / Dresser.
 */
export function LightPanel({ lightId, onClose }: { lightId: string; onClose: () => void }) {
  const { data } = useHome()
  const actions = useLightActions()
  const cans = data?.lighting?.cans ?? null
  const isCans = !!cans && [cans.groupId, cans.windowId, cans.dresserId].includes(lightId)
  const [target, setTarget] = useState<Target>(
    !isCans || lightId === cans!.groupId ? 'both' : lightId === cans!.windowId ? 'window' : 'dresser')
  const currentId = isCans ? (target === 'both' ? cans!.groupId : target === 'window' ? cans!.windowId : cans!.dresserId) : lightId
  const win = cans ? data?.lights.find((l) => l.id === cans.windowId) : undefined
  const dresser = cans ? data?.lights.find((l) => l.id === cans.dresserId) : undefined
  const found = data?.lights.find((l) => l.id === currentId)
  // "Both" reads from the two cans themselves, so it's right even if the group reports differently
  const cansOn = [win, dresser].filter((l): l is Light => !!l?.on)
  const light: Light | undefined = found && isCans && target === 'both' ? {
    ...found,
    on: found.on || cansOn.length > 0,
    brightnessPct: cansOn.length ? Math.round(cansOn.reduce((t, l) => t + l.brightnessPct, 0) / cansOn.length) : found.brightnessPct,
    color: cansOn.length ? blend(cansOn) : found.color,
    kelvin: cansOn.length && cansOn.every((l) => l.kelvin) ? cansOn[0].kelvin : cansOn.length ? null : found.kelvin,
  } : found
  const split = isCans && target === 'both' && !!win?.on && !!dresser?.on &&
    (differ(win.color, dresser.color) || Math.abs(win.brightnessPct - dresser.brightnessPct) > 5)

  const [tab, setTab] = useState<'white' | 'color'>('white')
  const tabSet = useRef(false)
  useEffect(() => {
    if (!light || tabSet.current) return
    tabSet.current = true
    setTab(light.supports?.white && (light.kelvin || !light.supports?.color) ? 'white' : light.supports?.color ? 'color' : 'white')
  }, [light])

  // Close with Escape; keep the page behind from scrolling
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  if (!data || !light) return null

  const linked = isCans && target === 'both'
  const apply = (c: LightChange) => void actions.set([currentId], c, { linked })
  const color = light.on ? light.color ?? WARM_WHITE : null
  const scenes = (data.lighting?.scenes ?? []).filter((s) => s.room === light.room || s.room === light.name)
  const supports = light.supports ?? { color: false, white: false, dim: true }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sheet-backdrop" onClick={onClose}>
      <div role="dialog" aria-modal aria-label={`${light.name} settings`}
        className="sheet-up w-full max-w-lg rounded-t-3xl border-t border-edge bg-surface px-5 pb-8 pt-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-edge" />

        {/* Header: icon lit in its color, name, on/off */}
        <div className="flex items-center gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={split
              ? { background: `linear-gradient(90deg, ${rgba(win!.color ?? WARM_WHITE, 0.35)} 50%, ${rgba(dresser!.color ?? WARM_WHITE, 0.35)} 50%)`, color: 'var(--color-ink)' }
              : color ? { background: rgba(color, 0.22), color, boxShadow: `0 0 22px -6px ${color}` } : { background: 'var(--color-surface-raised)', color: 'var(--color-ink-faint)' }}>
            <Lightbulb size={22} fill={color && !split ? 'currentColor' : 'none'} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-semibold">{isCans ? 'Bedroom overhead' : light.name}</p>
            <p className="truncate text-xs text-ink-faint">
              {split ? 'Split · cans set separately' : isCans && target !== 'both' ? `${light.name} can only` : light.room}
              {light.available === false ? ' · unavailable' : ''}
            </p>
          </div>
          <Switch on={light.on} onChange={(on) => apply({ on })} color={color ?? 'var(--color-lights)'} label={`${light.name} on or off`} />
        </div>

        {isCans && (
          <div className="mt-4">
            <Segmented label="Which cans" value={target} onChange={setTarget} color="var(--color-lights)" dim="var(--color-lights-dim)"
              options={[{ value: 'both', label: 'Both' }, { value: 'window', label: 'Window' }, { value: 'dresser', label: 'Dresser' }]} />
          </div>
        )}

        {supports.dim && (
          <BrightnessBar value={light.on ? light.brightnessPct : 0} mixed={split} color={color ?? '#56636f'}
            onChange={(v) => apply({ brightnessPct: v })} />
        )}

        {(supports.white || supports.color) && (
          <div className="mt-5">
            {supports.white && supports.color && (
              <Segmented label="White or color" value={tab} onChange={setTab} color="var(--color-lights)" dim="var(--color-lights-dim)"
                options={[{ value: 'white', label: 'White' }, { value: 'color', label: 'Color' }]} />
            )}
            {(tab === 'white' && supports.white) || !supports.color
              ? <WhiteTones light={light} onPick={(kelvin) => apply({ kelvin })} />
              : <ColorPicker light={light} onPick={(rgb) => apply({ rgb })} />}
          </div>
        )}

        {scenes.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Scenes · {light.room}</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {scenes.map((s) => (
                <button key={s.id} onClick={() => void actions.scene(s.id)}
                  className="h-9 shrink-0 rounded-full border border-edge bg-surface-raised px-4 text-xs font-medium text-ink-dim hover:text-ink">
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-surface-raised px-6 text-sm font-semibold text-ink hover:bg-edge">
            <X size={15} /> Done
          </button>
        </div>
      </div>
    </div>
  )
}

export function Switch({ on, onChange, color, label, disabled }: { on: boolean; onChange: (on: boolean) => void; color: string; label: string; disabled?: boolean }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className="relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40" style={{ background: on ? color : 'var(--color-edge)' }}>
      <span className="absolute left-0 top-1 h-5 w-5 rounded-full bg-bg transition-transform" style={{ transform: `translateX(${on ? 24 : 4}px)` }} />
    </button>
  )
}

/** Shared drag logic: 0–1 along the bar while the finger moves */
function useDrag(onMove: (fraction: number) => void, onEnd: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const at = (e: ReactPointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
  }
  return {
    ref,
    onPointerDown: (e: ReactPointerEvent) => { e.currentTarget.setPointerCapture(e.pointerId); onMove(at(e)) },
    onPointerMove: (e: ReactPointerEvent) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) onMove(at(e)) },
    onPointerUp: onEnd,
    onPointerCancel: onEnd,
  }
}

function BrightnessBar({ value, color, mixed, onChange }: { value: number; color: string; mixed: boolean; onChange: (v: number) => void }) {
  const [drag, setDrag] = useState<number | null>(null)
  const send = useThrottle(onChange, 200)
  const handlers = useDrag(
    (f) => { const v = Math.max(1, Math.round(f * 100)); setDrag(v); send.push(v) },
    () => { send.flush(); setTimeout(() => setDrag(null), 600) },
  )
  const shown = drag ?? value
  const step = (d: number) => { const v = Math.max(1, Math.min(100, shown + d)); setDrag(v); onChange(v); setTimeout(() => setDrag(null), 600) }
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Brightness</span>
        <span className="font-mono text-sm text-ink">{mixed && drag === null ? 'Mixed' : `${shown}%`}</span>
      </div>
      <div {...handlers} role="slider" aria-label="Brightness" aria-valuemin={1} aria-valuemax={100} aria-valuenow={shown} tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowUp') step(5); if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') step(-5) }}
        className="relative h-14 cursor-pointer touch-none overflow-hidden rounded-2xl bg-surface-raised select-none">
        <div className="absolute inset-y-0 left-0 rounded-2xl transition-[width] duration-75"
          style={{ width: `${shown}%`, background: `linear-gradient(90deg, ${rgba(color, 0.35)}, ${rgba(color, 0.75)})` }} />
        <div className="absolute inset-y-3 w-1 rounded-full bg-ink/80" style={{ left: `calc(${shown}% - 10px)` }} />
      </div>
    </div>
  )
}

function WhiteTones({ light, onPick }: { light: Light; onPick: (kelvin: number) => void }) {
  const min = light.minKelvin ?? 2000, max = light.maxKelvin ?? 6500
  return (
    <div className="mt-3 grid grid-cols-5 gap-2">
      {WHITE_TONES.map((t) => {
        const k = Math.max(min, Math.min(max, t.kelvin))
        const hex = rgbToHex(kelvinToRgb(k))
        const active = light.on && light.kelvin != null && Math.abs(light.kelvin - k) < 200
        return (
          <button key={t.label} onClick={() => onPick(k)} aria-pressed={active}
            className="flex flex-col items-center gap-1.5 rounded-xl border py-2.5 text-[11px] font-medium transition-colors"
            style={active ? { borderColor: hex, color: 'var(--color-ink)', background: rgba(hex, 0.12) } : { borderColor: 'var(--color-edge)', color: 'var(--color-ink-dim)' }}>
            <span className="h-6 w-6 rounded-full" style={{ background: hex, boxShadow: active ? `0 0 12px -2px ${hex}` : undefined }} />
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

function ColorPicker({ light, onPick }: { light: Light; onPick: (rgb: [number, number, number]) => void }) {
  const current = light.on && light.color && light.kelvin == null ? rgbToHue(hexToRgb(light.color)) : 30
  const [drag, setDrag] = useState<number | null>(null)
  const send = useThrottle((h: number) => onPick(hueToRgb(h)), 200)
  const handlers = useDrag(
    (f) => { const h = Math.round(f * 359); setDrag(h); send.push(h) },
    () => { send.flush(); setTimeout(() => setDrag(null), 600) },
  )
  const hue = drag ?? current
  return (
    <div className="mt-3">
      <div {...handlers} role="slider" aria-label="Color" aria-valuemin={0} aria-valuemax={359} aria-valuenow={hue} tabIndex={0}
        className="relative h-10 cursor-pointer touch-none rounded-full select-none"
        style={{ background: 'linear-gradient(90deg, #ff0000, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000)' }}>
        <div className="absolute top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-lg"
          style={{ left: `${(hue / 359) * 100}%`, background: rgbToHex(hueToRgb(hue)) }} />
      </div>
      <div className="mt-3 grid grid-cols-8 gap-2">
        {SWATCHES.map((s) => (
          <button key={s.label} aria-label={s.label} onClick={() => onPick(hexToRgb(s.hex))}
            className="aspect-square rounded-full border-2 border-transparent transition-transform hover:scale-110"
            style={{ background: s.hex, borderColor: light.on && !differ(light.color, s.hex) ? 'var(--color-ink)' : 'transparent' }} />
        ))}
      </div>
    </div>
  )
}
