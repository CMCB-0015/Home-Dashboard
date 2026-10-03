// GET /api/health — open this after deploying to confirm the backend is alive.
import type { Config } from '@netlify/functions'
import { ok } from './_shared/http.ts'

export default async () => ok({ ok: true, time: new Date().toISOString() })

export const config: Config = { path: '/api/health' }
