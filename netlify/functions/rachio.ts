// Rachio sprinklers.
//   POST /api/rachio/command
//        { action: 'start' | 'stop' | 'pause' | 'resume', zoneId, durationSeconds? }
//        { action: 'quick', quickId }   { action: 'skip-tomorrow' }
//   GET  /api/rachio/debug    shows what Rachio returns (for troubleshooting)
//   POST /api/rachio/webhook  reserved for Rachio push events (not registered yet)
// Needs RACHIO_API_KEY (Rachio app → Account → API Access).
import type { Config } from '@netlify/functions'
import { ok, fail, readJson, stub } from './_shared/http.ts'
import { isAuthed, locked } from './_shared/auth.ts'
import { rachioCommand, rachioConfigured, rachioDebug } from './_shared/rachio.ts'

export default async (req: Request) => {
  const path = new URL(req.url).pathname

  // Rachio's servers will call this; it gets its own check when we turn webhooks on.
  if (path.endsWith('/webhook')) return stub('rachio', req, [], true)

  if (!isAuthed(req)) return locked()
  if (!rachioConfigured()) return stub('rachio', req, ['RACHIO_API_KEY'])

  try {
    if (path.endsWith('/debug')) return ok(await rachioDebug())
    if (req.method !== 'POST') return fail('POST only', 405)
    const { action, zoneId, durationSeconds, quickId } = await readJson<{ action?: string; zoneId?: string; durationSeconds?: number; quickId?: string }>(req)
    await rachioCommand(String(action), String(zoneId ?? ''), durationSeconds, quickId)
    return ok({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Rachio request failed'
    console.error('[rachio]', message)
    return fail(message, 502)
  }
}

export const config: Config = { path: ['/api/rachio/command', '/api/rachio/debug', '/api/rachio/webhook'] }
