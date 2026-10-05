import { Zap, Lock, LockOpen } from 'lucide-react'
import { useHome } from '../../lib/useHome'
import { categories } from '../../lib/categories'
import { relativeTime } from '../../lib/format'
import { Card } from '../Card'
import { Pill } from '../Buttons'
import { Bar } from '../Gauges'
import { CarIcon } from '../CarIcon'
import type { Vehicle } from '../../types'

const cfg = categories.vehicles

const chargeText: Record<Vehicle['charging'], string> = {
  charging: 'Charging', complete: 'Plugged in · charge complete', plugged: 'Plugged in', unplugged: 'Unplugged',
}

export function VehicleSummary({ v }: { v: Vehicle }) {
  return (
    <div>
      <div className="flex items-center gap-4">
        <CarIcon kind={v.kind} color={v.color} width={100} />
        <div>
          <div className="text-sm font-semibold">{v.name}</div>
          <div className="text-[11px] text-ink-faint">{v.detail}</div>
        </div>
      </div>
      <div className={`mt-4 grid gap-4 ${v.fuelPct !== undefined ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <div>
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-3xl">{v.batteryPct}%</span>
            <span className="text-xs text-ink-dim">{v.rangeMi} mi{v.kind === 'phev' ? ' electric' : ''}</span>
          </div>
          <div className="mt-2"><Bar value={v.batteryPct} color="var(--color-charge)" /></div>
        </div>
        {v.fuelPct !== undefined && (
          <div>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-3xl">{v.fuelPct}%</span>
              <span className="text-xs text-ink-dim">{v.fuelRangeMi} mi gas</span>
            </div>
            <div className="mt-2"><Bar value={v.fuelPct} color="var(--color-fuel)" /></div>
          </div>
        )}
      </div>
      <div className="mt-3 space-y-1.5 text-[11px] text-ink-dim">
        {v.charging !== 'unplugged' && <p className="flex items-center gap-1.5"><Zap size={13} className="text-charge" /> {chargeText[v.charging]}</p>}
        <p className="flex items-center gap-1.5">
          {v.locked ? <Lock size={13} /> : <LockOpen size={13} className="text-critical" />}
          {v.locked ? 'Locked' : 'Unlocked'}
          {v.insideTempF !== null && <> · {v.insideTempF}°F inside</>}
          <span className="text-ink-faint"> · updated {relativeTime(v.updatedAt)}</span>
        </p>
      </div>
    </div>
  )
}

export function useVehicleActions() {
  const { update, send } = useHome()
  return {
    toggleLock: (v: Vehicle) => {
      update((s) => ({ ...s, vehicles: s.vehicles.map((x) => (x.id === v.id ? { ...x, locked: !x.locked } : x)) }))
      send('tesla/command', { vehicleId: v.id, command: v.locked ? 'door_unlock' : 'door_lock' })
    },
    precondition: (v: Vehicle) => send('tesla/command', { vehicleId: v.id, command: 'auto_conditioning_start' }),
  }
}

export function VehiclesCard() {
  const { data } = useHome()
  const { toggleLock, precondition } = useVehicleActions()
  if (!data || !data.vehicles.length) return null
  const v = data.vehicles[0]
  return (
    <Card
      accent={cfg.color}
      title="Vehicles" category="vehicles"
      to={cfg.path}
      actions={v.canCommand ? (
        <>
          <Pill color={cfg.color} dim={cfg.dim} onClick={() => toggleLock(v)}>{v.locked ? 'Unlock' : 'Lock'}</Pill>
          <Pill color={cfg.color} dim={cfg.dim} onClick={() => precondition(v)}>Precondition</Pill>
        </>
      ) : <span className="text-[11px] text-ink-faint">View only</span>}
    >
      <VehicleSummary v={v} />
    </Card>
  )
}
