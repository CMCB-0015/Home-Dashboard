import { useHome } from '../../lib/useHome'
import { categories } from '../../lib/categories'
import { relativeTime } from '../../lib/format'
import { HOME } from '../../config/home'
import { DetailLayout } from '../../components/DetailLayout'
import { Card } from '../../components/Card'
import { TeslaCard } from '../../components/vehicles/TeslaCard'
import { clock } from '../../components/vehicles/useTesla'
import type { Tesla } from '../../types'

const cfg = categories.vehicles

const yesNo = (v: boolean | null, yes: string, no: string) => (v === null ? '—' : v ? yes : no)

function details(t: Tesla): [string, string][] {
  const sched = t.schedule ? (t.schedule.enabled ? `On · starts ${t.schedule.time ?? '—'}` : 'Off') : '—'
  return [
    ['Where', t.driving ? (t.enRouteHome ? 'Driving home' : 'Driving') : t.atHome ? 'Home' : 'Away from home'],
    ['Locks', yesNo(t.locked, 'Locked', 'Unlocked')],
    ['Inside', t.insideF !== null ? `${t.insideF}°` : '—'],
    ['Outside', t.outsideF !== null ? `${t.outsideF}°` : '—'],
    ['Climate', t.climateOn ? `On · ${t.targetF ?? '–'}°` : 'Off'],
    ['Charge limit', t.chargeLimitPct !== null ? `${t.chargeLimitPct}%` : '—'],
    ['Scheduled charging', sched],
    ['Charge done', clock(t.doneAt) ?? '—'],
    ['Frunk', yesNo(t.frunkOpen, 'Open', 'Closed')],
    ['Trunk', yesNo(t.trunkOpen, 'Open', 'Closed')],
    ['Connection', t.online ? 'Awake' : 'Asleep — wakes on the first command'],
  ]
}

export function VehiclesPage() {
  const { data } = useHome()
  if (!data) return null
  const t = data.tesla
  return (
    <DetailLayout title="Vehicles" color={cfg.color}
      subtitle={t ? `${HOME.tesla.name} · updated ${relativeTime(t.updatedAt)} · the dashboard never wakes the car just to refresh` : 'Teslemetry isn’t in Home Assistant yet'}>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,420px)_1fr]">
        <TeslaCard className="min-h-[500px]" />
        {t && (
          <Card accent={cfg.color} title="Status">
            <dl className="divide-y divide-edge-soft">
              {details(t).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                  <dt className="text-ink-dim">{k}</dt><dd className="text-right">{v}</dd>
                </div>
              ))}
            </dl>
            {t.location && (
              <a className="mt-3 inline-block text-xs text-ink-dim underline hover:text-ink" target="_blank" rel="noreferrer"
                href={`https://maps.apple.com/?q=${encodeURIComponent(HOME.tesla.name)}&ll=${t.location.lat},${t.location.lon}`}>Open location in Maps</a>
            )}
          </Card>
        )}
      </div>
    </DetailLayout>
  )
}
