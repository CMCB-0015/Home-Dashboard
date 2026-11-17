import { useState } from 'react'
import { ChevronRight, Clock, Play, Pause, Square, TriangleAlert } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useHome } from '../../lib/useHome'
import { categories } from '../../lib/categories'
import { relativeTime, untilTime } from '../../lib/format'
import { DetailLayout } from '../../components/DetailLayout'
import { Card } from '../../components/Card'
import { Pill, StatusPill } from '../../components/Buttons'
import { nextRunText, useIrrigationActions, IrrigationControls } from '../../components/tiles/SmallTiles'
import { QuickRunPicker, QuickRunSheet, DEFAULT_MINUTES } from '../../components/irrigation/QuickRunPicker'
import { ScheduledRunSheet, useCancelWithUndo } from '../../components/irrigation/ScheduledRuns'
import { whenLabel } from '../../components/irrigation/scheduled'
import type { IrrigationZone } from '../../types'

const cfg = categories.irrigation

export function IrrigationPage() {
  const { data } = useHome()
  const { stop, resume, pause, startZones, scheduleRun } = useIrrigationActions()
  const [pick, setPick] = useState<IrrigationZone | null>(null)
  // A scheduled quick run's details open from ?scheduled=<id> (status-bar chip, card)
  const [params, setParams] = useSearchParams()
  const openId = params.get('scheduled')
  const closeDetails = () => setParams((p) => { p.delete('scheduled'); return p }, { replace: true })
  const undo = useCancelWithUndo()
  if (!data) return null
  const scheduled = (data.irrigation?.scheduled ?? []).filter((r) => r.id !== undo.hiddenId)
  const open = openId ? scheduled.find((r) => r.id === openId) : undefined
  const next = data.irrigation?.nextRun
  const quickRuns = data.irrigation?.quickRuns ?? []
  const unmatched = quickRuns.filter((r) => !r.available)

  const zoneChoices = data.irrigationZones.map((z) => ({ id: z.id, name: z.name.trim() }))

  return (
    <DetailLayout title="Irrigation" subtitle="Schedules stay in the Rachio app — run or stop anything from here." color={cfg.color}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card accent={cfg.color} title="Next scheduled run" category="irrigation">
          {next ? (
            <>
              <p className="font-mono text-2xl">{nextRunText(next.at)}</p>
              <p className="mt-1 text-sm text-ink-dim">{next.name} · {untilTime(next.at)}</p>
            </>
          ) : <p className="text-sm text-ink-faint">Nothing scheduled.</p>}
        </Card>
        <Card accent={cfg.color} title="Controls">
          <IrrigationControls stacked={false} />
          {unmatched.length > 0 && (
            <div className="mt-3 rounded-lg bg-critical-dim p-3 text-xs text-ink">
              <p className="font-medium">Some buttons aren't matched to Rachio:</p>
              <ul className="mt-1 list-disc pl-4 text-ink-dim">{unmatched.map((r) => <li key={r.id}>{r.label}: {r.reason}</li>)}</ul>
            </div>
          )}
        </Card>
      </div>

      {scheduled.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Scheduled quick runs</h2>
          <div className="flex flex-col gap-2">
            {scheduled.map((r) => {
              const warn = r.state !== 'pending'
              return (
                <button key={r.id} type="button" onClick={() => setParams((p) => { p.set('scheduled', r.id); return p })}
                  className="flex min-h-14 items-center gap-3 rounded-2xl border bg-surface px-4 text-left hover:bg-surface-raised"
                  style={{ borderColor: warn ? '#f2c14e' : 'var(--color-edge)' }}>
                  {warn ? <TriangleAlert size={17} style={{ color: '#f2c14e' }} /> : <Clock size={17} style={{ color: cfg.color }} />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{r.state === 'missed' ? 'Missed · ' : r.state === 'waiting' ? 'Waiting · ' : ''}{whenLabel(Date.parse(r.at))}</span>
                    <span className="block truncate text-xs text-ink-dim">{r.reason && warn ? `${r.reason} · ` : ''}{r.zones.map((z) => `${z.name} ${z.minutes}m`).join(', ')}</span>
                  </span>
                  <ChevronRight size={16} className="text-ink-faint" />
                </button>
              )
            })}
          </div>
        </>
      )}

      <h2 className="mb-2 mt-8 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Zones</h2>
      <div className="flex flex-col gap-3">
        {data.irrigationZones.map((z) => (
          <Card key={z.id} accent={cfg.color}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-sm font-semibold">{z.name}</h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {z.isWatering && <StatusPill label={`Watering${z.minutesLeft ? ` · ${z.minutesLeft} min left` : ''}`} color={cfg.color} dim={cfg.dim} pulse />}
                  {z.isPaused && <StatusPill label="Paused" color="var(--color-ink-dim)" dim="var(--color-surface-raised)" />}
                  {z.rainDelay && <StatusPill label="Rain delay" color="var(--color-rain)" dim="var(--color-calendar-dim)" />}
                  {!z.isWatering && !z.isPaused && !z.rainDelay && <span className="text-xs text-ink-faint">Next run {untilTime(z.nextRunAt)}</span>}
                </div>
                <p className="mt-1 text-xs text-ink-faint">Last run {relativeTime(z.lastRunAt)}</p>
              </div>
              {z.isWatering || z.isPaused
                ? <div className="flex gap-2">
                    {z.isPaused
                      ? <Pill color={cfg.color} dim={cfg.dim} onClick={() => resume(z)}><Play size={12} fill="currentColor" /> Resume</Pill>
                      : <Pill color={cfg.color} dim={cfg.dim} onClick={() => pause(z)}><Pause size={12} fill="currentColor" /> Pause</Pill>}
                    <Pill color={cfg.color} dim={cfg.dim} onClick={() => stop(z)}><Square size={11} fill="currentColor" /> Stop</Pill>
                  </div>
                : <Pill color={cfg.color} dim={cfg.dim} onClick={() => setPick(z)}><Play size={12} fill="currentColor" /> Quick run</Pill>}
            </div>
          </Card>
        ))}
      </div>
      {pick && (
        <QuickRunSheet title={pick.name.trim()} onClose={() => setPick(null)}>
          <QuickRunPicker zones={zoneChoices} first={{ zoneId: pick.id, minutes: DEFAULT_MINUTES }} summary={data.irrigation}
            onStart={(rows) => { setPick(null); void startZones(rows) }}
            onSchedule={(rows, at) => { setPick(null); void scheduleRun(rows, at) }} />
        </QuickRunSheet>
      )}
      {open && <ScheduledRunSheet key={open.id} run={open} summary={data.irrigation} zones={zoneChoices} onCancel={undo.cancel} onClose={closeDetails} />}
      {undo.bar}
    </DetailLayout>
  )
}
