import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, Droplet, ChevronRight, Flame, Minus, Plus, Power, Snowflake } from 'lucide-react'
import { useHome } from '../../lib/useHome'
import { categories } from '../../lib/categories'
import { rgba } from '../../lib/lightColor'
import { MODE_LABEL, canAdjust, nudge, setPoint, targetText } from '../../lib/climate'
import type { Thermostat, ThermostatMode } from '../../types'
import { Card } from '../Card'
import { RoundButton } from '../Buttons'
import { HaloDial, type Setpoint } from './HaloDial'
import { dewFeel, dewPointF } from '../../lib/dew'

const cfg = categories.climate
// Same values as the theme tokens in index.css (rgba() needs the hex)
const HEAT = '#ff6b5e'   // --color-temp-high
const COOL = '#5aa2ff'   // --color-temp-low
const IDLE = '#5b8fc7'   // --color-climate
const ECO = '#7fd1b9'    // leaf green (--color-charge)
const GREY = '#8493a1'   // --color-ink-dim

/** The menu from tapping the dial's center (Heat · Cool and Eco stay on the Climate page) */
const MENU: { mode: ThermostatMode; color: string; icon: typeof Flame }[] = [
  { mode: 'heat', color: HEAT, icon: Flame },
  { mode: 'cool', color: COOL, icon: Snowflake },
  { mode: 'off', color: GREY, icon: Power },
]

