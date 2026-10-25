import { useCallback, useRef } from 'react'
import { useHome } from './useHome'
import { kelvinToRgb, rgbToHex, WARM_WHITE, type RGB } from './lightColor'
import type { Light } from '../types'

export interface LightChange { on?: boolean; brightnessPct?: number; kelvin?: number; rgb?: RGB }

/** Light commands, with the screen updated right away. */
export function useLightActions() {
  const { data, update, send } = useHome()
  const cans = data?.lighting?.cans ?? null

  // Changing the bedroom overhead group changes both cans
  const affects = useCallback((ids: string[], l: Light) =>
    ids.includes(l.id) || (!!cans && ids.includes(cans.groupId) && (l.id === cans.windowId || l.id === cans.dresserId)), [cans])

  const patch = useCallback((ids: string[], fn: (l: Light) => Partial<Light>) => {
    update((s) => ({ ...s, lights: s.lights.map((l) => (affects(ids, l) ? { ...l, ...fn(l) } : l)) }))
  }, [update, affects])

  const set = useCallback((ids: string[], c: LightChange, opts?: { linked?: boolean }) => {
    patch(ids, (l) => {
      const on = c.on ?? (c.brightnessPct || c.kelvin || c.rgb ? true : l.on)
      const color = c.kelvin ? rgbToHex(kelvinToRgb(c.kelvin)) : c.rgb ? rgbToHex(c.rgb) : l.color ?? WARM_WHITE
      return {
        on,
        brightnessPct: c.brightnessPct ?? (on && !l.brightnessPct ? 100 : l.brightnessPct),
        color: on ? color : null,
        kelvin: c.kelvin ?? (c.rgb ? null : l.kelvin),
      }
    })
    return send('lights/set', { ids, ...c, linked: opts?.linked })
  }, [patch, send])

  const toggle = useCallback((light: Light) => set([light.id], { on: !light.on }, { linked: false }), [set])

  const allOff = useCallback((scope: 'indoor' | 'all') => {
    update((s) => ({ ...s, lights: s.lights.map((l) => (scope === 'all' || !l.timer ? { ...l, on: false, color: null } : l)) }))
    return send('lights/off', { scope })
  }, [update, send])

  const scene = useCallback((id: string) => send('lights/scene', { id }), [send])

  return { set, toggle, allOff, scene }
}

/**
 * For sliders: send at most every `ms` while dragging, and always send the
 * final value when the finger lifts.
 */
export function useThrottle<T>(fn: (v: T) => void, ms = 200) {
  const last = useRef(0)
  const pending = useRef<{ v: T } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flush = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    if (pending.current) { const { v } = pending.current; pending.current = null; last.current = Date.now(); fn(v) }
  }, [fn])
  const push = useCallback((v: T) => {
    pending.current = { v }
    const wait = ms - (Date.now() - last.current)
    if (wait <= 0) flush()
    else if (!timer.current) timer.current = setTimeout(flush, wait)
  }, [flush, ms])
  return { push, flush }
}
