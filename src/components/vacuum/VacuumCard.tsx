import { Link } from 'react-router-dom'
import { useHome } from '../../lib/useHome'
import { VAC_GREY, roomCenter } from '../../lib/vacuum'
import { Card } from '../Card'
import { FloorPlan, tint } from './FloorPlan'
import { AMBER, GREEN, describe, dockRows, statsText, useVacuumActions } from './useVacuum'
import type { VacuumState } from '../../types'

const DOCK_IMG = '/images/vacuum-dock.png'

const Play = ({ size = 16 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 4l13 8-13 8z" /></svg>
const PauseIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
const HomeIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></svg>
const Chevron = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8493a1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 6l6 6-6 6" /></svg>

export function Battery({ pct }: { pct: number | null }) {
  return (
    <span aria-hidden className="relative box-border h-[11px] w-6 shrink-0 rounded-[3px] border-[1.5px] border-ink-dim p-px">
      <span className="block h-full rounded-[1px]" style={{ width: `${pct ?? 0}%`, background: (pct ?? 0) < 20 ? '#ff6b5e' : GREEN }} />
    </span>
  )
}

/** The little map while it cleans: rooms in the run light up as they're done */
function MiniMap({ v, d }: { v: VacuumState; d: ReturnType<typeof describe> }) {
  const plan = d.run?.rooms ?? []
  const done = d.prog?.done ?? 0
  const robot = d.cur ? roomCenter(d.cur) : null
  return (
    <FloorPlan rooms={v.rooms} robot={robot} className="w-full overflow-hidden rounded-[10px] bg-[#0b1015]"
      room={(r, i, style) => {
        const pos = plan.indexOf(r.id)
        const a = pos < 0 ? 0.14 : pos < done ? 0.85 : pos === done && d.running && d.cur ? 1 : 0.4
        return <div key={`${r.id}-${i}`} style={{ ...style, background: tint(r.color, a), borderRadius: 1 }} />
      }} />
  )
}

/**
 * The vacuum card (bottom row on Home). Docked: the dock picture and its
 * water/drying status. Cleaning: a small map, the room it's in and progress.
 * Start a full clean or a preset; Map & rooms opens the full page. Glows in
 * the current room's color while cleaning, half strength when paused.
 */
export function VacuumCard() {
  const { data } = useHome()
  const a = useVacuumActions()
  if (!data) return null
  const v = data.vacuum
  if (!v) {
    return (
      <Card className="h-full" accent="var(--color-vacuum)" title="Vacuum" category="vacuum" placeholder>
        <div className="flex h-40 items-center justify-center"><img src={DOCK_IMG} alt="" className="h-28" /></div>
      </Card>
    )
  }
  const d = describe(v)
  const wash = d.k ? { backgroundImage: `linear-gradient(180deg, ${tint(d.color, 0.2 * d.k)} 0%, ${tint(d.color, 0.06 * d.k)} 45%, transparent 80%)` } : undefined
  const busy = !!a.starting
  const showMap = d.running || v.state === 'returning'
  const n = d.run?.rooms.length ?? 0
  const sub = d.running
    ? (n > 1 && d.prog && d.prog.idx >= 0 ? `${d.run!.name} · room ${d.prog.idx + 1} of ${n}` : n > 1 ? `${d.run!.name} · ${n} rooms` : d.run?.name ?? '')
    : `${d.run?.name ?? 'Clean'}${n ? ` · ${n} room${n > 1 ? 's' : ''} done` : ''}`
  const btn = 'flex items-center justify-center gap-2.5 rounded-[14px] text-[15px] font-semibold'

  return (
    <Card className="h-full" accent={d.k ? d.color : VAC_GREY} title="Vacuum" category="vacuum" style={wash}
      headerRight={<span className="text-[13px] text-ink-dim">{d.header}</span>}
      bodyClassName="@container flex flex-col gap-2.5">
      <h3 className="font-display text-[22px] font-semibold leading-tight @min-[360px]:text-[26px]">{v.name}</h3>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Battery pct={v.batteryPct} />
        <span className="text-sm text-[#c9d2db]">{v.batteryPct ?? '–'}%</span>
        <span className="ml-auto text-right text-sm" style={{ color: d.statusColor }}>{d.status}</span>
      </div>

      {/* Middle: dock, or the map while it cleans */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 @min-[360px]:flex-row @min-[360px]:gap-[18px]">
        {showMap ? (
          <>
            <div className="w-full max-w-[220px] shrink-0 @min-[360px]:w-[150px]"><MiniMap v={v} d={d} /></div>
            <div className="flex w-full min-w-0 flex-1 flex-col gap-1.5">
              <span className="font-display text-lg font-semibold" style={{ color: d.running && d.color !== VAC_GREY ? d.color : '#e8edf2' }}>{d.running ? d.roomName : 'Heading home'}</span>
              <span className="text-[13px] text-[#c9d2db]">{sub}</span>
              {statsText(v) && <span className="font-mono text-[12.5px] font-medium text-[#c9d2db]">{statsText(v)}</span>}
              {d.run && n > 1 && (
                <div className="mt-1 flex gap-[3px]">
                  {d.run.rooms.map((id, i) => {
                    const lit = i < (d.prog?.done ?? 0) || (i === d.prog?.idx && d.running)
                    return <span key={id} className="h-1 flex-1 rounded-sm" style={{ background: lit ? v.rooms.find((r) => r.id === id)?.color : '#29333d' }} />
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <img src={DOCK_IMG} alt={`Roborock ${v.name} in its dock`} className="h-[96px] w-auto shrink-0 @min-[360px]:ml-[18px] @min-[360px]:h-[118px]" />
            <div className="flex w-full min-w-0 flex-1 flex-col gap-[9px]">
              {dockRows(v).map((r) => (
                <div key={r.label} className="flex items-center gap-2 text-[13px]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.bad ? AMBER : GREEN }} />
                  <span className="text-[#c9d2db]">{r.label}</span>
                  <span className="ml-auto" style={{ color: r.bad ? AMBER : '#c9d2db' }}>{r.value}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {d.alert && (
        <div className="flex min-h-10 items-center gap-2.5 rounded-xl border px-3 py-2 text-[13px]" style={{ borderColor: tint(AMBER, 0.6), background: tint(AMBER, 0.08) }}>
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: AMBER }} />
          <span className="flex min-w-0 flex-1 flex-col @min-[360px]:flex-row @min-[360px]:items-center">
            <span>{d.alert.text}</span>
            <span className="text-[#c9d2db] @min-[360px]:ml-auto">{d.alert.detail}</span>
          </span>
        </div>
      )}

      {d.running ? (
        <div className="grid grid-cols-2 gap-2.5">
          <button onClick={() => void (v.state === 'paused' ? a.resume() : a.pause())}
            className={`${btn} h-14 border`} style={v.state === 'paused' ? { borderColor: tint(d.color, 0.6), background: tint(d.color, 0.12) } : { borderColor: '#29333d', background: '#1c242c' }}>
            {v.state === 'paused' ? <Play /> : <PauseIcon />}<span>{v.state === 'paused' ? 'Resume' : 'Pause'}</span>
          </button>
          <button onClick={() => void a.dock()} className={`${btn} h-14 border border-edge bg-surface-raised`}>
            <HomeIcon /><span className="whitespace-nowrap"><span className="hidden @min-[360px]:inline">Send to </span>Dock</span>
          </button>
        </div>
      ) : (
        <button onClick={() => void a.full()} disabled={busy} aria-busy={a.starting === 'full'}
          className="flex min-h-14 items-center gap-3 rounded-[14px] bg-ink px-[18px] py-2 text-left text-bg disabled:opacity-80">
          <Play size={18} />
          <span className="flex min-w-0 flex-1 flex-col @min-[360px]:flex-row @min-[360px]:items-center">
            <span className="text-base font-semibold">{a.starting === 'full' ? 'Starting…' : v.state === 'returning' ? 'Start again' : 'Start'}</span>
            <span className="text-xs text-[#3a4652] @min-[360px]:ml-auto @min-[360px]:text-[12.5px]">Full clean · vacuum + mop<span className="hidden @min-[360px]:inline"> · all rooms</span></span>
          </span>
        </button>
      )}

      <div className="grid grid-cols-1 gap-2 @min-[360px]:grid-cols-3">
        {v.presets.map((p) => {
          const active = d.running && d.run?.name === p.name
          return (
            <button key={p.id} onClick={() => void a.preset(p.id)} disabled={!p.available || busy || d.running} aria-pressed={active}
              title={p.reason}
              className="flex min-h-[52px] min-w-0 flex-col items-start justify-center gap-[3px] rounded-xl border px-3 py-1.5 text-left disabled:cursor-default @min-[360px]:h-[62px] @min-[360px]:px-2"
              style={{ borderColor: active ? p.color : '#29333d', background: active ? tint(p.color, 0.14) : '#1c242c', opacity: p.available ? 1 : 0.45 }}>
              <span className="max-w-full truncate text-[13px] font-semibold">{p.name}</span>
              <span className="max-w-full truncate text-xs text-ink-dim">{a.starting === p.id ? 'Starting…' : p.available ? p.sub : 'Set up rooms'}</span>
            </button>
          )
        })}
      </div>

      <Link to="/vacuum" className="flex min-h-11 items-center justify-between rounded-xl border border-edge bg-surface-raised px-3.5 text-sm font-medium hover:bg-[#252e38]">
        <span>Map &amp; rooms</span><Chevron />
      </Link>
    </Card>
  )
}

