// Passcode lock for the whole backend.
//
// You choose a passcode and save it in Netlify as PANEL_PASSCODE. Each device
// enters it once; the backend then gives that device a signed cookie that
// lasts a year. Every device-control and personal-data endpoint checks it.
// Changing the passcode signs out every device.

import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from './http.ts'

const COOKIE = 'panel_session'
const ONE_YEAR = 365 * 24 * 60 * 60

function key(): string | null {
  const pass = env('PANEL_PASSCODE')
  return pass ? `panel-v1:${pass}` : null
}

function sign(payload: string, k: string) {
  return createHmac('sha256', k).update(payload).digest('base64url')
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function passcodeConfigured(): boolean {
  return key() !== null
}

export function checkPasscode(attempt: string): boolean {
  const pass = env('PANEL_PASSCODE')
  return !!pass && safeEqual(attempt, pass)
}

export function sessionCookie(): string {
  const k = key()!
  const expires = String(Math.floor(Date.now() / 1000) + ONE_YEAR)
  return `${COOKIE}=${expires}.${sign(expires, k)}; Path=/; Max-Age=${ONE_YEAR}; HttpOnly; Secure; SameSite=Strict`
}

export const clearCookie = `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`

export function isAuthed(req: Request): boolean {
  const k = key()
  if (!k) return false // no passcode set → stay locked
  const raw = (req.headers.get('cookie') ?? '').split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`))
  if (!raw) return false
  const [expires, sig] = raw.slice(COOKIE.length + 1).split('.')
  if (!expires || !sig || Number(expires) * 1000 < Date.now()) return false
  return safeEqual(sig, sign(expires, k))
}

export function locked(): Response {
  return new Response(JSON.stringify({ error: 'locked', setup: !passcodeConfigured() }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}
