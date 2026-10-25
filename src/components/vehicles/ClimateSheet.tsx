import { useEffect, useState, type ReactNode } from 'react'
import { Sheet } from '../Sheet'
import { BLUE, DIM, IDLE_BG, OFF_BAR, RED, tint, useDebounced, type TeslaAct } from './useTesla'
import type { Tesla } from '../../types'

const svg = (children: ReactNode, size = 28) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
)
const ICONS = {
  frontDef: svg(<><path d="M3 8c5-4 13-4 18 0l-2.5 9h-13z" /><path d="M9 11c.8.8.8 1.7 0 2.5" /><path d="M12 10.5c.8.8.8 1.7 0 2.5" /><path d="M15 11c.8.8.8 1.7 0 2.5" /></>),
  rearDef: svg(<><rect x="3" y="6" width="18" height="11" rx="2.5" /><path d="M9 9c.8.8.8 1.7 0 2.5" /><path d="M12 9c.8.8.8 1.7 0 2.5" /><path d="M15 9c.8.8.8 1.7 0 2.5" /></>),
  wheel: svg(<><circle cx="12" cy="14" r="7.5" /><circle cx="12" cy="14" r="2" /><path d="M4.8 12.5H10" /><path d="M14 12.5h5.2" /><path d="M12 16v5" /><path d="M9.5 2.5c.6.6.6 1.4 0 2" /><path d="M12 2.5c.6.6.6 1.4 0 2" /><path d="M14.5 2.5c.6.6.6 1.4 0 2" /></>),
  seat: svg(<><path d="M6 5v9a2 2 0 0 0 2 2h8l1 4" /><path d="M8 16l-1 4" /><path d="M6 11h7" /><path d="M14 3c.6.6.6 1.4 0 2" /><path d="M16.5 3c.6.6.6 1.4 0 2" /><path d="M19 3c.6.6.6 1.4 0 2" /></>),
  rear: svg(<><path d="M18 9v6a2 2 0 0 1-2 2H8l-1 4" /><path d="M16 17l1 4" /><path d="M18 13h-7" /><path d="M6 4c.6.6.6 1.4 0 2" /><path d="M8.5 4c.6.6.6 1.4 0 2" /><path d="M11 4c.6.6.6 1.4 0 2" /></>),
}
const Chevron = ({ dir }: { dir: 'l' | 'r' }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={dir === 'l' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
  </svg>
)

const levelName = (v: number) => (v === 0 ? 'off' : `${['low', 'medium', 'high'][Math.abs(v) - 1]} ${v > 0 ? 'heat' : 'cooling'}`)
/** Front seats: off → heat 1–3 → cool 1–3 → off (cooling only if the car has it) */
const nextFront = (v: number, cool: boolean) => (v >= 0 && v < 3 ? v + 1 : v === 3 ? (cool ? -1 : 0) : v === -3 ? 0 : v - 1)

/**
 * Climate panel (opens from the fan on the Tesla card while climate is on):
 * target temperature, power, defrost, seat heat/cooling, steering wheel.
 */
export function ClimateSheet({ t, act, onClose }: { t: Tesla; act: TeslaAct; onClose: () => void }) {
  const [target, setTarget] = useState(t.targetF ?? 70)
  // Follow the car when it reports a new target (and nobody is tapping)
  useEffect(() => { if (t.targetF !== null) setTarget(t.targetF) }, [t.targetF])
  const sendTarget = useDebounced((v: number) => void act('climate_target', { value: v }, { targetF: v }), 700)
  const nudge = (d: number) => {
    const v = Math.min(t.maxF, Math.max(t.minF, target + d))
    setTarget(v); sendTarget(v)
  }

  const on = t.climateOn
  const heating = t.insideF === null || target >= t.insideF
  const status = on ? `${heating ? 'Heating' : 'Cooling'} to ${target}°` : 'Climate off'

  type Control = { key: string; label: string; icon: ReactNode; active: boolean; color: string; bars: number | null; aria: string; available: boolean; tap: () => void }
  const toggle = (key: 'frontDefrost' | 'rearDefrost' | 'wheel', action: string, label: string, icon: ReactNode, color: string): Control => {
    const v = t[key]
    return {
      key, label, icon, active: !!v, color, bars: null, available: v !== null,
      aria: v === null ? `${label}: not in Home Assistant` : `${label}: ${v ? 'on' : 'off'}`,
      tap: () => void act(action, { value: !v }, { [key]: !v }),
    }
  }
  const seat = (key: 'driver' | 'passenger' | 'rear', label: string, icon: ReactNode): Control => {
    const v = t[key]
    const next = key === 'rear' ? (v + 1) % 4 : nextFront(v, t.coolingSeats)
    return {
      key, label, icon, active: v !== 0, color: v < 0 ? BLUE : RED, bars: v, available: true,
      aria: `${label}: ${levelName(v)}`,
      tap: () => void act('seat', { seat: key, level: next }, { [key]: next }),
    }
  }
  const controls: Control[] = [
    toggle('frontDefrost', 'front_defrost', 'Front defrost', ICONS.frontDef, BLUE),
    toggle('rearDefrost', 'rear_defrost', 'Rear defrost', ICONS.rearDef, BLUE),
    seat('driver', 'Driver', ICONS.seat),
    seat('passenger', 'Passenger', ICONS.seat),
    toggle('wheel', 'wheel', 'Steering wheel', ICONS.wheel, RED),
    seat('rear', 'Rear seats', ICONS.rear),
  ]

  return (
    <Sheet title="Climate" onClose={onClose} subtitle={<>
      Interior <strong className="font-semibold text-ink">{t.insideF ?? '–'}°</strong>  ·  Exterior <strong className="font-semibold text-ink">{t.outsideF ?? '–'}°</strong>
    </>}>
      <div className="flex flex-col items-center gap-2.5">
        <div className="flex items-center gap-3 sm:gap-10">
          <button onClick={() => nudge(-1)} disabled={target <= t.minF} aria-label="Lower target temperature" className="flex h-[52px] w-[52px] items-center justify-center rounded-full text-[#a7b4c2] hover:bg-white/5 disabled:opacity-30"><Chevron dir="l" /></button>
          <span className="min-w-[120px] text-center text-[64px] font-light leading-none sm:min-w-[150px] sm:text-[84px]" style={{ color: on ? '#e8edf2' : DIM }}>{target}°</span>
          <button onClick={() => nudge(1)} disabled={target >= t.maxF} aria-label="Raise target temperature" className="flex h-[52px] w-[52px] items-center justify-center rounded-full text-[#a7b4c2] hover:bg-white/5 disabled:opacity-30"><Chevron dir="r" /></button>
          <button onClick={() => void act(on ? 'climate_off' : 'climate_on', {}, { climateOn: !on })} aria-label={on ? 'Turn climate off' : 'Turn climate on'} aria-pressed={on}
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-[6px] sm:h-[84px] sm:w-[84px]"
            style={{ borderColor: on ? tint(BLUE, 0.25) : IDLE_BG, background: on ? BLUE : '#2c3640', color: on ? '#fff' : '#c9d2db' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M12 3v8" /><path d="M6.3 6.6a8 8 0 1 0 11.4 0" /></svg>
          </button>
        </div>
        <span className="text-[17px]" style={{ color: on ? (heating ? RED : BLUE) : DIM }}>{status}</span>
      </div>

      <div className="h-px bg-edge" />

      <div className="grid grid-cols-3 gap-y-5 gap-x-2 sm:grid-cols-6">
        {controls.map((c) => (
          <button key={c.key} onClick={c.tap} disabled={!c.available} aria-label={c.aria}
            className="flex flex-col items-center gap-2.5 py-1 disabled:opacity-35">
            <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full transition-colors"
              style={{ background: c.active ? tint(c.color, 0.22) : IDLE_BG, color: c.active ? c.color : '#c9d2db' }}>
              {c.icon}
            </span>
            <span className="text-center text-[15px] leading-tight text-[#c9d2db]">{c.label}</span>
            <span className="flex h-1 gap-1">
              {c.bars !== null && [1, 2, 3].map((i) => (
                <span key={i} className="h-1 w-3.5 rounded-sm" style={{ background: Math.abs(c.bars!) >= i ? c.color : OFF_BAR }} />
              ))}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
