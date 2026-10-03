import { Minus, Plus } from 'lucide-react'
import { useHome } from '../../lib/useHome'
import { categories } from '../../lib/categories'
import { DetailLayout } from '../../components/DetailLayout'
import { Card } from '../../components/Card'
import { Dial } from '../../components/Gauges'
import { RoundButton } from '../../components/Buttons'
import type { Thermostat } from '../../types'

const cfg = categories.climate
const MODES: Thermostat['mode'][] = ['heat', 'cool', 'eco', 'off']

export function ClimatePage() {
  const { data, update, send } = useHome()
  if (!data) return null
  const patch = (id: string, change: Partial<Thermostat>) => {
    update((s) => ({ ...s, thermostats: s.thermostats.map((t) => (t.id === id ? { ...t, ...change } : t)) }))
    send('nest/set', { deviceId: id, ...change })
  }
  return (
    <DetailLayout title="Climate" subtitle="Quick adjustments — schedules stay in the Nest app." color={cfg.color}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.thermostats.map((t) => (
          <Card key={t.id} accent={cfg.color} title={t.name} subtitle={`${t.room} · ${t.humidityPct}% humidity`}>
            <div className="flex items-center gap-6 py-2">
              <Dial value={((t.currentTempF - 55) / 30) * 100} color={cfg.color} size={120} label={`${t.currentTempF}°`} sublabel="inside" />
              <div>
                <p className="text-xs text-ink-faint">Target</p>
                <div className="mt-1 flex items-center gap-3">
                  <RoundButton color={cfg.color} dim={cfg.dim} onClick={() => patch(t.id, { targetTempF: t.targetTempF - 1 })} label="Lower"><Minus size={14} /></RoundButton>
                  <span className="font-mono text-2xl">{t.targetTempF}°</span>
                  <RoundButton color={cfg.color} dim={cfg.dim} onClick={() => patch(t.id, { targetTempF: t.targetTempF + 1 })} label="Raise"><Plus size={14} /></RoundButton>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {MODES.map((m) => (
                    <button key={m} onClick={() => patch(t.id, { mode: m })} aria-pressed={m === t.mode}
                      className="rounded-full border px-3 py-1 text-xs font-medium capitalize"
                      style={m === t.mode ? { background: cfg.dim, color: cfg.color, borderColor: 'transparent' } : { borderColor: 'var(--color-edge)', color: 'var(--color-ink-dim)' }}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </DetailLayout>
  )
}
