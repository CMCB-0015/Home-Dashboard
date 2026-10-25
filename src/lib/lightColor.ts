// Color helpers for the Lights card and light panel.

import type { Light } from '../types'

export type RGB = [number, number, number]

export const WARM_WHITE = '#ffd6a0'

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const rgbToHex = (rgb: RGB) => '#' + rgb.map((n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')).join('')

export const rgba = (hex: string, alpha: number) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r}, ${g}, ${b}, ${alpha})` }

/** Approximate color of white light at a given temperature (kelvin) */
export function kelvinToRgb(k: number): RGB {
  const t = k / 100
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592)
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492)
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  return [r, g, b].map((v) => Math.max(0, Math.min(255, v))) as RGB
}

/** Fully saturated color for a hue (0–360) */
export function hueToRgb(h: number): RGB {
  const f = (n: number) => { const k = (n + h / 60) % 6; return 255 * (1 - Math.max(0, Math.min(k, 4 - k, 1))) }
  return [f(5), f(3), f(1)]
}

export function rgbToHue([r, g, b]: RGB): number {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  if (d === 0) return 0
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return Math.round(((h * 60) + 360) % 360)
}

/** The blended color of every light that's on, weighted by brightness. Null when everything's off. */
export function blend(lights: Light[]): string | null {
  const on = lights.filter((l) => l.on && !l.isGroup)
  if (!on.length) return null
  let r = 0, g = 0, b = 0, w = 0
  for (const l of on) {
    const [lr, lg, lb] = hexToRgb(l.color ?? WARM_WHITE)
    const weight = Math.max(0.15, l.brightnessPct / 100)
    r += lr * weight; g += lg * weight; b += lb * weight; w += weight
  }
  return rgbToHex([r / w, g / w, b / w])
}

/** Two colors are "different" when they're visibly apart */
export function differ(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return a !== b
  const x = hexToRgb(a), y = hexToRgb(b)
  return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]) > 40
}

export const WHITE_TONES = [
  { label: 'Candle', kelvin: 2200 },
  { label: 'Warm', kelvin: 2700 },
  { label: 'Neutral', kelvin: 3500 },
  { label: 'Cool', kelvin: 4500 },
  { label: 'Daylight', kelvin: 6500 },
]

export const SWATCHES: { label: string; hex: string }[] = [
  { label: 'Red', hex: '#ff3b30' }, { label: 'Orange', hex: '#ff8a00' }, { label: 'Amber', hex: '#ffc233' },
  { label: 'Green', hex: '#34c759' }, { label: 'Teal', hex: '#2dd4bf' }, { label: 'Blue', hex: '#3b82f6' },
  { label: 'Purple', hex: '#8b5cf6' }, { label: 'Pink', hex: '#ff4fa3' },
]

/** "20:00" → "8:00 PM" */
export function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** "20:00", "22:00" → "8:00–10:00 PM" */
export function timeRange(start: string, end: string): string {
  const a = timeLabel(start), b = timeLabel(end)
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)}–${b}` : `${a}–${b}`
}
