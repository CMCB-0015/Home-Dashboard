import { useHome } from '../../lib/useHome'
import { categories } from '../../lib/categories'
import { DetailLayout } from '../../components/DetailLayout'
import { Card } from '../../components/Card'
import { Pill } from '../../components/Buttons'
import type { Light } from '../../types'

const cfg = categories.lights

export function LightsPage() {
  const { data, update, send } = useHome()
  if (!data) return null
  const patch = (id: string, change: Partial<Light>) => {
    update((s) => ({ ...s, lights: s.lights.map((l) => (l.id === id ? { ...l, ...change } : l)) }))
    send('hue/set', { lightId: id, ...change })
  }
  const rooms = [...new Set(data.lights.map((l) => l.room))]
  const on = data.lights.filter((l) => l.on).length
  return (
    <DetailLayout title="Lights" subtitle={`${on} of ${data.lights.length} on`} color={cfg.color}
      action={<Pill color={cfg.color} dim={cfg.dim} onClick={() => { update((s) => ({ ...s, lights: s.lights.map((l) => ({ ...l, on: false })) })); send('hue/set', { all: true, on: false }) }}>All off</Pill>}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {rooms.map((room) => (
          <Card key={room} accent={cfg.color} title={room}>
            <div className="divide-y divide-edge-soft">
              {data.lights.filter((l) => l.room === room).map((l) => (
                <div key={l.id} className="flex items-center gap-4 py-3">
                  <button role="switch" aria-checked={l.on} aria-label={`${l.name} ${l.on ? 'off' : 'on'}`}
                    onClick={() => patch(l.id, { on: !l.on, brightnessPct: l.on ? l.brightnessPct : l.brightnessPct || 80 })}
                    className="relative h-6 w-11 shrink-0 rounded-full transition-colors" style={{ background: l.on ? cfg.color : 'var(--color-edge)' }}>
                    <span className="absolute top-0.5 h-5 w-5 rounded-full bg-bg transition-transform" style={{ transform: `translateX(${l.on ? 22 : 2}px)` }} />
                  </button>
                  <span className="w-28 shrink-0 truncate text-sm">{l.name}</span>
                  <input type="range" min={1} max={100} value={l.brightnessPct || 1} disabled={!l.on} aria-label={`${l.name} brightness`}
                    onChange={(e) => patch(l.id, { brightnessPct: Number(e.target.value) })}
                    className="h-1.5 flex-1 cursor-pointer disabled:opacity-30" style={{ color: cfg.color }} />
                  <span className="w-10 text-right font-mono text-xs text-ink-faint">{l.on ? `${l.brightnessPct}%` : 'off'}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </DetailLayout>
  )
}
