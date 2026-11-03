// The car picture on the Tesla card, with motion for two states:
//
//  • Plugged in (anywhere): the rear view with the charge cable. While charging
//    the cable is faint white and one long green pulse flows from the wall into
//    the car; plugged in but not charging, the cable is solid blue.
//  • Driving: the front view on a road drawn in true perspective (its lines meet
//    at the same vanishing point as the photo), lane dashes moving past, and the
//    car's real rims spinning around their hubs.
//
// All motion is CSS (see "Tesla card motion" in index.css) and stops with the
// device's reduce-motion setting. Parked or plugged in, the frunk and trunk
// show as tappable ring dots on the picture (Spots). Numbers below are in the photos' own pixels
// (driving 580×370, charging 670×445); each scene is scaled to the card.

import type { MouseEvent, ReactNode } from 'react'

export type SceneMode = 'parked' | 'charging' | 'plugged' | 'driving'

const PARKED_IMG = '/images/tesla-willawilla.png'
const DRIVE_IMG = '/images/tesla-driving.png'
const CHARGE_IMG = '/images/tesla-charging.png'

// ── Driving ──────────────────────────────────────────────────────────────
const DW = 580, DH = 370
/** Maps a flat 360×828 road strip (3 lanes, 10 px per foot) into the photo's perspective */
const ROAD = 'matrix3d(4.11316,1.02829,0,0,4.15965,-1.21217,0,0.00115997,0,0,1,0,-1563.76,518.469,0,1)'
/** Each rim, unwarped to a 128 px circle, mapped back onto its wheel */
const RIMS = [
  { src: '/images/tesla-rim-front.png', m: 'matrix(0.41266,0.08771,-0.12994,0.61134,236.391,245.249)' },
  { src: '/images/tesla-rim-rear.png', m: 'matrix(0.36298,0.07715,-0.11939,0.56167,503.794,143.625)' },
]

function Stage({ width, children }: { width: number; children: ReactNode }) {
  return (
    <div className="absolute left-0 top-0" style={{ width: DW, height: DH, transform: `scale(${width / DW})`, transformOrigin: '0 0' }}>
      {children}
    </div>
  )
}

