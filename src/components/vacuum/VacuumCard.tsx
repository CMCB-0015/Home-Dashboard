import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Panel } from '../irrigation/IrrigationCard'
import { useHome } from '../../lib/useHome'
import { VAC_GREY, roomCenter } from '../../lib/vacuum'
import { Card } from '../Card'
import { FloorPlan, tint } from './FloorPlan'
import { AMBER, GREEN, describe, dockRows, finishText, statsText, useVacuumActions } from './useVacuum'
import type { VacuumState } from '../../types'

const DOCK_IMG = '/images/vacuum-dock.png'

const Play = ({ size = 16 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 4l13 8-13 8z" /></svg>
const PauseIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
const HomeIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></svg>

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
  const [presetsOpen, setPresetsOpen] = useState(false)
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
  const strip = 'flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-xs font-medium transition-colors duration-150 active:scale-[0.97] disabled:opacity-60'
  // Footer strip, like the other cards: Start + Map while docked, Pause + Dock while cleaning
  const actions = d.running ? (
    <div className="grid w-full grid-cols-2 gap-2">
      <button onClick={() => void (v.state === 'paused' ? a.resume() : a.pause())} className={strip}
        style={{ background: v.state === 'paused' ? tint(d.color, 0.18) : 'var(--color-surface-raised)', color: 'var(--color-ink)' }}>
        {v.state === 'paused' ? <Play size={12} /> : <PauseIcon />}{v.state === 'paused' ? 'Resume' : 'Pause'}
      </button>
      <button onClick={() => void a.dock()} className={strip} style={{ background: 'var(--color-surface-raised)', color: 'var(--color-ink)' }}><HomeIcon /> Dock</button>
    </div>
  ) : (
    <div className="grid w-full grid-cols-2 gap-2">
      <button onClick={() => void a.full()} disabled={busy} aria-busy={a.starting === 'full'} title="Full clean · vacuum + mop · all rooms"
        className={strip} style={{ background: 'var(--color-ink)', color: 'var(--color-bg)' }}>
        <Play size={12} />{a.starting === 'full' ? 'Starting…' : 'Full clean'}
      </button>
      <Link to="/vacuum" className={strip} style={{ background: 'var(--color-surface-raised)', color: 'var(--color-ink)' }}>Map &amp; rooms</Link>
    </div>
  )

  return (
    <Card className="h-full" accent={d.k ? d.color : VAC_GREY} title="Vacuum" category="vacuum" style={wash}
      headerRight={<span className="flex items-center gap-1 text-[13px] text-ink-dim">{d.header}
        <Link to="/vacuum" aria-label="Map & rooms" className="-mr-1 flex rounded-full p-1 text-ink-faint hover:text-ink"><ChevronRight size={16} /></Link></span>}
      bodyClassName="@container flex flex-col gap-2.5"
      actions={actions}
      overlay={presetsOpen && !d.running ? (
        <Panel title="Presets" onClose={() => setPresetsOpen(false)}>
          {v.presets.map((p) => (
            <button key={p.id} onClick={() => { setPresetsOpen(false); void a.preset(p.id) }} disabled={!p.available || busy} title={p.reason}
              className="flex min-h-12 items-center gap-3 rounded-xl border border-edge bg-surface px-3 text-left active:scale-[0.98] disabled:opacity-45">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] font-semibold">{p.name}</span>
                <span className="truncate text-xs text-ink-dim">{p.available ? p.sub : 'Set up rooms'}</span>
              </span>
              <span className="ml-auto text-ink-dim"><Play size={14} /></span>
            </button>
          ))}
        </Panel>
      ) : undefined}>
      <h3 className="font-display text-[22px] font-semibold leading-tight @min-[360px]:text-[26px]">{v.name}</h3>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Battery pct={v.batteryPct} />
        <span className="text-sm text-[#c9d2db]">{v.batteryPct ?? '–'}%</span>
        {/* While cleaning, the room name next to the map says it; a narrow card skips the repeat */}
        <span className={`ml-auto text-right text-sm ${showMap ? 'hidden @min-[360px]:inline' : ''}`} style={{ color: d.statusColor }}>{d.status}</span>
      </div>

      {/* Middle: dock, or the map while it cleans */}
      <div className="flex flex-1 flex-row items-center justify-center gap-3 @min-[360px]:gap-[18px]">
        {showMap ? (
          <>
            <div className="w-[112px] shrink-0 @min-[360px]:w-[150px]"><MiniMap v={v} d={d} /></div>
            <div className="flex min-w-0 flex-1 flex-col gap-1 @min-[360px]:gap-1.5">
              <span className="font-display text-[15px] font-semibold leading-tight @min-[360px]:text-lg" style={{ color: d.running && d.color !== VAC_GREY ? d.color : '#e8edf2' }}>{d.running ? d.roomName : 'Heading home'}</span>
              <span className="text-xs text-[#c9d2db] @min-[360px]:text-[13px]">{sub}</span>
              {statsText(v) && <span className="font-mono text-[11.5px] font-medium text-[#c9d2db] @min-[360px]:text-[12.5px]">{statsText(v)}</span>}
              {finishText(v) && <span className="text-[13px] font-semibold" style={{ color: d.color !== VAC_GREY ? d.color : '#e8edf2' }}>{finishText(v)}</span>}
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
            <img src={DOCK_IMG} alt={`Roborock ${v.name} in its dock`} className="h-[76px] w-auto shrink-0 @min-[360px]:ml-[18px] @min-[360px]:h-[118px]" />
            <div className="flex min-w-0 flex-1 flex-col gap-[7px] @min-[360px]:gap-[9px]">
              {dockRows(v).map((r) => (
                <div key={r.label} className="flex items-center gap-2 text-[12.5px] @min-[360px]:text-[13px]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.bad ? AMBER : GREEN }} />
                  <span className="truncate text-[#c9d2db]">{r.label}</span>
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

      {/* Presets: one row that opens a list (the card is narrow on the tablet) */}
      {!d.running && (
        <button onClick={() => setPresetsOpen(true)} aria-expanded={presetsOpen}
          className="flex min-h-11 shrink-0 items-center justify-between rounded-xl border border-edge bg-surface-raised px-3.5 text-[13px] font-medium hover:bg-[#252e38]">
          <span>Presets <span className="ml-1 text-xs text-ink-faint">{v.presets.length} saved</span></span><ChevronDown size={16} className="text-ink-faint" />
        </button>
      )}
    </Card>
  )
}

