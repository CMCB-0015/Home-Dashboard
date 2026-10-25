// The Nest thermostat, through Home Assistant.

import type { Thermostat, ThermostatMode } from '../src/types.ts'
import { ha, type HAState } from './ha.ts'

const KNOWN: ThermostatMode[] = ['heat', 'cool', 'heat_cool', 'off']
/** Order the mode buttons appear in */
const ORDER: ThermostatMode[] = ['heat', 'cool', 'heat_cool', 'eco', 'off']
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function thermostatStates(): HAState[] {
  // Never the car's climate (Teslemetry and friends)
  const all = ha.all('climate').filter((s) => !['teslemetry', 'tesla_fleet', 'tessie'].includes(ha.platform(s.entity_id) ?? ''))
  const nest = all.filter((s) => ha.platform(s.entity_id) === 'nest')
  return nest.length ? nest : all
}

export function thermostats(): Thermostat[] {
  return thermostatStates().map((s) => {
    const a = s.attributes
    const eco = a.preset_mode === 'eco'
    const mode: ThermostatMode = eco ? 'eco' : (KNOWN.includes(s.state as ThermostatMode) ? s.state : s.state === 'auto' ? 'heat_cool' : 'off') as ThermostatMode
    const offered: string[] = [...(Array.isArray(a.hvac_modes) ? a.hvac_modes : []), ...(Array.isArray(a.preset_modes) && a.preset_modes.includes('eco') ? ['eco'] : [])]
    const modes = ORDER.filter((m) => offered.includes(m))
    const low = num(a.target_temp_low), high = num(a.target_temp_high)
    const current = num(a.current_temperature) ?? 0
    const target = num(a.temperature) ?? (low !== null && high !== null ? Math.round((low + high) / 2) : current)
    return {
      id: s.entity_id,
      name: ha.name(s),
      room: ha.area(s.entity_id) ?? 'Home',
      currentTempF: Math.round(current),
      targetTempF: Math.round(target),
      targetLowF: low, targetHighF: high,
      humidityPct: Math.round(num(a.current_humidity) ?? 0),
      mode, modes,
      action: (a.hvac_action as Thermostat['action']) ?? null,
    }
  })
}

export async function setClimate(body: { deviceId?: string; delta?: number; targetTempF?: number; mode?: ThermostatMode }) {
  const s = body.deviceId ? ha.states.get(body.deviceId) : undefined
  if (!s || !s.entity_id.startsWith('climate.')) throw new Error("That thermostat isn't in Home Assistant")
  const id = [s.entity_id]
  const a = s.attributes

  if (body.mode) {
    if (body.mode === 'eco') return ha.callService('climate', 'set_preset_mode', { preset_mode: 'eco' }, id)
    if (!KNOWN.includes(body.mode)) throw new Error('Unknown mode')
    if (a.preset_mode === 'eco') await ha.callService('climate', 'set_preset_mode', { preset_mode: 'none' }, id)
    return ha.callService('climate', 'set_hvac_mode', { hvac_mode: body.mode }, id)
  }

  if (a.preset_mode === 'eco') throw new Error('The Nest is in Eco mode — switch to Heat or Cool to change the temperature')
  if (s.state === 'off') throw new Error('The Nest is off — pick Heat or Cool first')
  const clamp = (t: number) => Math.max(50, Math.min(90, Math.round(t)))
  const delta = Number(body.delta) || 0
  if (s.state === 'heat_cool' && num(a.target_temp_low) !== null && num(a.target_temp_high) !== null) {
    return ha.callService('climate', 'set_temperature', { target_temp_low: clamp(a.target_temp_low + delta), target_temp_high: clamp(a.target_temp_high + delta) }, id)
  }
  const target = typeof body.targetTempF === 'number' ? body.targetTempF : (num(a.temperature) ?? num(a.current_temperature) ?? 70) + delta
  return ha.callService('climate', 'set_temperature', { temperature: clamp(target) }, id)
}
