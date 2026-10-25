import { useCallback, useEffect, useState } from 'react'
import { useHome } from '../../lib/useHome'
import { VAC_GREY, runProgress } from '../../lib/vacuum'
import type { VacuumState } from '../../types'

export const AMBER = '#f2c14e'
export const GREEN = '#4fd18b'
export const DIM = '#8493a1'

/**
 * Vacuum commands. `starting` names the button that was pressed until the
 * robot actually starts (or 20 seconds pass), so it can say "Starting…".
 */
export function useVacuumActions() {
  const { data, update, send } = useHome()
  const [starting, setStarting] = useState<string | null>(null)
  const state = data?.vacuum?.state

  useEffect(() => { if (state === 'cleaning') setStarting(null) }, [state])
  useEffect(() => { if (!starting) return; const t = setTimeout(() => setStarting(null), 20_000); return () => clearTimeout(t) }, [starting])

  const act = useCallback(async (body: Record<string, unknown>, change?: Partial<VacuumState>, startingId?: string) => {
    if (startingId) setStarting(startingId)
    if (change) update((s) => (s.vacuum ? { ...s, vacuum: { ...s.vacuum, ...change } } : s))
    const ok = await send('vacuum/command', body)
    if (!ok) setStarting(null)
    return ok
  }, [update, send])

  return {
    act, starting,
    pause: () => act({ action: 'pause' }, { state: 'paused' }),
    resume: () => act({ action: 'resume' }, { state: 'cleaning' }),
    dock: () => act({ action: 'dock' }, { state: 'returning' }),
    preset: (id: string) => act({ action: 'preset', preset: id }, undefined, id),
    full: () => act({ action: 'clean' }, undefined, 'full'),
  }
}

/** Everything the card and page say about the robot right now */
export function describe(v: VacuumState) {
  const running = v.state === 'cleaning' || v.state === 'paused'
  const prog = runProgress(v)
  const run = v.run
  const cur = running && v.currentRoom ? v.rooms.find((r) => r.id === v.currentRoom) ?? null : null
  const only = run && run.rooms.length === 1 ? v.rooms.find((r) => r.id === run.rooms[0]) ?? null : null
  const color = cur?.color ?? only?.color ?? VAC_GREY
  const roomName = cur?.name ?? only?.name ?? run?.name ?? 'Cleaning'
  const dockIssue = v.dock.cleanWater === 'empty' || v.dock.dirtyWater === 'full' || !!v.dock.problem

  const header = { docked: 'Docked', cleaning: 'Cleaning', paused: 'Paused', returning: 'Returning', idle: 'Idle', error: 'Needs help' }[v.state]
  let status: string, statusColor: string
  if (v.state === 'error') { status = v.error ?? 'Needs attention'; statusColor = AMBER }
  else if (v.state === 'cleaning') { status = `Cleaning ${roomName}`; statusColor = color === VAC_GREY ? '#c9d2db' : color }
  else if (v.state === 'paused') { status = `Paused · ${roomName}`; statusColor = '#c9d2db' }
  else if (v.state === 'returning') { status = 'Returning to dock'; statusColor = '#c9d2db' }
  else if (dockIssue) { status = 'Needs attention'; statusColor = AMBER }
  else { status = v.state === 'idle' ? 'Off the dock' : 'Ready'; statusColor = DIM }

  // Glow: full while cleaning, half while paused (same rule as Lights and Sonos)
  const k = v.state === 'cleaning' ? 1 : v.state === 'paused' ? 0.5 : 0

  let alert: { text: string; detail: string } | null = null
  if (v.state === 'error') alert = { text: v.error ?? 'Needs attention', detail: 'Check the robot' }
  else if (v.dock.cleanWater === 'empty') alert = { text: 'Clean water tank is empty', detail: 'Refill to mop' }
  else if (v.dock.dirtyWater === 'full') alert = { text: 'Dirty water tank is full', detail: 'Empty to mop' }
  else if (v.dock.problem) alert = { text: v.dock.problem, detail: 'Check the dock' }

  return { running, prog, run, cur, color, roomName, header, status, statusColor, k, alert }
}

export function dockRows(v: VacuumState) {
  const rows: { label: string; value: string; bad: boolean }[] = []
  if (v.dock.cleanWater) rows.push({ label: 'Clean water', value: v.dock.cleanWater === 'empty' ? 'Empty' : 'OK', bad: v.dock.cleanWater === 'empty' })
  if (v.dock.dirtyWater) rows.push({ label: 'Dirty water', value: v.dock.dirtyWater === 'full' ? 'Full' : 'OK', bad: v.dock.dirtyWater === 'full' })
  if (v.dock.mopDrying !== null) rows.push({ label: 'Mop drying', value: v.dock.mopDrying ? (v.dock.dryingMinutes ? `${v.dock.dryingMinutes} min left` : 'Drying') : v.state === 'returning' ? 'Waiting' : 'Done', bad: false })
  return rows
}

/** "39 min · 334 ft²" */
export const statsText = (v: VacuumState) =>
  [v.cleanMinutes !== null ? `${v.cleanMinutes} min` : null, v.cleanAreaFt2 !== null ? `${v.cleanAreaFt2} ft²` : null].filter(Boolean).join(' · ')
