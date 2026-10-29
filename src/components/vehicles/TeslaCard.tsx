import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useHome } from '../../lib/useHome'
import { HOME } from '../../config/home'
import { Card } from '../Card'
import { ClimateSheet } from './ClimateSheet'
import { ChargingSheet } from './ChargingSheet'
import { CarScene, type SceneMode } from './CarScene'
import { LiveCarMap } from './LiveCarMap'
import { ACC, AMBER, BLUE, DIM, GREEN, RED, clock, isCharging, tint, useTeslaActions } from './useTesla'
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
const CarOpenIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden>
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
export function teslaSummary(t: Tesla, waking: boolean) {
  const charging = isCharging(t)
  const plugged = !t.driving && t.plugged && !charging
  const where = t.atHome ? ' · Home' : '' // never names a place away from home
  const header = t.driving ? 'Driving' : charging ? `Charging${where}` : plugged ? `Plugged in${where}` : t.climateOn || waking ? 'Live' : t.atHome ? 'Parked · Home' : 'Parked'
  let status: string, color: string
  if (waking) { status = 'Waking car…'; color = ACC }
  else if (t.enRouteHome) { status = 'En route home'; color = '#6fa8ff' }
  else if (t.driving) { status = t.speedMph ? `Driving · ${t.speedMph} mph` : 'Driving'; color = '#6fa8ff' }
  else if (charging) {
    const done = chargeDoneAt(t)
    status = done && t.chargeLimitPct !== null
      ? `Charging · ${t.chargeLimitPct}% by ~${done}`
      : `Charging · ${t.batteryPct ?? '–'}% → ${t.chargeLimitPct ?? '–'}%`
    color = GREEN
  } else if (plugged) { status = t.charging === 'no_power' ? 'Plugged in · no power' : 'Plugged in'; color = BLUE }
  else if (t.climateOn) {
    const heating = t.targetF !== null && t.insideF !== null ? t.targetF >= t.insideF : true
    status = `${heating ? 'Heating' : 'Cooling'} to ${t.targetF ?? '–'}°${t.insideF !== null ? ` · ${t.insideF}° inside` : ''}`
    color = heating ? RED : BLUE
  } else {
    const lock = t.locked === null ? null : t.locked ? 'Locked' : 'Unlocked'
    status = [lock, t.insideF !== null ? `Inside ${t.insideF}°` : null].filter(Boolean).join(' · ') || (t.online ? 'Parked' : 'Asleep')
    color = DIM
  }
  const scene: SceneMode = t.driving ? 'driving' : charging ? 'charging' : plugged ? 'plugged' : 'parked'
  return { header, status, color, charging, plugged, scene }
}

/**
 * The Tesla card (top-right on Home). Lock, climate, charging, and
 * frunk/trunk — the fan and bolt open the Climate and Charging panels. Glows
 * green while charging; the top bar turns blue with climate on. The picture
 * shows the charge cable whenever the car is plugged in (anywhere) and the car
 * on a moving road while driving (CarScene).
 */
