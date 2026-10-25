import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { HOME } from '../../config/home'
import { Sheet, Switch } from '../Sheet'
import { ACC, DIM, GREEN, IDLE_BG, clock, isCharging, tint, useDebounced, type TeslaAct } from './useTesla'
import type { Tesla } from '../../types'

/** The green line under the battery bar */
function statusLine(t: Tesla) {
  if (isCharging(t)) {
    const done = clock(t.doneAt)
    return ['Charging', t.chargerAmps !== null ? `${t.chargerAmps} A` : null, t.chargeRateMph !== null ? `${t.chargeRateMph} mi/hr` : null, done ? `done by ${done}` : null].filter(Boolean).join(' · ')
  }
  if (t.charging === 'complete') return 'Charge complete'
  if (t.charging === 'no_power') return 'Plugged in · the charger isn’t giving power'
  if (t.plugged) return `Stopped at ${t.batteryPct ?? '–'}%`
  return 'Plug in to charge'
}

/**
 * Charging panel (opens from the bolt on the Tesla card): battery and limit,
 * start/stop, amps, charge port, scheduled charging.
 */
export function ChargingSheet({ t, act, onClose }: { t: Tesla; act: TeslaAct; onClose: () => void }) {
  const charging = isCharging(t)
  const [limit, setLimit] = useState(t.chargeLimitPct ?? HOME.tesla.defaultLimit)
  const [amps, setAmps] = useState(t.chargeAmps ?? 32)
  const [time, setTime] = useState(t.schedule?.time ?? '23:00')
  useEffect(() => { if (t.chargeLimitPct !== null) setLimit(t.chargeLimitPct) }, [t.chargeLimitPct])
  useEffect(() => { if (t.chargeAmps !== null) setAmps(t.chargeAmps) }, [t.chargeAmps])
  useEffect(() => { if (t.schedule?.time) setTime(t.schedule.time) }, [t.schedule?.time])

  const sendLimit = useDebounced((v: number) => void act('charge_limit', { value: v }, { chargeLimitPct: v }), 600)
  const sendAmps = useDebounced((v: number) => void act('charge_amps', { value: v }, { chargeAmps: v }), 700)
  const pickLimit = (v: number) => { setLimit(v); sendLimit(v) }
  const nudgeAmps = (d: number) => { const v = Math.min(t.chargeAmpsMax, Math.max(1, amps + d)); setAmps(v); sendAmps(v) }

  const subtitle = t.plugged ? (charging ? 'Plugged in · charging' : 'Plugged in · not charging') : 'Not plugged in'
  const pct = t.batteryPct ?? 0
  const portState = t.plugged ? 'Cable in' : t.portOpen ? 'Open' : t.portOpen === false ? 'Closed' : ''
  const portAction = t.plugged ? 'Release' : t.portOpen ? 'Close' : 'Open'
  const tapPort = () => void (t.plugged || !t.portOpen ? act('port_open', {}, { portOpen: true }) : act('port_close', {}, { portOpen: false }))
  const setSchedule = (enabled: boolean, at = time) => void act('schedule', { enabled, time: at }, { schedule: { enabled, time: at } })
  const sendTime = useDebounced((at: string) => setSchedule(true, at), 900)

  const row = 'flex min-h-12 items-center gap-2.5'
  const roundBtn = 'flex h-11 w-11 items-center justify-center rounded-full bg-[#252e38] text-ink hover:bg-[#2c3640] disabled:opacity-35'

  return (
    <Sheet title="Charging" subtitle={subtitle} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline gap-4">
          <span className="text-[60px] font-light leading-none sm:text-[72px]">{t.batteryPct ?? '–'}%</span>
          {t.rangeMi !== null && <span className="text-[17px] text-ink-dim">{t.rangeMi} mi</span>}
          <span className="ml-auto text-[15px] text-ink-dim">Limit <strong className="font-semibold text-ink">{limit}%</strong></span>
        </div>
        <div className="relative h-3.5 rounded-full border border-edge bg-surface">
          <div className="absolute inset-y-0 left-0 rounded-full transition-[width]" style={{ width: `${pct}%`, background: charging ? GREEN : ACC, boxShadow: charging ? `0 0 14px -2px ${tint(GREEN, 0.6)}` : undefined }} />
          <div className="absolute -bottom-1.5 -top-1.5 -ml-px w-[3px] rounded-sm bg-ink" style={{ left: `${limit}%` }} />
        </div>
        <span className="text-[17px]" style={{ color: charging ? GREEN : DIM }}>{statusLine(t)}</span>
      </div>

      <div className="h-px bg-edge" />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-3">
            <span className="flex justify-between text-[15px] font-semibold"><span>Charge limit</span><span>{limit}%</span></span>
            <input type="range" min={t.chargeLimitMin} max={t.chargeLimitMax} step={1} value={limit}
              onChange={(e) => pickLimit(Number(e.target.value))} className="w-full" style={{ accentColor: GREEN }} />
          </label>
          <div className="flex justify-between text-xs text-ink-dim"><span>{t.chargeLimitMin}%</span><span>{t.chargeLimitMax}%</span></div>
          <div className="grid grid-cols-2 gap-2.5">
            {HOME.tesla.chargePresets.map((p) => {
              const on = limit === p
              return (
                <button key={p} onClick={() => pickLimit(p)} aria-pressed={on}
                  className="h-12 rounded-full border text-[15px] font-medium"
                  style={{ borderColor: on ? GREEN : 'transparent', background: on ? tint(GREEN, 0.16) : IDLE_BG }}>
                  {p}%{p === HOME.tesla.defaultLimit ? ' · default' : ''}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button onClick={() => void act(charging ? 'charge_stop' : 'charge_start', {}, { charging: charging ? 'stopped' : 'starting' })}
            disabled={!t.plugged || t.charging === 'complete' && !charging && limit <= pct}
            className="h-12 rounded-full border text-[15px] font-semibold disabled:opacity-40"
            style={charging ? { borderColor: 'transparent', background: IDLE_BG, color: '#e8edf2' } : { borderColor: GREEN, background: GREEN, color: '#0e1318' }}>
            {charging ? 'Stop charging' : 'Start charging'}
          </button>
          <div className={row}>
            <span className="text-[15px]">Charging amps</span>
            <button onClick={() => nudgeAmps(-1)} disabled={amps <= 1} aria-label="Fewer amps" className={`${roundBtn} ml-auto`}><Minus size={18} /></button>
            <span className="w-12 text-center text-[15px] font-semibold">{amps} A</span>
            <button onClick={() => nudgeAmps(1)} disabled={amps >= t.chargeAmpsMax} aria-label="More amps" className={roundBtn}><Plus size={18} /></button>
          </div>
          <div className={row}>
            <span className="text-[15px]">Charge port</span>
            <span className="text-[13px] text-ink-dim">{portState}</span>
            <button onClick={tapPort} disabled={t.portOpen === null && !t.plugged} className="ml-auto h-11 rounded-full bg-[#252e38] px-[18px] text-sm font-medium hover:bg-[#2c3640] disabled:opacity-35">{portAction}</button>
          </div>
          {t.schedule && (
            <div className={row}>
              <span className="text-[15px]">Scheduled</span>
              <input type="time" value={time} aria-label="Scheduled start time"
                onChange={(e) => { setTime(e.target.value); if (t.schedule?.enabled && e.target.value) sendTime(e.target.value) }}
                className="ml-auto h-10 rounded-[10px] border border-edge bg-surface px-2 text-sm text-ink [color-scheme:dark]" />
              <Switch on={t.schedule.enabled} onChange={(v) => setSchedule(v)} label="Scheduled charging" />
            </div>
          )}
        </div>
      </div>
    </Sheet>
  )
}
