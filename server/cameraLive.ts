// Live view: passes WebRTC set-up messages between the dashboard and Home
// Assistant. The video itself flows straight from Home Assistant (its built-in
// go2rtc, on the eufy bridge's RTSP restream) to the tablet over the home network.
//
//   POST /api/cameras/live/start      { camera, offer }      → { id, answer?, candidates, iceServers }
//   POST /api/cameras/live/candidate  { id, candidate }      the tablet's network routes
//   GET  /api/cameras/live/poll?id=   → { answer?, candidates, ended?, error? }   (also keeps it alive)
//   POST /api/cameras/live/stop       { id }
//
// Battery cameras: every stream is closed when the pop-up closes, when the
// screen stops checking in for 30 seconds (tablet asleep, page closed), and
// after 10 minutes at most.

import { randomUUID } from 'node:crypto'
import { ha } from './ha.ts'

const MAX_MS = 10 * 60_000
const IDLE_MS = 30_000

interface Session {
  id: string
  camera: string
  sub: number | null
  haSession: string | null
  answer: string | null
  candidates: unknown[]
  pendingOut: unknown[]
  error: string | null
  ended: boolean
  started: number
  seen: number
  waiters: (() => void)[]
}

const sessions = new Map<string, Session>()

function wake(s: Session) { const w = s.waiters; s.waiters = []; for (const f of w) f() }

function close(s: Session, why?: string) {
  if (s.ended) return
  s.ended = true
  if (why && !s.error) s.error = why
  if (s.sub !== null) ha.unsubscribe(s.sub)
  wake(s)
  setTimeout(() => sessions.delete(s.id), 60_000)
}

setInterval(() => {
  const now = Date.now()
  for (const s of sessions.values()) {
    if (s.ended) continue
    if (now - s.started > MAX_MS) close(s, 'Live view stops after 10 minutes to save the camera’s battery')
    else if (now - s.seen > IDLE_MS) close(s)
  }
}, 5_000)

/** Home Assistant's candidate shape → the browser's RTCIceCandidateInit */
function toBrowser(c: any) {
  if (typeof c === 'string') return { candidate: c, sdpMLineIndex: 0 }
  return { candidate: c?.candidate ?? '', sdpMid: c?.sdpMid ?? c?.sdp_mid ?? null, sdpMLineIndex: c?.sdpMLineIndex ?? c?.sdp_m_line_index ?? 0 }
}

async function sendCandidate(s: Session, candidate: any) {
  if (!s.haSession) { s.pendingOut.push(candidate); return }
  await ha.command({ type: 'camera/webrtc/candidate', entity_id: s.camera, session_id: s.haSession, candidate }).catch((e) => {
    console.warn('[live view] candidate refused:', e instanceof Error ? e.message : e)
  })
}

function waitFor(s: Session, ms: number, done: () => boolean) {
  return new Promise<void>((resolve) => {
    if (done()) return resolve()
    const t = setTimeout(resolve, ms)
    const check = () => { if (done()) { clearTimeout(t); resolve() } else s.waiters.push(check) }
    s.waiters.push(check)
  })
}

export async function iceServers(camera: string): Promise<unknown[]> {
  try {
    const r = await ha.command<any>({ type: 'camera/webrtc/get_client_config', entity_id: camera })
    return Array.isArray(r?.configuration?.iceServers) ? r.configuration.iceServers : []
  } catch { return [] }
}

export async function liveStart(b: { camera?: string; offer?: string }) {
  const camera = String(b.camera ?? '')
  if (!/^camera\.[a-z0-9_]+$/.test(camera) || !ha.states.has(camera)) throw new Error('Unknown camera')
  if (typeof b.offer !== 'string' || !b.offer.startsWith('v=')) throw new Error('Bad offer')
  // One stream per camera: a second screen opening the same camera ends the first
  for (const s of sessions.values()) if (s.camera === camera && !s.ended) close(s)
  const s: Session = {
    id: randomUUID(), camera, sub: null, haSession: null, answer: null, candidates: [], pendingOut: [],
    error: null, ended: false, started: Date.now(), seen: Date.now(), waiters: [],
  }
  sessions.set(s.id, s)
  s.sub = await ha.subscribe({ type: 'camera/webrtc/offer', entity_id: camera, offer: b.offer }, (ev: any) => {
    if (ev?.type === 'session') {
      s.haSession = String(ev.session_id)
      const out = s.pendingOut; s.pendingOut = []
      for (const c of out) void sendCandidate(s, c)
    } else if (ev?.type === 'answer') s.answer = String(ev.answer)
    else if (ev?.type === 'candidate') s.candidates.push(toBrowser(ev.candidate))
    else if (ev?.type === 'error') { s.error = String(ev.message ?? 'The camera didn’t start'); close(s) }
    wake(s)
  })
  // A battery camera can take several seconds to wake
  await waitFor(s, 20_000, () => !!s.answer || s.ended)
  if (!s.answer && !s.ended) close(s, 'The camera didn’t answer. It may be asleep or out of Wi-Fi range; try again.')
  return { id: s.id, answer: s.answer, candidates: s.candidates.splice(0), error: s.error }
}

export async function liveCandidate(b: { id?: string; candidate?: unknown }) {
  const s = sessions.get(String(b.id))
  if (!s || s.ended) return
  s.seen = Date.now()
  if (b.candidate) await sendCandidate(s, b.candidate)
}

/** Waits up to 4 s for news, so new routes reach the tablet quickly without hammering */
export async function livePoll(id: string) {
  const s = sessions.get(id)
  if (!s) return { ended: true, candidates: [] }
  s.seen = Date.now()
  if (!s.ended && !s.candidates.length) await waitFor(s, 4_000, () => s.candidates.length > 0 || s.ended)
  return { candidates: s.candidates.splice(0), ended: s.ended, error: s.error }
}

export function liveStop(b: { id?: string }) {
  const s = sessions.get(String(b.id))
  if (s) close(s)
}
