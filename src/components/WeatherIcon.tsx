import { useId } from 'react'
import type { WeatherIcon as Kind } from '../types'

// Simple, original weather glyphs drawn in SVG (0–48 coordinate box).

const SUN = 'var(--color-weather)'
const CLOUD = '#c7d1db'
const CLOUD_DARK = '#8e9aa6'
const MOON = '#e6e1c9'
const RAIN = 'var(--color-rain)'

function Sun({ cx = 24, cy = 24, r = 9 }) {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4
    return <line key={i} x1={cx + Math.cos(a) * (r + 3)} y1={cy + Math.sin(a) * (r + 3)} x2={cx + Math.cos(a) * (r + 7)} y2={cy + Math.sin(a) * (r + 7)} stroke={SUN} strokeWidth={2.5} strokeLinecap="round" />
  })
  return <g>{rays}<circle cx={cx} cy={cy} r={r} fill={SUN} /></g>
}

function Cloud({ x = 0, y = 0, s = 1, fill = CLOUD }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill}>
      <circle cx="17" cy="27" r="8" />
      <circle cx="25" cy="22" r="10" />
      <circle cx="33" cy="27" r="8" />
      <rect x="13" y="26" width="24" height="9" rx="4.5" />
    </g>
  )
}

function Moon({ cx = 17, cy = 17, r = 9 }) {
  const id = useId()
  return (
    <g>
      <mask id={id}><rect width="48" height="48" fill="white" /><circle cx={cx + 5} cy={cy - 3} r={r} fill="black" /></mask>
      <circle cx={cx} cy={cy} r={r} fill={MOON} mask={`url(#${id})`} />
    </g>
  )
}

export function WeatherIcon({ kind, size = 48 }: { kind: Kind; size?: number }) {
  let content
  switch (kind) {
    case 'sun': content = <Sun />; break
    case 'moon': content = <Moon cx={24} cy={24} r={11} />; break
    case 'pcloudy': content = <><Sun cx={18} cy={18} r={7} /><Cloud x={4} y={6} s={0.95} /></>; break
    case 'pcloudy-night': content = <><Moon cx={17} cy={16} r={8} /><Cloud x={4} y={6} s={0.95} /></>; break
    case 'cloudy': content = <><Cloud x={-4} y={-4} s={0.8} fill={CLOUD_DARK} /><Cloud x={3} y={5} s={0.95} /></>; break
    case 'fog': content = <><Cloud x={0} y={-2} fill={CLOUD_DARK} />{[36, 41].map((y) => <line key={y} x1="10" y1={y} x2="38" y2={y} stroke={CLOUD} strokeWidth={2.5} strokeLinecap="round" />)}</>; break
    case 'rain':
    case 'storm':
      content = (
        <>
          <Cloud x={0} y={-4} fill={CLOUD_DARK} />
          {kind === 'storm'
            ? <polygon points="25,32 19,42 24,42 21,48 30,37 25,37 28,32" fill={SUN} />
            : [17, 24, 31].map((x) => <line key={x} x1={x} y1={35} x2={x - 3} y2={43} stroke={RAIN} strokeWidth={2.5} strokeLinecap="round" />)}
        </>
      ); break
    case 'snow':
      content = <><Cloud x={0} y={-4} fill={CLOUD_DARK} />{[17, 24, 31].map((x) => <circle key={x} cx={x} cy={39} r={2} fill={CLOUD} />)}</>; break
  }
  return <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>{content}</svg>
}
