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

/** How a command's progress is tracked: which button it belongs to, and how to tell it has happened */
export interface ActOptions {
  /** Which control is busy (e.g. 'trunk'), so it can show "Opening…" */
  key?: string
  /** True once the car reports the change — the action counts as done right then */
  done?: (t: Tesla) => boolean
}
export type TeslaAct = (action: string, extra?: Record<string, unknown>, change?: Partial<Tesla>, opts?: ActOptions) => Promise<boolean>

interface Pending { id: number; key?: string; done?: (t: Tesla) => boolean; asleep: boolean }

/**
 * Sends Tesla commands. The screen changes right away (`change`), and goes
 * back if the command fails. An action is finished as soon as the car reports
 * the change (`done`) — over Teslemetry's live stream that's usually well
 * before Tesla's server confirms the command — or when the command returns,
 * whichever comes first (if the command returns before the new state, the
 * button stays busy up to 8 s more, so the old state doesn't flash back). A sleeping car wakes on the first command (10–30 s):
 * `waking` is true until the car reports it's awake or the action is done.
 */
export function useTeslaActions() {
  const { data, update, send } = useHome()
  const [pending, setPending] = useState<Pending[]>([])
  const seq = useRef(0)
  const t = data?.tesla ?? null
  const online = t?.online ?? true
  const onlineRef = useRef(online)
  onlineRef.current = online
  const tRef = useRef(t)
  tRef.current = t

  // Finish actions the moment the car reports the change
  useEffect(() => {
    if (!t) return
    setPending((ps) => {
      const left = ps.filter((p) => !(p.done && p.done(t)))
      return left.length === ps.length ? ps : left
    })
  }, [t])

  const act: TeslaAct = useCallback(async (action, extra = {}, change, opts) => {
    if (change) update((s) => (s.tesla ? { ...s, tesla: { ...s.tesla, ...change } } : s))
    const id = ++seq.current
    setPending((ps) => [...ps, { id, key: opts?.key, done: opts?.done, asleep: !onlineRef.current }])
    const drop = () => setPending((ps) => ps.filter((p) => p.id !== id))
    let ok = false
    try { ok = await send('tesla/command', { action, ...extra }); return ok } finally {
      // Tesla said yes but the new state hasn't arrived yet: keep "Opening…"
      // up a little longer rather than flash the old state, then let go.
      const waitMore = ok && opts?.done && !(tRef.current && opts.done(tRef.current))
      if (waitMore) setTimeout(drop, 8000)
      else drop()
    }
  }, [update, send])

  const busy = useCallback((key: string) => pending.some((p) => p.key === key), [pending])
  return { act, waking: !online && pending.some((p) => p.asleep), busy }
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
