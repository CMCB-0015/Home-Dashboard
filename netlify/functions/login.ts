// POST /api/login  { passcode }  → sets the session cookie if it matches.
// POST /api/logout                → clears it.
import type { Config } from '@netlify/functions'
import { ok, readJson } from './_shared/http.ts'
import { checkPasscode, sessionCookie, clearCookie, passcodeConfigured } from './_shared/auth.ts'

export default async (req: Request) => {
  if (req.method !== 'POST') return ok({ error: 'POST only' }, 405)
  const json = (body: unknown, status: number, cookie?: string) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { 'Set-Cookie': cookie } : {}) },
    })

  if (new URL(req.url).pathname.endsWith('/logout')) return json({ ok: true }, 200, clearCookie)
  if (!passcodeConfigured()) return json({ error: 'setup' }, 401)

  const { passcode } = await readJson<{ passcode?: string }>(req)
  if (typeof passcode === 'string' && checkPasscode(passcode.trim())) {
    return json({ ok: true }, 200, sessionCookie())
  }
  await new Promise((r) => setTimeout(r, 1500)) // slows down guessing
  return json({ error: 'wrong' }, 401)
}

export const config: Config = { path: ['/api/login', '/api/logout'] }
