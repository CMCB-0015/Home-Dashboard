import { Minus, Plus, Play, Pause, Square, SkipBack, SkipForward, Check } from 'lucide-react'
import { useHome } from '../../lib/useHome'
import { categories } from '../../lib/categories'
import { relativeTime, untilTime, mmss, clockTime } from '../../lib/format'
import { QuickRunButton, ConfirmButton } from '../QuickRunButton'
import { PAUSE_MINUTES } from '../../config/irrigation'
import type { QuickRun, IrrigationZone } from '../../types'
import { Card } from '../Card'
import { Pill, RoundButton } from '../Buttons'
import { Dial, DotRow, Bar } from '../Gauges'

const tile = 'h-full'

// ── Climate ──────────────────────────────────────────────────────────────
export function ClimateTile() {
  const { data, update, send } = useHome()
  const cfg = categories.climate
  if (!data) return null
  const t = data.thermostats[0]
  const adjust = (delta: number) => {
    const target = t.targetTempF + delta
    update((s) => ({ ...s, thermostats: s.thermostats.map((x) => (x.id === t.id ? { ...x, targetTempF: target } : x)) }))
    send('nest/set', { deviceId: t.id, targetTempF: target })
  }
  return (
    <Card className={tile} accent={cfg.color} title="Climate" category="climate" subtitle={`${t.room} · ${t.mode}`} to={cfg.path}
      actions={
        <div className="flex w-full items-center justify-between">
          <RoundButton color={cfg.color} dim={cfg.dim} onClick={() => adjust(-1)} label="Lower target"><Minus size={14} /></RoundButton>
          <span className="font-mono text-xs text-ink-dim">{t.targetTempF}°</span>
          <RoundButton color={cfg.color} dim={cfg.dim} onClick={() => adjust(1)} label="Raise target"><Plus size={14} /></RoundButton>
        </div>
      }>
      <div className="flex justify-center py-2">
        <Dial value={((t.currentTempF - 55) / 30) * 100} color={cfg.color} label={`${t.currentTempF}°`} sublabel={`target ${t.targetTempF}°`} />
      </div>
    </Card>
  )
}

// ── Lights ───────────────────────────────────────────────────────────────
export function LightsTile() {
  const { data, update, send } = useHome()
  const cfg = categories.lights
  if (!data) return null
  const on = data.lights.filter((l) => l.on).length
  const allOff = () => {
    update((s) => ({ ...s, lights: s.lights.map((l) => ({ ...l, on: false })) }))
    send('hue/set', { all: true, on: false })
  }
  return (
    <Card className={tile} accent={cfg.color} title="Lights" category="lights" to={cfg.path}
      actions={<Pill color={cfg.color} dim={cfg.dim} onClick={allOff} disabled={on === 0}>All off</Pill>}>
      <div className="flex items-baseline gap-2 pt-4">
        <span className="font-mono text-5xl">{on}</span>
        <span className="text-sm text-ink-dim">/ {data.lights.length} on</span>
      </div>
      <div className="mt-6"><DotRow total={data.lights.length} active={on} color={cfg.color} /></div>
    </Card>
  )
}

