import type React from 'react'
import type { ReactNode } from 'react'
import { HOME } from '../../config/home'
import type { VacuumRoom } from '../../types'

const [W, H] = HOME.vacuum.size
export const pctX = (x: number) => `${(x / W) * 100}%`
export const pctY = (y: number) => `${(y / H) * 100}%`

/** rgba() from a #rrggbb color */
export const tint = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`
}

/**
 * The dashboard's own floor plan (Home Assistant only offers the Roborock map
 * as a picture). Scales to whatever width it's given. `room` draws each box;
 * `children` go on top (robot dot, drawn areas).
 */
export function FloorPlan({ rooms, room, children, className = '', robot, dock = true, big = false }: {
  rooms: VacuumRoom[]
  room: (r: VacuumRoom, rectIndex: number, style: React.CSSProperties) => ReactNode
  children?: ReactNode
  className?: string
  /** Robot position in floor-plan units */
  robot?: [number, number] | null
  dock?: boolean
  big?: boolean
}) {
  const [dx, dy] = HOME.vacuum.dock
  return (
    <div className={`relative ${className}`} style={{ aspectRatio: `${W} / ${H}` }}>
      {rooms.flatMap((r) => r.rects.map((q, i) => room(r, i, { position: 'absolute', left: pctX(q[0]), top: pctY(q[1]), width: pctX(q[2]), height: pctY(q[3]) })))}
      {dock && (
        <span aria-hidden className="pointer-events-none absolute rounded-[2px] bg-ink"
          style={{ left: pctX(dx - 2), top: pctY(dy - 2), width: big ? 16 : 6, height: big ? 12 : 6 }} />
      )}
      {robot && (
        <span aria-hidden className="pointer-events-none absolute rounded-full bg-white transition-all duration-700"
          style={{
            left: pctX(robot[0]), top: pctY(robot[1]),
            width: big ? 20 : 12, height: big ? 20 : 12, marginLeft: big ? -10 : -6, marginTop: big ? -10 : -6,
            border: `${big ? 3 : 2}px solid #0b1015`, boxShadow: `0 0 0 ${big ? 5 : 4}px rgba(255,255,255,${big ? 0.22 : 0.25})`,
          }} />
      )}
      {children}
    </div>
  )
}
