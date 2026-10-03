import { Play, Pause, Home } from 'lucide-react'
import { useHome } from '../../lib/useHome'
import { categories } from '../../lib/categories'
import { relativeTime } from '../../lib/format'
import { DetailLayout } from '../../components/DetailLayout'
import { Card } from '../../components/Card'
import { Dial } from '../../components/Gauges'
import { Pill } from '../../components/Buttons'
import type { Vacuum } from '../../types'

const cfg = categories.vacuum

export function VacuumPage() {
  const { data, update, send } = useHome()
  if (!data) return null
  const v = data.vacuums[0]
  const set = (state: Vacuum['state'], action: string, profileId?: string) => {
    update((s) => ({ ...s, vacuums: s.vacuums.map((x) => (x.id === v.id ? { ...x, state } : x)) }))
    send('roborock/command', { action, profileId })
  }
  return (
    <DetailLayout title="Vacuum" subtitle={`${v.name} · last clean ${relativeTime(v.lastCleanAt)}`} color={cfg.color}>
      <Card accent={cfg.color}>
        <div className="flex flex-col items-center gap-6 py-4 sm:flex-row sm:justify-center sm:gap-12">
          <Dial value={v.batteryPct} color={cfg.color} size={140} stroke={9} label={`${v.batteryPct}%`} sublabel="battery" />
          <div className="text-center sm:text-left">
            <p className="font-display text-lg font-semibold capitalize">{v.state}</p>
            <div className="mt-4 flex justify-center gap-2 sm:justify-start">
              <Pill color={cfg.color} dim={cfg.dim} onClick={() => set('cleaning', 'start')} disabled={v.state === 'cleaning'}><Play size={13} /> Start</Pill>
              <Pill color={cfg.color} dim={cfg.dim} onClick={() => set('paused', 'pause')} disabled={v.state !== 'cleaning'}><Pause size={13} /> Pause</Pill>
              <Pill color={cfg.color} dim={cfg.dim} onClick={() => set('returning', 'dock')} disabled={v.state === 'docked'}><Home size={13} /> Dock</Pill>
            </div>
          </div>
        </div>
      </Card>
      <h2 className="mb-2 mt-8 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Run profiles</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {data.vacuumRunProfiles.map((p) => (
          <button key={p.id} onClick={() => set('cleaning', 'start', p.id)}
            className="rounded-xl border border-edge bg-surface p-4 text-left transition-colors hover:border-ink-faint">
            <p className="font-display text-sm font-semibold">{p.name}</p>
            <p className="mt-1 text-xs text-ink-faint">{p.rooms} · {p.suction} suction</p>
          </button>
        ))}
      </div>
    </DetailLayout>
  )
}