// ── Sonos ────────────────────────────────────────────────────────────────
export function SonosTile() {
  const { data, update, send } = useHome()
  const cfg = categories.sonos
  if (!data || !data.sonos) return null
  const p = data.sonos
  const cmd = (command: string) => send('sonos/command', { command })
  const togglePlay = () => {
    update((s) => (s.sonos ? { ...s, sonos: { ...s.sonos, playing: !s.sonos.playing } } : s))
    cmd(p.playing ? 'pause' : 'play')
  }
  const setVolume = (v: number) => {
    update((s) => (s.sonos ? { ...s, sonos: { ...s.sonos, volumePct: v } } : s))
    send('sonos/command', { command: 'volume', value: v })
  }
  return (
    <Card className={tile} accent={cfg.color} title="Sonos" category="sonos" subtitle={`${p.room}${p.groupSize > 1 ? ` +${p.groupSize - 1}` : ''}`}
      actions={
        <div className="flex w-full items-center justify-center gap-5">
          <button onClick={() => cmd('previous')} aria-label="Previous" className="text-ink-dim hover:text-ink"><SkipBack size={18} fill="currentColor" /></button>
          <RoundButton color={cfg.color} dim={cfg.dim} onClick={togglePlay} label={p.playing ? 'Pause' : 'Play'} size={34}>
            {p.playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
          </RoundButton>
          <button onClick={() => cmd('next')} aria-label="Next" className="text-ink-dim hover:text-ink"><SkipForward size={18} fill="currentColor" /></button>
        </div>
      }>
      <div className="flex gap-3">
        {p.artUrl ? <img src={p.artUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" /> : <div className="h-16 w-16 shrink-0 rounded-lg bg-surface-raised" />}
        <div className="min-w-0 pt-1">
          <p className="truncate text-[13px] font-semibold">{p.title}</p>
          <p className="truncate text-[11px] text-ink-dim">{p.subtitle}</p>
          <p className="mt-1 text-[10px] font-medium" style={{ color: p.playing ? cfg.color : 'var(--color-ink-faint)' }}>{p.playing ? 'Playing' : 'Paused'}</p>
        </div>
      </div>
      <div className="mt-4"><Bar value={(p.positionSec / p.durationSec) * 100} color={cfg.color} height={4} /></div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-faint"><span>{mmss(p.positionSec)}</span><span>{mmss(p.durationSec)}</span></div>
      <label className="mt-3 flex items-center gap-2 text-[10px] text-ink-faint">
        Vol
        <input type="range" min={0} max={100} value={p.volumePct} aria-label="Volume"
          onChange={(e) => setVolume(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer" style={{ color: 'var(--color-ink-dim)' }} />
      </label>
    </Card>
  )
}

// ── Vacuum ───────────────────────────────────────────────────────────────
export function VacuumTile() {
  const { data, update, send } = useHome()
  const cfg = categories.vacuum
  if (!data) return null
  const v = data.vacuums[0]
  const run = (profileId?: string) => {
    const next = v.state === 'cleaning' ? 'paused' : 'cleaning'
    update((s) => ({ ...s, vacuums: s.vacuums.map((x) => (x.id === v.id ? { ...x, state: next } : x)) }))
    send('roborock/command', { action: next === 'cleaning' ? 'start' : 'pause', profileId })
  }
  return (
    <Card className={tile} accent={cfg.color} title="Vacuum" category="vacuum" subtitle={`Last clean ${relativeTime(v.lastCleanAt)}`} to={cfg.path}
      actions={<>
        <Pill color={cfg.color} dim={cfg.dim} onClick={() => run()}>{v.state === 'cleaning' ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Start</>}</Pill>
      </>}>
      <div className="flex justify-center py-2">
        <Dial value={v.batteryPct} color={cfg.color} label={`${v.batteryPct}%`} sublabel={v.state} />
      </div>
    </Card>
  )
}

// ── Irrigation ───────────────────────────────────────────────────────────
export function nextRunText(at: string): string {
  const d = new Date(at)
  const today = new Date()
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1)
  const day = d.toDateString() === today.toDateString() ? 'Today'
    : d.toDateString() === tomorrow.toDateString() ? 'Tomorrow'
    : d.toLocaleDateString('en-US', { weekday: 'short' })
  return `${day} ${clockTime(at, true)}`
}

export function useIrrigationActions() {
  const { update, send } = useHome()
  const setZone = (id: string, change: Partial<IrrigationZone>) =>
    update((s) => ({ ...s, irrigationZones: s.irrigationZones.map((z) => (z.id === id ? { ...z, ...change } : z)) }))
  return {
    quick: (run: QuickRun) => {
      if (run.zoneIds?.[0]) setZone(run.zoneIds[0], { isWatering: true, isPaused: false, minutesLeft: parseInt(run.detail) || null })
      send('rachio/command', { action: 'quick', quickId: run.id }, { refresh: true })
    },
    stop: (zone: IrrigationZone) => {
      setZone(zone.id, { isWatering: false, isPaused: false, minutesLeft: null, resumesAt: null })
      send('rachio/command', { action: 'stop', zoneId: zone.id }, { refresh: true })
    },
    pause: (zone: IrrigationZone) => {
      setZone(zone.id, { isWatering: false, isPaused: true, resumesAt: new Date(Date.now() + PAUSE_MINUTES * 60_000).toISOString() })
      send('rachio/command', { action: 'pause', zoneId: zone.id }, { refresh: true })
    },
    resume: (zone: IrrigationZone) => {
      setZone(zone.id, { isWatering: true, isPaused: false, resumesAt: null })
      send('rachio/command', { action: 'resume', zoneId: zone.id }, { refresh: true })
    },
    skipTomorrow: () => {
      update((s) => ({ ...s, irrigation: { ...s.irrigation, skipTomorrow: { available: false, skipped: true, label: "Tomorrow's runs skipped" } } }))
      send('rachio/command', { action: 'skip-tomorrow' }, { refresh: true })
    },
  }
}

const pauseLabel = PAUSE_MINUTES === 60 ? '1 hr' : `${PAUSE_MINUTES} min`

/** Pause/Resume + Stop while a zone is running or paused; quick runs + skip otherwise. */
export function IrrigationControls({ stacked = true }: { stacked?: boolean }) {
  const { data } = useHome()
  const a = useIrrigationActions()
  const cfg = categories.irrigation
  if (!data) return null
  const active = data.irrigationZones.find((z) => z.isWatering || z.isPaused)
  if (active) {
    return (
      <div className="flex w-full gap-2">
        {active.isPaused
          ? <Pill color={cfg.color} dim={cfg.dim} onClick={() => a.resume(active)}><Play size={12} fill="currentColor" /> Resume</Pill>
          : <Pill color={cfg.color} dim={cfg.dim} onClick={() => a.pause(active)}><Pause size={12} fill="currentColor" /> Pause {pauseLabel}</Pill>}
        <Pill color={cfg.color} dim={cfg.dim} onClick={() => a.stop(active)}><Square size={11} fill="currentColor" /> Stop</Pill>
      </div>
    )
  }
  const skip = data.irrigation?.skipTomorrow
  return (
    <div className={`flex w-full flex-col ${stacked ? 'gap-1.5' : 'gap-2'}`}>
      {data.irrigation?.quickRuns.map((r) => <QuickRunButton key={r.id} run={r} onStart={() => a.quick(r)} color={cfg.color} dim={cfg.dim} />)}
      {skip && (
        <ConfirmButton label={skip.label} disabled={!skip.available} onConfirm={a.skipTomorrow}
          icon={skip.skipped ? <Check size={13} /> : <SkipForward size={12} />}
          color="var(--color-rain)" dim="var(--color-calendar-dim)" />
      )}
    </div>
  )
}

export function IrrigationTile() {
  const { data } = useHome()
  const cfg = categories.irrigation
  if (!data) return null
  const zones = data.irrigationZones
  const active = zones.find((z) => z.isWatering || z.isPaused)
  const next = data.irrigation?.nextRun
  const delays = zones.filter((z) => z.rainDelay).length
  return (
    <Card className={tile} accent={cfg.color} title="Irrigation" to={cfg.path} category="irrigation" actions={<IrrigationControls />}>
      <div className="pt-2">
        {active ? (
          <>
            <p className="font-mono text-2xl" style={{ color: active.isPaused ? 'var(--color-ink-dim)' : cfg.color }}>{active.isPaused ? 'Paused' : 'Watering'}</p>
            <p className="mt-1 text-xs text-ink-dim">
              {active.name}
              {active.isPaused
                ? active.resumesAt ? ` · resumes ${clockTime(active.resumesAt, true)}` : ''
                : active.minutesLeft ? ` · ${active.minutesLeft} min left` : ''}
            </p>
          </>
        ) : (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Next run</p>
            <p className="mt-1 font-mono text-xl">{next ? nextRunText(next.at) : '—'}</p>
            <p className="mt-0.5 truncate text-xs text-ink-dim">{next ? `${next.name} · ${untilTime(next.at)}` : delays ? 'Paused for rain' : 'Nothing scheduled'}</p>
          </>
        )}
        {delays > 0 && <p className="mt-2 text-[11px] text-rain">Rain delay on</p>}
      </div>
    </Card>
  )
}
