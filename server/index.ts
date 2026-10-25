// Panel's server. Runs on the Lenovo as a Home Assistant app.
//
// - Serves the dashboard pages (the built React app in dist/)
// - Answers the dashboard's /api/... requests
// - Streams live updates to every open screen (/api/stream)
//
// Endpoints (all need the passcode cookie except login and health):
//   GET  /api/health                  is the server up?
//   POST /api/login, /api/logout      passcode
//   GET  /api/home-state              everything the dashboard shows
//   GET  /api/stream                  the same, pushed again whenever anything changes
//   GET  /api/setup-check             names the dashboard found in Home Assistant, for fixing src/config/home.ts
//   GET  /api/ha-image?p=…            album art from Home Assistant
//   POST /api/lights/set | off | scene | bedtime
//   POST /api/climate/set
//   POST /api/sonos/command | preset | play | queue-jump · GET /api/sonos/queue
//   POST /api/tesla/command                       Tesla card and panels (Teslemetry)
//   GET  /api/calendar/range?start=&end=          Calendar events for another month
//   POST /api/vacuum/command                      Vacuum card and Map & rooms page (Roborock)
//   POST /api/sonos/preset-save | preset-rename | preset-delete   quick-play buttons saved from the Sonos page
//   POST /api/rachio/command          GET /api/rachio/debug

import http from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { ok, fail, readJson } from './http.ts'
import { isAuthed, locked, checkPasscode, sessionCookie, clearCookie, passcodeConfigured } from './auth.ts'
import { ha } from './ha.ts'
import { buildState, startBackgroundRefresh } from './state.ts'
import { setLights, allOff, activateScene, bedtimeCommand, lightNames, lightingState, type LightChange } from './lights.ts'
import { setClimate, thermostats } from './climate.ts'
import { sportsNotes, sportsEvents } from './sports.ts'
import { teslaCommand, teslaNotes } from './tesla.ts'
import { vacuumCommand, vacuumNotes } from './vacuum.ts'
import { calendarRangeEvents } from './calendar.ts'
import { sonosCommand, playPreset, playOn, getQueue, jumpToQueue, refreshFavorites, sonosNotes, savePreset, renamePreset, deletePreset } from './sonos.ts'
import { rachioCommand, rachioConfigured, rachioDebug, startRachioWatcher, pokeRachio, latestRachio, rachioError } from './rachio.ts'
import { calendarError } from './calendar.ts'
import { env } from './env.ts'

const PORT = Number(env('PANEL_PORT') ?? 8099)
const DIST = resolve(env('PANEL_DIST') ?? 'dist')

// ── Live updates ─────────────────────────────────────────────────────────
const streams = new Set<http.ServerResponse>()
let pushTimer: NodeJS.Timeout | null = null

/** Something changed: send fresh data to every open screen (at most a few times a second). */
function changed() {
  if (pushTimer || !streams.size) return
  pushTimer = setTimeout(() => {
    pushTimer = null
    const payload = `data: ${JSON.stringify(buildState())}\n\n`
    for (const res of streams) res.write(payload)
  }, 250)
}
setInterval(() => { for (const res of streams) res.write(': keep-alive\n\n') }, 25_000)

// ── Routes ───────────────────────────────────────────────────────────────
type Handler = (req: Request) => Promise<Response>

