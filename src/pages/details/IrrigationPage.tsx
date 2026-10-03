import { Play, Square } from 'lucide-react'
import { useHome } from '../../lib/useHome'
import { categories } from '../../lib/categories'
import { relativeTime, untilTime } from '../../lib/format'
import { DetailLayout } from '../../components/DetailLayout'
import { Card } from '../../components/Card'
import { Pill, StatusPill } from '../../components/Buttons'

const cfg = categories.irrigation

export function IrrigationPage() {
  const { data, update, send } = useHome()
  if (!data) return null
  const toggle = (id: string, start: boolean) => {
    update((s) => ({ ...s, irrigationZones: s.irrigationZones.map((z) => (z.id === id ? { ...z, isWatering: start, minutesLeft: start ? 10 : null } : z)) }))
    send('rachio/command', { action: start ? 'start' : 'stop', zoneId: id })
  }
  return (
    <DetailLayout title="Irrigation" subtitle="Manual zone control — schedules stay in the Rachio app." color={cfg.color}>
      <div className="flex flex-col gap-3">
        {data.irrigationZones.map((z) => (
          <Card key={z.id} accent={cfg.color}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-sm font-semibold">{z.name}</h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {z.isWatering && <StatusPill label={`Watering${z.minutesLeft ? ` · ${z.minutesLeft} min left` : ''}`} color={cfg.color} dim={cfg.dim} pulse />}
                  {z.rainDelay && <StatusPill label="Rain delay" color="var(--color-rain)" dim="var(--color-calendar-dim)" />}
                  {!z.isWatering && !z.rainDelay && <span className="text-xs text-ink-faint">Next run {untilTime(z.nextRunAt)}</span>}
                </div>
                <p className="mt-1 text-xs text-ink-faint">Last run {relativeTime(z.lastRunAt)}</p>
              </div>
              <Pill color={cfg.color} dim={cfg.dim} onClick={() => toggle(z.id, !z.isWatering)}>
                {z.isWatering ? <><Square size={11} fill="currentColor" /> Stop</> : <><Play size={12} /> Run 10 min</>}
              </Pill>
            </div>
          </Card>
        ))}
      </div>
    </DetailLayout>
  )
}
