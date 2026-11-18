import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Clock, Undo2 } from 'lucide-react'
import type React from 'react'
import { useHome } from '../../lib/useHome'
import { useLongPress } from '../../lib/useLongPress'
import { QuickRunSheet, StartAt, defaultStart, startOk } from '../irrigation/QuickRunPicker'
import { inLabel, timeOf, whenLabel } from '../irrigation/scheduled'
import { doneBy, estimateRun } from '../../lib/vacuum'
import type { ScheduledClean, VacuumState } from '../../types'

/**
 * Scheduled cleans ("Start at…"), kept by Panel on the Lenovo (server/vacuumScheduled.ts).
 * The vacuum's version of the Rachio scheduled quick run: same sheet, same time picker,
 * in the vacuum's white instead of cyan.
 */
const INK = '#e8edf2'
const AMBER = '#f2c14e'
export type StartCmd = ScheduledClean['cmd']

export function useVacuumScheduled() {
  const { send } = useHome()
  const call = useCallback((body: Record<string, unknown>) => send('vacuum/scheduled', body), [send])
  return {
    add: (cmd: StartCmd, at: number) => call({ action: 'add', cmd, at: new Date(at).toISOString() }),
    update: (id: string, cmd: StartCmd, at: number) => call({ action: 'update', id, cmd, at: new Date(at).toISOString() }),
    cancel: (id: string) => call({ action: 'cancel', id }),
    dismiss: (id: string) => call({ action: 'dismiss', id }),
    runNow: (id: string) => call({ action: 'run-now', id }),
  }
}

/** Minutes the command would take, from the learned times (null = no estimate yet) */
export function estimateOf(v: VacuumState, cmd: StartCmd): number | null {
  const p = cmd.action === 'preset' ? v.presets.find((x) => x.id === cmd.preset) : null
  const e = estimateRun(v, p ? { rooms: p.rooms, vacuum: p.vacuum, mop: p.mop } : { rooms: cmd.rooms ?? [], vacuum: cmd.vacuum !== false, mop: cmd.mop !== false, passes: cmd.passes })
  return e.state === 'none' ? null : e.minutes
}

/**
 * Start sheet: what will run, Starts: Now | Start at…, then Start or Schedule.
 * Opened from the clock beside Start on Map & rooms, or by pressing and holding a preset.
 * With `edit`, it's the scheduled clean's Edit (opens on Start at…, button says Save).
 */
export function VacStartSheet({ v, title, subtitle, cmd, edit, onStartNow, onClose }: {
  v: VacuumState
  title: string
  subtitle: string
  cmd: StartCmd
  edit?: ScheduledClean
  onStartNow: () => void
  onClose: () => void
}) {
  const s = useVacuumScheduled()
  const [later, setLater] = useState(!!edit)
  const [at, setAt] = useState<number>(() => (edit ? Date.parse(edit.at) : defaultStart()))
  const [busy, setBusy] = useState(false)
  const est = estimateOf(v, cmd)
  const schedule = async () => {
    setBusy(true)
    const ok = await (edit ? s.update(edit.id, cmd, at) : s.add(cmd, at))
    setBusy(false)
    if (ok) onClose()
  }
  return (
    <QuickRunSheet eyebrow={edit ? 'Scheduled clean' : 'Start'} title={title} subtitle={`${subtitle}${est ? ` · ~${est} min` : ''}`} onClose={onClose}>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Starts</p>
      <div role="radiogroup" aria-label="When to start" className="grid grid-cols-2 rounded-xl border border-edge bg-surface p-[3px]">
        {([false, true] as const).map((x) => (
          <button key={String(x)} type="button" role="radio" aria-checked={later === x} onClick={() => setLater(x)}
            className="flex min-h-10 items-center justify-center gap-1.5 rounded-[9px] text-[13.5px] font-medium transition-colors"
            style={later === x ? { background: 'var(--color-edge)', color: 'var(--color-ink)' } : { color: 'var(--color-ink-dim)' }}>
            {x ? <><Clock size={14} />Start at…</> : 'Now'}
          </button>
        ))}
      </div>
      {later && <StartAt value={at} onChange={setAt} minutes={est ?? 0} color={INK} note={est ? `done ~${timeOf(at + est * 60_000)}` : undefined} />}
      {later ? (
        <button type="button" disabled={!startOk(at) || busy} onClick={() => void schedule()}
          className="min-h-12 rounded-xl text-sm font-semibold text-bg active:scale-[0.98] disabled:opacity-40" style={{ background: INK }}>
          {busy ? 'Saving…' : `${edit ? 'Save' : 'Schedule'} · ${whenLabel(at)}`}
        </button>
      ) : (
        <button type="button" onClick={async () => { if (edit) { if (await s.runNow(edit.id)) onClose() } else { onClose(); onStartNow() } }} className="min-h-12 rounded-xl text-sm font-semibold text-bg active:scale-[0.98]" style={{ background: INK }}>
          Start {title}{est ? ` · ~${est} min` : ''}
        </button>
      )}
    </QuickRunSheet>
  )
}

