import { useState } from 'react'
import { useFitWidth } from '../../lib/useFit'
import { useNavigate } from 'react-router-dom'
import { useHome } from '../../lib/useHome'
import { HOME } from '../../config/home'
import { Card } from '../Card'
import { ClimateSheet } from './ClimateSheet'
import { ChargingSheet } from './ChargingSheet'
import { CarScene, type SceneMode } from './CarScene'
import { LiveCarMap } from './LiveCarMap'
import { ACC, AMBER, BLUE, DIM, GREEN, RED, clock, isCharging, lowTires, tint, useTeslaActions } from './useTesla'
import { useRoadName } from './useRoadName'
import { PsiIcon, TireView } from './TireView'
import type { Tesla } from '../../types'

const CAR_IMG = '/images/tesla-willawilla.png'

// ── Icons from the mockup ────────────────────────────────────────────────
const blade = 'M12 12C9.6 9.6 9.1 5.6 11 3.7c1.2-1.1 3.3-.6 3.6 1.2.4 2.4-.8 4.9-2.6 7.1z'
export const FanIcon = ({ glow }: { glow?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={glow ? { filter: `drop-shadow(0 0 6px ${glow})` } : undefined}>
    {[0, 90, 180, 270].map((r) => <path key={r} d={blade} transform={r ? `rotate(${r} 12 12)` : undefined} />)}
  </svg>
)
const LockIcon = ({ open }: { open: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
    <path d={open ? 'M7.5 10.5V7.5a4.5 4.5 0 0 1 8.7-1.6' : 'M7.5 10.5V7.5a4.5 4.5 0 0 1 9 0v3'} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    <rect x="4.5" y="10.5" width="15" height="11" rx="2.5" fill="currentColor" />
  </svg>
)
const BoltIcon = ({ glow }: { glow?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={glow ? { filter: `drop-shadow(0 0 6px ${glow})` } : undefined}>
    <path d="M13.5 2 4 14h6.5L9.5 22 20 9.5h-6.6z" />
  </svg>
)
const CarOpenIcon = ({ glow }: { glow?: string }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden
    style={glow ? { filter: `drop-shadow(0 0 6px ${glow})` } : undefined}>
    <path d="M3.5 18v-4.5L5.8 8c.3-.7 1-1 1.7-1h9c.7 0 1.4.3 1.7 1l2.3 5.5V18a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" /><path d="M3.5 13.5h17" />
  </svg>
)

/** When charging reaches the limit, from Teslemetry's "Time to full charge" — only if it's still ahead */
export function chargeDoneAt(t: Tesla): string | null {
  if (!isCharging(t) || !t.doneAt) return null
  const ms = Date.parse(t.doneAt)
  return Number.isFinite(ms) && ms > Date.now() + 30_000 ? clock(t.doneAt) : null
}

/** What the card says right now */
export function teslaSummary(t: Tesla, waking: boolean, doing: string | null = null) {
  const charging = isCharging(t)
  const plugged = !t.driving && t.plugged && !charging
  const e = t.enRouteHome
  // Names home and your own Home Assistant zones (e.g. Work) — never any other place the car is parked
  const zone = !t.atHome && t.zone ? t.zone : null
  const where = t.atHome ? ' · Home' : zone ? ` · ${zone}` : ''
  const header = e ? 'En route home' : t.driving ? 'Driving' : charging ? `Charging${where}` : plugged ? `Plugged in${where}`
    : t.climateOn || waking ? 'Live' : t.atHome ? 'Parked · Home' : zone ? `At ${zone}` : 'Parked'
  const low = t.driving ? [] : lowTires(t)
  let status: string, color: string
  const open = [t.trunkOpen ? 'Trunk open' : null, t.frunkOpen ? 'Frunk open' : null].filter(Boolean).join(' · ')
  if (waking) { status = doing ? `Waking car · ${doing.toLowerCase()}` : 'Waking car…'; color = ACC }
  else if (doing) { status = doing; color = '#e8edf2' }
  // "Driving · 0 mph" at a light, same as when moving
  else if (t.driving) { status = t.speedMph !== null ? `Driving · ${t.speedMph} mph` : 'Driving'; color = '#6fa8ff' }
  else if (e) { status = 'En route home'; color = '#6fa8ff' }
  else if (low.length) { status = `${low[0].name} tire low · ${low[0].psi} psi`; color = AMBER }
  else if (charging) {
    const done = chargeDoneAt(t)
    status = done && t.chargeLimitPct !== null
      ? `Charging · ${t.chargeLimitPct}% by ~${done}`
      : `Charging · ${t.batteryPct ?? '–'}% → ${t.chargeLimitPct ?? '–'}%`
    color = GREEN
  } else if (open && !t.driving) { status = t.windowsVented ? `${open} · Vented` : open; color = AMBER }
  else if (plugged) { status = t.charging === 'no_power' ? 'Plugged in · no power' : 'Plugged in'; color = BLUE }
  else if (t.windowsVented && !t.driving && !t.climateOn) { status = 'Windows vented'; color = BLUE }
  else if (t.climateOn) {
    const heating = t.targetF !== null && t.insideF !== null ? t.targetF >= t.insideF : true
    status = `${heating ? 'Heating' : 'Cooling'} to ${t.targetF ?? '–'}°${t.insideF !== null ? ` · ${t.insideF}° inside` : ''}`
    color = heating ? RED : BLUE
  } else {
    const lock = t.locked === null ? null : t.locked ? 'Locked' : 'Unlocked'
    status = [lock, t.insideF !== null ? `Inside ${t.insideF}°` : null].filter(Boolean).join(' · ') || (t.online ? 'Parked' : 'Asleep')
    color = DIM
  }
  const scene: SceneMode = t.driving || e ? 'driving' : charging ? 'charging' : plugged ? 'plugged' : 'parked'
  return { header, status, color, charging, plugged, scene, low }
}

/**
 * The Tesla card (top-right on Home). Lock, climate, charging, and vent
 * windows — the fan and bolt open the Climate and Charging panels. The frunk
 * and trunk are ring dots on the car picture (tap to open; tap "Trunk open"
 * to close). Glows
 * green while charging; the top bar turns blue with climate on. The picture
 * shows the charge cable whenever the car is plugged in (anywhere) and the car
 * on a moving road while driving (CarScene).
 *
 * Driving: the car on the road with the speed and the road name, and a ribbon
 * with this drive's time and miles. Driving home: the live map takes the
 * picture's place (the ribbon with the arrival time matters more than the
 * picture then). On the Vehicles page (onPage) the big map sits beside the
 * card, so it keeps the car on the road, and a psi button in the corner
 * switches to the tire view.
 */
export function TeslaCard({ className = 'h-full', onPage = false }: { className?: string; onPage?: boolean }) {
  const { data } = useHome()
  const { act, waking, busy } = useTeslaActions()
  const navigate = useNavigate()
  // Tablet fit layout: the car shrinks to the height the card has (pictures are about 3:2)
  const [picRef, picMax] = useFitWidth<HTMLDivElement>(1.6, 0)
  const [panel, setPanel] = useState<'climate' | 'charging' | null>(null)
  const [tiresOn, setTiresOn] = useState(false)
  const [mapFailed, setMapFailed] = useState(false)
  const road = useRoadName(data?.tesla, data?.mapsKey ?? null)

  const t = data?.tesla
  if (!data) return null
  if (!t) {
    return (
      <Card className={className} accent="var(--color-vehicles)" title="Vehicles" category="vehicles" placeholder>
        <div className="flex h-56 items-center justify-center"><img src={CAR_IMG} alt="" className="w-[260px]" /></div>
      </Card>
    )
  }

  // Trunk, frunk and vent windows wait for the car to report the change
  // instead of changing the picture first, so what's shown is what the car says.
  const doing = busy('trunk') ? (t.trunkOpen ? 'Closing trunk…' : 'Opening trunk…')
    : busy('frunk') ? 'Opening frunk…'
    : busy('vent') ? (t.windowsVented ? 'Closing windows…' : 'Venting windows…')
    : null
  const { header, status, color, charging, plugged, scene, low } = teslaSummary(t, waking, doing)
  const wash = charging ? { backgroundImage: `linear-gradient(180deg, ${tint(GREEN, 0.2)} 0%, ${tint(GREEN, 0.06)} 45%, transparent 80%)` } : undefined
  const accent = charging ? GREEN : t.climateOn ? BLUE : low.length ? AMBER : 'var(--color-vehicles)'
  const pct = t.batteryPct ?? 0
  const unlocked = t.locked === false

  const tapLock = () => {
    void act(unlocked ? 'lock' : 'unlock', {}, { locked: !unlocked })
  }
  const tapFan = () => {
    if (t.climateOn) setPanel('climate')
    else if (!waking) void act('climate_on', {}, t.online ? { climateOn: true } : undefined)
  }
  const tapTrunk = () => {
    if (busy('trunk')) return
    const close = t.trunkOpen === true
    void act(close ? 'trunk_close' : 'trunk', {}, undefined, { key: 'trunk', done: (c) => c.trunkOpen === !close })
  }
  const tapFrunk = () => {
    if (busy('frunk') || t.frunkOpen) return
    void act('frunk', {}, undefined, { key: 'frunk', done: (c) => c.frunkOpen === true })
  }
  const vented = t.windowsVented === true
  const tapVent = () => {
    if (busy('vent')) return
    void act(vented ? 'vent_close' : 'vent', {}, undefined, { key: 'vent', done: (c) => c.windowsVented === !vented })
  }
  const spots = scene === 'driving' ? undefined : {
    frunkOpen: t.frunkOpen === true,
    trunkOpen: t.trunkOpen === true,
    busy: {
      frunk: busy('frunk') ? 'Opening…' as const : undefined,
      trunk: busy('trunk') ? (t.trunkOpen ? 'Closing…' as const : 'Opening…' as const) : undefined,
    },
    onFrunk: tapFrunk,
    onTrunk: tapTrunk,
  }

  let hint = ''
  const hintColor = DIM
  if (waking) hint = doing ? 'Car was asleep — waking it, then it happens' : 'Usually 10–30 seconds'
  else if (t.frunkOpen && !t.driving) hint = 'The frunk closes by hand'

  const iconBtn = 'flex h-14 items-center justify-center rounded-[14px] transition-colors hover:bg-white/5'
  const e = t.enRouteHome
  const mapsKey = data.mapsKey ?? null
  const showMap = !!e && !onPage && !!mapsKey && !mapFailed && !tiresOn
  const onRoad = scene === 'driving'
  const headerRight = (
    <div className="flex items-center gap-2.5">
      <span className="text-[13px] text-ink-dim">{header}</span>
      {onPage && (
        <button type="button" onClick={() => setTiresOn((v) => !v)} aria-pressed={tiresOn}
          aria-label={tiresOn ? 'Back to the car' : 'Tire pressure'}
          className={`-my-2 -mr-1.5 flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${tiresOn ? 'border-white/35 bg-white/[0.12]' : 'border-transparent hover:bg-white/5'}`}
          style={{ color: !tiresOn && low.length ? AMBER : '#e8edf2' }}>
          <PsiIcon />
        </button>
      )}
    </div>
  )

  return (
    <>
      <Card className={className} accent={accent} title="Vehicles" category="vehicles" style={wash}
        headerRight={headerRight}
        bodyClassName="flex flex-col">
        <h3 className="font-display text-[26px] font-semibold leading-tight">{HOME.tesla.name}</h3>
        {tiresOn ? (
          <div className="mt-2 text-[13.5px] text-[#a7b4c2]">Recommended cold pressure: {t.tirePsi ?? HOME.tesla.tirePsi} psi</div>
        ) : (
        <div className="mt-2 flex items-center gap-2">
          <span aria-hidden className="relative box-border h-[11px] w-6 shrink-0 rounded-[3px] border-[1.5px] border-ink-dim p-px">
            <span className="block h-full rounded-[1px]" style={{ width: `${pct}%`, background: pct < 20 ? RED : GREEN }} />
          </span>
          <span className="whitespace-nowrap text-sm text-[#c9d2db]">{t.batteryPct ?? '–'}%{t.rangeMi !== null && ` · ${t.rangeMi} mi`}</span>
          <span className="ml-auto truncate text-right text-sm" style={{ color }}>{status}</span>
        </div>
        )}

        {tiresOn ? <TireView t={t} /> : showMap ? (
          <EnRouteMap t={t} e={e!} mapsKey={mapsKey!} road={road} onFail={() => setMapFailed(true)} />
        ) : (
          <>
            {/* The picture opens Vehicles; the dots on it open the frunk and trunk */}
            <div ref={picRef} role="link" tabIndex={0} aria-label="Vehicle details" onClick={() => navigate('/vehicles')}
              onKeyDown={(ev) => { if (ev.key === 'Enter' && ev.target === ev.currentTarget) navigate('/vehicles') }}
              className={`relative flex flex-1 cursor-pointer items-center justify-center py-2 ${onRoad ? 'min-h-[120px] fit:min-h-[84px]' : 'min-h-[150px] fit:min-h-[110px]'}`}>
              {/* On the tablet layout the picture is sized from this box's height, so it never pushes the buttons down */}
              <div className="flex items-center justify-center fit:absolute fit:inset-0">
                <CarScene mode={scene} spots={spots} maxWidth={picMax} />
              </div>
              {onRoad && t.driving && t.speedMph !== null && (
                <div className="pointer-events-none absolute right-0 top-1 flex flex-col items-end gap-0.5">
                  <span className="flex items-baseline gap-1 font-mono">
                    <span className="text-[26px] font-semibold leading-none">{t.speedMph}</span>
                    <span className="text-[11px] text-ink-dim">mph</span>
                  </span>
                  {road && <span className="max-w-[170px] truncate text-xs font-medium text-[#c9d2db]">{road}</span>}
                </div>
              )}
            </div>
            {onRoad && <Ribbon t={t} withMinutes className="mb-2" />}
          </>
        )}

        <div className="h-px bg-edge" />

        <div className="grid grid-cols-4 gap-1.5 pt-1.5">
          <button onClick={tapLock} aria-label={unlocked ? 'Unlocked: tap to lock' : 'Locked: tap to unlock'} disabled={t.locked === null}
            className={`${iconBtn} border disabled:opacity-40`} style={{ borderColor: 'transparent', color: unlocked ? AMBER : ACC }}>
            <LockIcon open={unlocked} />
          </button>
          <button onClick={tapFan} aria-label={t.climateOn ? 'Climate on: open climate controls' : 'Start climate'} aria-busy={waking}
            className={iconBtn} style={{ color: t.climateOn ? BLUE : waking ? '#e8edf2' : ACC }}>
            <span className={waking ? 'animate-pulse' : ''}><FanIcon glow={t.climateOn ? tint(BLUE, 0.7) : undefined} /></span>
          </button>
          <button onClick={() => setPanel('charging')} aria-label="Charging"
            className={iconBtn} style={{ color: charging ? GREEN : plugged ? BLUE : ACC }}>
            <BoltIcon glow={charging ? tint(GREEN, 0.8) : undefined} />
          </button>
          <button onClick={tapVent} aria-label={vented ? 'Windows vented: tap to close' : 'Vent windows'} aria-pressed={vented}
            aria-busy={busy('vent')} disabled={t.windowsVented === null || t.windowsVented === undefined}
            className={`${iconBtn} disabled:opacity-40`} style={{ color: vented ? BLUE : busy('vent') ? '#e8edf2' : ACC }}>
            <span className={busy('vent') ? 'animate-pulse' : ''}><CarOpenIcon glow={vented ? tint(BLUE, 0.7) : undefined} /></span>
          </button>
        </div>
        <span className="min-h-[15px] text-center text-xs" style={{ color: hintColor }}>{hint}</span>
      </Card>

      {panel === 'climate' && <ClimateSheet t={t} act={act} onClose={() => setPanel(null)} />}
      {panel === 'charging' && <ChargingSheet t={t} act={act} onClose={() => setPanel(null)} />}
    </>
  )
}

/**
 * The line under the map or the moving car. Driving home: who, and when
 * they'll be home. Otherwise: how long and how far this drive has gone.
 */
function Ribbon({ t, withMinutes = false, className = '' }: { t: Tesla; withMinutes?: boolean; className?: string }) {
  const e = t.enRouteHome
  let left: string, right: string
  if (e) {
    const at = e.arriveAt ? clock(e.arriveAt) : null
    left = `${HOME.tesla.driver} · en route home`
    right = (withMinutes
      ? [e.minutes !== null ? `${e.minutes} min` : null, at ? `Home ${at}` : null]
      : [at ? `Home ${at}` : null, e.miles !== null ? `${e.miles} mi` : null]).filter(Boolean).join(' · ')
  } else {
    const d = t.drive
    const min = d?.startedAt ? Math.max(0, Math.round((Date.now() - Date.parse(d.startedAt)) / 60_000)) : null
    left = `${HOME.tesla.driver} · driving`
    right = [min !== null ? `${min} min` : null, d?.miles != null ? `${d.miles < 10 ? d.miles : Math.round(d.miles)} mi so far` : null].filter(Boolean).join(' · ')
  }
  const box = withMinutes ? 'rounded-xl border border-edge bg-surface-raised' : ''
  return (
    <div className={`flex shrink-0 items-baseline gap-2 px-3 py-2 ${box} ${className}`}>
      <span className="truncate text-sm font-semibold">{left}</span>
      {right && <span className="ml-auto shrink-0 font-mono text-[12.5px] font-medium">{right}</span>}
    </div>
  )
}

/**
 * Driving home: the live map (car, home, Google's route) fills the space the
 * picture had, with the road name, the minutes left ("Arriving" at the end)
 * and the ribbon. If Google refuses the key, the card falls back to the car
 * on the road.
 */
function EnRouteMap({ t, e, mapsKey, road, onFail }: { t: Tesla; e: NonNullable<Tesla['enRouteHome']>; mapsKey: string; road: string | null; onFail: () => void }) {
  const arriving = e.minutes !== null && e.minutes <= 1
  return (
    <div className="mb-2 mt-2 flex min-h-[150px] flex-1 flex-col overflow-hidden rounded-xl border border-edge bg-surface-raised fit:min-h-[110px]">
      <div className="relative min-h-[70px] flex-1">
        <LiveCarMap t={t} mapsKey={mapsKey} mode="card" onError={onFail} className="absolute inset-0" />
        {road && (
          <span className="absolute left-2 top-2 max-w-[62%] truncate rounded-full bg-bg/85 px-2.5 py-0.5 text-[11.5px] font-medium text-[#c9d2db]">{road}</span>
        )}
        {e.minutes !== null && (
          <span className="absolute right-2 top-2 rounded-full bg-bg/85 px-2 py-0.5 font-mono text-xs font-semibold" style={{ color: arriving ? GREEN : undefined }}>
            {arriving ? 'Arriving' : `${e.minutes} min`}
          </span>
        )}
      </div>
      <Ribbon t={t} />
    </div>
  )
}