/** Run a command; reply ok, or with the reason it didn't work. */
const act = (fn: (body: any) => Promise<unknown>): Handler => async (req) => {
  if (req.method !== 'POST') return fail('POST only', 405)
  try {
    await fn(await readJson(req))
    return ok({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'That didn’t work'
    console.warn(`[${new URL(req.url).pathname}]`, message)
    return fail(message, 502)
  }
}

const notConnected = (what: string): Handler => async () => fail(`${what} isn't connected to the dashboard yet`, 409)

const routes: Record<string, Handler> = {
  '/api/home-state': async () => ok(buildState()),

  '/api/lights/set': act((b: LightChange) => setLights(b)),
  '/api/lights/off': act((b: { scope?: string }) => allOff(b.scope === 'all' ? 'all' : 'indoor')),
  '/api/lights/scene': act((b: { id?: string }) => activateScene(String(b.id))),
  '/api/lights/bedtime': act((b) => bedtimeCommand(b)),
  '/api/climate/set': act((b) => setClimate(b)),
  '/api/sonos/command': act((b) => sonosCommand(b)),
  '/api/sonos/preset': act((b: { id?: string }) => playPreset(String(b.id))),
  '/api/sonos/play': act((b: { favoriteId?: string; speakerIds?: string[]; shuffle?: boolean }) =>
    playOn(String(b.favoriteId), Array.isArray(b.speakerIds) ? b.speakerIds : [], { shuffle: typeof b.shuffle === 'boolean' ? b.shuffle : undefined })),
  '/api/sonos/preset-save': act(async (b) => { await savePreset(b); changed() }),
  '/api/sonos/preset-rename': act(async (b) => { await renamePreset(b); changed() }),
  '/api/sonos/preset-delete': act(async (b) => { await deletePreset(b); changed() }),
  '/api/sonos/queue-jump': act((b: { position?: number }) => jumpToQueue(Number(b.position))),
  '/api/sonos/queue': async () => {
    try { return ok(await getQueue()) } catch (e) { return fail(e instanceof Error ? e.message : 'Couldn\u2019t read the queue', 502) }
  },
  '/api/sonos/refresh': act(async () => { await refreshFavorites(); changed() }),

  '/api/rachio/command': act(async (b: { action?: string; zoneId?: string; durationSeconds?: number; quickId?: string }) => {
    if (!rachioConfigured()) throw new Error('Add your Rachio API key in the app settings')
    await rachioCommand(String(b.action), String(b.zoneId ?? ''), b.durationSeconds, b.quickId)
    pokeRachio()
  }),
  '/api/calendar/range': async (req) => {
    const q = new URL(req.url).searchParams
    try { return ok(await calendarRangeEvents(q.get('start') ?? '', q.get('end') ?? '')) } catch (e) { return fail(e instanceof Error ? e.message : 'Couldn’t read the calendar', 400) }
  },
  '/api/rachio/debug': async () => {
    if (!rachioConfigured()) return fail('No Rachio API key set', 409)
    try { return ok(await rachioDebug()) } catch (e) { return fail(e instanceof Error ? e.message : 'Rachio request failed', 502) }
  },

  '/api/setup-check': async () => ok({
    homeAssistant: ha.status,
    lights: lightNames(),
    lightsMatching: ha.status === 'connected' ? lightingState().lighting : null,
    thermostats: thermostats().map((t) => ({ id: t.id, name: t.name })),
    mediaPlayers: ha.all('media_player').map((p) => ({ id: p.entity_id, name: ha.name(p), platform: ha.platform(p.entity_id), state: p.state })),
    calendars: ha.all('calendar').map((c) => ({ id: c.entity_id, name: ha.name(c) })),
    calendarProblem: calendarError(),
    sonos: { notes: ha.status === 'connected' ? sonosNotes() : [], speakers: ha.all('media_player').filter((p) => ha.platform(p.entity_id) === 'sonos').map((p) => ({ id: p.entity_id, name: ha.name(p), state: p.state })) },
    tesla: ha.status === 'connected' ? teslaNotes() : null,
    vacuum: ha.status === 'connected' ? vacuumNotes() : null,
    sports: { notes: sportsNotes(), games: sportsEvents().length },
    rachio: { configured: rachioConfigured(), working: !!latestRachio(), problem: rachioError() },
  }),

  '/api/ha-image': async (req) => {
    const p = new URL(req.url).searchParams.get('p') ?? ''
    if (!/^\/api\/(media_player_proxy|image_proxy|camera_proxy)\//.test(p)) return fail('Not allowed', 400)
    try {
      const res = await ha.rest(p)
      if (!res.ok) return fail('Image not available', 404)
      return new Response(res.body, { headers: { 'Content-Type': res.headers.get('content-type') ?? 'image/jpeg', 'Cache-Control': 'private, max-age=300' } })
    } catch { return fail('Image not available', 404) }
  },

  '/api/vacuum/command': act((b) => vacuumCommand(b)),
  '/api/tesla/command': act((b) => teslaCommand(b)),
  '/api/eufy/guard-mode': notConnected('Eufy'),
  '/api/todoist/add': notConnected('Todoist'),
  '/api/todoist/toggle': notConnected('Todoist'),
}

async function login(req: Request): Promise<Response> {
  if (req.method !== 'POST') return fail('POST only', 405)
  const json = (body: unknown, status: number, cookie?: string) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...(cookie ? { 'Set-Cookie': cookie } : {}) } })
  if (new URL(req.url).pathname === '/api/logout') return json({ ok: true }, 200, clearCookie(req))
  if (!passcodeConfigured()) return json({ error: 'setup' }, 401)
  const { passcode } = await readJson<{ passcode?: string }>(req)
  if (typeof passcode === 'string' && checkPasscode(passcode.trim())) return json({ ok: true }, 200, sessionCookie(req))
  await new Promise((r) => setTimeout(r, 1500)) // slows down guessing
  return json({ error: 'wrong' }, 401)
}