/** What a scheduled clean will do, in words: "Vacuum + mop · Master, Margaux’s, Guest · Balanced · Medium water" */
export function cleanDetail(v: VacuumState, s: ScheduledClean) {
  const p = s.cmd.action === 'preset' ? v.presets.find((x) => x.id === s.cmd.preset) : null
  const vac = p ? p.vacuum : s.cmd.vacuum !== false, mop = p ? p.mop : s.cmd.mop !== false
  const mode = vac && mop ? 'Vacuum + mop' : vac ? 'Vacuum only' : 'Mop only'
  const all = s.rooms.length >= v.rooms.length
  const rooms = all ? 'whole home' : s.rooms.map((id) => v.rooms.find((r) => r.id === id)?.name.replace(/ (bedroom|room)$/i, '') ?? id).join(', ')
  const extra = [s.cmd.suction && s.cmd.suction[0].toUpperCase() + s.cmd.suction.slice(1), s.cmd.water && mop && `${s.cmd.water[0].toUpperCase() + s.cmd.water.slice(1)} water`, s.cmd.passes && s.cmd.passes > 1 && `${s.cmd.passes}×`].filter(Boolean)
  return [mode, rooms, ...extra].join(' · ')
}

/** Details: when, what, estimate; Edit · Start now · Cancel (5 s Undo). Skipped / missed: why, Run now · Dismiss. */
export function VacScheduledSheet({ v, s, onEdit, onCancel, onClose }: { v: VacuumState; s: ScheduledClean; onEdit: () => void; onCancel: () => void; onClose: () => void }) {
  const act = useVacuumScheduled()
  const at = Date.parse(s.at)
  const est = estimateOf(v, s.cmd)
  const done = s.state !== 'pending'
  const created = new Date(s.createdAt)
  return (
    <QuickRunSheet eyebrow={done ? (s.state === 'skipped' ? 'Clean skipped' : 'Clean missed') : 'Scheduled clean'} title={whenLabel(at)}
      subtitle={done ? s.reason ?? undefined : `${inLabel(at)} · set ${created.toLocaleDateString('en-US', { weekday: 'short' })} ${timeOf(created.getTime())}`} onClose={onClose}>
      <div className="flex flex-col gap-0.5 rounded-[10px] border border-edge bg-surface px-3 py-2.5">
        <span className="text-sm font-semibold">{s.name}</span>
        <span className="text-[12.5px] text-ink-dim">{cleanDetail(v, s)}</span>
      </div>
      {est !== null && <p className="text-[12.5px] text-ink-dim"><span className="font-mono">~{est} min</span>{!done && ` · done ~${timeOf(at + est * 60_000)}`}</p>}
      {done ? (
        <div className="flex gap-1.5">
          <button type="button" onClick={async () => { if (await act.runNow(s.id)) onClose() }} className="min-h-11 flex-1 rounded-[10px] text-[13.5px] font-semibold text-bg" style={{ background: INK }}>Run now</button>
          <button type="button" onClick={async () => { if (await act.dismiss(s.id)) onClose() }} className="min-h-11 flex-1 rounded-[10px] border border-edge bg-surface text-[13.5px] font-medium">Dismiss</button>
        </div>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-ink-faint">Skips (with a chip) if the robot is already cleaning, cleaned {s.rooms.length === 1 ? 'this room' : 'these rooms'} in the last 2 h, the dock can’t mop, or the battery is under 20%.</p>
          <div className="flex gap-1.5">
            <button type="button" onClick={onEdit} className="min-h-11 flex-1 rounded-[10px] border border-edge bg-surface text-[13px] font-medium">Edit</button>
            <button type="button" onClick={async () => { if (await act.runNow(s.id)) onClose() }} className="min-h-11 flex-1 rounded-[10px] border border-edge bg-surface text-[13px] font-medium">Start now</button>
          </div>
          <button type="button" onClick={() => { onCancel(); onClose() }} className="min-h-11 rounded-[10px] text-[13.5px] font-medium" style={{ background: 'rgba(255,107,94,.16)', color: '#ff6b5e' }}>Cancel this clean</button>
        </>
      )}
    </QuickRunSheet>
  )
}

