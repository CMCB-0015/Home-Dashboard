// Panel's own Settings menu (1.27.0): changed on the screen, saved on the Lenovo
// (/data, key `panel-settings`), so nothing needs a code rebuild or an app restart.
//
// Sections so far: Screensaver. More sections stack in the same object.
//
// The app's Configuration tab still has the last word on the screensaver:
// `idle_dim` off there = no screensaver at all, whatever the menu says
// (the safety net from 1.18.0). `idle_minutes` / `idle_brightness` are only the
// starting values until something is changed in the menu.

import os from 'node:os'
import { statfs } from 'node:fs/promises'
import { cacheGet, cacheSet } from './cache.ts'
import { DATA_DIR, env } from './env.ts'
import { ha } from './ha.ts'

export interface ScreensaverSettings {
  /** The menu's On switch */
  on: boolean
  /** Minutes with no touch before it comes on */
  minutes: number
  /** Clock & text brightness, 10–60 % */
  text: number
  /** Notification chip brightness, 0–100 % (0 hides the chips) */
  chips: number
}

interface Saved { screensaver?: Partial<ScreensaverSettings> }

const KEY = 'panel-settings'
export const WAIT_CHOICES = [1, 2, 5, 10, 15]
let saved: Saved = {}

export async function loadSettings() {
  saved = (await cacheGet<Saved>(KEY)) ?? {}
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)))
const num = (v: unknown, d: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d }

/** What the screens get: the menu's values, plus whether Configuration has the screensaver switched off */
export function screensaverState() {
  const s = saved.screensaver ?? {}
  const master = (env('IDLE_DIM') ?? 'true').toLowerCase() !== 'false'
  const minutes = num(s.minutes, num(env('IDLE_MINUTES'), 2))
  const text = clamp(num(s.text, num(env('IDLE_BRIGHTNESS'), 32)), 10, 60)
  const chips = clamp(typeof s.chips === 'number' ? s.chips : 40, 0, 100)
  const on = s.on ?? true
  return { enabled: master && on, on, master, minutes, brightness: text, chips }
}

/** POST /api/settings  { screensaver: { on?, minutes?, text?, chips? } } */
export async function saveSettings(body: { screensaver?: Partial<ScreensaverSettings> }) {
  const s = body?.screensaver
  if (!s || typeof s !== 'object') throw new Error('Nothing to save')
  const next: Partial<ScreensaverSettings> = { ...saved.screensaver }
  if (typeof s.on === 'boolean') next.on = s.on
  if (s.minutes !== undefined) {
    const m = Number(s.minutes)
    if (!WAIT_CHOICES.includes(m)) throw new Error('Pick 1, 2, 5, 10 or 15 minutes')
    next.minutes = m
  }
  if (s.text !== undefined) next.text = clamp(Number(s.text) || 32, 10, 60)
  if (s.chips !== undefined) next.chips = clamp(Number.isFinite(Number(s.chips)) ? Number(s.chips) : 40, 0, 100)
  saved = { ...saved, screensaver: next }
  await cacheSet(KEY, saved)
}

// ── System info (the window behind the version in the menu's footer) ─────

async function supervisor(path: string): Promise<any | null> {
  const token = env('SUPERVISOR_TOKEN')
  if (!token) return null
  try {
    const res = await fetch(`http://supervisor${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(4000) })
    if (!res.ok) return null
    const j = await res.json()
    return j?.data ?? null
  } catch { return null }
}

let cpuLast = os.cpus().map((c) => c.times)
/** Processor load since the last call (a few seconds apart while the window is open) */
function cpuPercent(): number {
  const now = os.cpus().map((c) => c.times)
  let idle = 0, total = 0
  now.forEach((t, i) => {
    const p = cpuLast[i] ?? t
    const d = (k: keyof typeof t) => t[k] - p[k]
    const all = d('user') + d('nice') + d('sys') + d('idle') + d('irq')
    idle += d('idle'); total += all
  })
  cpuLast = now
  return total > 0 ? Math.round((1 - idle / total) * 100) : Math.round((os.loadavg()[0] / Math.max(1, now.length)) * 100)
}

/** GET /api/system — live values for the System window. Anything unreadable is null. */
export async function systemInfo() {
  let disk: { totalGb: number; freeGb: number } | null = null
  try {
    const s = await statfs(DATA_DIR)
    disk = { totalGb: (s.blocks * s.bsize) / 1e9, freeGb: (s.bavail * s.bsize) / 1e9 }
  } catch { /* not available */ }
  const [core, osInfo] = await Promise.all([supervisor('/core/info'), supervisor('/os/info')])
  return {
    memory: { totalGb: os.totalmem() / 1e9, usedGb: (os.totalmem() - os.freemem()) / 1e9 },
    disk,
    cpuPercent: cpuPercent(),
    cores: os.cpus().length,
    upSince: new Date(Date.now() - os.uptime() * 1000).toISOString(),
    panelUpSince: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    node: process.version,
    haCore: core?.version ?? null,
    haOs: osInfo?.version ?? null,
    haStatus: ha.status,
    haConnectedSince: ha.connectedAt ? new Date(ha.connectedAt).toISOString() : null,
  }
}
