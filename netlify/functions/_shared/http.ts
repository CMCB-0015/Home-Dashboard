// Small helpers every backend function uses.

// Same-origin only: the dashboard and backend share one address, so no other
// website is allowed to call these endpoints from a browser.
const CORS = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } })

export const fail = (message: string, status = 500) => ok({ error: message }, status)

export const preflight = () => new Response(null, { status: 204, headers: CORS })

/** Read a setting from Netlify's environment variables (or your local .env). */
export const env = (name: string): string | undefined => process.env[name] || undefined

/** Read a body from a POST without crashing on bad input. */
export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try { return (await req.json()) as T } catch { return {} as T }
}

/**
 * A placeholder for a service that isn't connected yet: it records what was
 * asked and replies "ok", so dashboard buttons are safe to press.
 */
export async function stub(service: string, req: Request, needs: string[], open = false) {
  if (req.method === 'OPTIONS') return preflight()
  if (!open) {
    const { isAuthed, locked } = await import('./auth.ts')
    if (!isAuthed(req)) return locked()
  }
  const body = req.method === 'POST' ? await readJson(req) : {}
  const missing = needs.filter((n) => !env(n))
  console.log(`[${service}] ${new URL(req.url).pathname}`, JSON.stringify(body), missing.length ? `(not connected — missing ${missing.join(', ')})` : '')
  return ok({ ok: true, connected: missing.length === 0, service })
}
