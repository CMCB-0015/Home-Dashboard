// GET /api/home-state — the one endpoint the dashboard loads.
//
// Each service starts as demo data. As we connect a service, its section
// below switches from demo to live. If a live call fails, that section
// falls back to demo data so the rest of the dashboard keeps working.
//
// Status:   Weather ✅   Rachio ✅ (once RACHIO_API_KEY is set)   |   everything else: demo

import type { Config } from '@netlify/functions'
import { ok } from './_shared/http.ts'
import { isAuthed, locked } from './_shared/auth.ts'
import { getWeather } from './_shared/weather.ts'
import { getRachio, rachioConfigured } from './_shared/rachio.ts'
import type { Category, HomeState } from '../../src/types.ts'
import { buildMockState } from '../../src/data/mockData.ts'

export default async (req: Request) => {
  if (!isAuthed(req)) return locked()
  const demo = buildMockState()
  const sources: NonNullable<HomeState['sources']> = {}

  // Load a live section; on failure fall back to demo and say so.
  async function live<T>(cat: Category, enabled: boolean, fn: () => Promise<T>, fallback: T): Promise<T> {
    if (!enabled) { sources[cat] = 'demo'; return fallback }
    try {
      const value = await fn()
      sources[cat] = 'live'
      return value
    } catch (e) {
      console.warn(`[home-state] ${cat} unavailable, using demo data:`, e instanceof Error ? e.message : e)
      sources[cat] = 'demo'
      return fallback
    }
  }

  // Live services load in parallel.
  const [weather, rachio] = await Promise.all([
    live('weather', true, getWeather, demo.weather),
    live('irrigation', rachioConfigured(), getRachio, { zones: demo.irrigationZones, summary: demo.irrigation }),
  ])

  // Everything not connected yet is demo.
  for (const cat of ['climate', 'lights', 'cameras', 'vacuum', 'vehicles', 'sonos', 'calendar', 'list'] as Category[]) {
    sources[cat] = 'demo'
  }

  // Don't mix made-up sprinkler alerts with real sprinkler data.
  const alerts = sources.irrigation === 'live' ? demo.alerts.filter((a) => a.category !== 'irrigation') : demo.alerts

  const state: HomeState = { ...demo, weather, irrigationZones: rachio.zones, irrigation: rachio.summary, alerts, sources }
  return ok(state)
  // Next to connect, one at a time:
  // shoppingList (Todoist) · calendar + thermostats (Google) · lights (Hue) · sonos · vehicles (Tesla)
  // cameras + guardMode (Eufy) · vacuums (Roborock)
}

export const config: Config = { path: '/api/home-state' }
