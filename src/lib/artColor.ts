import { useEffect, useState } from 'react'

const cache = new Map<string, string | null>()

/**
 * The most vivid color in a piece of album art, brightened so it reads on the
 * dark theme. Returns null until loaded, or if there's no art.
 */
export function useArtColor(url: string | null): string | null {
  const [color, setColor] = useState<string | null>(url ? cache.get(url) ?? null : null)
  useEffect(() => {
    if (!url) { setColor(null); return }
    if (cache.has(url)) { setColor(cache.get(url)!); return }
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      const c = pick(img)
      cache.set(url, c)
      if (!cancelled) setColor(c)
    }
    img.onerror = () => { cache.set(url, null); if (!cancelled) setColor(null) }
    img.src = url
    return () => { cancelled = true }
  }, [url])
  return color
}

function pick(img: HTMLImageElement): string | null {
  const n = 32
  const cv = document.createElement('canvas')
  cv.width = n; cv.height = n
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, n, n)
  const d = ctx.getImageData(0, 0, n, n).data
  // Bucket by hue, weight by saturation × brightness, take the strongest bucket
  const buckets = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }))
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2]
    const [h, s, v] = hsv(r, g, b)
    const w = s * s * v
    if (w < 0.02) continue
    const k = buckets[Math.floor(h / 30) % 12]
    k.w += w; k.r += r * w; k.g += g * w; k.b += b * w
  }
  const best = buckets.sort((a, b) => b.w - a.w)[0]
  if (!best.w) return null
  const [h, s] = hsv(best.r / best.w, best.g / best.w, best.b / best.w)
  // Readable on the dark theme: fairly light, not neon
  return hslHex(h, Math.min(0.75, Math.max(0.45, s)), 0.68)
}

function hsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), c = max - min
  let h = 0
  if (c) h = max === r ? ((g - b) / c) % 6 : max === g ? (b - r) / c + 2 : (r - g) / c + 4
  return [(h * 60 + 360) % 360, max ? c / max : 0, max]
}

function hslHex(h: number, s: number, l: number) {
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const a = s * Math.min(l, 1 - l)
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}
