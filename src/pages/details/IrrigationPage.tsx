import { Play, Pause, Square } from 'lucide-react'
import { useHome } from '../../lib/useHome'
import { categories } from '../../lib/categories'
import { relativeTime, untilTime } from '../../lib/format'
import { DetailLayout } from '../../components/DetailLayout'
import { Card } from '../../components/Card'
import { Pill, StatusPill } from '../../components/Buttons'
import { nextRunText, useIrrigationActions, IrrigationControls } from '../../components/tiles/SmallTiles'

const cfg = categories.irrigation

export function IrrigationPage() {
  const { data, update, send } = useHome()
  const { stop, resume, pause } = useIrrigationActions()
  if (!data) return null
  const next = data.irrigation?.nextRun
  const quickRuns = data.irrigation?.quickRuns ?? []
  const unmatched = quickRuns.filter((r) => !r.available)

  const startZone = (id: string) => {
    update((s) => ({ ...s, irrigationZones: s.irrigationZones.map((z) => (z.id === id ? { ...z, isWatering: true, minutesLeft: 10 } : z)) }))
    send('rachio/command', { action: 'start', zoneId: id }, { refresh: true })
  }

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
                : <Pill color={cfg.color} dim={cfg.dim} onClick={() => startZone(z.id)}><Play size={12} /> Run 10 min</Pill>}
            </div>
          </Card>
        ))}
      </div>
    </DetailLayout>
  )
}
