import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useHome } from '../../lib/useHome'
import { categories } from '../../lib/categories'
import { relativeTime } from '../../lib/format'
import { DetailLayout } from '../../components/DetailLayout'
import { Card } from '../../components/Card'
import { Snapshot, GuardToggle, StargazingButton } from '../../components/tiles/CamerasCard'
import { CameraSheet } from '../../components/cameras/CameraSheet'

const cfg = categories.cameras

export function CamerasPage() {
  const { data } = useHome()
  // ?live=camera.front_yard (from a motion chip) opens that camera's live view
  const [params, setParams] = useSearchParams()
  const [open, setOpenState] = useState<string | null>(() => params.get('live'))
  const setOpen = (id: string | null) => { setOpenState(id); if (params.has('live')) setParams({}, { replace: true }) }
  if (!data) return null
  const motion = data.alerts.filter((a) => a.category === 'cameras').sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  return (
    <DetailLayout title="Cameras" subtitle="Tap a camera for live view." color={cfg.color} action={<div className="flex items-center gap-2"><StargazingButton /><GuardToggle /></div>}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.cameras.map((c) => (
          <div id={c.id} key={c.id}><Snapshot cam={c} onOpen={() => setOpen(c.id)} /></div>
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
      {open && <CameraSheet cameras={data.cameras} startId={open} onClose={() => setOpen(null)} />}
    </DetailLayout>
  )
}
