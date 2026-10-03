// GET /api/weather — live forecast only (handy for testing).
import type { Config } from '@netlify/functions'
import { ok, fail } from './_shared/http.ts'
import { getWeather } from './_shared/weather.ts'

export default async () => {
  try { return ok(await getWeather()) } catch (e) { return fail(e instanceof Error ? e.message : 'Weather failed') }
}

export const config: Config = { path: '/api/weather' }
