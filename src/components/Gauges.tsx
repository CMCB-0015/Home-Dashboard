// Instrument-style readouts: arc dial, one-dot-per-device row, and a bar.

const SWEEP = 270
const START = 135

function point(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}
function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const s = point(cx, cy, r, from), e = point(cx, cy, r, to)
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${e.x} ${e.y}`
}

export function Dial({ value, color, size = 104, stroke = 7, label, sublabel }:
  { value: number; color: string; size?: number; stroke?: number; label: string; sublabel?: string }) {
  const c = size / 2, r = size / 2 - stroke
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden>
        <path d={arc(c, c, r, START, START + SWEEP)} fill="none" stroke="var(--color-edge)" strokeWidth={stroke} strokeLinecap="round" />
        {v > 0 && <path d={arc(c, c, r, START, START + (SWEEP * v) / 100)} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" />}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-xl font-medium leading-none">{label}</span>
        {sublabel && <span className="mt-1.5 text-[9px] uppercase tracking-wider text-ink-faint">{sublabel}</span>}
      </div>
    </div>
  )
}

export function DotRow({ total, active, color }: { total: number; active: number; color: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" aria-label={`${active} of ${total} on`}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className="h-2 w-2 rounded-full" style={{ background: i < active ? color : 'var(--color-edge)' }} />
      ))}
    </div>
  )
}

export function Bar({ value, color, height = 8 }: { value: number; color: string; height?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-full bg-edge" style={{ height }}>
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  )
}
