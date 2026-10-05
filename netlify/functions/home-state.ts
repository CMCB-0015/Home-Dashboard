// GET /api/home-state — the one endpoint the dashboard loads.
//
// Each service starts as demo data. As we connect a service, its section
// below switches from demo to live. If a live call fails, that section
// falls back to demo data so the rest of the dashboard keeps working.
//
// Status:   Weather ✅ live   |   everything else: demo (not connected yet)

import type { Config } from '@netlify/functions'
import { ok } from './_shared/http.ts'
import { isAuthed, locked } from './_shared/auth.ts'
import { getWeather } from './_shared/weather.ts'
import { buildMockState } from '../../src/data/mockData.ts'

async function live<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn() } catch (e) {
    console.warn(`[home-state] ${label} unavailable, using demo data:`, e instanceof Error ? e.message : e)
    return fallback
  }
}

export default async (req: Request) => {
  if (!isAuthed(req)) return locked()
  const demo = buildMockState()
  const weather = await live('weather', getWeather, demo.weather)

  return ok({
    ...demo,
    weather,
    // Next to connect, one at a time:
    // irrigationZones: await live('rachio', getRachioZones, demo.irrigationZones),
    // shoppingList:    await live('todoist', getTodoistItems, demo.shoppingList),
    // calendar:        await live('google-calendar', getCalendarEvents, demo.calendar),
    // thermostats:     await live('nest', getNestThermostats, demo.thermostats),
    // lights:          await live('hue', getHueLights, demo.lights),
    // sonos:           await live('sonos', getSonos, demo.sonos),
    // vehicles:        await live('tesla', getVehicles, demo.vehicles),
    // cameras/guardMode: Eufy  ·  vacuums: Roborock
  })
}

export const config: Config = { path: '/api/home-state' }
