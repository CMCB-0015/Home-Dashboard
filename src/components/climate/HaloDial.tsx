import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { rgba } from '../../lib/lightColor'
import { DIAL_MAX, DIAL_MIN, MIN_GAP } from '../../lib/climate'

/**
 * The Halo dial (approved Nov 1, 2026 — spec in the project's
 * claude/climate-card-spec.md). A black glass face in a dark metal bezel with
 * a thin ring of light. Turn the bezel like a knob to change the target:
 * clockwise is warmer, about STEP_DEG of turn per degree, relative to where it
 * already is, so touching it never jumps the target. The value only goes out
 * when the finger lifts (onCommit); while turning the dial shows the new value
 * itself. Tapping the center calls onCenter (the mode menu).
 */

/** Degrees of turn per 1°F — tune here once it's on the tablet */
export const STEP_DEG = 8

const SIZE = 176
const C = SIZE / 2
const R_HALO = 71
const R_DOT = 82
const SWEEP_FROM = 135
const SWEEP = 270

export type Setpoint = 'target' | 'low' | 'high'

interface Props {
  cur: number
  /** Single target (Heat / Cool) */
  target: number
  /** Heat · Cool and Eco show a range instead */
  range: { low: number; high: number } | null
  /** Ring color: heating / cooling color while running, else the climate blue */
  color: string
  live: boolean
  /** Eco and Off: no turning, no target dot in Off */
  locked: boolean
  off?: boolean
  /** Range dot colors (blue low, red high; grey in Eco) */
  lowColor: string
  highColor: string
  /** Center content (word, number, mode pill) — drawn inside the tap area */
  center: (draft: { which: Setpoint; value: number } | null) => ReactNode
  centerLabel: string
  onCenter: () => void
  onCommit: (which: Setpoint, value: number) => void
  onTurning?: (draft: { which: Setpoint; value: number } | null) => void
}

const clampT = (t: number) => Math.max(DIAL_MIN, Math.min(DIAL_MAX, Math.round(t)))
const angleOf = (t: number) => SWEEP_FROM + (SWEEP * (clampT(t) - DIAL_MIN)) / (DIAL_MAX - DIAL_MIN)
const point = (deg: number, r: number) => { const a = (deg * Math.PI) / 180; return [C + r * Math.cos(a), C + r * Math.sin(a)] as const }
const f = (n: number) => n.toFixed(2)
function arc(from: number, to: number, r: number) {
  if (to - from < 1) to = from + 1
  const [x1, y1] = point(from, r), [x2, y2] = point(to, r)
  return `M ${f(x1)} ${f(y1)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${f(x2)} ${f(y2)}`
}
/** Temperature under a screen angle on the sweep (used only to pick the nearer setpoint) */
function tempAt(deg: number) {
  let a = (deg + 360) % 360
  if (a < 90) a += 360
  const rel = Math.max(0, Math.min(SWEEP, a - SWEEP_FROM))
  return DIAL_MIN + (rel / SWEEP) * (DIAL_MAX - DIAL_MIN)
}

