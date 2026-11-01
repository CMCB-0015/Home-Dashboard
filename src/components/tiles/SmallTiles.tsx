import { Play, Pause, Square, SkipForward, Check } from 'lucide-react'
import { useHome } from '../../lib/useHome'
import { categories } from '../../lib/categories'
import { clockTime } from '../../lib/format'
import { QuickRunButton, ConfirmButton } from '../QuickRunButton'
import { PAUSE_MINUTES } from '../../config/irrigation'
import type { QuickRun, IrrigationZone } from '../../types'
import { Pill } from '../Buttons'

// ── Irrigation ───────────────────────────────────────────────────────────
export function nextRunText(at: string): string {
  const d = new Date(at)
  const today = new Date()
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1)
  const day = d.toDateString() === today.toDateString() ? 'Today'
    : d.toDateString() === tomorrow.toDateString() ? 'Tomorrow'
    : d.toLocaleDateString('en-US', { weekday: 'short' })
  return `${day} ${clockTime(at, true)}`
}

export function useIrrigationActions() {
  const { update, send } = useHome()
  const setZone = (id: string, change: Partial<IrrigationZone>) =>
    update((s) => ({ ...s, irrigationZones: s.irrigationZones.map((z) => (z.id === id ? { ...z, ...change } : z)) }))
  return {
    quick: (run: QuickRun) => {
      if (run.zoneIds?.[0]) setZone(run.zoneIds[0], { isWatering: true, isPaused: false, minutesLeft: parseInt(run.detail) || null })
      send('rachio/command', { action: 'quick', quickId: run.id }, { refresh: true })
    },
    stop: (zone: IrrigationZone) => {
      setZone(zone.id, { isWatering: false, isPaused: false, minutesLeft: null, resumesAt: null })
      send('rachio/command', { action: 'stop', zoneId: zone.id }, { refresh: true })
    },
    pause: (zone: IrrigationZone) => {
      setZone(zone.id, { isWatering: false, isPaused: true, resumesAt: new Date(Date.now() + PAUSE_MINUTES * 60_000).toISOString() })
      send('rachio/command', { action: 'pause', zoneId: zone.id }, { refresh: true })
    },
    /** Skip to the next zone of the running schedule (stop + start the rest) */
    nextZone: () => send('rachio/command', { action: 'next-zone' }, { refresh: true }),
    resume: (zone: IrrigationZone) => {
      setZone(zone.id, { isWatering: true, isPaused: false, resumesAt: null })
      send('rachio/command', { action: 'resume', zoneId: zone.id }, { refresh: true })
    },
    skipTomorrow: () => {
      update((s) => ({ ...s, irrigation: { ...s.irrigation, skipTomorrow: { available: false, skipped: true, label: "Tomorrow's runs skipped" } } }))
      send('rachio/command', { action: 'skip-tomorrow' }, { refresh: true })
    },
  }
}

const pauseLabel = PAUSE_MINUTES === 60 ? '1 hr' : `${PAUSE_MINUTES} min`

/** Pause/Resume + Stop while a zone is running or paused; quick runs + skip otherwise. */
export function IrrigationControls({ stacked = true }: { stacked?: boolean }) {
  const { data } = useHome()
  const a = useIrrigationActions()
  const cfg = categories.irrigation
  if (!data) return null
  const active = data.irrigationZones.find((z) => z.isWatering || z.isPaused)
  if (active) {
    return (
      <div className="flex w-full gap-2">
        {active.isPaused
          ? <Pill color={cfg.color} dim={cfg.dim} onClick={() => a.resume(active)}><Play size={12} fill="currentColor" /> Resume</Pill>
          : <Pill color={cfg.color} dim={cfg.dim} onClick={() => a.pause(active)}><Pause size={12} fill="currentColor" /> Pause {pauseLabel}</Pill>}
        <Pill color={cfg.color} dim={cfg.dim} onClick={() => a.stop(active)}><Square size={11} fill="currentColor" /> Stop</Pill>
      </div>
    )
  }
  const skip = data.irrigation?.skipTomorrow
  return (
    <div className={`flex w-full flex-col ${stacked ? 'gap-1.5' : 'gap-2'}`}>
      {data.irrigation?.quickRuns.map((r) => <QuickRunButton key={r.id} run={r} onStart={() => a.quick(r)} color={cfg.color} dim={cfg.dim} />)}
      {skip && (
        <ConfirmButton label={skip.label} disabled={!skip.available} onConfirm={a.skipTomorrow}
          icon={skip.skipped ? <Check size={13} /> : <SkipForward size={12} />}
          color="var(--color-rain)" dim="var(--color-calendar-dim)" />
      )}
    </div>
  )
}