async function handleApi(req: Request): Promise<Response> {
  const path = new URL(req.url).pathname
  if (path === '/api/health') return ok({ ok: true, homeAssistant: ha.status, time: new Date().toISOString() })
  if (path === '/api/login' || path === '/api/logout') return login(req)
  if (!isAuthed(req)) return locked()
  const route = routes[path]
  return route ? route(req) : fail('Not found', 404)
}

// ── The dashboard pages ──────────────────────────────────────────────────
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2',
}

function serveFile(res: http.ServerResponse, pathname: string) {
  let file = normalize(join(DIST, decodeURIComponent(pathname)))
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html') // app pages
  if (!existsSync(file)) { res.writeHead(503, { 'Content-Type': 'text/plain' }).end('The dashboard has not been built yet (npm run build).'); return }
  const hashed = pathname.startsWith('/assets/')
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  createReadStream(file).pipe(res)
}

// ── The server ───────────────────────────────────────────────────────────
function toRequest(req: http.IncomingMessage, body?: Buffer): Request {
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
  return new Request(`${proto}://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`, {
    method: req.method, headers, body: body && body.length ? new Uint8Array(body) : undefined,
  })
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://x')
    if (!url.pathname.startsWith('/api/')) return serveFile(res, url.pathname)

    if (url.pathname === '/api/stream') {
      if (!isAuthed(toRequest(req))) { res.writeHead(401).end(); return }
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
      res.write(`data: ${JSON.stringify(buildState())}\n\n`)
      streams.add(res)
      req.on('close', () => streams.delete(res))
      return
    }

    const chunks: Buffer[] = []
    let size = 0
    for await (const c of req) { size += c.length; if (size > 100_000) { res.writeHead(413).end(); return } chunks.push(c as Buffer) }
    const reply = await handleApi(toRequest(req, Buffer.concat(chunks)))
    const headers: Record<string, string | string[]> = {}
    reply.headers.forEach((v, k) => { headers[k] = v })
    const cookie = reply.headers.getSetCookie?.()
    if (cookie?.length) headers['set-cookie'] = cookie
    res.writeHead(reply.status, headers)
    if (reply.body) for await (const chunk of reply.body as any) res.write(chunk)
    res.end()
  } catch (e) {
    console.error('[server]', e)
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Something went wrong on the dashboard server' }))
  }
})

ha.onChange(changed)
ha.start()
startRachioWatcher(changed)
startBackgroundRefresh(changed)

server.listen(PORT, () => {
  console.log(`[panel] dashboard running on port ${PORT}`)
  if (!passcodeConfigured()) console.warn('[panel] no passcode set — set one in the app Configuration tab (or PANEL_PASSCODE in .env)')
})