export function TeslaCard({ className = 'h-full' }: { className?: string }) {
  const { data } = useHome()
  const { act, waking } = useTeslaActions()
  const [chooser, setChooser] = useState(false)
  const [opened, setOpened] = useState<string | null>(null)
  const [panel, setPanel] = useState<'climate' | 'charging' | null>(null)

  // "Frunk open" fades after a few seconds
  useEffect(() => { if (!opened) return; const t = setTimeout(() => setOpened(null), 6000); return () => clearTimeout(t) }, [opened])

  const t = data?.tesla
  if (!data) return null
  if (!t) {
    return (
      <Card className={className} accent="var(--color-vehicles)" title="Vehicles" category="vehicles" placeholder>
        <div className="flex h-56 items-center justify-center"><img src={CAR_IMG} alt="" className="w-[260px]" /></div>
      </Card>
    )
  }

  const { header, status, color, charging, plugged, scene } = teslaSummary(t, waking)
  const wash = charging ? { backgroundImage: `linear-gradient(180deg, ${tint(GREEN, 0.2)} 0%, ${tint(GREEN, 0.06)} 45%, transparent 80%)` } : undefined
  const accent = charging ? GREEN : t.climateOn ? BLUE : 'var(--color-vehicles)'
  const pct = t.batteryPct ?? 0
  const unlocked = t.locked === false

  const tapLock = () => {
    setChooser(false)
    void act(unlocked ? 'lock' : 'unlock', {}, { locked: !unlocked })
  }
  const tapFan = () => {
    setChooser(false)
    if (t.climateOn) setPanel('climate')
    else if (!waking) void act('climate_on', {}, t.online ? { climateOn: true } : undefined)
  }
  const openOne = (what: 'frunk' | 'trunk') => {
    setChooser(false)
    void act(what, {}, what === 'frunk' ? { frunkOpen: true } : { trunkOpen: true }).then((ok) => ok && setOpened(what === 'frunk' ? 'Frunk' : 'Trunk'))
  }

  let hint = ''
  const hintColor = DIM
  if (waking) hint = 'Usually 10–30 seconds'
  else if (opened) hint = `${opened} open`

  const iconBtn = 'flex h-14 items-center justify-center rounded-[14px] transition-colors hover:bg-white/5'
  const e = t.enRouteHome

  return (
    <>
      <Card className={className} accent={accent} title="Vehicles" category="vehicles" style={wash}
        headerRight={<span className="text-[13px] text-ink-dim">{header}</span>}
        bodyClassName="flex flex-col">
        <h3 className="font-display text-[26px] font-semibold leading-tight">{HOME.tesla.name}</h3>
        <div className="mt-2 flex items-center gap-2">
          <span aria-hidden className="relative box-border h-[11px] w-6 shrink-0 rounded-[3px] border-[1.5px] border-ink-dim p-px">
            <span className="block h-full rounded-[1px]" style={{ width: `${pct}%`, background: pct < 20 ? RED : GREEN }} />
          </span>
          <span className="whitespace-nowrap text-sm text-[#c9d2db]">{t.batteryPct ?? '–'}%{t.rangeMi !== null && ` · ${t.rangeMi} mi`}</span>
          <span className="ml-auto truncate text-right text-sm" style={{ color }}>{status}</span>
        </div>

        <Link to="/vehicles" aria-label="Vehicle details" className="relative flex min-h-[150px] flex-1 items-center justify-center py-2">
          <CarScene mode={scene} compact={!!e} />
        </Link>

        {e && <EnRoute t={t} e={e} mapsKey={data.mapsKey ?? null} />}

        <div className="h-px bg-edge" />

        {chooser && (
          <div className="grid grid-cols-2 gap-2.5 pt-2.5">
            {(['frunk', 'trunk'] as const).map((w) => (
              <button key={w} onClick={() => openOne(w)} className="h-11 rounded-xl border border-edge bg-surface-raised text-sm font-medium hover:bg-[#252e38]">
                Open {w}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-4 gap-1.5 pt-1.5">
          <button onClick={tapLock} aria-label={unlocked ? 'Unlocked: tap to lock' : 'Locked: tap to unlock'} disabled={t.locked === null}
            className={`${iconBtn} border disabled:opacity-40`} style={{ borderColor: 'transparent', color: unlocked ? AMBER : ACC }}>
            <LockIcon open={unlocked} />
          </button>
          <button onClick={tapFan} aria-label={t.climateOn ? 'Climate on: open climate controls' : 'Start climate'} aria-busy={waking}
            className={iconBtn} style={{ color: t.climateOn ? BLUE : waking ? '#e8edf2' : ACC }}>
            <span className={waking ? 'animate-pulse' : ''}><FanIcon glow={t.climateOn ? tint(BLUE, 0.7) : undefined} /></span>
          </button>
          <button onClick={() => { setChooser(false); setPanel('charging') }} aria-label="Charging"
            className={iconBtn} style={{ color: charging ? GREEN : plugged ? BLUE : ACC }}>
            <BoltIcon glow={charging ? tint(GREEN, 0.8) : undefined} />
          </button>
          <button onClick={() => setChooser((c) => !c)} aria-label="Frunk and trunk" aria-expanded={chooser}
            className={iconBtn} style={{ color: chooser || opened ? '#e8edf2' : ACC }}>
            <CarOpenIcon />
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
 * "En route home": a live map strip (car, home, Google's route) with the
 * minutes left, then one line with the arrival time and distance. Without a
 * Maps key — or if Google refuses it — the small drawn icon row instead.
 */
function EnRoute({ t, e, mapsKey }: { t: Tesla; e: NonNullable<Tesla['enRouteHome']>; mapsKey: string | null }) {
  const [failed, setFailed] = useState(false)
  if (!mapsKey || failed) return <EnRouteRow e={e} />
  const at = e.arriveAt ? clock(e.arriveAt) : null
  const rest = [at ? `Home ${at}` : null, e.miles !== null ? `${e.miles} mi` : null].filter(Boolean).join(' · ')
  return (
    <div className="mb-3 flex flex-col overflow-hidden rounded-xl border border-edge bg-surface-raised">
      <div className="relative h-24">
        <LiveCarMap t={t} mapsKey={mapsKey} mode="card" onError={() => setFailed(true)} className="absolute inset-0" />
        {e.minutes !== null && (
          <span className="absolute right-2 top-2 rounded-full bg-bg/85 px-2 py-0.5 font-mono text-xs font-semibold">{e.minutes} min</span>
        )}
      </div>
      <div className="flex items-baseline gap-2 px-3 py-2">
        <span className="truncate text-sm font-semibold">{HOME.tesla.driver} · en route home</span>
        {rest && <span className="ml-auto shrink-0 font-mono text-[12.5px] font-medium">{rest}</span>}
      </div>
    </div>
  )
}

function EnRouteRow({ e }: { e: NonNullable<Tesla['enRouteHome']> }) {
  const parts = [e.arriveAt && clock(e.arriveAt) ? `Home at ${clock(e.arriveAt)}` : null, e.minutes !== null ? `${e.minutes} min` : null, e.miles !== null ? `${e.miles} mi` : null].filter(Boolean)
  return (
    <div className="mb-3 flex items-center gap-3 rounded-xl border border-edge bg-surface-raised px-3 py-2.5">
      <div aria-hidden className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[10px] bg-bg">
        <svg width="52" height="52" viewBox="0 0 52 52">
          <path d="M6 60 L24 -4" stroke="#1f2830" strokeWidth="4" fill="none" />
          <path d="M-4 40 C10 36 18 20 31 15 S47 6 58 3" stroke="#29333d" strokeWidth="5" fill="none" />
          <path d="M26 17 C35 13 41 8 49 5" stroke="#6fa8ff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <circle cx="47" cy="6" r="3" fill="#e8edf2" />
        </svg>
        <span className="absolute left-[19px] top-[11px] h-3 w-3 rounded-full bg-[#6fa8ff] shadow-[0_0_0_4px_rgba(111,168,255,0.25)]" />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-semibold">{HOME.tesla.driver} · en route home</span>
        {e.near && <span className="truncate text-[12.5px] text-ink-dim">Near {e.near}</span>}
        {parts.length > 0 && <span className="font-mono text-[12.5px] font-medium">{parts.join(' · ')}</span>}
      </div>
    </div>
  )
}
