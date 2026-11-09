import { useEffect, useState } from 'react'
import { Moon, Play, X } from 'lucide-react'
import { Battery } from '../vacuum/VacuumCard'
import { useHome } from '../../lib/useHome'
import { categories } from '../../lib/categories'
import { clockTime } from '../../lib/format'
import { Card } from '../Card'
import { Segmented } from '../Buttons'
import { CameraSheet } from '../cameras/CameraSheet'
import type { Camera, GuardMode } from '../../types'

const cfg = categories.cameras
/** Motion counts as "now" for this long: tile ring, card wash, status chip */
export const MOTION_NOW_MS = 3 * 60_000

/** "just now" for 3 minutes, then the time the picture is from: "7:34 PM", "Yesterday 7:34 PM", "Sat 7:34 PM" */
export function motionWhen(iso: string): string {
  const t = new Date(iso)
  if (Date.now() - t.getTime() < MOTION_NOW_MS) return 'just now'
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((day(new Date()) - day(t)) / 86_400_000)
  const time = clockTime(iso)
  if (days <= 0) return time
  if (days === 1) return `Yesterday ${time}`
  if (days < 7) return `${t.toLocaleDateString('en-US', { weekday: 'short' })} ${time}`
  return `${t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`
}

export const motionNow = (cam: Camera) =>
  !!cam.lastMotionAt && Date.now() - new Date(cam.lastMotionAt).getTime() < MOTION_NOW_MS

/** Solar Intensity below this is "inactive" and the sun reading is hidden (Connor, Nov 8: ~10%) */
const SUN_AT = 10
/** Stargazing: Twilight's night-sky navy, same as the launch chips */
const NAVY = '#070a1c', NAVY_EDGE = '#2a3a68', STAR = '#cfdaff'

