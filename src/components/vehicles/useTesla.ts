import { useCallback, useEffect, useRef, useState } from 'react'
import { useHome } from '../../lib/useHome'
import type { Tesla } from '../../types'

export const GREEN = '#4fd18b'
export const BLUE = '#5aa2ff'
export const RED = '#ff6b5e'
export const AMBER = '#f2c14e'
export const ACC = '#a7b4c2'
export const DIM = '#8493a1'
export const IDLE_BG = '#252e38'
export const OFF_BAR = '#3a4652'

/** rgba() from a #rrggbb color */
export const tint = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`
}

export type TeslaAct = (action: string, extra?: Record<string, unknown>, change?: Partial<Tesla>) => Promise<boolean>

/**
 * Sends Tesla commands. The screen changes right away (`change`), and goes
 * back if the command fails. A sleeping car wakes on the first command, which
 * takes 10–30 seconds — `waking` is true while that happens.
 */
export function useTeslaActions() {
  const { data, update, send } = useHome()
  const [pending, setPending] = useState(0)
  const online = data?.tesla?.online ?? true

  const act: TeslaAct = useCallback(async (action, extra = {}, change) => {
    if (change) update((s) => (s.tesla ? { ...s, tesla: { ...s.tesla, ...change } } : s))
    setPending((n) => n + 1)
    try { return await send('tesla/command', { action, ...extra }) } finally { setPending((n) => n - 1) }
  }, [update, send])

  return { act, waking: pending > 0 && !online }
}

/** Waits until the value stops changing (arrow taps, slider drags), then sends once */
export function useDebounced<T>(fn: (v: T) => void, ms = 700) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return useCallback((v: T) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => fnRef.current(v), ms)
  }, [ms])
}

/** "9:40 PM" */
export const clock = (iso: string | null) => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export const isCharging = (t: Tesla) => t.charging === 'charging' || t.charging === 'starting'