/** Cancel with a 5-second Undo bar (like the Rachio quick runs and calendar deletes) */
export function useCancelCleanWithUndo(): { cancel: (s: ScheduledClean) => void; bar: ReactNode } {
  const act = useVacuumScheduled()
  const [pending, setPending] = useState<ScheduledClean | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const actRef = useRef(act); actRef.current = act
  const latest = useRef(pending); latest.current = pending
  const commit = (s: ScheduledClean) => { if (timer.current) clearTimeout(timer.current); timer.current = null; setPending(null); void actRef.current.cancel(s.id) }
  const cancel = (s: ScheduledClean) => {
    if (latest.current) commit(latest.current)
    if (Date.parse(s.at) - Date.now() < 10_000) { void act.cancel(s.id); return }
    setPending(s)
    timer.current = setTimeout(() => commit(s), 5000)
  }
  const undo = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; setPending(null) }
  useEffect(() => () => { if (latest.current) { if (timer.current) clearTimeout(timer.current); void actRef.current.cancel(latest.current.id) } }, [])
  const bar = pending && (
    <div role="status" className="fixed inset-x-3 bottom-4 z-50 mx-auto flex min-h-[56px] max-w-md items-center gap-2.5 overflow-hidden rounded-xl border border-[#33404c] bg-[#222c36] pl-4 pr-1.5 text-[13px] shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
      <Clock size={16} className="shrink-0 text-ink-dim" />
      <span className="min-w-0 flex-1 truncate">Canceled {pending.name} · {whenLabel(Date.parse(pending.at))}</span>
      <button type="button" onClick={undo} className="flex h-11 items-center gap-1.5 rounded-[10px] px-3.5 text-sm font-semibold hover:bg-[#2a3540]" style={{ color: INK }}><Undo2 size={16} />Undo</button>
      <span key={pending.id} className="undo-progress absolute bottom-0 left-0 h-[3px] w-full" style={{ background: INK }} />
    </div>
  )
  return { cancel, bar }
}

/** Short time for the narrow card: "8:00 PM" today, else "Wed 10 AM" */
function shortWhen(t: number) {
  const d = new Date(t), today = new Date()
  const time = timeOf(t).replace(':00 ', ' ')
  return d.toDateString() === today.toDateString() ? timeOf(t) : `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${time}`
}

/** Card row for the next scheduled clean (or one that was skipped / missed) */
export function NextCleanRow({ s, onOpen }: { s: ScheduledClean; onOpen: () => void }) {
  const warn = s.state !== 'pending'
  return (
    <button type="button" onClick={onOpen}
      className="flex min-h-11 w-full items-center gap-2 rounded-xl border bg-surface px-3 text-left text-[13px] font-semibold active:scale-[0.99]"
      style={{ borderColor: warn ? AMBER : 'color-mix(in srgb, var(--color-vacuum) 70%, transparent)' }}>
      {warn ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: AMBER, boxShadow: `0 0 6px ${AMBER}` }} /> : <Clock size={15} className="shrink-0 text-[#c9d2db]" />}
      <span className="max-w-[60%] shrink-0 truncate">{warn ? `${s.state === 'skipped' ? 'Skipped' : 'Missed'} · ${s.name}` : s.name}</span>
      <span className="ml-auto min-w-0 truncate text-right font-mono text-xs font-medium text-ink-dim">{warn ? s.reason : shortWhen(Date.parse(s.at))}</span>
    </button>
  )
}

/** The list shown on the card/page: pending first by time, then skipped / missed */
export const visibleScheduled = (v: VacuumState) => [...(v.scheduled ?? [])].sort((a, b) => (a.state === 'pending' ? 0 : 1) - (b.state === 'pending' ? 0 : 1) || Date.parse(a.at) - Date.parse(b.at))

export { doneBy }

/** A button where a tap does one thing and press-and-hold another (presets: tap = start now, hold = Start sheet) */
export function HoldButton({ onTap, onHold, children, ...rest }: { onTap: () => void; onHold: () => void; children: ReactNode } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  const lp = useLongPress(onTap, onHold)
  return <button type="button" {...rest} {...lp}>{children}</button>
}