/** The Climate card ("Halo"): turn the dial to change the temperature, tap its center for the mode */
export function ClimateCard() {
  const { data, update, send } = useHome()
  const [menu, setMenu] = useState(false)
  const [draft, setDraft] = useState<{ which: Setpoint; value: number } | null>(null)
  if (!data) return null
  const t = data.thermostats[0]
  if (!t) return null

  const change = (fn: (x: Thermostat) => Thermostat) =>
    update((s) => ({ ...s, thermostats: s.thermostats.map((x) => (x.id === t.id ? fn(x) : x)) }))
  const adjust = (delta: number) => {
    change((x) => nudge(x, delta))
    void send('climate/set', { deviceId: t.id, delta })
  }
  const commit = (which: Setpoint, value: number) => {
    change((x) => setPoint(x, which, value))
    const key = which === 'low' ? 'targetLowF' : which === 'high' ? 'targetHighF' : 'targetTempF'
    void send('climate/set', { deviceId: t.id, [key]: value })
  }
  const pickMode = (mode: ThermostatMode) => {
    setMenu(false)
    if (mode === t.mode) return
    change((x) => ({
      ...x, mode,
      action: mode === 'off' ? 'off' : x.action,
      // Leaving Heat · Cool: show the matching end until the Nest reports its own target
      targetTempF: x.mode === 'heat_cool' && mode === 'heat' && x.targetLowF != null ? x.targetLowF
        : x.mode === 'heat_cool' && mode === 'cool' && x.targetHighF != null ? x.targetHighF : x.targetTempF,
    }))
    void send('climate/set', { deviceId: t.id, mode })
  }

  const off = t.mode === 'off', eco = t.mode === 'eco'
  const locked = off || eco
  const live = !off && (t.action === 'heating' || t.action === 'cooling')
  const c = !live ? IDLE : t.action === 'heating' ? HEAT : COOL
  const hasRange = t.targetLowF != null && t.targetHighF != null
  const range = (t.mode === 'heat_cool' || eco) && hasRange ? { low: t.targetLowF!, high: t.targetHighF! } : null
  const lo = range ? (draft?.which === 'low' ? draft.value : range.low) : 0
  const hi = range ? (draft?.which === 'high' ? draft.value : range.high) : 0
  const tg = draft?.which === 'target' ? draft.value : t.targetTempF

  const word = draft ? 'Set to' : off ? 'Inside' : eco ? 'Eco' : t.action === 'heating' ? 'Heating' : t.action === 'cooling' ? 'Cooling' : 'Holding'
  const wordColor = draft ? '#e8edf2' : live ? c : eco ? ECO : GREY
  const big = off ? `${t.currentTempF}°` : eco ? 'Eco' : range ? `${lo}–${hi}°` : `${tg}°`
  const status = draft ? `Set to ${draft.value}° · release to send`
    : off ? 'System off'
    : eco ? (range ? `Eco ${range.low}–${range.high}°` : 'Eco temperatures')
    : t.action === 'heating' ? `Heating to ${range ? range.low : t.targetTempF}°`
    : t.action === 'cooling' ? `Cooling to ${range ? range.high : t.targetTempF}°`
    : `Holding ${targetText(t)}`
  const statusColor = draft ? '#e8edf2' : live ? c : eco ? ECO : off ? GREY : '#e8edf2'

  // Off: the card is an indoor thermometer — inside vs outside, plus the indoor dew point
  const outside = data.weather?.current
  const dew = off ? dewPointF(t.currentTempF, t.humidityPct) : null
  const since = off && t.modeSince ? new Date(t.modeSince) : null
  const sinceText = since && !isNaN(since.getTime())
    ? `Since ${since.toDateString() === new Date().toDateString() ? '' : since.toLocaleDateString('en-US', { weekday: 'short' }) + ' '}${since.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : null

  const wash = live ? { backgroundImage: `linear-gradient(180deg, ${rgba(c, 0.2)} 0%, ${rgba(c, 0.06)} 45%, transparent 80%)` } : undefined
  const modes = MENU.filter((m) => !t.modes?.length || t.modes.includes(m.mode))

  return (
    <Card className="h-full" accent={c} title="Climate" category="climate" subtitle={MODE_LABEL[t.mode]} style={wash}
      headerRight={<Link to={cfg.path} aria-label="Climate page" className="-mr-1 flex rounded-full p-1 text-ink-faint hover:text-ink"><ChevronRight size={16} /></Link>}
      bodyClassName="flex flex-col items-center justify-center gap-2"
      actions={
        <div className="flex w-full items-center justify-between">
          <RoundButton color={live ? c : cfg.color} dim={live ? rgba(c, 0.16) : cfg.dim} onClick={() => adjust(-1)} label="Lower target" disabled={!canAdjust(t)}><Minus size={14} /></RoundButton>
          <span className="font-mono text-xs text-ink-dim">{draft ? (range ? `${lo}–${hi}°` : `${tg}°`) : off ? (sinceText ?? '') : targetText(t)}</span>
          <RoundButton color={live ? c : cfg.color} dim={live ? rgba(c, 0.16) : cfg.dim} onClick={() => adjust(1)} label="Raise target" disabled={!canAdjust(t)}><Plus size={14} /></RoundButton>
        </div>
      }
      overlay={menu ? <ModeMenu current={t.mode} modes={modes} onPick={pickMode} onClose={() => setMenu(false)} /> : undefined}>
      <div className={off ? 'h-[160px] w-[160px] shrink-0' : 'contents'}>
      <div className={off ? 'origin-top-left scale-[0.909]' : 'contents'}>
      <HaloDial thermometer={off} cur={t.currentTempF} target={t.targetTempF} range={range} color={c} live={live}
        locked={locked} off={off || (eco && !range)}
        lowColor={eco ? GREY : COOL} highColor={eco ? GREY : HEAT}
        centerLabel={`Mode: ${MODE_LABEL[t.mode]}. Tap to change`} onCenter={() => setMenu(true)}
        onCommit={commit} onTurning={setDraft}
        center={() => (
          <>
            <span className="text-[9px] font-semibold uppercase tracking-[0.16em]" style={{ color: wordColor }}>{word}</span>
            <span className="font-display font-normal leading-none tracking-[-0.03em] transition-colors duration-300"
              style={{ fontSize: range || eco ? 30 : 52, color: live ? c : 'var(--color-ink)' }}>{big}</span>
            {off
              ? <span className="mt-0.5 inline-flex items-center gap-[3px] font-mono text-[10px] text-[#6fd3c7]"><Droplet size={10} strokeWidth={2.2} aria-hidden />{t.humidityPct}% humidity</span>
              : <span className="mt-0.5 font-mono text-[10px] text-ink-dim">Inside {t.currentTempF}°</span>}
            <span className="mt-1.5 inline-flex h-4 items-center gap-0.5 rounded-full border px-1.5 text-[9px] font-semibold text-[#c3ccd5]" style={{ borderColor: rgba(GREY, 0.35) }}>
              {MODE_LABEL[t.mode]}<ChevronDown size={9} strokeWidth={3} aria-hidden />
            </span>
          </>
        )} />
      </div>
      </div>
      {off ? (
        <div className="grid w-full grid-cols-2 gap-2">
          <Reading label="Outside" value={outside ? `${Math.round(outside.tempF)}°` : '—'} note={outside ? `${outside.humidityPct}% RH` : 'No weather'} />
          <Reading label="Dew point" value={dew != null ? `${dew}°` : '—'} note={dew != null ? dewFeel(dew).replace(/^./, (x) => x.toUpperCase()) : 'Inside'} />
        </div>
      ) : (
        <p className="whitespace-nowrap text-[11px] text-ink-dim">
          <span className="font-semibold" style={{ color: statusColor }}>{status}</span> · {t.humidityPct}% humidity
        </p>
      )}
    </Card>
  )
}

/** A small reading tile under the dial while the system is off */
function Reading({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-edge bg-surface-raised px-2.5 py-2">
      <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-dim">{label}</span>
      <span className="font-display text-xl font-medium leading-tight text-ink">{value}</span>
      <span className="truncate font-mono text-[10px] text-[#6fd3c7]">{note}</span>
    </div>
  )
}

function ModeMenu({ current, modes, onPick, onClose }: { current: ThermostatMode; modes: typeof MENU; onPick: (m: ThermostatMode) => void; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-[3] bg-black/45" onClick={onClose}>
      <div role="dialog" aria-label="Mode" onClick={(e) => e.stopPropagation()}
        className="sheet-up absolute inset-x-0 bottom-0 flex flex-col gap-2 rounded-t-2xl border-t border-edge bg-surface-raised px-4 pb-4 pt-3 shadow-[0_-12px_24px_rgba(0,0,0,0.35)]">
        <div className="h-1 w-9 shrink-0 self-center rounded-full bg-edge" />
        <div className="flex items-center justify-between">
          <p className="font-display text-base font-semibold">Mode</p>
          <button onClick={onClose} className="flex h-8 items-center rounded-full bg-edge px-3 text-xs font-semibold text-ink">Done</button>
        </div>
        {modes.map(({ mode, color, icon: Icon }) => {
          const on = mode === current
          return (
            <button key={mode} onClick={() => onPick(mode)} aria-pressed={on}
              className="flex h-[50px] items-center gap-3 rounded-xl border px-3.5 text-left transition-colors active:scale-[0.98]"
              style={on
                ? { background: rgba(color, 0.16), borderColor: rgba(color, 0.6), boxShadow: `0 0 18px -6px ${rgba(color, 0.8)}` }
                : { background: 'var(--color-surface)', borderColor: 'var(--color-edge)' }}>
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full" style={{ background: rgba(color, 0.16), color }}>
                <Icon size={16} aria-hidden />
              </span>
              <span className="flex-1 text-sm font-semibold">{MODE_LABEL[mode]}</span>
              {on && <Check size={16} aria-hidden />}
            </button>
          )
        })}
        {current !== 'heat' && current !== 'cool' && current !== 'off' && (
          <p className="text-[11px] text-ink-dim">Now in {MODE_LABEL[current]} — change it here or on the <Link to={cfg.path} className="underline">Climate page</Link></p>
        )}
      </div>
    </div>
  )
}
