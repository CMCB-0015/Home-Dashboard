import { useNavigate } from 'react-router-dom'
import { Play } from 'lucide-react'
import { useHome } from '../../lib/useHome'
import { categories } from '../../lib/categories'
import { relativeTime } from '../../lib/format'
import { Card } from '../Card'
import { Segmented } from '../Buttons'
import type { Camera, GuardMode } from '../../types'

const cfg = categories.cameras

export function openLive(cam: Camera, navigate: (to: string) => void) {
  // When Eufy is connected, liveUrl points at the live feed. Until then, go to the camera page.
  if (cam.liveUrl) window.open(cam.liveUrl, '_blank', 'noopener')
  else navigate(`/cameras#${cam.id}`)
}

export function Snapshot({ cam, onOpen }: { cam: Camera; onOpen: () => void }) {
  const offline = cam.status === 'offline'
  return (
    <button onClick={onOpen} className="group relative block aspect-video w-full overflow-hidden rounded-xl bg-surface-raised text-left" aria-label={`Open live view for ${cam.name}`}>
      {cam.snapshotUrl && (
        <img src={cam.snapshotUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          style={offline ? { filter: 'grayscale(1) brightness(.5)' } : undefined} />
      )}
      <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: offline ? 'var(--color-critical)' : cfg.color }} />
        {cam.name}
      </span>
      <span className="absolute bottom-2.5 left-2.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium">
        {offline ? 'Offline' : `Motion · ${relativeTime(cam.lastMotionAt)}`}
      </span>
      <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium">
        <Play size={11} fill="currentColor" /> Live
      </span>
    </button>
  )
}

export function GuardToggle() {
  const { data, update, send } = useHome()
  if (!data) return null
  const set = (mode: GuardMode) => {
    update((s) => ({ ...s, guardMode: mode }))
    send('eufy/guard-mode', { mode })
  }
  return (
    <div className="flex items-center gap-2.5">
      <span className="hidden text-[11px] text-ink-faint sm:inline">HomeBase</span>
      <Segmented label="HomeBase mode" value={data.guardMode} onChange={set} color={cfg.color} dim={cfg.dim}
        options={[{ value: 'home', label: 'Home' }, { value: 'away', label: 'Away' }]} />
    </div>
  )
}

export function CamerasCard() {
  const { data } = useHome()
  const navigate = useNavigate()
  if (!data) return null
  const online = data.cameras.filter((c) => c.status === 'online').length
  return (
    <Card accent={cfg.color} title="Cameras" subtitle={`${online} of ${data.cameras.length} online`} headerRight={<GuardToggle />}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {data.cameras.map((c) => <Snapshot key={c.id} cam={c} onOpen={() => openLive(c, navigate)} />)}
      </div>
      <p className="mt-3 text-[11px] text-ink-faint">Latest motion snapshot · tap a camera for the live feed</p>
    </Card>
  )
}