/** Emoji-style sun: gold disc with warm rays */
export function SunIcon({ size = 14 }: { size?: number }) {
  const rays = Array.from({ length: 8 }, (_, i) => i * 45)
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <defs>
        <radialGradient id="sun-disc" cx="40%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#ffe680" /><stop offset="60%" stopColor="#ffc531" /><stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
      </defs>
      {rays.map((r) => (
        <path key={r} d="M12 0.8 L13.6 4.6 L10.4 4.6 Z" fill="#ffb020" transform={`rotate(${r} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="5.6" fill="url(#sun-disc)" />
    </svg>
  )
}

/** Battery like the Tesla/Vacuum cards (green fill to the real level, red under 20%), plus sun + solar level when the panel is active */
export function BatteryTag({ pct, solar }: { pct: number | null; solar?: number | null }) {
  if (pct === null) return null
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-ink">
      <Battery pct={pct} />{pct}%
      {solar != null && solar >= SUN_AT && (
        <span className="ml-0.5 flex items-center gap-1 border-l border-white/15 pl-1.5 text-[#ffd257]" title={`Solar intensity ${solar}`}>
          <SunIcon />{solar}
        </span>
      )}
    </span>
  )
}

export function Snapshot({ cam, onOpen }: { cam: Camera; onOpen: () => void }) {
  const offline = cam.status === 'offline'
  const now = !offline && motionNow(cam)
  const what = cam.lastEvent ?? 'Motion'
  return (
    <button onClick={onOpen}
      className="group relative block aspect-video w-full overflow-hidden fit:aspect-auto fit:h-full rounded-xl bg-surface-raised text-left transition-shadow"
      style={now ? { boxShadow: `0 0 0 2px ${cfg.color}, 0 0 22px -6px ${cfg.color}` } : undefined}
      aria-label={`Open live view for ${cam.name}`}>
      {cam.snapshotUrl && (
        <img src={cam.snapshotUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          style={offline ? { filter: 'grayscale(1) brightness(.5)' } : undefined} />
      )}
      <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium">
        <span className={`h-1.5 w-1.5 rounded-full ${now ? 'animate-pulse' : ''}`} style={{ background: offline ? 'var(--color-critical)' : cfg.color }} />
        {cam.name}
        {!cam.spotlight && <Moon size={11} style={{ color: STAR }} aria-label="motion light off" />}
      </span>
      <span className="absolute right-2.5 top-2.5"><BatteryTag pct={cam.battery} solar={cam.solar} /></span>
      <span className="absolute bottom-2.5 left-2.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
        style={now ? { background: cfg.color, color: '#0e1318' } : { background: 'rgba(0,0,0,.7)' }}>
        {offline ? 'Offline' : cam.lastMotionAt ? `${what} · ${motionWhen(cam.lastMotionAt)}` : 'No motion yet'}
      </span>
      {!offline && (
        <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium">
          <Play size={11} fill="currentColor" /> Live
        </span>
      )}
    </button>
  )
}

/** Stargazing lasts this long; tapping the button again restarts it */
export const STARGAZE_MS = 60 * 60_000
/** Coarse countdown in 5-minute steps: "35 min" */
const coarse = (ms: number) => `${Math.max(5, Math.ceil(ms / 300_000) * 5)} min`

/**
 * Stargazing: both cameras' motion lights off (they keep recording) for 1 hour.
 * Tap while on = back to a full hour. The × on the countdown ends it now.
 * The Lenovo turns the lights back on when the hour is up, even if no screen is open.
 */
export function StargazingButton() {
  const { data, update, send } = useHome()
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(t) }, [])
  if (!data) return null
  const left = data.stargazingUntil ? new Date(data.stargazingUntil).getTime() - Date.now() : 0
  const on = left > 0
  const start = () => {
    const until = new Date(Date.now() + STARGAZE_MS).toISOString()
    update((s) => ({ ...s, stargazingUntil: until, cameras: s.cameras.map((c) => ({ ...c, spotlight: false })) }))
    send('cameras/command', { action: 'stargazing', minutes: 60 })
  }
  const end = () => {
    update((s) => ({ ...s, stargazingUntil: null, cameras: s.cameras.map((c) => ({ ...c, spotlight: true })) }))
    send('cameras/command', { action: 'stargazing', minutes: 0 })
  }
  return (
    <div className="flex items-center gap-1.5">
      {on && (
        <span className="flex h-9 items-center gap-1 rounded-full border pl-3 pr-1 text-xs font-medium tabular-nums"
          style={{ borderColor: NAVY_EDGE, color: STAR, background: 'rgba(7,10,28,.6)' }}>
          {coarse(left)}
          <button onClick={end} aria-label="End stargazing: motion lights back on"
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/10"><X size={13} aria-hidden /></button>
        </span>
      )}
      <button onClick={start} aria-pressed={on} aria-label={on ? 'Stargazing on: tap to restart the hour' : 'Stargazing: motion lights off for 1 hour'}
        className="flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors"
        style={on ? { background: NAVY, borderColor: NAVY_EDGE, color: STAR, boxShadow: `0 0 14px -4px ${STAR}` } : { borderColor: 'var(--color-edge)', color: 'var(--color-ink-dim)', background: 'var(--color-surface-raised)' }}>
        <Moon size={14} fill={on ? STAR : 'none'} aria-hidden />
        <span className="hidden sm:inline">Stargazing</span>
      </button>
    </div>
  )
}

export function GuardToggle() {
  const { data, update, send } = useHome()
  if (!data) return null
  const set = (mode: GuardMode) => {
    update((s) => ({ ...s, guardMode: mode }))
    send('cameras/command', { action: 'guard-mode', mode })
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
  const [open, setOpen] = useState<string | null>(null)
  if (!data) return null
  const online = data.cameras.filter((c) => c.status === 'online').length
  const active = data.cameras.some(motionNow)
  const stars = !!data.stargazingUntil && new Date(data.stargazingUntil).getTime() > Date.now()
  return (
    <>
      <Card accent={cfg.color} title="Cameras" category="cameras"
        subtitle={active ? `Motion now · ${data.cameras.filter(motionNow).map((c) => c.name).join(', ')}` : stars ? 'Stargazing · motion lights off' : `${online} of ${data.cameras.length} online`}
        headerRight={<div className="flex items-center gap-2"><StargazingButton /><GuardToggle /></div>} bodyClassName="flex flex-col"
        style={active ? { backgroundImage: 'linear-gradient(180deg, rgba(124,140,240,0.16) 0%, rgba(124,140,240,0.05) 45%, transparent 80%)' }
          : stars ? { backgroundImage: 'linear-gradient(180deg, rgba(22,20,54,0.95) 0%, rgba(7,10,28,0.55) 50%, transparent 85%)' } : undefined}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 fit:min-h-0 fit:flex-1">
          {data.cameras.map((c) => <Snapshot key={c.id} cam={c} onOpen={() => setOpen(c.id)} />)}
        </div>
        <p className="mt-3 shrink-0 text-[11px] text-ink-faint">Latest motion picture · tap a camera for live view</p>
      </Card>
      {open && <CameraSheet cameras={data.cameras} startId={open} onClose={() => setOpen(null)} />}
    </>
  )
}
