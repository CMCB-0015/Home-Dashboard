import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Lightbulb, Power } from 'lucide-react'
import { useHome } from '../../lib/useHome'
import { useLightActions } from '../../lib/useLightActions'
import { useLongPress } from '../../lib/useLongPress'
import { blend, rgba, timeRange, WARM_WHITE } from '../../lib/lightColor'
import { categories } from '../../lib/categories'
import { Card } from '../Card'
import { ConfirmButton } from '../QuickRunButton'
import { LightPanel } from './LightPanel'
import type { Light, QuickLight } from '../../types'

const cfg = categories.lights

/**
 * The Lights card ("Ambient" style). The card takes on the colors of the
 * lights that are on. Tap a light to toggle it; press and hold to open its panel.
 */
export function LightsCard() {
  const { data } = useHome()
  const { allOff } = useLightActions()
  const [panel, setPanel] = useState<string | null>(null)
  if (!data) return null

  const singles = data.lights.filter((l) => !l.isGroup)
  const glow = blend(singles)
  const inside = singles.filter((l) => !l.outdoor)
  const outside = singles.filter((l) => l.outdoor)
  const inOn = inside.filter((l) => l.on).length
  const outOn = outside.filter((l) => l.on).length
  const nonTimerOn = singles.some((l) => l.on && !l.timer)
  const bedtime = data.lighting?.bedtime
  const quick = data.lighting?.quick ?? []

  return (
    <>
      <Card className="h-full" accent={glow ?? 'var(--color-lights)'} title="Lights" category="lights"
        subtitle={`${inOn} in · ${outOn} out`}
        style={glow ? { backgroundImage: `linear-gradient(180deg, ${rgba(glow, 0.2)} 0%, ${rgba(glow, 0.06)} 45%, transparent 80%)` } : undefined}
        headerRight={<Link to={cfg.path} aria-label="All lights" className="-mr-1 flex rounded-full p-1 text-ink-faint hover:text-ink"><ChevronRight size={16} /></Link>}
        actions={
          <div className="grid w-full grid-cols-2 gap-2">
            <button onClick={() => void allOff('indoor')} disabled={!nonTimerOn} title="Turns off everything except the timer lights"
              className="flex h-9 items-center justify-center whitespace-nowrap rounded-lg px-1.5 text-[11px] font-medium transition-opacity hover:opacity-85 disabled:opacity-40"
              style={{ background: cfg.dim, color: cfg.color }}>
              All indoor off
            </button>
            <ConfirmButton label="All off" icon={<Power size={11} />} disabled={inOn + outOn === 0}
              onConfirm={() => void allOff('all')} color="var(--color-critical)" dim="var(--color-critical-dim)" />
          </div>
        }>
        <div className="grid grid-cols-2 gap-2">
          {quick.map((q) => <QuickButton key={q.label} q={q} lights={data.lights} onHold={setPanel} />)}
        </div>

        <div className="mt-3 space-y-1.5">
          <Dots label="In" lights={inside} />
          <Dots label="Out" lights={outside} />
        </div>

        {bedtime && (
          <Link to="/lights#bedtime" className="mt-3 block truncate text-[10px] text-ink-faint hover:text-ink-dim">
            Bedtime lamp · {bedtime.status !== 'ready' ? 'not set up'
              : bedtime.enabled ? timeRange(bedtime.start, bedtime.end) : 'off'}
          </Link>
        )}
      </Card>
      {panel && <LightPanel lightId={panel} onClose={() => setPanel(null)} />}
    </>
  )
}

function QuickButton({ q, lights, onHold }: { q: QuickLight; lights: Light[]; onHold: (id: string) => void }) {
  const { toggle } = useLightActions()
  const { data } = useHome()
  const light = q.lightId ? lights.find((l) => l.id === q.lightId) : undefined
  // The bedroom overhead group counts as on when either can is on
  const cans = data?.lighting?.cans
  const members = light && cans && light.id === cans.groupId ? lights.filter((l) => l.id === cans.windowId || l.id === cans.dresserId) : []
  const on = !!light && (light.on || members.some((m) => m.on))
  const color = on ? blend(members.length ? members : [light!]) ?? light?.color ?? WARM_WHITE : null
  const membersOn = members.filter((m) => m.on)
  const brightness = membersOn.length ? Math.round(membersOn.reduce((t, m) => t + m.brightnessPct, 0) / membersOn.length) : light?.brightnessPct ?? 0
  const press = useLongPress(() => light && void toggle({ ...light, on }), () => light && onHold(light.id))
  const unavailable = !light || light.available === false

  return (
    <button {...press} disabled={unavailable} aria-pressed={on}
      aria-label={`${q.label}: ${on ? 'on' : 'off'}. Tap to switch ${on ? 'off' : 'on'}, hold for more`}
      title={!light ? q.reason : undefined}
      className="flex min-h-[66px] flex-col justify-between rounded-xl border px-2.5 py-2 text-left transition-all duration-300 select-none disabled:opacity-40"
      style={color
        ? { background: rgba(color, 0.16), borderColor: rgba(color, 0.5), boxShadow: `0 0 18px -6px ${rgba(color, 0.8)}` }
        : { background: 'var(--color-surface-raised)', borderColor: 'var(--color-edge)' }}>
      <Lightbulb size={15} style={{ color: color ?? 'var(--color-ink-faint)' }} fill={color ? 'currentColor' : 'none'} />
      <span className="mt-1 block w-full">
        <span className="line-clamp-2 block text-[11px] font-semibold leading-tight text-ink">{q.label}</span>
        <span className="block text-[10px] leading-tight text-ink-faint">
          {!light ? 'Not found' : light.available === false ? 'Unavailable' : on ? `On · ${brightness}%` : 'Off'}
        </span>
      </span>
    </button>
  )
}

function Dots({ label, lights }: { label: string; lights: Light[] }) {
  if (!lights.length) return null
  return (
    <div className="flex items-center gap-2">
      <span className="w-7 shrink-0 text-[9px] font-semibold uppercase tracking-wider text-ink-faint">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {lights.map((l) => (
          <span key={l.id} title={`${l.name}${l.on ? '' : ' (off)'}`} className="h-2 w-2 rounded-full"
            style={l.on ? { background: l.color ?? WARM_WHITE, boxShadow: `0 0 6px ${l.color ?? WARM_WHITE}` } : { background: 'var(--color-edge)' }} />
        ))}
      </div>
    </div>
  )
}
