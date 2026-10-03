import { useHome } from '../../lib/useHome'
import { categories } from '../../lib/categories'
import { DetailLayout } from '../../components/DetailLayout'
import { Card } from '../../components/Card'
import { Pill } from '../../components/Buttons'
import { VehicleSummary, useVehicleActions } from '../../components/tiles/VehiclesCard'

const cfg = categories.vehicles

export function VehiclesPage() {
  const { data } = useHome()
  const { toggleLock, precondition } = useVehicleActions()
  if (!data) return null
  return (
    <DetailLayout title="Vehicles" subtitle="Last known status — the dashboard never wakes a sleeping car just to refresh." color={cfg.color}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.vehicles.map((v) => (
          <Card key={v.id} accent={cfg.color}
            actions={v.canCommand ? (
              <>
                <Pill color={cfg.color} dim={cfg.dim} onClick={() => toggleLock(v)}>{v.locked ? 'Unlock' : 'Lock'}</Pill>
                <Pill color={cfg.color} dim={cfg.dim} onClick={() => precondition(v)}>Precondition</Pill>
              </>
            ) : <span className="text-[11px] text-ink-faint">View only</span>}>
            <VehicleSummary v={v} />
          </Card>
        ))}
      </div>
    </DetailLayout>
  )
}
