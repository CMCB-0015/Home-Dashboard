import { useEffect, useRef } from 'react'
import type { SceneProps } from '../../lib/holidays'
import { XM } from './sceneEngine'
import { RIDGELINE } from './christmasRidgeline'

// Christmas screensaver scene (1.30.0): an animated canvas behind the
// screensaver's clock. Follows the real time of day (sunrise ~6:50 AM,
// sunset ~4:45 PM), lights stay on in daylight, Santa crosses the moon at night.
//
// Light on the Slate: ~30 frames a second, at most 1.5× pixel density, and the
// mountains / forest / trees are drawn once into a still image that's only
// redrawn as the daylight changes. Unmounting (Panel wakes) stops everything.

const SNOW = { off: 0, light: 0.6, normal: 1, heavy: 1.8 } as const
const LIGHTS = { few: 1, normal: 2, lots: 3, max: 4 } as const
const SCENE = RIDGELINE

type Santa = { x0: number; x1: number; slope: number; dur: number; age: number; dir: number }

export default function ChristmasScene({ settings, preview }: SceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const opts = useRef(settings)
  opts.current = settings

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    let W = 0, H = 0, dpr = 1
    let S: any, snow: any[] = []
    const land = document.createElement('canvas')
    const lctx = land.getContext('2d')!
    let landKey = ''

    const setup = () => {
      W = window.innerWidth; H = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
      land.width = cv.width; land.height = cv.height
      S = SCENE.build(XM.rng(SCENE.seed), W, H)
      snow = XM.makeSnow(XM.rng(7), W, H, Math.round(360 * Math.max(0.6, (W * H) / (1200 * 800)) ** 0.5), SCENE.snowScale * Math.max(0.8, S.s))
      landKey = ''
    }
    setup()

    let santa: Santa | null = null
    // First sighting soon after a night-time screensaver starts (right away for Preview), then every 4–8 min
    let nextSanta = preview ? 3 : 25 + Math.random() * 20
    const t0 = performance.now()
    let prev = t0, raf = 0

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (now - prev < 30) return
      const dt = Math.min(0.1, (now - prev) / 1000); prev = now
      const t = (now - t0) / 1000
      const d = new Date()
      const env = XM.env(d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600)
      env.t = reduce ? 0 : t
      const o = opts.current

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      SCENE.sky(ctx, S, env)

      if (santa) {
        santa.age += dt
        if (santa.age > santa.dur) santa = null
      } else if (env.n >= 0.9) {
        nextSanta -= dt
        if (nextSanta <= 0) {
          const dir = Math.random() < 0.5 ? 1 : -1, off = 170 * S.s
          santa = { x0: dir > 0 ? -off : W + off, x1: dir > 0 ? W + off : -off, slope: (Math.random() - 0.5) * 0.14 - 0.05 * dir, dur: SCENE.santaDur, age: 0, dir }
          nextSanta = 240 + Math.random() * 240
        }
      }
      if (santa) SCENE.santa(ctx, S, env, santa)

      const key = Math.round(env.d * 40) + '_' + Math.round(env.g * 40)
      if (key !== landKey) {
        landKey = key
        lctx.setTransform(dpr, 0, 0, dpr, 0, 0); lctx.clearRect(0, 0, W, H)
        SCENE.land(lctx, S, env)
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(land, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      SCENE.lights(ctx, S, env, { level: LIGHTS[o.lights] ?? 2, glow: (o.glow ?? 60) / 70 })
      XM.drawSnow(ctx, snow, W, H, reduce ? dt * 0.4 : dt, t, SNOW[o.snow] ?? 1, '#ffffff')
    }
    raf = requestAnimationFrame(frame)
    window.addEventListener('resize', setup)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', setup) }
  }, [preview])

  const veil = 1 - Math.min(100, Math.max(30, settings.scene ?? 100)) / 100
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 block">
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      {veil > 0 && <span className="absolute inset-0 block bg-black" style={{ opacity: veil }} />}
    </span>
  )
}
