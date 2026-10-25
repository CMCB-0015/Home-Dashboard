import { useEffect, useRef, useState, type ReactNode } from 'react'
import type React from 'react'
import { useHome } from '../../lib/useHome'
import { HOME } from '../../config/home'
import { VAC_GREY, roomCenter, whatText } from '../../lib/vacuum'
import { DetailLayout } from '../../components/DetailLayout'
import { Switch } from '../../components/Sheet'
import { FloorPlan, tint } from '../../components/vacuum/FloorPlan'
import { AMBER, GREEN, describe, dockRows, useVacuumActions } from '../../components/vacuum/useVacuum'
import type { VacuumState } from '../../types'

// ── Icons from the mockup ────────────────────────────────────────────────
const ic = (children: ReactNode, extra: React.SVGProps<SVGSVGElement> = {}) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...extra}>{children}</svg>
)
const ICON = {
  vacuum: ic(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /><path d="M12 4v3" /><path d="M4 12h3" /><path d="M17 12h3" /></>),
  mop: ic(<path d="M12 3c3.5 4.2 6 7.4 6 10.5a6 6 0 0 1-12 0C6 10.4 8.5 7.2 12 3z" />),
  rooms: ic(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 12h9" /><path d="M12 3v18" /><path d="M12 15h9" /></>),
  areas: ic(<rect x="4" y="4" width="16" height="16" rx="2" />, { strokeDasharray: '3 3' }),
}
const Check = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5 9-10" /></svg>
const XIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
const Play = ({ size = 20 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 4l13 8-13 8z" /></svg>

// What the buttons say → what Roborock calls it
const SUCTION: [string, string][] = [['Quiet', 'quiet'], ['Balanced', 'balanced'], ['Turbo', 'turbo'], ['Max', 'max'], ['Max+', 'max_plus']]
const WATER: [string, RegExp][] = [['Low', /low|mild|light/], ['Medium', /medium|moderate|standard|middle/], ['High', /high|intense|heavy|max/]]
const ROUTE: [string, string][] = [['Standard', 'standard'], ['Deep', 'deep'], ['Deep+', 'deep_plus']]

type Tool = 'vacuum' | 'mop' | 'rooms' | 'areas'
type Box = [number, number, number, number]

function initial(v: VacuumState) {
  const suction = SUCTION.find(([, val]) => val === v.suction)?.[0] ?? 'Balanced'
  const water = WATER.find(([, re]) => re.test(String(v.mopIntensity ?? '')))?.[0] ?? 'Medium'
  const route = ROUTE.find(([, val]) => val === v.mopRoute)?.[0] ?? 'Standard'
  return { suction, water, route }
}

/**
 * Map & rooms: pick rooms on the floor plan (or draw areas), set suction,
 * water and passes, then Start. Presets and the dock on the right.
 */
export function VacuumPage() {
  const { data } = useHome()
  const v = data?.vacuum
  if (!data) return null
  if (!v) {
    return (
      <DetailLayout title="Vacuum" subtitle="The Roborock isn’t in Home Assistant yet" color="var(--color-vacuum)">
        <p className="text-sm text-ink-dim">Add the Roborock integration in Home Assistant, then this page fills in on its own.</p>
      </DetailLayout>
    )
  }
  return <MapPage v={v} />
}

function MapPage({ v }: { v: VacuumState }) {
  const a = useVacuumActions()
  const d = describe(v)
  const init = initial(v)
  const [sheet, setSheet] = useState<Tool | null>(null)
  const [vacOn, setVacOn] = useState(true)
  const [suction, setSuction] = useState(init.suction)
  const [passes, setPasses] = useState(1)
  const [mopOn, setMopOn] = useState(true)
  const [water, setWater] = useState(init.water)
  const [route, setRoute] = useState(init.route)
  const [sel, setSel] = useState<string[]>([])
  const [zones, setZones] = useState<Box[]>([])
  const [zonePasses, setZonePasses] = useState(1)
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 8000); return () => clearTimeout(t) }, [msg])

  const areasMode = sheet === 'areas' || zones.length > 0
  const pickable = (id: string) => v.rooms.find((r) => r.id === id)?.segment !== null
  const toggleRoom = (id: string) => {
    if (sheet === 'areas' || !pickable(id)) return
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])); setZones([]); setMsg(null)
  }

  const what = whatText(vacOn, mopOn)
  const where = zones.length ? `${zones.length} area${zones.length > 1 ? 's' : ''}` : sel.length ? `${sel.length} room${sel.length > 1 ? 's' : ''}` : 'whole home'
  const nothing = !vacOn && !mopOn

  const start = async () => {
    if (nothing) return
    if (d.running) { void (v.state === 'paused' ? a.resume() : a.pause()); return }
    setSheet(null)
    const order = v.rooms.map((r) => r.id)
    const ok = await a.act({
      action: 'clean', vacuum: vacOn, mop: mopOn,
      suction: SUCTION.find(([l]) => l === suction)?.[1], passes: zones.length ? zonePasses : passes,
      water, route: ROUTE.find(([l]) => l === route)?.[1],
      rooms: [...sel].sort((x, y) => order.indexOf(x) - order.indexOf(y)), areas: zones,
    }, undefined, 'map')
    if (ok) setMsg(`Started · ${what} · ${where}`)
  }

  // ── Drawing areas: drag on the map ──
  const planRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ x: number; y: number; x2: number; y2: number } | null>(null)
  const [W, H] = HOME.vacuum.size
  const toPlan = (e: React.PointerEvent) => {
    const r = planRef.current!.getBoundingClientRect()
    return { x: Math.max(0, Math.min(W, ((e.clientX - r.left) / r.width) * W)), y: Math.max(0, Math.min(H, ((e.clientY - r.top) / r.height) * H)) }
  }
  const drawing = sheet === 'areas' && v.areas
  const boxOf = (g: NonNullable<typeof drag>): Box => [Math.min(g.x, g.x2), Math.min(g.y, g.y2), Math.abs(g.x2 - g.x), Math.abs(g.y2 - g.y)]
  const roomAt = (z: Box) => {
    const cx = z[0] + z[2] / 2, cy = z[1] + z[3] / 2
    const r = v.rooms.find((q) => q.rects.some((t) => cx >= t[0] && cx < t[0] + t[2] && cy >= t[1] && cy < t[1] + t[3]))
    return r ? `in ${r.name}` : ''
  }

  // Below the room's label, so the dot doesn't cover the name
  const robot: [number, number] | null = d.cur ? ((c) => [c[0], c[1] + 42] as [number, number])(roomCenter(d.cur)) : null
  const hint = !areasMode ? 'Tap rooms to pick them · none picked = whole home'
    : v.areas ? 'Drag on the map to draw an area' : 'Drawn areas need a one-time setup — pick rooms for now'

  const tools: { id: Tool; label: string; value: string; on: boolean }[] = [
    { id: 'vacuum', label: 'Vacuum', value: vacOn ? suction + (passes === 2 ? ' · 2×' : '') : 'Off', on: vacOn },
    { id: 'mop', label: 'Mop', value: mopOn ? `${water} · ${route}` : 'Off', on: mopOn },
    { id: 'rooms', label: 'Rooms', value: areasMode ? 'Not used' : sel.length ? `${sel.length} picked` : 'Whole home', on: !areasMode },
    { id: 'areas', label: 'Areas', value: zones.length ? `${zones.length} drawn` : v.areas ? 'None' : 'Needs setup', on: zones.length > 0 },
  ]
  const toolIndex = sheet ? tools.findIndex((t) => t.id === sheet) : 0

  const seg = <T extends string | number>(options: { label: string; value: T; disabled?: boolean }[], value: T, set: (v: T) => void, cols: string) => (
    <div className={`grid gap-1.5 ${cols}`}>
      {options.map((o) => (
        <button key={o.label} onClick={() => set(o.value)} aria-pressed={o.value === value} disabled={o.disabled}
          className="h-11 rounded-xl text-[13px] font-semibold disabled:opacity-30"
          style={{ background: o.value === value ? '#e8edf2' : '#252e38', color: o.value === value ? '#0e1318' : '#c9d2db' }}>{o.label}</button>
      ))}
    </div>
  )
  const has = (list: string[], val: string) => !list.length || list.includes(val)
  const subtitle = [v.name, d.header, v.batteryPct !== null ? `${v.batteryPct}%` : null].filter(Boolean).join(' · ')

  return (
    <DetailLayout title="Vacuum" subtitle={subtitle} color={d.k ? d.color : 'var(--color-vacuum)'} wide
      action={msg ? (
        <span role="status" className="flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px]" style={{ background: tint(GREEN, 0.12), borderColor: tint(GREEN, 0.5) }}>
          <span className="h-2 w-2 rounded-full" style={{ background: GREEN }} />{msg}
        </span>
      ) : undefined}>
      <div className="flex flex-col gap-5 lg:flex-row">
        {/* Map */}
        <div className="relative flex min-w-0 flex-1 flex-col overflow-visible rounded-2xl border border-edge bg-surface">
          <div className="h-[3px] rounded-t-2xl transition-colors" style={{ background: d.k ? d.color : VAC_GREY }} />
          <div className="relative px-4 pb-4 pt-9">
            <span className="absolute left-4 top-3 text-[12.5px] text-ink-dim">{hint}</span>
            <div className="mx-auto w-full max-w-[min(100%,calc((100vh-330px)*690/514))] min-w-[260px]">
              <div ref={planRef} className="relative">
                <FloorPlan rooms={v.rooms} robot={robot} big className="w-full rounded-xl bg-[#0b1015]"
                  room={(r, i, style) => {
                    const picked = !areasMode && sel.includes(r.id)
                    const ok = r.segment !== null
                    const alpha = areasMode ? 0.4 : !ok ? 0.12 : sel.length === 0 ? 0.8 : picked ? 1 : 0.28
                    return (
                      <button key={`${r.id}-${i}`} onClick={() => toggleRoom(r.id)} aria-pressed={picked} disabled={!ok && !areasMode}
                        aria-label={`${r.name}${picked ? ', picked' : ''}${ok ? '' : ' (no matching Roborock room)'}`}
                        className="flex items-center justify-center rounded-[3px] border-2 border-[#0b1015] p-0 text-[11px] font-semibold transition-colors sm:text-sm"
                        style={{ ...style, background: tint(r.color, alpha), color: alpha >= 0.75 ? '#0e1318' : '#e8edf2' }}>
                        {i === r.main && <span className="px-1 text-center leading-tight">{r.name}</span>}
                        {picked && i === r.main && (
                          <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-bg"><Check /></span>
                        )}
                      </button>
                    )
                  }}>
                  {zones.map((z, i) => <ZoneBox key={i} z={z} label={`Area ${i + 1}`} />)}
                  {drag && <ZoneBox z={boxOf(drag)} label="" />}
                  {drawing && (
                    <div className="absolute inset-0 cursor-crosshair touch-none"
                      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); const p = toPlan(e); setDrag({ x: p.x, y: p.y, x2: p.x, y2: p.y }) }}
                      onPointerMove={(e) => { if (drag) { const p = toPlan(e); setDrag({ ...drag, x2: p.x, y2: p.y }) } }}
                      onPointerUp={() => {
                        if (drag) { const b = boxOf(drag); if (b[2] > 25 && b[3] > 25 && zones.length < 5) { setZones([...zones, b]); setSel([]) } }
                        setDrag(null)
                      }} />
                  )}
                </FloorPlan>
              </div>
            </div>
          </div>

          {/* Tools + Start */}
          <div className="relative flex flex-wrap gap-2.5 px-4 pb-4">
            {sheet && (
              <div role="dialog" aria-label={tools[toolIndex].label}
                className="absolute bottom-full left-4 right-4 z-10 mb-3 flex flex-col gap-4 rounded-[18px] border border-[#3a4652] bg-surface-raised p-[18px] shadow-[0_18px_40px_rgba(0,0,0,0.55)] sm:left-[var(--pl)] sm:right-auto sm:w-[380px]"
                style={{ ['--pl' as string]: `${16 + toolIndex * 140}px` }}>
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-[19px] font-semibold">{tools[toolIndex].label}</h2>
                  {sheet === 'vacuum' && <span className="ml-auto"><Switch on={vacOn} onChange={setVacOn} label="Vacuum on" /></span>}
                  {sheet === 'mop' && <span className="ml-auto"><Switch on={mopOn} onChange={setMopOn} label="Mop on" /></span>}
                  {(sheet === 'rooms' || sheet === 'areas') && (
                    <button onClick={() => (sheet === 'rooms' ? setSel([]) : setZones([]))} className="ml-auto h-[34px] rounded-full border border-[#3a4652] px-3.5 text-[13px] text-[#c9d2db]">Clear</button>
                  )}
                  <button onClick={() => setSheet(null)} aria-label="Close" className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[#3a4652] bg-[#252e38]"><XIcon /></button>
                </div>

                {sheet === 'vacuum' && (<>
                  <div className={`flex flex-col gap-3.5 ${vacOn ? '' : 'opacity-40'}`}>
                    <Field label="Suction">{seg(SUCTION.map(([l, val]) => ({ label: l, value: l, disabled: !has(v.suctionOptions, val) })), suction, setSuction, 'grid-cols-5')}</Field>
                    <Field label="Passes">{seg([{ label: '1×', value: 1 }, { label: '2×', value: 2 }], passes, setPasses, 'grid-cols-2')}</Field>
                  </div>
                  <span className="text-[12.5px] text-ink-dim">{vacOn ? (mopOn ? 'Vacuums and mops in one pass.' : 'Mop is off, so this is vacuum only.') : 'Vacuum is off, so this is mop only.'}</span>
                </>)}

                {sheet === 'mop' && (<>
                  <div className={`flex flex-col gap-3.5 ${mopOn ? '' : 'opacity-40'}`}>
                    <Field label="Water flow">{seg(WATER.map(([l]) => ({ label: l, value: l })), water, setWater, 'grid-cols-3')}</Field>
                    <Field label="Mop route">{seg(ROUTE.map(([l, val]) => ({ label: l, value: l, disabled: !has(v.mopRouteOptions, val) })), route, setRoute, 'grid-cols-3')}</Field>
                  </div>
                  <span className="text-[12.5px] text-ink-dim">{mopOn ? (vacOn ? 'Vacuums and mops in one pass.' : 'Vacuum is off, so this is mop only.') : 'Mop is off, so this is vacuum only.'}</span>
                </>)}

                {sheet === 'rooms' && (<>
                  <span className="text-[13px] text-ink-dim">Tap rooms here or on the map. None picked cleans the whole home.</span>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {v.rooms.map((r) => {
                      const picked = sel.includes(r.id)
                      return (
                        <button key={r.id} onClick={() => toggleRoom(r.id)} aria-pressed={picked} disabled={r.segment === null} title={r.segment === null ? 'No matching room in the Roborock app' : undefined}
                          className="flex h-11 items-center gap-[7px] rounded-xl border px-[9px] text-left text-[12.5px] font-semibold disabled:opacity-35"
                          style={{ borderColor: picked ? r.color : '#29333d', background: picked ? tint(r.color, 0.16) : '#252e38' }}>
                          <span className="h-[9px] w-[9px] shrink-0 rounded-[3px]" style={{ background: r.color }} />
                          <span className="truncate">{r.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </>)}

                {sheet === 'areas' && (v.areas ? (<>
                  <span className="text-[13px] text-ink-dim">Drag on the map to draw an area. Areas replace any rooms you picked.</span>
                  <div className="flex flex-col gap-1.5">
                    {zones.map((z, i) => (
                      <div key={i} className="flex h-11 items-center gap-2.5 rounded-xl bg-[#252e38] pl-3 pr-1.5">
                        <span className="h-3 w-3 rounded-[2px] border-2 border-dashed border-white" />
                        <span className="text-[13.5px] font-semibold">Area {i + 1}</span>
                        <span className="text-[12.5px] text-ink-dim">{roomAt(z)}</span>
                        <button onClick={() => setZones(zones.filter((_, j) => j !== i))} aria-label={`Remove area ${i + 1}`} className="ml-auto flex h-[34px] w-[34px] items-center justify-center rounded-full text-[#c9d2db]"><XIcon /></button>
                      </div>
                    ))}
                    {zones.length < 5 && (
                      <button onClick={() => { setZones([...zones, [W / 2 - 60, H / 2 - 45, 120, 90]]); setSel([]) }}
                        className="h-11 rounded-xl border border-dashed border-[#3a4652] text-[13.5px] font-medium text-[#c9d2db]">+ Add area</button>
                    )}
                  </div>
                  <Field label="Passes">{seg([1, 2, 3].map((n) => ({ label: `${n}×`, value: n })), zonePasses, setZonePasses, 'grid-cols-3')}</Field>
                </>) : (
                  <span className="text-[13px] leading-relaxed text-ink-dim">
                    Drawing areas needs the floor plan lined up with the robot’s own map — a one-time step at install (vacuum.calibration in the dashboard settings). Until then, pick rooms.
                  </span>
                ))}
              </div>
            )}

            <div className="grid w-full grid-cols-4 gap-2 sm:flex sm:w-auto sm:flex-none sm:gap-2.5">
              {tools.map((t) => {
                const open = sheet === t.id
                return (
                  <button key={t.id} onClick={() => { setSheet(open ? null : t.id); setMsg(null) }} aria-expanded={open}
                    className="flex h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-[14px] border px-2 text-left sm:w-[130px] sm:flex-row sm:justify-start sm:gap-2.5 sm:px-3"
                    style={{ borderColor: open ? '#e8edf2' : '#29333d', background: open ? '#252e38' : '#1c242c' }}>
                    <span className="hidden h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full sm:flex"
                      style={{ background: t.on ? '#e8edf2' : '#252e38', color: t.on ? '#0e1318' : '#8493a1' }}>{ICON[t.id]}</span>
                    <span className="flex w-full min-w-0 flex-col items-center gap-0.5 sm:items-start">
                      <span className="text-sm font-semibold">{t.label}</span>
                      <span className="max-w-full truncate text-xs" style={{ color: t.on ? '#c9d2db' : '#8493a1' }}>{t.value}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <button onClick={() => void start()} aria-disabled={nothing} disabled={!!a.starting}
              className="flex h-16 min-w-[220px] flex-1 items-center gap-3 rounded-[14px] px-[18px] text-left"
              style={{ background: nothing ? '#252e38' : '#e8edf2', color: nothing ? '#8493a1' : '#0e1318' }}>
              {d.running && v.state !== 'paused'
                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                : <Play />}
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-base font-semibold">{a.starting === 'map' ? 'Starting…' : d.running ? (v.state === 'paused' ? 'Resume' : 'Pause') : 'Start'}</span>
                <span className="truncate text-[12.5px] opacity-75">{d.running ? d.run?.name ?? '' : nothing ? 'Turn on Vacuum or Mop first' : `${what} · ${where}`}</span>
              </span>
            </button>
          </div>
        </div>

        {/* Presets + dock */}
        <div className="flex w-full shrink-0 flex-col gap-2.5 lg:w-[320px]">
          <span className="text-[13px] font-semibold text-ink-dim">Presets</span>
          {[{ id: 'full', name: 'Full clean', sub: 'Vacuum + mop · whole home', color: '#e8edf2', available: true, reason: undefined as string | undefined }, ...v.presets.map((p) => ({ ...p, sub: `${p.sub}${p.rooms.length > 1 ? ' · ' + p.rooms.map((id) => v.rooms.find((r) => r.id === id)?.name.replace(/ (bedroom|room)$/i, '')).join(', ') : ''}` }))].map((p) => (
            <button key={p.id} disabled={!p.available || !!a.starting || d.running} title={p.reason}
              onClick={async () => { const ok = await (p.id === 'full' ? a.full() : a.preset(p.id)); if (ok) setMsg(`Started · ${p.name}`) }}
              className="flex h-16 items-center gap-3 rounded-[14px] border border-edge bg-surface px-3.5 text-left hover:bg-surface-raised disabled:opacity-45">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{p.name}</span>
                <span className="truncate text-[12.5px] text-ink-dim">{a.starting === p.id ? 'Starting…' : p.available ? p.sub : p.reason}</span>
              </span>
              <span className="ml-auto text-ink-dim"><Play size={16} /></span>
            </button>
          ))}

          <div className="mt-auto flex flex-col gap-2.5 rounded-[14px] border border-edge bg-surface p-4">
            <span className="text-[13px] font-semibold text-ink-dim">Dock</span>
            {dockRows(v).map((r) => (
              <div key={r.label} className="flex items-center gap-2 text-[13.5px]">
                <span className="h-2 w-2 rounded-full" style={{ background: r.bad ? AMBER : GREEN }} />
                <span className="text-[#c9d2db]">{r.label}</span>
                <span className="ml-auto" style={{ color: r.bad ? AMBER : undefined }}>{r.value}</span>
              </div>
            ))}
            <button onClick={() => void a.dock()} disabled={v.state === 'docked' || v.state === 'returning'}
              className="mt-1 h-11 rounded-xl border border-edge bg-surface-raised text-sm font-medium disabled:opacity-40">
              {v.state === 'returning' ? 'Heading to the dock…' : 'Send to dock'}
            </button>
          </div>
        </div>
      </div>
    </DetailLayout>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex flex-col gap-2"><span className="text-[13px] text-ink-dim">{label}</span>{children}</div>
}

function ZoneBox({ z, label }: { z: Box; label: string }) {
  const [W, H] = HOME.vacuum.size
  return (
    <div className="pointer-events-none absolute rounded border-2 border-dashed border-white bg-white/15"
      style={{ left: `${(z[0] / W) * 100}%`, top: `${(z[1] / H) * 100}%`, width: `${(z[2] / W) * 100}%`, height: `${(z[3] / H) * 100}%` }}>
      {label && <span className="absolute left-2 top-1.5 text-xs font-semibold text-white">{label}</span>}
      <span className="absolute -bottom-[7px] -right-[7px] h-3 w-3 rounded-full border-2 border-[#0b1015] bg-white" />
      <span className="absolute -left-[7px] -top-[7px] h-3 w-3 rounded-full border-2 border-[#0b1015] bg-white" />
    </div>
  )
}
