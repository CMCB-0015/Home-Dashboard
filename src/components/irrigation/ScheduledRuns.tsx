import { useCallback, useEffect, useRef, useState } from 'react'
import { Clock, TriangleAlert, Undo2 } from 'lucide-react'
import type { IrrigationSummary, ScheduledQuickRun } from '../../types'
import { useIrrigationActions } from '../tiles/SmallTiles'
import { QuickRunPicker, QuickRunSheet, type PickZone } from './QuickRunPicker'
import { inLabel, timeOf, totalMinutes, whenLabel, MINUTE } from './scheduled'

const CYAN = 'var(--color-irrigation)'
const AMBER = '#f2c14e'
const btn = 'flex min-h-11 flex-1 items-center justify-center rounded-[10px] border border-edge bg-surface text-[13px] font-medium active:scale-[0.97]'

/**
 * Details of a quick run set to start later: when, its zones, and Edit / Start
 * now / Cancel. A waiting run (due, but something else is watering) offers
 * Start now / Cancel; a missed one Run now / Dismiss.
 */
export function ScheduledRunSheet({ run, summary, zones, onCancel, onClose }: {
  run: ScheduledQuickRun; summary: IrrigationSummary; zones: PickZone[]
  onCancel: (r: ScheduledQuickRun) => void; onClose: () => void
}) {
  const a = useIrrigationActions()
  const [editing, setEditing] = useState(false)
  const at = Date.parse(run.at)
  const total = totalMinutes(run.zones)
  const rows = run.zones.map((z) => ({ zoneId: z.zoneId, minutes: z.minutes }))

  if (editing) {
    return (
      <QuickRunSheet title="Edit scheduled quick run" onClose={onClose}>
        <QuickRunPicker zones={zones} first={rows[0]} firstRows={rows} initialAt={at} editId={run.id} summary={summary}
          onStart={(r) => { onClose(); void a.runScheduledNow(run.id, r) }}
          onSchedule={(r, t) => { onClose(); void a.updateScheduled(run.id, r, t) }} />
      </QuickRunSheet>
    )
  }

  const missed = run.state === 'missed', waiting = run.state === 'waiting'
  return (
    <QuickRunSheet title={whenLabel(at)} eyebrow={missed ? 'Quick run missed' : waiting ? 'Quick run waiting' : 'Scheduled quick run'}
      subtitle={missed || waiting ? undefined : `${inLabel(at)} · set ${whenLabel(Date.parse(run.createdAt))}`} onClose={onClose}>
      {(missed || waiting) && run.reason && (
        <p className="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[13px]" style={{ borderColor: AMBER, background: 'rgba(242,193,78,0.08)' }}>
          <TriangleAlert size={15} className="mt-0.5 shrink-0" style={{ color: AMBER }} />
          <span>{run.reason}{waiting && run.reason.endsWith('is watering') ? ' — it starts as soon as that ends.' : '.'}</span>
        </p>
      )}
      <ol className="flex flex-col gap-1.5" aria-label="Zones">
        {run.zones.map((z, k) => (
          <li key={z.zoneId} className="flex min-h-10 items-center gap-2.5 rounded-[10px] border border-edge bg-surface px-3 text-[13px]">
            <span className="font-mono text-[11px] text-ink-faint">{k + 1}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{z.name}</span>
            <span className="font-mono text-xs text-ink-dim">{z.minutes}m</span>
          </li>
        ))}
      </ol>
      <p className="text-[12.5px] text-ink-dim">{total} min total{!missed && !waiting ? <> · done ~<span className="font-mono text-ink">{timeOf(at + total * MINUTE)}</span></> : null}</p>
      {missed ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => { onClose(); void a.runScheduledNow(run.id) }} className="min-h-12 flex-1 rounded-xl text-sm font-semibold text-bg" style={{ background: CYAN }}>Run now · {total} min</button>
          <button type="button" onClick={() => { onClose(); void a.dismissScheduled(run.id) }} className={btn}>Dismiss</button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            {!waiting && <button type="button" onClick={() => setEditing(true)} className={btn}>Edit</button>}
            <button type="button" onClick={() => { onClose(); void a.runScheduledNow(run.id) }} className={btn}>Start now</button>
          </div>
          <button type="button" onClick={() => { onClose(); onCancel(run) }}
            className="min-h-11 rounded-[10px] text-[13.5px] font-medium active:scale-[0.98]" style={{ background: 'rgba(255,107,94,0.16)', color: '#ff6b5e' }}>Cancel this run</button>
        </>
      )}
    </QuickRunSheet>
  )
}

/**
 * Cancel with a 5-second Undo (like deleting a calendar event): the run is hidden
 * right away and only cancelled on the server when the 5 seconds run out.
 */
export function useCancelWithUndo() {
  const a = useIrrigationActions()
  const [pending, setPending] = useState<ScheduledQuickRun | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const commit = useCallback((r: ScheduledQuickRun) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    setPending(null)
    void a.cancelScheduled(r.id)
  }, [a])
  const cancel = (r: ScheduledQuickRun) => {
    if (pending) commit(pending)
    // Due within the next few seconds: cancel straight away
    if (Date.parse(r.at) - Date.now() < 10_000) { void a.cancelScheduled(r.id); return }
    setPending(r)
    timer.current = setTimeout(() => commit(r), 5000)
  }
  const undo = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; setPending(null) }
  // Leaving the page: finish the cancel now
  // (refs, not deps: the actions object is new on every render, and a cleanup
  // that ran on every render would cancel straight away and skip the Undo)
  const latest = useRef(pending); latest.current = pending
  const actions = useRef(a); actions.current = a
  useEffect(() => () => { if (latest.current) { if (timer.current) clearTimeout(timer.current); void actions.current.cancelScheduled(latest.current.id) } }, [])
  const bar = pending && (
    <div role="status" className="fixed inset-x-3 bottom-4 z-50 mx-auto flex min-h-[56px] max-w-md items-center gap-2.5 overflow-hidden rounded-xl border border-[#33404c] bg-[#222c36] pl-4 pr-1.5 text-[13px] shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
      <Clock size={16} className="shrink-0 text-ink-dim" />
      <span className="min-w-0 flex-1 truncate">Canceled quick run · {whenLabel(Date.parse(pending.at))}</span>
      <button type="button" onClick={undo} className="flex h-11 items-center gap-1.5 rounded-[10px] px-3.5 text-sm font-semibold hover:bg-[#2a3540]" style={{ color: CYAN }}><Undo2 size={16} />Undo</button>
      <span key={pending.id} className="undo-progress absolute bottom-0 left-0 h-[3px] w-full" style={{ background: CYAN }} />
    </div>
  )
  return { cancel, hiddenId: pending?.id ?? null, bar }
}
