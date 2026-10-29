import { useRef, useState } from 'react'
import { Minus, Navigation2, Plus } from 'lucide-react'
import { useHome } from '../../lib/useHome'
import { categories } from '../../lib/categories'
import { relativeTime } from '../../lib/format'
import { HOME } from '../../config/home'
import { DetailLayout } from '../../components/DetailLayout'
import { Card } from '../../components/Card'
import { TeslaCard } from '../../components/vehicles/TeslaCard'
import { clock } from '../../components/vehicles/useTesla'
import { LiveCarMap, type LiveCarMapHandle } from '../../components/vehicles/LiveCarMap'
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

const mapsLink = (l: { lat: number; lon: number }) => `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lon}`

/** Where the car is: a live Google map (car, home, this drive's trail, Google's route home) */
function LocationCard({ t, mapsKey }: { t: Tesla; mapsKey: string | null }) {
  const [follow, setFollow] = useState(true)
  const [failed, setFailed] = useState<string | null>(null)
  const ctl = useRef<LiveCarMapHandle | null>(null)
  const e = t.enRouteHome
  const where = t.driving ? (e ? 'Driving home' : 'Driving') : t.atHome ? 'Parked · Home' : 'Parked'
  const speed = t.driving && t.speedMph ? ` · ${t.speedMph} mph` : ''
  const round = 'flex h-11 w-11 items-center justify-center rounded-full border border-edge bg-bg/85 text-ink hover:bg-surface-raised'
  return (
    <Card accent={cfg.color} title="Location" className="flex h-[460px] flex-col md:sticky md:top-4 md:h-[min(680px,calc(100vh-150px))] md:min-h-[440px]" bodyClassName="flex flex-col !px-3 !pb-3"
      headerRight={<span className="text-[13px]" style={{ color: t.driving ? '#6fa8ff' : 'var(--color-ink-dim)' }}>{where}{speed}</span>}>
      <div className="relative min-h-[320px] flex-1 overflow-hidden rounded-xl border border-edge bg-[#18212a]">
        {mapsKey && !failed ? (
          <>
            <LiveCarMap t={t} mapsKey={mapsKey} mode="page" follow={follow} onUserMove={() => setFollow(false)} onError={setFailed}
              handle={(h) => { ctl.current = h }} className="absolute inset-0" />
            {e && (
              <div className="absolute left-3.5 top-3.5 flex flex-col gap-0.5 rounded-xl border border-edge bg-bg/90 px-3.5 py-2.5">
                {e.minutes !== null && <span className="font-mono text-[22px] font-semibold leading-tight">{e.minutes} min</span>}
                <span className="text-[13px] text-[#c9d2db]">{[e.arriveAt && clock(e.arriveAt) ? `Home at ${clock(e.arriveAt)}` : null, e.miles !== null ? `${e.miles} mi` : null].filter(Boolean).join(' · ')}</span>
                {e.trafficDelayMin ? <span className="text-[12.5px] text-[#f2c14e]">+{e.trafficDelayMin} min traffic</span> : null}
              </div>
            )}
            <div className="absolute right-3.5 top-3.5 flex flex-col gap-2">
              <button onClick={() => ctl.current?.zoom(1)} aria-label="Zoom in" className={round}><Plus size={18} /></button>
              <button onClick={() => ctl.current?.zoom(-1)} aria-label="Zoom out" className={round}><Minus size={18} /></button>
              <button onClick={() => setFollow(true)} aria-label="Follow the car" aria-pressed={follow}
                className={`${round} ${follow ? '!border-[#6fa8ff] !bg-[#6fa8ff]/15 !text-[#6fa8ff]' : ''}`}>
                <Navigation2 size={17} fill="currentColor" />
              </button>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm leading-relaxed text-ink-dim">
            {failed
              ? `Map unavailable: ${failed}.`
              : 'Add a Google Maps key (google_maps_key in Panel’s Configuration tab — the same one the weather radar uses) to see the car on a map.'}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 px-2 pt-3">
        <span className="truncate text-[13px] text-ink-dim">{e?.near ? `Near ${e.near}` : t.location ? (t.driving ? 'Updates live while driving' : '') : 'Location not reported yet'}</span>
        {t.location && (
          <a href={mapsLink(t.location)} target="_blank" rel="noreferrer"
            className="ml-auto flex h-10 shrink-0 items-center rounded-full bg-[#252e38] px-4 text-sm font-medium hover:bg-[#2c3640]">Open in Google Maps</a>
        )}
      </div>
    </Card>
  )
}

export function VehiclesPage() {
  const { data } = useHome()
  if (!data) return null
  const t = data.tesla
  return (
    <DetailLayout title="Vehicles" color={cfg.color}
      subtitle={t ? `${HOME.tesla.name} · updated ${relativeTime(t.updatedAt)} · the dashboard never wakes the car just to refresh` : 'Teslemetry isn’t in Home Assistant yet'}>
      <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-[minmax(0,420px)_1fr]">
        <div className="flex flex-col gap-5">
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
            </Card>
          )}
        </div>
        {t && <LocationCard t={t} mapsKey={data.mapsKey ?? null} />}
      </div>
    </DetailLayout>
  )
}
