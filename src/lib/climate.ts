import type { Thermostat, ThermostatMode } from '../types'

export const MODE_LABEL: Record<ThermostatMode, string> = {
  heat: 'Heat', cool: 'Cool', heat_cool: 'Heat · Cool', eco: 'Eco', off: 'Off',
}

/** "70°" or "68–74°" in Heat · Cool mode */
export function targetText(t: Thermostat): string {
  if (t.mode === 'heat_cool' && t.targetLowF != null && t.targetHighF != null) return `${Math.round(t.targetLowF)}–${Math.round(t.targetHighF)}°`
  if (t.mode === 'off') return 'Off'
  if (t.mode === 'eco') return 'Eco'
  return `${t.targetTempF}°`
}

/** The target can be changed from the dashboard in Heat, Cool and Heat · Cool */
export const canAdjust = (t: Thermostat) => t.mode === 'heat' || t.mode === 'cool' || t.mode === 'heat_cool'

/** Move the target up or down on screen right away (the server does the real change) */
export function nudge(t: Thermostat, delta: number): Thermostat {
  return {
    ...t,
    targetTempF: t.targetTempF + delta,
    targetLowF: t.targetLowF != null ? t.targetLowF + delta : t.targetLowF,
    targetHighF: t.targetHighF != null ? t.targetHighF + delta : t.targetHighF,
  }
}

export const actionText = (t: Thermostat) =>
  t.action === 'heating' ? 'Heating' : t.action === 'cooling' ? 'Cooling' : MODE_LABEL[t.mode]

/** The Halo dial's scale and Nest's Heat · Cool gap (°F) — match server/climate.ts */
export const DIAL_MIN = 50
export const DIAL_MAX = 90
export const MIN_GAP = 3

/** Set one setpoint exactly on screen (the server does the real change) */
export function setPoint(t: Thermostat, which: 'target' | 'low' | 'high', value: number): Thermostat {
  if (which === 'low') return { ...t, targetLowF: value }
  if (which === 'high') return { ...t, targetHighF: value }
  return { ...t, targetTempF: value }
}