export function HaloDial(p: Props) {
  // Bezel sheen angle: follows the finger and stays where it was left
  const [ring, setRing] = useState(20)
  const [draft, setDraft] = useState<{ which: Setpoint; value: number } | null>(null)
  const turn = useRef<{ which: Setpoint; value: number; last: number; acc: number } | null>(null)

  const setDraftBoth = (d: { which: Setpoint; value: number } | null) => { setDraft(d); p.onTurning?.(d) }

  const valueOf = (which: Setpoint) => (which === 'target' ? p.target : which === 'low' ? p.range!.low : p.range!.high)
  /** Keep Heat · Cool's ends apart */
  const fix = (which: Setpoint, v: number) => {
    v = clampT(v)
    if (which === 'low' && p.range) v = Math.min(v, p.range.high - MIN_GAP)
    if (which === 'high' && p.range) v = Math.max(v, p.range.low + MIN_GAP)
    return v
  }
  const angleAt = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI
  }

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (p.locked || (e.pointerType === 'mouse' && e.button !== 0)) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const deg = angleAt(e)
    const which: Setpoint = p.range
      ? (Math.abs(tempAt(deg) - p.range.low) <= Math.abs(tempAt(deg) - p.range.high) ? 'low' : 'high')
      : 'target'
    turn.current = { which, value: valueOf(which), last: deg, acc: 0 }
    setDraftBoth({ which, value: valueOf(which) })
  }
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const t = turn.current
    if (!t) return
    const deg = angleAt(e)
    const d = ((deg - t.last + 540) % 360) - 180
    t.last = deg
    t.acc += d
    const steps = t.acc > 0 ? Math.floor(t.acc / STEP_DEG) : Math.ceil(t.acc / STEP_DEG)
    if (steps !== 0) {
      t.acc -= steps * STEP_DEG
      const next = fix(t.which, t.value + steps)
      if (next !== t.value) { t.value = next; setDraftBoth({ which: t.which, value: next }) }
    }
    setRing((r) => r + d)
  }
  const up = () => {
    const t = turn.current
    turn.current = null
    if (!t) return
    setDraftBoth(null)
    if (t.value !== valueOf(t.which)) p.onCommit(t.which, t.value)
  }
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if (p.locked) return
    const n = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1 : 0
    if (!n) return
    e.preventDefault()
    const which: Setpoint = p.range ? (n > 0 ? 'high' : 'low') : 'target'
    const v = fix(which, valueOf(which) + n)
    if (v !== valueOf(which)) { setRing((r) => r + n * STEP_DEG); p.onCommit(which, v) }
  }

  // What's drawn: the draft value replaces its setpoint while turning
  const shown = (which: Setpoint) => (draft && draft.which === which ? draft.value : valueOf(which))
  const lo = p.range ? shown('low') : 0, hi = p.range ? shown('high') : 0, tg = shown('target')
  const [a1, a2] = p.range ? [lo, hi] : [Math.min(p.cur, tg), Math.max(p.cur, tg)]
  const showArc = !p.off && (!!p.range || a1 !== a2)
  // Range arc: climate blue in Heat · Cool, grey in Eco (both dots grey)
  const arcColor = p.range ? (p.lowColor === p.highColor ? rgba(p.lowColor, 0.55) : rgba('#5b8fc7', 0.75)) : p.color
  const dots = p.off ? [] : p.range
    ? [{ t: lo, c: p.lowColor }, { t: hi, c: p.highColor }]
    : [{ t: tg, c: p.color }]
  const [cx, cy] = point(angleOf(p.cur), R_HALO - 9)
  const nowValue = draft ? draft.value : p.range ? lo : tg

  return (
    <div role="slider" tabIndex={p.locked ? -1 : 0} aria-label="Temperature — turn the dial"
      aria-valuemin={DIAL_MIN} aria-valuemax={DIAL_MAX} aria-valuenow={nowValue} aria-readonly={p.locked || undefined}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}
      className="relative shrink-0 select-none rounded-full outline-offset-4"
      style={{ width: SIZE, height: SIZE, touchAction: 'none', cursor: p.locked ? 'default' : draft ? 'grabbing' : 'grab' }}>
      {/* Bezel: dark metal, the sheen turns with the finger */}
      <div aria-hidden className="absolute inset-0 rounded-full shadow-[0_6px_18px_rgba(0,0,0,0.55)]"
        style={{ background: `conic-gradient(from ${f(ring)}deg, #6b7681, #1a2026 18%, #3d4650 30%, #8a96a2 38%, #1a2026 55%, #4b5560 70%, #1a2026 85%, #6b7681)` }} />
      {/* Black glass face */}
      <div aria-hidden className="absolute inset-[9px] rounded-full shadow-[inset_0_2px_10px_rgba(0,0,0,0.7)]"
        style={{ background: 'radial-gradient(circle at 50% 28%, #1f2830 0%, #0a0d10 72%)' }} />
      <svg aria-hidden width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="pointer-events-none absolute inset-0 overflow-visible">
        <circle cx={C} cy={C} r={R_HALO} fill="none" strokeWidth={2}
          stroke={p.live ? rgba(p.color, 0.28) : 'rgba(132, 147, 161, 0.2)'} />
        {showArc && (
          <path d={arc(angleOf(a1), angleOf(a2), R_HALO)} fill="none" stroke={arcColor} strokeWidth={3.5} strokeLinecap="round"
            style={{ filter: p.live ? `drop-shadow(0 0 6px ${p.color})` : undefined, transition: 'stroke 0.4s' }} />
        )}
        <circle cx={cx} cy={cy} r={2.5} fill="#8493a1" />
        {dots.map((d, i) => {
          const [x, y] = point(angleOf(d.t), R_DOT)
          return <circle key={i} cx={x} cy={y} r={4} fill={d.c} style={{ filter: `drop-shadow(0 0 4px ${d.c})` }} />
        })}
      </svg>
      {/* Center: tap for the mode menu (kept apart from the turning zone) */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <button type="button" aria-label={p.centerLabel} onClick={p.onCenter} onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto flex h-[112px] w-[112px] flex-col items-center justify-center gap-px rounded-full">
          {p.center(draft)}
        </button>
      </div>
    </div>
  )
}
