import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Moon, Power, TriangleAlert } from 'lucide-react'
import { useHome } from '../../lib/useHome'
import { useLightActions, useThrottle } from '../../lib/useLightActions'
import { rgba, timeLabel, WARM_WHITE } from '../../lib/lightColor'
import { relativeTime } from '../../lib/format'
import { categories } from '../../lib/categories'
import { DetailLayout } from '../../components/DetailLayout'
import { Card } from '../../components/Card'
import { ConfirmButton } from '../../components/QuickRunButton'
import { LightPanel, Switch } from '../../components/lights/LightPanel'
import type { BedtimeLamp, Light } from '../../types'

const cfg = categories.lights

export function LightsPage() {
  const { data } = useHome()
  const { allOff } = useLightActions()
  const [panel, setPanel] = useState<string | null>(null)
  const { hash } = useLocation()
  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [hash, data === null])
  if (!data) return null

  const singles = data.lights.filter((l) => !l.isGroup)
  const rooms = [...new Set(singles.map((l) => l.room))]
  const on = singles.filter((l) => l.on).length
  const notes = data.lighting?.notes ?? []

  return (
    <DetailLayout title="Lights" subtitle={`${on} of ${singles.length} on · tap a light's name for color and scenes`} color={cfg.color}
      action={
        <div className="flex w-56 gap-2">
          <button onClick={() => void allOff('indoor')} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium" style={{ background: cfg.dim, color: cfg.color }}>
            <Moon size={12} /> Indoor off
          </button>
          <div className="flex-1"><ConfirmButton label="All off" icon={<Power size={12} />} onConfirm={() => void allOff('all')} color="var(--color-critical)" dim="var(--color-critical-dim)" /></div>
        </div>
      }>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.lighting && <div id="bedtime" className="scroll-mt-6 md:col-span-2"><BedtimeCard bedtime={data.lighting.bedtime} /></div>}

        {notes.length > 0 && (
          <div className="md:col-span-2">
            <Card accent="var(--color-weather)" title="Setup check" subtitle="Names in src/config/home.ts that didn't match a light">
              <ul className="space-y-1.5 text-xs text-ink-dim">
                {notes.map((n) => <li key={n} className="flex gap-2"><TriangleAlert size={13} className="mt-0.5 shrink-0 text-weather" />{n}</li>)}
              </ul>
            </Card>
          </div>
        )}

        {rooms.map((room) => (
          <Card key={room} accent={cfg.color} title={room}>
            <div className="divide-y divide-edge-soft">
              {singles.filter((l) => l.room === room).map((l) => <LightRow key={l.id} light={l} onOpen={() => setPanel(l.id)} />)}
            </div>
          </Card>
        ))}
      </div>
      {panel && <LightPanel lightId={panel} onClose={() => setPanel(null)} />}
    </DetailLayout>
  )
}

function LightRow({ light: l, onOpen }: { light: Light; onOpen: () => void }) {
  const { set, toggle } = useLightActions()
  const [drag, setDrag] = useState<number | null>(null)
  const send = useThrottle((v: number) => void set([l.id], { brightnessPct: v }), 250)
  const color = l.on ? l.color ?? WARM_WHITE : null
  const shown = drag ?? (l.on ? l.brightnessPct : 0)
  return (
    <div className="flex items-center gap-3 py-3">
      <Switch on={l.on} onChange={() => void toggle(l)} color={color ?? cfg.color} label={`${l.name} ${l.on ? 'off' : 'on'}`} disabled={l.available === false} />
      <button onClick={onOpen} className="flex w-36 shrink-0 items-center gap-2 text-left text-sm hover:text-lights">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={color ? { background: color, boxShadow: `0 0 6px ${color}` } : { background: 'var(--color-edge)' }} />
        <span className="truncate">{l.name}</span>
        {l.timer && <span className="shrink-0 text-[9px] uppercase tracking-wider text-ink-faint">timer</span>}
      </button>
      {l.supports?.dim !== false ? (
        <input type="range" min={1} max={100} value={shown || 1} disabled={!l.on} aria-label={`${l.name} brightness`}
          onChange={(e) => { const v = Number(e.target.value); setDrag(v); send.push(v) }}
          onPointerUp={() => { send.flush(); setTimeout(() => setDrag(null), 600) }}
          className="h-1.5 flex-1 cursor-pointer disabled:opacity-30" style={{ color: color ?? cfg.color }} />
      ) : <span className="flex-1" />}
      <span className="w-14 text-right font-mono text-xs text-ink-faint">{l.available === false ? 'offline' : l.on ? `${shown}%` : 'off'}</span>
    </div>
  )
}

const TIMES = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`)

function BedtimeCard({ bedtime: b }: { bedtime: BedtimeLamp }) {
  const { update, send } = useHome()
  const [busy, setBusy] = useState(false)
  const change = (patch: Partial<BedtimeLamp>, body: Record<string, unknown>) => {
    update((s) => (s.lighting ? { ...s, lighting: { ...s.lighting, bedtime: { ...s.lighting.bedtime, ...patch } } } : s))
    void send('lights/bedtime', body)
  }
  const setUp = async () => {
    setBusy(true)
    await send('lights/bedtime', { action: 'setup' })
    setBusy(false)
  }
  const ready = b.status === 'ready'
  const lamp = '#ffd6a0'

  return (
    <Card accent={ready && b.enabled ? lamp : 'var(--color-edge)'} title="Bedside lamp after TV"
      subtitle={ready ? (b.lastRun ? `Last ran ${relativeTime(b.lastRun)}` : 'Hasn’t run yet') : undefined}
      headerRight={ready ? <Switch on={b.enabled} color={lamp} label="Bedside lamp after TV on or off"
        onChange={(on) => change({ enabled: on }, { action: on ? 'enable' : 'disable' })} /> : undefined}>
      <p className="text-sm text-ink-dim">
        When the living room TV turns off between these times, the bedside lamp turns on at full brightness, soft white — so the bedroom is lit when you get there.
      </p>
      {ready ? (
        <div className={`mt-4 flex flex-wrap items-center gap-3 text-sm ${b.enabled ? '' : 'opacity-50'}`}>
          <TimeSelect label="From" value={b.start} onChange={(start) => change({ start }, { action: 'window', start })} />
          <span className="text-ink-faint">to</span>
          <TimeSelect label="Until" value={b.end} onChange={(end) => change({ end }, { action: 'window', end })} />
        </div>
      ) : b.status === 'not-set-up' ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={() => void setUp()} disabled={busy}
            className="h-9 rounded-full px-4 text-xs font-semibold disabled:opacity-50" style={{ background: rgba(lamp, 0.16), color: lamp }}>
            {busy ? 'Setting up…' : 'Set it up in Home Assistant'}
          </button>
          <span className="text-xs text-ink-faint">Adds the automation and two time settings, starting at 8:00–10:00 PM</span>
        </div>
      ) : (
        <p className="mt-4 flex items-center gap-2 text-xs text-ink-faint"><TriangleAlert size={13} className="text-weather" />{b.message}</p>
      )}
    </Card>
  )
}

function TimeSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-edge bg-surface-raised px-3 font-mono text-sm text-ink">
      {!TIMES.includes(value) && <option value={value}>{timeLabel(value)}</option>}
      {TIMES.map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}
    </select>
  )
}
