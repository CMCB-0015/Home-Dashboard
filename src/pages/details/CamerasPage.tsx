import { useNavigate } from 'react-router-dom'
import { useHome } from '../../lib/useHome'
import { categories } from '../../lib/categories'
import { relativeTime } from '../../lib/format'
import { DetailLayout } from '../../components/DetailLayout'
import { Card } from '../../components/Card'
import { Snapshot, GuardToggle, openLive } from '../../components/tiles/CamerasCard'

const cfg = categories.cameras

export function CamerasPage() {
  const { data } = useHome()
  const navigate = useNavigate()
  if (!data) return null
  const motion = data.alerts.filter((a) => a.category === 'cameras').sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  return (
    <DetailLayout title="Cameras" subtitle="Live view opens once Eufy is connected." color={cfg.color} action={<GuardToggle />}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.cameras.map((c) => (
          <div id={c.id} key={c.id}><Snapshot cam={c} onOpen={() => openLive(c, navigate)} /></div>
        ))}
      </div>
      <div className="mt-6">
        <Card accent={cfg.color} title="Motion events">
          <div className="divide-y divide-edge-soft">
            {motion.length === 0 && <p className="py-4 text-sm text-ink-faint">No recent motion.</p>}
            {motion.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                <span>{a.deviceName} <span className="text-ink-dim">· {a.message}</span></span>
                <span className="font-mono text-xs text-ink-faint">{relativeTime(a.timestamp)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </DetailLayout>
  )
}