function Driving({ width }: { width: number }) {
  const h = (width * DH) / DW
  return (
    <>
      {/* The road, behind the car; fades out above and below the picture */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 -left-5 -right-5 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,#000_16%,#000_84%,transparent)]">
        <div className="absolute left-1/2 top-1/2" style={{ width, height: h, marginLeft: -width / 2, marginTop: -h / 2 }}>
          <Stage width={width}>
            <div className="absolute left-0 top-0 h-[828px] w-[360px] [mask-image:linear-gradient(to_bottom,transparent_0%,#000_30%,#000_62%,transparent_92%)]"
              style={{ transform: ROAD, transformOrigin: '0 0' }}>
              <div className="absolute inset-0 bg-white/[0.022]" />
              <div className="absolute inset-y-0 left-0 w-[3px] bg-[#3a4652]" />
              <div className="tesla-road-dash absolute inset-y-0 left-[118px] w-[3.5px]" />
              <div className="tesla-road-dash absolute inset-y-0 left-[238px] w-[3.5px]" />
              <div className="absolute inset-y-0 left-[357px] w-[3px] bg-[#3a4652]" />
            </div>
          </Stage>
        </div>
      </div>
      {/* The car, its shadow and spinning rims */}
      <div className="relative" style={{ width, height: h }}>
        <Stage width={width}>
          <svg width={DW} height={DH} className="absolute left-0 top-0 overflow-visible" aria-hidden>
            <defs><filter id="tesla-shadow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14" /></filter></defs>
            <polygon points="250,345 519,232 317,182 48,292" fill="#000" opacity="0.65" filter="url(#tesla-shadow)" />
          </svg>
          <img src={DRIVE_IMG} alt="WillaWilla driving" className="absolute left-0 top-0" style={{ width: DW, height: DH }} />
          {RIMS.map((r) => (
            <div key={r.src} aria-hidden className="absolute left-0 top-0 h-32 w-32" style={{ transform: r.m, transformOrigin: '0 0' }}>
              <img src={r.src} alt="" className="tesla-rim block h-32 w-32" />
            </div>
          ))}
        </Stage>
      </div>
    </>
  )
}

// ── Plugged in ───────────────────────────────────────────────────────────
const CW = 670, CH = 445
const CABLE = 'M403 203 C397 262 392 318 372 344 C352 366 300 378 180 398 S20 432 -130 456'
/** One soft pulse: stacked dashes (length % of the cable, opacity, width), centered together */
const PULSE: [number, number, number][] = [[75, 0.16, 9], [60, 0.16, 8], [45, 0.2, 7], [30, 0.26, 6], [16, 0.4, 5]]
const GREEN = '#4fd18b', BLUE = '#5aa2ff', AMBER = '#f2c14e'

function Plugged({ width, charging, children }: { width: number; charging: boolean; children?: ReactNode }) {
  const grad = charging ? 'tesla-cable-white' : 'tesla-cable-blue'
  return (
    <div className="relative" style={{ width }}>
      <img src={CHARGE_IMG} alt={charging ? 'WillaWilla charging' : 'WillaWilla plugged in'} className="block h-auto w-full" />
      <svg viewBox={`0 0 ${CW} ${CH}`} className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={grad} gradientUnits="userSpaceOnUse" x1="403" y1="0" x2="-130" y2="0">
            <stop offset="0" stopColor={charging ? '#e8edf2' : BLUE} stopOpacity={charging ? 0.5 : 1} />
            <stop offset="0.7" stopColor={charging ? '#e8edf2' : BLUE} stopOpacity={charging ? 0.4 : 0.85} />
            <stop offset="1" stopColor={charging ? '#e8edf2' : BLUE} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="tesla-pulse-fade-g" gradientUnits="userSpaceOnUse" x1="403" y1="0" x2="-130" y2="0">
            <stop offset="0" stopColor="#fff" /><stop offset="0.72" stopColor="#fff" /><stop offset="1" stopColor="#000" />
          </linearGradient>
          <mask id="tesla-pulse-fade" maskUnits="userSpaceOnUse" x="-200" y="0" width="900" height="500">
            <rect x="-200" y="0" width="900" height="500" fill="url(#tesla-pulse-fade-g)" />
          </mask>
        </defs>
        <path d={CABLE} fill="none" stroke={`url(#${grad})`} strokeWidth="6" strokeLinecap="round"
          style={charging ? undefined : { filter: 'drop-shadow(0 0 5px rgba(90,162,255,0.45))' }} />
        {charging && (
          <g mask="url(#tesla-pulse-fade)">
            <g style={{ filter: 'drop-shadow(0 0 5px rgba(79,209,139,0.6))' }}>
              {PULSE.map(([d, op, w], i) => (
                <path key={d} className={`tesla-pulse-${i}`} d={CABLE} pathLength={100} fill="none" stroke={GREEN} strokeOpacity={op}
                  strokeWidth={w} strokeLinecap="round" strokeDasharray={`${d} ${300 - d}`}
                  // Where the pulse sits when motion is off: midway along the cable
                  style={{ strokeDashoffset: d / 2 - 50 }} />
              ))}
            </g>
          </g>
        )}
      </svg>
      {children}
    </div>
  )
}

// ── Frunk and trunk spots ─────────────────────────────────────────────────
/** Where the frunk and trunk sit in each picture, in % of its width and height */
const SPOT_AT = {
  parked: { frunk: [22, 50], trunk: [78.5, 20] },
  plugged: { frunk: [7.5, 21], trunk: [82, 37] },
} as const

export interface SpotState {
  frunkOpen: boolean
  trunkOpen: boolean
  /** Which one is waiting on the car, and whether it's opening or closing */
  busy: { frunk?: 'Opening…' | 'Closing…'; trunk?: 'Opening…' | 'Closing…' }
  onFrunk: () => void
  onTrunk: () => void
}

/**
 * A ring dot that slowly breathes on the frunk and the trunk. Tap one to open
 * it; it turns into an amber "Trunk open" / "Frunk open" pill. Tap the trunk
 * pill to close it again — the frunk only closes by hand, so its pill is just
 * a label.
 */
function Spots({ at, s }: { at: (typeof SPOT_AT)[keyof typeof SPOT_AT]; s: SpotState }) {
  const one = (what: 'frunk' | 'trunk') => {
    const [x, y] = at[what]
    const open = what === 'frunk' ? s.frunkOpen : s.trunkOpen
    const busy = s.busy[what]
    const name = what === 'frunk' ? 'Frunk' : 'Trunk'
    const tap = what === 'frunk' ? s.onFrunk : s.onTrunk
    const pos = { left: `${x}%`, top: `${y}%` }
    const stop = (ev: MouseEvent) => { ev.preventDefault(); ev.stopPropagation() }
    if (busy) {
      return (
        <span key={what} role="status" style={pos}
          className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-white/25 bg-bg/85 px-2.5 py-1 text-[12px] font-medium text-ink"
          onClick={stop}>
          {busy}
        </span>
      )
    }
    if (open) {
      const pill = 'absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[12px] font-semibold'
      const look = { ...pos, color: AMBER, background: 'rgba(242,193,78,0.16)', borderColor: 'rgba(242,193,78,0.7)' }
      const dot = <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: AMBER }} />
      return what === 'trunk'
        ? <button key={what} type="button" aria-label="Trunk open: tap to close" className={`${pill} hover:brightness-125`} style={look}
            onClick={(ev) => { stop(ev); tap() }}>{dot}{name} open</button>
        : <span key={what} className={pill} style={look} onClick={stop}>{dot}{name} open</span>
    }
    return (
      <button key={what} type="button" aria-label={`Open ${what}`} style={pos}
        className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
        onClick={(ev) => { stop(ev); tap() }}>
        <span aria-hidden className="tesla-breathe flex h-6 w-6 items-center justify-center rounded-full border-2"
          style={{ borderColor: 'rgba(255,255,255,0.85)', boxShadow: '0 0 10px rgba(255,255,255,0.45), inset 0 0 6px rgba(255,255,255,0.25)' }}>
          <span className="h-[9px] w-[9px] rounded-full bg-white" />
        </span>
      </button>
    )
  }
  return <>{one('frunk')}{one('trunk')}</>
}

/** The car picture for the card's current state */
export function CarScene({ mode, compact, spots, maxWidth }: { mode: SceneMode; compact?: boolean; spots?: SpotState; maxWidth?: number }) {
  // maxWidth: the fit-to-screen tablet layout shrinks the picture to the card's height
  const w = (full: number) => Math.round(Math.min(full, maxWidth ?? full))
  if (mode === 'driving') return <Driving width={w(compact ? 240 : 300)} />
  if (mode === 'charging' || mode === 'plugged') {
    return <Plugged width={w(300)} charging={mode === 'charging'}>{spots && <Spots at={SPOT_AT.plugged} s={spots} />}</Plugged>
  }
  return (
    <div className="relative max-w-full" style={{ width: w(compact ? 230 : 300) }}>
      <img src={PARKED_IMG} alt="WillaWilla, black Model 3"
        className="block h-auto w-full [mask-image:radial-gradient(ellipse_at_center,#000_55%,transparent_72%)]" />
      {spots && <Spots at={SPOT_AT.parked} s={spots} />}
    </div>
  )
}
